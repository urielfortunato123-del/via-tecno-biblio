// PDF text extraction using pdf.js. Browser-only — lazy-loaded.

export interface ExtractedPage {
  page: number;
  text: string;
}

export interface ExtractResult {
  numPages: number;
  pages: ExtractedPage[];
  hasText: boolean;
}

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  return pdfjs;
}

export async function extractPdf(file: Blob): Promise<ExtractResult> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pages: ExtractedPage[] = [];
  let totalChars = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const p = await pdf.getPage(i);
    const content = await p.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    totalChars += text.length;
    pages.push({ page: i, text });
  }
  return { numPages: pdf.numPages, pages, hasText: totalChars > 50 };
}

export async function extractTxt(file: Blob): Promise<ExtractResult> {
  const text = await file.text();
  const CHUNK = 3000;
  const pages: ExtractedPage[] = [];
  for (let i = 0, p = 1; i < text.length; i += CHUNK, p++) {
    pages.push({ page: p, text: text.slice(i, i + CHUNK).trim() });
  }
  if (pages.length === 0) pages.push({ page: 1, text: "" });
  return { numPages: pages.length, pages, hasText: text.length > 0 };
}

export async function extractAny(file: File): Promise<ExtractResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdf(file);
  }
  if (name.endsWith(".txt") || file.type.startsWith("text/")) {
    return extractTxt(file);
  }
  throw new Error("Formato não suportado nesta versão. Use PDF ou TXT.");
}
