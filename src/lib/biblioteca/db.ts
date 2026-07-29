import Dexie, { type Table } from "dexie";

export type DocStatus = "vigente" | "revogado" | "substituido";

export interface DocRecord {
  id?: number;
  nome: string;
  descricao?: string;
  categoria: string;
  orgao?: string;
  ano?: number;
  versao?: string;
  status: DocStatus;
  autor?: string;
  observacoes?: string;
  mime: string;
  fileName: string;
  numPages: number;
  createdAt: number;
  updatedAt: number;
  hasText: boolean; // false when PDF has no selectable text (OCR-pending)
}

export interface PageRecord {
  id?: number;
  docId: number;
  page: number; // 1-based
  text: string;
}

export interface DocBlob {
  docId: number;
  blob: Blob;
}

export interface FavoriteRecord {
  id?: number;
  docId: number;
  page?: number;
  snippet?: string;
  createdAt: number;
}

export interface HistoryRecord {
  id?: number;
  query: string;
  docId?: number;
  page?: number;
  createdAt: number;
}

class BibliotecaDB extends Dexie {
  docs!: Table<DocRecord, number>;
  pages!: Table<PageRecord, number>;
  blobs!: Table<DocBlob, number>;
  favorites!: Table<FavoriteRecord, number>;
  history!: Table<HistoryRecord, number>;

  constructor() {
    super("biblioteca-tecnica");
    this.version(1).stores({
      docs: "++id, categoria, orgao, ano, status, createdAt, nome",
      pages: "++id, docId, page, [docId+page]",
      blobs: "docId",
      favorites: "++id, docId, createdAt",
      history: "++id, createdAt, query",
    });
  }
}

export const db = new BibliotecaDB();
