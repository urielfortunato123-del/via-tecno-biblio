import { db, type DocRecord } from "./db";
import { invalidateIndex } from "./search";

/** Normalizes a file name for comparison: lowercase, no accents, no extension. */
export function normalizeFileName(name?: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function normalizeUrl(url?: string): string {
  if (!url) return "";
  try {
    const u = new URL(url, "http://local");
    return (u.pathname.split("/").pop() ?? "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export interface DuplicateCandidate {
  fileName?: string;
  pdfUrl?: string;
  pdfHash?: string;
  numPages?: number;
  id?: number;
  sourceKey?: string;
}

/**
 * Finds an already-registered document matching the candidate by
 * internal id, sourceKey, hash, url or (fileName + page count).
 */
export async function findExistingDoc(
  cand: DuplicateCandidate,
  docs?: DocRecord[],
): Promise<DocRecord | undefined> {
  const all = docs ?? (await db.docs.toArray());
  if (cand.id != null) {
    const byId = all.find((d) => d.id === cand.id);
    if (byId) return byId;
  }
  if (cand.sourceKey) {
    const bySource = all.find((d) => d.sourceKey === cand.sourceKey);
    if (bySource) return bySource;
  }
  if (cand.pdfHash) {
    const byHash = all.find((d) => d.pdfHash && d.pdfHash === cand.pdfHash);
    if (byHash) return byHash;
  }
  const url = normalizeUrl(cand.pdfUrl);
  if (url) {
    const byUrl = all.find((d) => normalizeUrl(d.pdfUrl) === url);
    if (byUrl) return byUrl;
  }
  const fn = normalizeFileName(cand.fileName);
  if (fn) {
    const byFile = all.find((d) => {
      if (normalizeFileName(d.fileName) !== fn) return false;
      if (cand.numPages && d.numPages) return d.numPages === cand.numPages;
      return true;
    });
    if (byFile) return byFile;
  }
  return undefined;
}

/** Hard-removes a doc and every derived record (pages, blob, favorites, history, glossary, refs, ocr). */
export async function purgeDoc(docId: number): Promise<void> {
  await db.transaction(
    "rw",
    db.docs,
    db.pages,
    db.blobs,
    db.favorites,
    db.history,
    db.glossary,
    db.ocrPages,
    db.inspectionRefs,
    async () => {
      await db.docs.delete(docId);
      await db.pages.where("docId").equals(docId).delete();
      await db.blobs.delete(docId);
      await db.favorites.where("docId").equals(docId).delete();
      await db.glossary.where("docId").equals(docId).delete();
      await db.ocrPages.where("docId").equals(docId).delete();
      await db.inspectionRefs.where("docId").equals(docId).delete();
      const hist = await db.history.toArray();
      const stale = hist.filter((h) => h.docId === docId).map((h) => h.id!);
      if (stale.length) await db.history.bulkDelete(stale);
    },
  );
  invalidateIndex();
}

/**
 * Collapses duplicated documents that point to the same file.
 * Keeps the oldest record (first card) and purges the rest.
 * Returns the number of removed records.
 */
export async function dedupeLibrary(): Promise<number> {
  const all = await db.docs.toArray();
  const groups = new Map<string, DocRecord[]>();
  for (const d of all) {
    const key =
      d.pdfHash ||
      normalizeUrl(d.pdfUrl) ||
      normalizeFileName(d.fileName) ||
      `id:${d.id}`;
    const list = groups.get(key) ?? [];
    list.push(d);
    groups.set(key, list);
  }

  let removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    // Keep the oldest / lowest id; prefer a record that already has the PDF offline.
    const sorted = [...list].sort((a, b) => {
      const ca = a.createdAt ?? 0;
      const cb = b.createdAt ?? 0;
      if (ca !== cb) return ca - cb;
      return (a.id ?? 0) - (b.id ?? 0);
    });
    const keeper = sorted[0];
    for (const dup of sorted.slice(1)) {
      if (dup.id == null || dup.id === keeper.id) continue;
      // Re-point favorites/history/refs to the surviving record instead of losing them.
      const favs = await db.favorites.where("docId").equals(dup.id).toArray();
      for (const f of favs) {
        await db.favorites.update(f.id!, { docId: keeper.id! });
      }
      const refs = await db.inspectionRefs.where("docId").equals(dup.id).toArray();
      for (const r of refs) {
        await db.inspectionRefs.update(r.id!, { docId: keeper.id! });
      }
      await purgeDoc(dup.id);
      removed++;
    }
  }
  if (removed) invalidateIndex();
  return removed;
}
