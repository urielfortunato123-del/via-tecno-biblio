import Dexie, { type Table } from "dexie";

export type DocStatus = "vigente" | "revogado" | "substituido";
export type SyncStatus = "local" | "pending" | "synced" | "error";

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
  hasText: boolean;
  // v2 fields
  protected?: boolean; // built-in docs (SMR) — users cannot delete
  sourceKey?: string; // stable key for built-in docs, e.g. "smr"
  pdfHash?: string;
  indexVersion?: number;
  pdfUrl?: string; // remote CDN URL for lazy download
  pdfDownloaded?: boolean; // Blob available offline
}

export interface PageRecord {
  id?: number;
  docId: number;
  page: number;
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

// v2: inspections
export type InspectionStatus = "rascunho" | "concluida";
export interface InspectionRecord {
  id?: number;
  titulo: string;
  rodovia?: string;
  km?: string;
  sentido?: string;
  regional?: string;
  municipio?: string;
  empresa?: string;
  servico?: string;
  fiscal?: string;
  descricao?: string;
  observacoes?: string;
  status: InspectionStatus;
  createdAt: number;
  updatedAt: number;
  syncStatus: SyncStatus;
  createdBy: string;
  retryCount?: number;
  lastSyncError?: string;
}

export interface InspectionPhotoRecord {
  id?: number;
  inspectionId: number;
  fase: "antes" | "durante" | "depois" | "geral";
  legenda?: string;
  blob: Blob;
  createdAt: number;
}

export interface InspectionRefRecord {
  id?: number;
  inspectionId: number;
  docId: number;
  docNome: string;
  orgao?: string;
  versao?: string;
  capitulo?: string;
  item?: string;
  page: number;
  trecho: string;
  createdAt: number;
}

// v2: checklists
export type ChecklistItemStatus = "pendente" | "ok" | "nao_conforme" | "na";
export interface ChecklistRecord {
  id?: number;
  titulo: string;
  procedimento?: string;
  inspectionId?: number;
  sourceDocId?: number;
  sourceDocNome?: string;
  sourcePage?: number;
  status: "rascunho" | "concluido";
  responsavel?: string;
  observacoes?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  syncStatus: SyncStatus;
  createdBy: string;
}

export interface ChecklistItemRecord {
  id?: number;
  checklistId: number;
  secao: "antes" | "durante" | "depois" | "fotos" | "medicao" | "observacoes";
  texto: string;
  status: ChecklistItemStatus;
  ordem: number;
  observacao?: string;
  sourceDocId?: number;
  sourcePage?: number;
  sourceTrecho?: string;
  isCustom?: boolean;
  createdAt: number;
}

// v2: offline reports
export interface OfflineReportRecord {
  id?: number;
  nome: string;
  inspectionId?: number;
  rodovia?: string;
  km?: string;
  versao: number;
  size: number;
  createdAt: number;
  updatedAt: number;
  syncStatus: SyncStatus;
  createdBy: string;
}
export interface OfflineReportBlob {
  reportId: number;
  blob: Blob;
}

// v2: glossary
export interface GlossaryTermRecord {
  id?: number;
  term: string;
  termNorm: string;
  definition?: string;
  docId: number;
  docNome: string;
  page: number;
  categoria?: string;
  orgao?: string;
  related?: string[];
}

// v2: OCR (placeholder table; OCR execution intentionally left as follow-up)
export interface OcrPageRecord {
  id?: number;
  docId: number;
  page: number;
  originalText: string;
  ocrText?: string;
  finalText?: string;
  confidence?: number;
  status: "pendente" | "processando" | "concluido" | "erro";
  processedAt?: number;
  errorMessage?: string;
}

// v2: sync queue
export interface SyncQueueRecord {
  id?: number;
  entity: string;
  entityId: number;
  action: "create" | "update" | "delete";
  payload?: unknown;
  status: SyncStatus;
  retryCount: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

class BibliotecaDB extends Dexie {
  docs!: Table<DocRecord, number>;
  pages!: Table<PageRecord, number>;
  blobs!: Table<DocBlob, number>;
  favorites!: Table<FavoriteRecord, number>;
  history!: Table<HistoryRecord, number>;

  inspections!: Table<InspectionRecord, number>;
  inspectionPhotos!: Table<InspectionPhotoRecord, number>;
  inspectionRefs!: Table<InspectionRefRecord, number>;

  checklists!: Table<ChecklistRecord, number>;
  checklistItems!: Table<ChecklistItemRecord, number>;

  reports!: Table<OfflineReportRecord, number>;
  reportBlobs!: Table<OfflineReportBlob, number>;

  glossary!: Table<GlossaryTermRecord, number>;
  ocrPages!: Table<OcrPageRecord, number>;
  syncQueue!: Table<SyncQueueRecord, number>;

  constructor() {
    super("biblioteca-tecnica");
    this.version(1).stores({
      docs: "++id, categoria, orgao, ano, status, createdAt, nome",
      pages: "++id, docId, page, [docId+page]",
      blobs: "docId",
      favorites: "++id, docId, createdAt",
      history: "++id, createdAt, query",
    });
    this.version(2)
      .stores({
        docs: "++id, categoria, orgao, ano, status, createdAt, nome, sourceKey, protected",
        pages: "++id, docId, page, [docId+page]",
        blobs: "docId",
        favorites: "++id, docId, createdAt",
        history: "++id, createdAt, query",
        inspections: "++id, createdAt, updatedAt, status, syncStatus, rodovia",
        inspectionPhotos: "++id, inspectionId, createdAt, fase",
        inspectionRefs: "++id, inspectionId, docId, createdAt",
        checklists:
          "++id, inspectionId, sourceDocId, createdAt, status, syncStatus",
        checklistItems: "++id, checklistId, secao, ordem",
        reports: "++id, inspectionId, createdAt, syncStatus",
        reportBlobs: "reportId",
        glossary: "++id, termNorm, docId, page, categoria",
        ocrPages: "++id, docId, page, status, [docId+page]",
        syncQueue: "++id, entity, entityId, status, createdAt",
      })
      .upgrade(async () => {
        // no data transform needed
      });
  }
}

export const db = new BibliotecaDB();
