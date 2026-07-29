import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { db, type DocRecord } from "@/lib/biblioteca/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PdfViewer } from "@/components/biblioteca/PdfViewer";
import { Star, ArrowLeft, Download, Share2 } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  q: z.string().catch(""),
});

export const Route = createFileRoute("/biblioteca/doc/$docId")({
  validateSearch: searchSchema,
  component: DocViewerPage,
});

function DocViewerPage() {
  const { docId } = Route.useParams();
  const { page, q } = Route.useSearch();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<DocRecord | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [currentPage, setCurrentPage] = useState(page);

  useEffect(() => {
    let alive = true;
    (async () => {
      const id = Number(docId);
      const rec = await db.docs.get(id);
      if (!alive) return;
      if (!rec) {
        setNotFound(true);
        return;
      }
      setDoc(rec);
      const b = await db.blobs.get(id);
      if (!alive) return;
      setBlob(b?.blob ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [docId]);

  const isPdf =
    doc?.mime === "application/pdf" || doc?.fileName.toLowerCase().endsWith(".pdf");

  const handleDownload = () => {
    if (!blob || !doc) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.fileName || `${doc.nome}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleShare = async () => {
    if (!doc) return;
    const shareData: ShareData = {
      title: doc.nome,
      text: `${doc.nome}${doc.orgao ? " · " + doc.orgao : ""} — página ${currentPage}`,
      url: typeof window !== "undefined" ? window.location.href : undefined,
    };
    try {
      if (blob && typeof navigator !== "undefined" && "canShare" in navigator) {
        const file = new File([blob], doc.fileName || `${doc.nome}.pdf`, {
          type: doc.mime || "application/pdf",
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nav = navigator as any;
        if (nav.canShare?.({ files: [file] })) {
          await nav.share({ ...shareData, files: [file] });
          return;
        }
      }
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share(shareData);
        return;
      }
      if (shareData.url && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareData.url);
        toast.success("Link copiado");
      }
    } catch {
      /* user cancelled */
    }
  };

  if (notFound) {
    return (
      <Card className="p-6">
        <p className="text-sm">Documento não encontrado.</p>
        <Button className="mt-3" onClick={() => navigate({ to: "/biblioteca/documentos" })}>
          Voltar
        </Button>
      </Card>
    );
  }

  if (!doc) {
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* Header dedicado */}
      <div className="flex min-w-0 flex-col gap-2 rounded-md border bg-card p-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/biblioteca/documentos">
              <ArrowLeft className="mr-1 h-3 w-3" /> Voltar
            </Link>
          </Button>
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold sm:text-lg">
            {doc.nome}
          </h2>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="secondary">{doc.categoria}</Badge>
          {doc.orgao && <Badge variant="outline">{doc.orgao}</Badge>}
          {doc.ano && <Badge variant="outline">{doc.ano}</Badge>}
          <Badge variant={doc.status === "vigente" ? "default" : "secondary"}>
            {doc.status}
          </Badge>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await db.favorites.add({
                  docId: doc.id!,
                  page: currentPage,
                  createdAt: Date.now(),
                });
                toast.success("Adicionado aos favoritos");
              }}
            >
              <Star className="mr-1 h-3 w-3" /> Favoritar
            </Button>
            <Button size="sm" variant="outline" onClick={handleShare}>
              <Share2 className="mr-1 h-3 w-3" /> Compartilhar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              disabled={!blob}
              title={blob ? "Baixar PDF" : "PDF ainda não disponível offline"}
            >
              <Download className="mr-1 h-3 w-3" /> Baixar
            </Button>
          </div>
        </div>
        <div className="min-w-0 text-xs text-muted-foreground">
          Fonte: {doc.nome}
          {doc.orgao ? ` · ${doc.orgao}` : ""}
          {doc.ano ? ` · ${doc.ano}` : ""}
          {doc.versao ? ` · v${doc.versao}` : ""} · página {currentPage} de {doc.numPages}
        </div>
      </div>

      {isPdf && blob ? (
        <PdfViewer
          blob={blob}
          initialPage={page}
          highlight={q}
          onPageChange={setCurrentPage}
        />
      ) : isPdf && !blob ? (
        <Card className="p-6 text-sm">
          <p className="mb-2 font-medium">PDF ainda não disponível offline</p>
          <p className="text-muted-foreground">
            Aguarde o término do download do documento ou verifique a página de administração
            da Biblioteca.
          </p>
        </Card>
      ) : (
        <Card className="p-6 text-sm text-muted-foreground">
          Este documento não é um PDF.
        </Card>
      )}
    </div>
  );
}
