import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Scan,
  StretchHorizontal,
} from "lucide-react";


interface Props {
  blob: Blob;
  initialPage?: number;
  highlight?: string;
  onPageChange?: (page: number) => void;
}

// Loaded lazily inside effects so pdfjs never enters the SSR bundle.
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  return pdfjs;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfDoc = any;
type FitMode = "custom" | "width" | "page";

const MIN_SCALE = 0.4;
const MAX_SCALE = 4;

export function PdfViewer({ blob, initialPage = 1, highlight, onPageChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const pinchStateRef = useRef<{ startDist: number; startScale: number } | null>(null);

  const [pdf, setPdf] = useState<PdfDoc | null>(null);
  const [page, setPage] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [scale, setScale] = useState(1.2);
  const [fitMode, setFitMode] = useState<FitMode>("width");
  const [numPages, setNumPages] = useState(0);
  const [pageText, setPageText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const savedScrollRef = useRef<{ top: number; left: number } | null>(null);

  // Enter/exit fullscreen preserving page, zoom and scroll position.
  const enterFullscreen = useCallback(() => {
    const el = containerRef.current;
    savedScrollRef.current = el
      ? { top: el.scrollTop, left: el.scrollLeft }
      : null;
    setFullscreen(true);
    if (typeof history !== "undefined") {
      history.pushState({ pdfFullscreen: true }, "");
    }
    // Native Fullscreen API is only a progressive enhancement.
    const root = rootRef.current;
    if (root?.requestFullscreen) {
      root.requestFullscreen().catch(() => {});
    }
  }, []);

  const exitFullscreen = useCallback((fromPopstate = false) => {
    setFullscreen(false);
    if (typeof document !== "undefined" && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    if (!fromPopstate && typeof history !== "undefined") {
      if (history.state?.pdfFullscreen) history.back();
    }
  }, []);

  // Android back button / gesture closes fullscreen first.
  useEffect(() => {
    if (!fullscreen) return;
    const onPop = () => exitFullscreen(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitFullscreen();
    };
    const onFsChange = () => {
      if (!document.fullscreenElement && fullscreen) {
        // native exit (system gesture) — keep internal overlay in sync
      }
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, [fullscreen, exitFullscreen]);

  // Restore scroll position after layout switches.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const saved = savedScrollRef.current;
    const id = requestAnimationFrame(() => {
      if (saved) {
        el.scrollTop = saved.top;
        el.scrollLeft = saved.left;
      }
      savedScrollRef.current = el
        ? { top: el.scrollTop, left: el.scrollLeft }
        : null;
    });
    return () => cancelAnimationFrame(id);
  }, [fullscreen]);


  // Open document once per blob.
  useEffect(() => {
    let cancelled = false;
    setPdf(null);
    setError(null);
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const buf = await blob.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buf }).promise;
        if (cancelled) return;
        setPdf(doc);
        setNumPages(doc.numPages);
        const start = Math.min(Math.max(1, initialPage), doc.numPages);
        setPage(start);
        setPageInput(String(start));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao abrir PDF");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob, initialPage]);

  // Notify parent on page change and keep input in sync.
  useEffect(() => {
    setPageInput(String(page));
    onPageChange?.(page);
  }, [page, onPageChange]);

  // Compute an effective scale given fit mode + container width.
  const computeScale = useCallback(
    async (mode: FitMode, current: number) => {
      if (mode === "custom" || !pdf || !containerRef.current) return current;
      const p = await pdf.getPage(page);
      const vp = p.getViewport({ scale: 1 });
      const el = containerRef.current;
      const availW = el.clientWidth - 24; // padding buffer
      const availH = el.clientHeight - 24;
      if (mode === "width") return Math.max(MIN_SCALE, Math.min(MAX_SCALE, availW / vp.width));
      // page: fit both dimensions
      return Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, Math.min(availW / vp.width, availH / vp.height)),
      );
    },
    [pdf, page],
  );

  // Recalculate scale on fit mode or resize.
  useEffect(() => {
    if (!pdf) return;
    if (fitMode === "custom") return;
    let cancelled = false;
    const apply = async () => {
      const s = await computeScale(fitMode, scale);
      if (!cancelled) setScale(s);
    };
    apply();
    const onResize = () => apply();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [pdf, fitMode, page, computeScale, scale]);

  // Render current page + prefetch neighbours (virtualization: only 1 in DOM).
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    setLoadingPage(true);

    (async () => {
      try {
        renderTaskRef.current?.cancel();

        const p = await pdf.getPage(page);
        if (cancelled) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = p.getViewport({ scale: scale * dpr });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
        const task = p.render({ canvasContext: ctx, viewport, canvas });
        renderTaskRef.current = task;
        await task.promise;
        if (cancelled) return;

        const content = await p.getTextContent();
        if (cancelled) return;
        setPageText(
          content.items.map((it: { str?: string }) => it.str ?? "").join(" "),
        );
        setLoadingPage(false);

        // Prefetch neighbours (pdfjs caches them internally; releases old ones).
        if (page + 1 <= numPages) pdf.getPage(page + 1).catch(() => {});
        if (page - 1 >= 1) pdf.getPage(page - 1).catch(() => {});
        // Free memory of pages we're unlikely to revisit soon.
        pdf.cleanup?.();
      } catch (e) {
        // RenderingCancelledException — ignore
        if (!cancelled && e && (e as { name?: string }).name !== "RenderingCancelledException") {
          setError(e instanceof Error ? e.message : "Falha ao renderizar página");
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [pdf, page, scale, numPages]);

  // Touch pinch-zoom.
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const [a, b] = [e.touches[0], e.touches[1]];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        pinchStateRef.current = { startDist: d, startScale: scale };
      }
    },
    [scale],
  );
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStateRef.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const { startDist, startScale } = pinchStateRef.current;
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, startScale * (d / startDist)));
      setFitMode("custom");
      setScale(next);
      e.preventDefault();
    }
  }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchStateRef.current = null;
  }, []);

  const goto = useCallback(
    (n: number) => {
      if (!numPages) return;
      const clamped = Math.max(1, Math.min(numPages, Math.floor(n)));
      setPage(clamped);
    },
    [numPages],
  );

  const highlightSnippet = useMemo(() => {
    if (!highlight || !pageText) return null;
    return <HighlightedSnippet text={pageText} term={highlight} />;
  }, [highlight, pageText]);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* Toolbar */}
      <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border bg-card p-2">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => goto(page - 1)}
            disabled={page <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => goto(page + 1)}
            disabled={page >= numPages}
            aria-label="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <form
          className="flex items-center gap-1 text-sm tabular-nums"
          onSubmit={(e) => {
            e.preventDefault();
            const n = parseInt(pageInput, 10);
            if (!Number.isNaN(n)) goto(n);
          }}
        >
          <Input
            aria-label="Ir para página"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
            onBlur={() => {
              const n = parseInt(pageInput, 10);
              if (!Number.isNaN(n)) goto(n);
              else setPageInput(String(page));
            }}
            className="h-8 w-14 px-2 text-center"
          />
          <span className="text-muted-foreground">/ {numPages || "…"}</span>
        </form>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant={fitMode === "width" ? "default" : "outline"}
            onClick={() => setFitMode("width")}
            title="Ajustar à largura"
            aria-label="Ajustar à largura"
          >
            <StretchHorizontal className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={fitMode === "page" ? "default" : "outline"}
            onClick={() => setFitMode("page")}
            title="Ajustar página inteira"
            aria-label="Ajustar página inteira"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFitMode("custom");
              setScale((s) => Math.max(MIN_SCALE, s - 0.2));
            }}
            aria-label="Reduzir zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-[3ch] text-center text-xs text-muted-foreground tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFitMode("custom");
              setScale((s) => Math.min(MAX_SCALE, s + 0.2));
            }}
            aria-label="Aumentar zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {highlight && (
        <div className="rounded-md border bg-card p-3 text-sm">
          <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Trecho encontrado
          </div>
          {highlightSnippet ?? (
            <span className="text-muted-foreground">Carregando trecho…</span>
          )}
        </div>
      )}

      {/* Canvas viewport (virtualization: apenas página atual no DOM) */}
      <div
        ref={containerRef}
        className="relative max-h-[78vh] min-h-[400px] w-full overflow-auto rounded-md border bg-muted/40 p-3 touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {loadingPage && (
          <div className="pointer-events-none absolute right-3 top-3 rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground shadow">
            Renderizando…
          </div>
        )}
        <canvas ref={canvasRef} className="mx-auto block bg-white shadow" />
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Página {page} de {numPages || "…"}
      </div>
    </div>
  );
}

function HighlightedSnippet({ text, term }: { text: string; term: string }) {
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tokens = norm(term).split(/\s+/).filter((t) => t.length > 2);
  const nText = norm(text);
  let idx = -1;
  for (const t of tokens) {
    idx = nText.indexOf(t);
    if (idx >= 0) break;
  }
  const radius = 200;
  const start = idx < 0 ? 0 : Math.max(0, idx - radius);
  const end = idx < 0 ? Math.min(text.length, 500) : Math.min(text.length, idx + radius);
  const slice = text.slice(start, end);
  if (idx < 0) return <span className="text-muted-foreground">{slice}…</span>;

  const re = new RegExp(`(${tokens.map(escapeRe).join("|")})`, "gi");
  const parts = slice.split(re);
  return (
    <span className="text-foreground">
      {start > 0 && "…"}
      {parts.map((p, i) =>
        tokens.includes(norm(p)) ? (
          <mark key={i} className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-500/40">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
      {end < text.length && "…"}
    </span>
  );
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
