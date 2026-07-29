import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

interface Props {
  blob: Blob;
  initialPage?: number;
  highlight?: string;
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

export function PdfViewer({ blob, initialPage = 1, highlight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PdfDoc | null>(null);
  const [page, setPage] = useState(initialPage);
  const [scale, setScale] = useState(1.2);
  const [numPages, setNumPages] = useState(0);
  const [pageText, setPageText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const buf = await blob.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buf }).promise;
        if (cancelled) return;
        setPdf(doc);
        setNumPages(doc.numPages);
        setPage(Math.min(Math.max(1, initialPage), doc.numPages));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao abrir PDF");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob, initialPage]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      const p = await pdf.getPage(page);
      if (cancelled) return;
      const viewport = p.getViewport({ scale });
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await p.render({ canvasContext: ctx, viewport, canvas }).promise;
      const content = await p.getTextContent();
      setPageText(
        content.items
          .map((it: { str?: string }) => it.str ?? "")
          .join(" "),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, page, scale]);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm tabular-nums">
          Página {page} / {numPages || "…"}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPage((p) => Math.min(numPages, p + 1))}
          disabled={page >= numPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <Button size="sm" variant="outline" onClick={() => setScale((s) => Math.min(3, s + 0.2))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="max-h-[75vh] overflow-auto rounded-md border bg-muted/40 p-3">
        <canvas ref={canvasRef} className="mx-auto shadow" />
      </div>
      {highlight && pageText && (
        <div className="rounded-md border bg-card p-3 text-sm">
          <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Trecho da página
          </div>
          <HighlightedSnippet text={pageText} term={highlight} />
        </div>
      )}
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
