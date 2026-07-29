import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/biblioteca/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/biblioteca/historico")({
  component: HistoryPage,
});

function HistoryPage() {
  const items = useLiveQuery(
    () => db.history.orderBy("createdAt").reverse().limit(100).toArray(),
    [],
    [],
  );
  if (!items || items.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">Nenhuma pesquisa registrada ainda.</Card>
    );
  }
  return (
    <Card className="divide-y p-2">
      <div className="flex items-center justify-between p-2">
        <span className="text-xs uppercase text-muted-foreground">Histórico</span>
        <Button size="sm" variant="ghost" onClick={() => db.history.clear()}>
          Limpar
        </Button>
      </div>
      {items.map((h) => (
        <div key={h.id} className="flex items-center justify-between p-2 text-sm">
          <div className="min-w-0 flex-1 truncate">
            <span className="font-medium">{h.query || "(abertura direta)"}</span>
            {h.docId && (
              <span className="ml-2 text-xs text-muted-foreground">
                → doc #{h.docId} pág. {h.page ?? 1}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{new Date(h.createdAt).toLocaleString("pt-BR")}</span>
            {h.docId && (
              <Button size="sm" variant="outline" asChild>
                <Link
                  to="/biblioteca/doc/$docId"
                  params={{ docId: String(h.docId) }}
                  search={{ page: h.page ?? 1, q: h.query }}
                >
                  Abrir
                </Link>
              </Button>
            )}
          </div>
        </div>
      ))}
    </Card>
  );
}
