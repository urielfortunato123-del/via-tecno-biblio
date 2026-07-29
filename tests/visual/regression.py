#!/usr/bin/env python3
"""
Testes de regressão visual (mobile) — Biblioteca Técnica / Via Norma.

Objetivos:
1. Detectar rolagem horizontal (overflow) em qualquer rota principal.
2. Detectar elementos individuais que excedem a largura do viewport.
3. Comparar screenshots atuais com uma baseline (snapshots) e sinalizar
   diferenças visuais acima do limiar configurado.

Uso:
    # 1ª execução (cria baseline)
    python tests/visual/regression.py --update

    # execuções seguintes (compara com baseline)
    python tests/visual/regression.py

Requisitos: dev server rodando em http://localhost:8080 (Playwright + Pillow).
Saída: código 0 se OK, 1 se houver regressão. Diffs em tests/visual/diff/.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:8080"

# Rotas cobertas pelo teste. Foco na Biblioteca Técnica + shell.
ROUTES: list[tuple[str, str]] = [
    ("home", "/"),
    ("biblioteca", "/biblioteca"),
    ("biblioteca-documentos", "/biblioteca/documentos"),
    ("biblioteca-favoritos", "/biblioteca/favoritos"),
    ("biblioteca-historico", "/biblioteca/historico"),
    ("biblioteca-glossario", "/biblioteca/glossario"),
    ("biblioteca-admin", "/biblioteca/admin"),
    ("inspecao", "/inspecao"),
    ("relatorios", "/relatorios"),
]

# Viewports mobile em retrato e paisagem (largura, altura).
VIEWPORTS: list[tuple[str, int, int]] = [
    ("mobile-portrait-360", 360, 800),
    ("mobile-portrait-390", 390, 844),
    ("mobile-landscape-667", 667, 375),
    ("mobile-landscape-844", 844, 390),
]

# Tolerância: proporção máxima de pixels diferentes (0..1) para considerar OK.
PIXEL_DIFF_THRESHOLD = 0.02  # 2%

ROOT = Path(__file__).parent
BASELINE_DIR = ROOT / "baseline"
CURRENT_DIR = ROOT / "current"
DIFF_DIR = ROOT / "diff"
REPORT_PATH = ROOT / "report.json"


async def measure_overflow(page: Any) -> dict[str, Any]:
    """Retorna métricas de overflow do documento e elementos maiores que o viewport."""
    return await page.evaluate(
        """
        () => {
          const docSw = document.documentElement.scrollWidth;
          const docCw = document.documentElement.clientWidth;
          const bodySw = document.body.scrollWidth;
          const isHScrollable = (el) => {
            const s = getComputedStyle(el);
            const ov = s.overflowX;
            return (ov === 'auto' || ov === 'scroll') && el.scrollWidth > el.clientWidth + 1;
          };
          const insideHScroll = (el) => {
            let p = el.parentElement;
            while (p && p !== document.documentElement) {
              if (isHScrollable(p)) return true;
              p = p.parentElement;
            }
            return false;
          };
          const overflowing = [];
          const all = document.querySelectorAll('body *');
          for (const el of all) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            // Ignora elementos dentro de um container com rolagem horizontal
            // intencional (ex.: tabs roláveis, carrosséis).
            if (insideHScroll(el)) continue;
            if (r.right > docCw + 1) {
              overflowing.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className && typeof el.className === 'string')
                  ? el.className.slice(0, 120) : '',
                right: Math.round(r.right),
                width: Math.round(r.width),
              });
              if (overflowing.length >= 5) break;
            }
          }
          return { docSw, docCw, bodySw, overflowing };
        }
        """
    )


def compare_images(baseline: Path, current: Path, diff_out: Path) -> float:
    """Retorna a proporção de pixels diferentes (0..1). Salva imagem de diff."""
    a = Image.open(baseline).convert("RGB")
    b = Image.open(current).convert("RGB")
    if a.size != b.size:
        # Dimensões diferentes = regressão total.
        b_resized = b.resize(a.size)
        diff = ImageChops.difference(a, b_resized)
        diff.save(diff_out)
        return 1.0
    diff = ImageChops.difference(a, b)
    bbox = diff.getbbox()
    if bbox is None:
        return 0.0
    # Conta pixels não-zero.
    hist = diff.convert("L").point(lambda p: 255 if p > 8 else 0).histogram()
    changed = hist[-1]
    total = a.size[0] * a.size[1]
    diff.save(diff_out)
    return changed / total


async def run(update_baseline: bool) -> int:
    BASELINE_DIR.mkdir(parents=True, exist_ok=True)
    CURRENT_DIR.mkdir(parents=True, exist_ok=True)
    DIFF_DIR.mkdir(parents=True, exist_ok=True)

    failures: list[dict[str, Any]] = []
    report: list[dict[str, Any]] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            for vp_name, w, h in VIEWPORTS:
                ctx = await browser.new_context(
                    viewport={"width": w, "height": h},
                    device_scale_factor=2,
                )
                page = await ctx.new_page()
                for route_name, route in ROUTES:
                    key = f"{vp_name}__{route_name}"
                    url = f"{BASE_URL}{route}"
                    try:
                        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                        await page.wait_for_timeout(600)  # deixa fontes/estilos assentarem
                    except Exception as e:
                        failures.append({"key": key, "reason": f"navigation: {e}"})
                        continue

                    metrics = await measure_overflow(page)
                    overflow_doc = metrics["docSw"] > metrics["docCw"]
                    overflow_elems = metrics["overflowing"]

                    current_png = CURRENT_DIR / f"{key}.png"
                    await page.screenshot(path=str(current_png))

                    baseline_png = BASELINE_DIR / f"{key}.png"
                    diff_ratio: float | None = None
                    if update_baseline or not baseline_png.exists():
                        # Cria/atualiza baseline.
                        current_png.replace(baseline_png)
                        current_png = baseline_png  # apenas para o relatório
                    else:
                        diff_png = DIFF_DIR / f"{key}.png"
                        diff_ratio = compare_images(baseline_png, current_png, diff_png)

                    entry = {
                        "key": key,
                        "route": route,
                        "viewport": [w, h],
                        "metrics": metrics,
                        "diff_ratio": diff_ratio,
                    }
                    report.append(entry)

                    if overflow_doc:
                        failures.append({
                            "key": key,
                            "reason": "document overflow",
                            "docSw": metrics["docSw"],
                            "docCw": metrics["docCw"],
                        })
                    if overflow_elems:
                        failures.append({
                            "key": key,
                            "reason": "element overflow",
                            "elements": overflow_elems,
                        })
                    if diff_ratio is not None and diff_ratio > PIXEL_DIFF_THRESHOLD:
                        failures.append({
                            "key": key,
                            "reason": "visual diff",
                            "diff_ratio": round(diff_ratio, 4),
                            "threshold": PIXEL_DIFF_THRESHOLD,
                        })
                await ctx.close()
        finally:
            await browser.close()

    REPORT_PATH.write_text(json.dumps(
        {"failures": failures, "results": report}, indent=2, ensure_ascii=False,
    ))

    print("\n=== Relatório de Regressão Visual ===")
    print(f"Rotas x Viewports testados: {len(report)}")
    print(f"Falhas: {len(failures)}")
    if failures:
        for f in failures:
            print(" -", json.dumps(f, ensure_ascii=False))
        print(f"\nRelatório completo: {REPORT_PATH}")
        print(f"Diffs em: {DIFF_DIR}")
        return 1
    print("Tudo OK — sem overflow horizontal e sem regressão visual.")
    if update_baseline:
        print(f"Baseline atualizada em: {BASELINE_DIR}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--update", action="store_true",
        help="Atualiza (ou cria) a baseline de screenshots.",
    )
    args = parser.parse_args()
    sys.exit(asyncio.run(run(update_baseline=args.update)))


if __name__ == "__main__":
    main()
