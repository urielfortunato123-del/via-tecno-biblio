import { db, type DocRecord } from "./db";
import { invalidateIndex } from "./search";

export const SMR_SOURCE_KEY = "smr";
const SMR_INDEX_VERSION_STORAGE = "smr-index-version";

interface SmrPage {
  page: number;
  text: string;
}
interface SmrGlossaryTerm {
  term: string;
  definition: string;
  page: number;
}
interface SmrChapter {
  number: string;
  title: string;
  page: number;
}
interface SmrIndex {
  version: number;
  indexVersion: number;
  pdfHash: string;
  metadata: {
    nome: string;
    sigla: string;
    orgao: string;
    ano: number;
    edicao: string;
    categoria: string;
    status: "vigente" | "revogado" | "substituido";
    origem: string;
    fileName: string;
    numPages: number;
  };
  pages: SmrPage[];
  glossary: SmrGlossaryTerm[];
  chapters: SmrChapter[];
}

export type SmrBootstrapPhase =
  | "checking"
  | "loading-index"
  | "indexing"
  | "downloading-pdf"
  | "ready"
  | "error";

export interface SmrBootstrapState {
  phase: SmrBootstrapPhase;
  current?: number;
  total?: number;
  message?: string;
  error?: string;
  docId?: number;
}

type Listener = (state: SmrBootstrapState) => void;

class SmrBootstrapManager {
  private state: SmrBootstrapState = { phase: "checking" };
  private listeners = new Set<Listener>();
  private started = false;

  getState() {
    return this.state;
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    l(this.state);
    return () => this.listeners.delete(l);
  }

  private set(s: Partial<SmrBootstrapState>) {
    this.state = { ...this.state, ...s };
    this.listeners.forEach((l) => l(this.state));
  }

  async ensure() {
    if (this.started) return;
    this.started = true;
    try {
      await this.run();
    } catch (e) {
      console.error("[SMR bootstrap] failed", e);
      this.set({
        phase: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private async run() {
    this.set({ phase: "checking", message: "Verificando Manual SMR…" });

    const existing = await db.docs
      .where("sourceKey")
      .equals(SMR_SOURCE_KEY)
      .first();

    const cachedVersion =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(SMR_INDEX_VERSION_STORAGE)
        : null;

    // Load pointer to PDF asset
    const assetMod = (await import("./smr.pdf.asset.json")) as {
      default?: { url: string };
      url?: string;
    };
    const pdfUrl =
      (assetMod.default?.url ?? assetMod.url) as string | undefined;

    if (existing && cachedVersion === String(existing.indexVersion)) {
      this.set({
        phase: existing.pdfDownloaded ? "ready" : "downloading-pdf",
        docId: existing.id,
        message: existing.pdfDownloaded
          ? "Manual SMR disponível offline."
          : "Baixando Manual SMR para uso offline…",
      });
      if (!existing.pdfDownloaded && pdfUrl) {
        void this.downloadPdf(existing.id!, pdfUrl).catch((e) =>
          console.warn("[SMR] PDF download deferred", e),
        );
      } else {
        this.set({ phase: "ready" });
      }
      return;
    }

    // Import pre-built index
    this.set({ phase: "loading-index", message: "Carregando índice do SMR…" });
    const indexMod = (await import("./smr-index.json")) as {
      default: SmrIndex;
    };
    const idx = indexMod.default;

    // Register / update doc
    const now = Date.now();
    const docPayload: DocRecord = {
      nome: idx.metadata.nome,
      descricao: `${idx.metadata.sigla} · ${idx.metadata.edicao}`,
      categoria: idx.metadata.categoria,
      orgao: idx.metadata.orgao,
      ano: idx.metadata.ano,
      versao: idx.metadata.edicao,
      status: idx.metadata.status,
      autor: idx.metadata.orgao,
      observacoes: idx.metadata.origem,
      mime: "application/pdf",
      fileName: idx.metadata.fileName,
      numPages: idx.metadata.numPages,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      hasText: true,
      protected: true,
      sourceKey: SMR_SOURCE_KEY,
      pdfHash: idx.pdfHash,
      indexVersion: idx.indexVersion,
      pdfUrl,
      pdfDownloaded: existing?.pdfDownloaded ?? false,
    };

    let docId = existing?.id;
    if (existing?.id) {
      await db.docs.update(existing.id, docPayload);
      docId = existing.id;
    } else {
      docId = await db.docs.add(docPayload);
    }
    const id = docId!;

    // Re-index pages
    this.set({
      phase: "indexing",
      current: 0,
      total: idx.pages.length,
      message: "Indexando páginas para busca offline…",
    });
    await db.pages.where("docId").equals(id).delete();
    const BATCH = 100;
    for (let i = 0; i < idx.pages.length; i += BATCH) {
      const chunk = idx.pages.slice(i, i + BATCH);
      await db.pages.bulkAdd(
        chunk.map((p) => ({ docId: id, page: p.page, text: p.text })),
      );
      this.set({ current: Math.min(i + BATCH, idx.pages.length) });
    }

    // Glossary
    await db.glossary.where("docId").equals(id).delete();
    if (idx.glossary.length > 0) {
      const norm = (s: string) =>
        s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      await db.glossary.bulkAdd(
        idx.glossary.map((g) => ({
          term: g.term,
          termNorm: norm(g.term),
          definition: g.definition,
          docId: id,
          docNome: idx.metadata.nome,
          page: g.page,
          categoria: idx.metadata.categoria,
          orgao: idx.metadata.orgao,
        })),
      );
    }

    invalidateIndex();
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(
        SMR_INDEX_VERSION_STORAGE,
        String(idx.indexVersion),
      );
    }

    this.set({
      phase: pdfUrl ? "downloading-pdf" : "ready",
      docId: id,
      message: pdfUrl
        ? "Baixando PDF do Manual SMR…"
        : "Índice pronto. PDF não configurado.",
    });

    if (pdfUrl) {
      void this.downloadPdf(id, pdfUrl).catch((e) =>
        console.warn("[SMR] PDF download deferred", e),
      );
    }
  }

  private async downloadPdf(docId: number, url: string) {
    // Check if already cached
    const cached = await db.blobs.get(docId);
    if (cached) {
      await db.docs.update(docId, { pdfDownloaded: true });
      this.set({ phase: "ready", message: "Manual SMR disponível offline." });
      return;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      await db.blobs.put({ docId, blob });
      await db.docs.update(docId, { pdfDownloaded: true });
      this.set({ phase: "ready", message: "Manual SMR disponível offline." });
    } catch (e) {
      this.set({
        phase: "ready", // search still works with text index
        message:
          "Índice pronto. PDF será baixado quando houver conexão (busca já funciona).",
      });
      throw e;
    }
  }

  async forceReprocess() {
    this.started = false;
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(SMR_INDEX_VERSION_STORAGE);
    }
    await this.ensure();
  }
}

export const smrBootstrap = new SmrBootstrapManager();
