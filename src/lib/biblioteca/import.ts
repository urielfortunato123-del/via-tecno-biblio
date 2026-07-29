import { db, type DocRecord } from "./db";
import { extractAny } from "./pdf-extract";
import { invalidateIndex } from "./search";

export interface ImportMetadata {
  nome: string;
  descricao?: string;
  categoria: string;
  orgao?: string;
  ano?: number;
  versao?: string;
  status?: "vigente" | "revogado" | "substituido";
  autor?: string;
  observacoes?: string;
}

export async function importDocument(file: File, meta: ImportMetadata): Promise<number> {
  const extracted = await extractAny(file);
  const now = Date.now();
  const rec: DocRecord = {
    nome: meta.nome.trim() || file.name,
    descricao: meta.descricao,
    categoria: meta.categoria,
    orgao: meta.orgao,
    ano: meta.ano,
    versao: meta.versao,
    status: meta.status ?? "vigente",
    autor: meta.autor,
    observacoes: meta.observacoes,
    mime: file.type || "application/octet-stream",
    fileName: file.name,
    numPages: extracted.numPages,
    createdAt: now,
    updatedAt: now,
    hasText: extracted.hasText,
  };
  const docId = await db.docs.add(rec);
  await db.blobs.put({ docId, blob: file });
  await db.pages.bulkAdd(
    extracted.pages.map((p) => ({ docId, page: p.page, text: p.text })),
  );
  invalidateIndex();
  return docId;
}

export async function deleteDocument(docId: number): Promise<void> {
  const rec = await db.docs.get(docId);
  if (rec?.protected) {
    throw new Error("Documento protegido. Apenas o administrador pode substituir.");
  }
  await db.transaction("rw", db.docs, db.pages, db.blobs, db.favorites, async () => {
    await db.docs.delete(docId);
    await db.pages.where("docId").equals(docId).delete();
    await db.blobs.delete(docId);
    await db.favorites.where("docId").equals(docId).delete();
  });
  invalidateIndex();
}

export async function getDocBlobUrl(docId: number): Promise<string | null> {
  const rec = await db.blobs.get(docId);
  if (!rec) return null;
  return URL.createObjectURL(rec.blob);
}
