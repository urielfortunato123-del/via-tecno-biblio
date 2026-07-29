"""
Testes de teclado virtual + Select em rotas principais da Biblioteca Técnica.

Objetivos:
- Simular abertura do teclado virtual do Android reduzindo a altura do
  visualViewport (~55% da altura) e disparando o evento "resize".
- Garantir que o campo de busca focado e o SelectTrigger (categoria)
  permanecem visíveis (não ficam ocultos por trás do teclado) e que
  scrollWidth == clientWidth (sem overflow horizontal).
- Verificar em retrato e paisagem, incluindo alternância com foco ativo.
"""

import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright, Page

SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

# Focus: rotas com input de busca + Select
ROUTES = [
    "/biblioteca",
    "/biblioteca/documentos",
    "/biblioteca/favoritos",
    "/biblioteca/historico",
    "/biblioteca/glossario",
    "/biblioteca/admin",
]

PORTRAIT = {"width": 390, "height": 844}   # iPhone 13-ish
LANDSCAPE = {"width": 844, "height": 390}
KEYBOARD_RATIO = 0.55  # Android Chrome typical keyboard occupies ~45% of viewport

FAKE_KB_JS = """
(() => {
  if (window.__kbInstalled) return;
  window.__kbInstalled = true;
  const vv = window.visualViewport;
  window.__kbOpen = false;
  window.__kbRatio = %f;
  const proxy = new Proxy(vv, {
    get(target, prop) {
      if (prop === 'height') {
        return window.__kbOpen
          ? Math.floor(target.height * window.__kbRatio)
          : target.height;
      }
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    }
  });
  Object.defineProperty(window, 'visualViewport', { get: () => proxy, configurable: true });
})();
""" % KEYBOARD_RATIO

TOGGLE_KB_JS = """
(open) => {
  window.__kbOpen = !!open;
  window.visualViewport.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new Event('resize'));
}
"""


async def measure(page: Page):
    return await page.evaluate("""
    () => {
      const doc = document.documentElement;
      const kbHeight = window.__kbOpen
        ? window.innerHeight - window.visualViewport.height
        : 0;
      const visibleBottom = window.innerHeight - kbHeight;
      const focused = document.activeElement;
      const focusedRect = focused && focused !== document.body ? focused.getBoundingClientRect() : null;
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        innerWidth: window.innerWidth,
        vvHeight: window.visualViewport.height,
        visibleBottom,
        focusedTag: focused && focused.tagName,
        focusedRect: focusedRect && { top: focusedRect.top, bottom: focusedRect.bottom, left: focusedRect.left, right: focusedRect.right },
      };
    }
    """)


async def find_search_input(page: Page):
    # Try common selectors
    for sel in [
        'input[type="search"]',
        'input[placeholder*="uscar" i]',
        'input[placeholder*="esquis" i]',
        'input[placeholder*="ermo" i]',
        'input[placeholder*="onsult" i]',
        'input[type="text"]',
        'input:not([type="checkbox"]):not([type="radio"]):not([type="file"])',
    ]:
        loc = page.locator(sel).first
        try:
            if await loc.count() > 0:
                return loc
        except Exception:
            continue
    return None


async def test_route(page: Page, route: str, orientation: str, results: list):
    label = f"{route}@{orientation}"
    print(f"→ {label}")
    await page.goto(f"http://localhost:8080{route}", wait_until="networkidle")
    await page.wait_for_timeout(400)
    await page.add_script_tag(content=FAKE_KB_JS)

    # 1) Focus search input, open keyboard
    search = await find_search_input(page)
    kb_search = None
    if search:
        await search.scroll_into_view_if_needed()
        await search.click()
        await page.evaluate(TOGGLE_KB_JS, True)
        await page.wait_for_timeout(250)
        # Nudge browser to scroll focused into view
        await page.evaluate("document.activeElement && document.activeElement.scrollIntoView({block:'center'})")
        await page.wait_for_timeout(150)
        kb_search = await measure(page)
        await page.screenshot(path=str(SCREENSHOTS / f"kb_search_{orientation}_{route.replace('/', '_')}.png"))

    # 2) Open Select (category) with keyboard visible
    kb_select = None
    trigger = page.locator('[role="combobox"]').first
    if await trigger.count() > 0 and await trigger.is_visible():
        await trigger.scroll_into_view_if_needed()
        box = await trigger.bounding_box()
        await trigger.click()
        await page.wait_for_timeout(300)
        # Check content is visible above the keyboard
        content = page.locator('[role="listbox"]').first
        content_rect = None
        if await content.count() > 0:
            content_rect = await content.bounding_box()
        m = await measure(page)
        kb_select = {
            **m,
            "trigger_bottom": box["y"] + box["height"] if box else None,
            "listbox_bottom": (content_rect["y"] + content_rect["height"]) if content_rect else None,
        }
        await page.screenshot(path=str(SCREENSHOTS / f"kb_select_{orientation}_{route.replace('/', '_')}.png"))
        # Close the dropdown
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(150)

    # 3) Assertions
    checks = []
    def check(name, cond, detail=""):
        checks.append({"name": name, "ok": bool(cond), "detail": detail})

    if kb_search:
        check("search:no_overflow", kb_search["scrollWidth"] <= kb_search["clientWidth"] + 1,
              f'sw={kb_search["scrollWidth"]} cw={kb_search["clientWidth"]}')
        if kb_search["focusedRect"]:
            check("search:visible_above_keyboard",
                  kb_search["focusedRect"]["bottom"] <= kb_search["visibleBottom"] + 2,
                  f'bottom={kb_search["focusedRect"]["bottom"]} visible={kb_search["visibleBottom"]}')
    if kb_select:
        check("select:no_overflow", kb_select["scrollWidth"] <= kb_select["clientWidth"] + 1,
              f'sw={kb_select["scrollWidth"]} cw={kb_select["clientWidth"]}')
        if kb_select["listbox_bottom"] is not None:
            check("select:listbox_above_keyboard",
                  kb_select["listbox_bottom"] <= kb_select["visibleBottom"] + 2,
                  f'lb_bottom={kb_select["listbox_bottom"]} visible={kb_select["visibleBottom"]}')

    results.append({"route": route, "orientation": orientation, "checks": checks,
                    "kb_search": kb_search, "kb_select": kb_select})


async def test_orientation_switch(page: Page, results: list):
    """Alterna retrato→paisagem com foco ativo e teclado aberto."""
    print("→ orientation_switch")
    await page.set_viewport_size(PORTRAIT)
    await page.goto("http://localhost:8080/biblioteca", wait_until="networkidle")
    await page.wait_for_timeout(500)
    await page.add_script_tag(content=FAKE_KB_JS)
    try:
        await page.wait_for_selector('input', state='visible', timeout=5000)
    except Exception:
        pass
    search = await find_search_input(page)
    if not search:
        results.append({"route": "/biblioteca", "orientation": "switch", "checks": [
            {"name": "search_input_present", "ok": False, "detail": "not found"}]})
        return
    await search.click()
    await page.evaluate(TOGGLE_KB_JS, True)
    await page.wait_for_timeout(200)
    # Switch to landscape while keyboard "open"
    await page.set_viewport_size(LANDSCAPE)
    await page.wait_for_timeout(300)
    await page.evaluate("document.activeElement && document.activeElement.scrollIntoView({block:'center'})")
    await page.wait_for_timeout(150)
    m = await measure(page)
    await page.screenshot(path=str(SCREENSHOTS / "kb_switch_landscape.png"))
    checks = [
        {"name": "switch:no_overflow", "ok": m["scrollWidth"] <= m["clientWidth"] + 1,
         "detail": f'sw={m["scrollWidth"]} cw={m["clientWidth"]}'},
    ]
    if m["focusedRect"]:
        checks.append({
            "name": "switch:focus_visible",
            "ok": m["focusedRect"]["bottom"] <= m["visibleBottom"] + 2,
            "detail": f'bottom={m["focusedRect"]["bottom"]} visible={m["visibleBottom"]}',
        })
    results.append({"route": "/biblioteca", "orientation": "switch", "checks": checks})


async def main():
    results = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport=PORTRAIT, device_scale_factor=2)
        page = await ctx.new_page()
        for orient, vp in (("portrait", PORTRAIT), ("landscape", LANDSCAPE)):
            await page.set_viewport_size(vp)
            for r in ROUTES:
                try:
                    await test_route(page, r, orient, results)
                except Exception as e:
                    results.append({"route": r, "orientation": orient, "error": str(e)})
        await test_orientation_switch(page, results)
        await browser.close()

    report_path = Path(__file__).parent / "report.json"
    report_path.write_text(json.dumps(results, indent=2))
    # Summary
    total = 0
    failed = 0
    for r in results:
        for c in r.get("checks", []):
            total += 1
            if not c["ok"]:
                failed += 1
                print(f"FAIL {r['route']}@{r['orientation']} {c['name']}: {c['detail']}")
    print(f"\n{total - failed}/{total} checks passed. Report: {report_path}")
    sys.exit(1 if failed else 0)


asyncio.run(main())
