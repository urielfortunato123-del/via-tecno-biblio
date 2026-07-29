import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/biblioteca/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Trash2 } from "lucide-react";

export const Route = createFileRoute("/biblioteca/favoritos")({
  component: FavPage,
});

function FavPage() {
  const favs = useLiveQuery(
    () => db.favorites.orderBy("createdAt").reverse().toArray(),
    [],
    [],
  );
  const docs = useLiveQuery(() => db.docs.toArray(), [], []);
  const docMap = new Map((docs ?? []).map((d) => [d.id!, d]));

  if (!favs || favs.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Nenhum favorito ainda. Marque trechos nas pesquisas para acessá-los rapidamente.
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {favs.map((f) => {
        const d = docMap.get(f.docId);
        return (
          <Card key={f.id} className="p-4">
            <div className="flex items-start gap-3">
              <Star className="mt-1 h-4 w-4 text-amber-500" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {d?.nome ?? `Documento #${f.docId}`} — página {f.page ?? 1}
                </div>
                {f.snippet && (
                  <p className="mt-1 text-sm italic text-muted-foreground">“{f.snippet}”</p>
                )}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" asChild>
                    <Link
                      to="/biblioteca/doc/$docId"
                      params={{ docId: String(f.docId) }}
                      search={{ page: f.page ?? 1, q: "" }}
                    >
                      Abrir
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => db.favorites.delete(f.id!)}
                  >
                    <Trash2 className="mr-1 h-3 w-3" /> Remover
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
