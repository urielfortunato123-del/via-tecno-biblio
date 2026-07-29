import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { db, type DocRecord } from "@/lib/biblioteca/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PdfViewer } from "@/components/biblioteca/PdfViewer";
import { Star, ArrowLeft } from "lucide-react";
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
  const [pageText, setPageText] = useState<string>("");
  const [notFound, setNotFound] = useState(false);

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
      const pg = await db.pages.where({ docId: id, page }).first();
      if (!alive) return;
      setPageText(pg?.text ?? "");
    })();
    return () => {
      alive = false;
    };
  }, [docId, page]);

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

  const isPdf = doc.mime === "application/pdf" || doc.fileName.toLowerCase().endsWith(".pdf");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/biblioteca/documentos">
            <ArrowLeft className="mr-1 h-3 w-3" /> Voltar
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">{doc.nome}</h2>
        <Badge variant="secondary">{doc.categoria}</Badge>
        {doc.orgao && <Badge variant="outline">{doc.orgao}</Badge>}
        {doc.ano && <Badge variant="outline">{doc.ano}</Badge>}
        <Badge variant={doc.status === "vigente" ? "default" : "secondary"}>{doc.status}</Badge>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={async () => {
            await db.favorites.add({
              docId: doc.id!,
              page,
              createdAt: Date.now(),
            });
            toast.success("Adicionado aos favoritos");
          }}
        >
          <Star className="mr-1 h-3 w-3" /> Favoritar
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        Fonte: {doc.nome}
        {doc.orgao ? ` · ${doc.orgao}` : ""}
        {doc.ano ? ` · ${doc.ano}` : ""}
        {doc.versao ? ` · v${doc.versao}` : ""} · página {page} de {doc.numPages}
      </div>

      {isPdf && blob ? (
        <PdfViewer blob={blob} initialPage={page} highlight={q} />
      ) : (
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-medium">Página {page}</h3>
          <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {pageText || "(sem texto)"}
          </pre>
        </Card>
      )}
    </div>
  );
}
