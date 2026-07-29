import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/biblioteca/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/biblioteca/documentos")({
  component: DocsPage,
});

function DocsPage() {
  const docs = useLiveQuery(
    () => db.docs.orderBy("createdAt").reverse().toArray(),
    [],
    [],
  );

  if (!docs || docs.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Nenhum documento cadastrado. Vá em <strong>Admin</strong> para importar.
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {docs.map((d) => (
        <Link
          key={d.id}
          to="/biblioteca/doc/$docId"
          params={{ docId: String(d.id) }}
          search={{ page: 1, q: "" }}
        >
          <Card className="p-4 transition-colors hover:border-primary hover:bg-accent/40">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{d.nome}</h3>
                  <Badge variant="secondary">{d.categoria}</Badge>
                  {d.orgao && <Badge variant="outline">{d.orgao}</Badge>}
                  {d.ano && <Badge variant="outline">{d.ano}</Badge>}
                  <Badge variant={d.status === "vigente" ? "default" : "secondary"}>
                    {d.status}
                  </Badge>
                  {!d.hasText && <Badge variant="destructive">Sem texto (OCR pendente)</Badge>}
                </div>
                {d.descricao && (
                  <p className="mt-1 text-sm text-muted-foreground">{d.descricao}</p>
                )}
                <div className="mt-1 text-xs text-muted-foreground">
                  {d.numPages} página(s) · {d.fileName}
                </div>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
