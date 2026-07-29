import MiniSearch from "minisearch";
import { db, type DocRecord } from "./db";
import { SYNONYMS } from "./categories";

export interface SearchHit {
  docId: number;
  page: number;
  snippet: string;
  score: number;
  doc: DocRecord;
}

interface IndexedPage {
  id: string; // `${docId}:${page}`
  docId: number;
  page: number;
  text: string;
  nome: string;
  categoria: string;
}

let mini: MiniSearch<IndexedPage> | null = null;
let building: Promise<void> | null = null;

function createIndex() {
  return new MiniSearch<IndexedPage>({
    idField: "id",
    fields: ["text", "nome", "categoria"],
    storeFields: ["docId", "page", "text", "nome", "categoria"],
    searchOptions: {
      boost: { nome: 3, categoria: 2 },
      prefix: true,
      fuzzy: 0.2,
    },
    tokenize: (s) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/[^a-z0-9]+/)
        .filter(Boolean),
    processTerm: (term) =>
      term
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
  });
}

export async function rebuildIndex(): Promise<void> {
  if (building) return building;
  building = (async () => {
    const idx = createIndex();
    const docs = await db.docs.toArray();
    const docMap = new Map(docs.map((d) => [d.id!, d]));
    const pages = await db.pages.toArray();
    const records: IndexedPage[] = pages.map((p) => {
      const d = docMap.get(p.docId);
      return {
        id: `${p.docId}:${p.page}`,
        docId: p.docId,
        page: p.page,
        text: p.text,
        nome: d?.nome ?? "",
        categoria: d?.categoria ?? "",
      };
    });
    idx.addAll(records);
    mini = idx;
  })();
  await building;
  building = null;
}

export async function ensureIndex(): Promise<void> {
  if (!mini) await rebuildIndex();
}

export function expandQuery(q: string): string {
  const base = q.toLowerCase().trim();
  const tokens = base.split(/\s+/);
  const extra: string[] = [];
  for (const t of tokens) {
    const syn = SYNONYMS[t];
    if (syn) extra.push(...syn);
  }
  return extra.length ? `${q} ${extra.join(" ")}` : q;
}

export function snippetOf(text: string, query: string, radius = 120): string {
  if (!text) return "";
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const nText = norm(text);
  const terms = norm(query)
    .split(/\s+/)
    .filter((t) => t.length > 2);
  let idx = -1;
  for (const t of terms) {
    idx = nText.indexOf(t);
    if (idx >= 0) break;
  }
  if (idx < 0) return text.slice(0, radius * 2) + (text.length > radius * 2 ? "…" : "");
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + radius);
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}

export async function search(
  q: string,
  opts?: { categoria?: string; orgao?: string; ano?: number; limit?: number },
): Promise<SearchHit[]> {
  await ensureIndex();
  if (!mini || !q.trim()) return [];
  const expanded = expandQuery(q);
  const raw = mini.search(expanded, { combineWith: "OR" });
  const limit = opts?.limit ?? 40;
  const docs = await db.docs.toArray();
  const docMap = new Map(docs.map((d) => [d.id!, d]));
  const hits: SearchHit[] = [];
  for (const r of raw) {
    const doc = docMap.get(r.docId as number);
    if (!doc) continue;
    if (opts?.categoria && doc.categoria !== opts.categoria) continue;
    if (opts?.orgao && doc.orgao !== opts.orgao) continue;
    if (opts?.ano && doc.ano !== opts.ano) continue;
    hits.push({
      docId: r.docId as number,
      page: r.page as number,
      snippet: snippetOf(r.text as string, q),
      score: r.score,
      doc,
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

export function invalidateIndex() {
  mini = null;
}
