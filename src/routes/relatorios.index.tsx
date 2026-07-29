import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/biblioteca/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/relatorios/")({
  head: () => ({
    meta: [
      { title: "Relatórios – Via Norma" },
      { name: "description", content: "Histórico de relatórios técnicos gerados offline." },
      { property: "og:title", content: "Relatórios – Via Norma" },
      { property: "og:description", content: "Histórico de relatórios técnicos gerados offline." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const reports = useLiveQuery(
    () => db.reports.orderBy("createdAt").reverse().toArray(),
    [],
    [],
  );

  async function download(reportId: number, nome: string) {
    const b = await db.reportBlobs.get(reportId);
    if (!b) {
      toast.error("Arquivo indisponível localmente.");
      return;
    }
    const url = URL.createObjectURL(b.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  async function remove(id: number) {
    await db.reports.delete(id);
    await db.reportBlobs.delete(id);
    toast.success("Relatório removido.");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-3 text-xl font-semibold">Relatórios gerados</h1>
      {(!reports || reports.length === 0) && (
        <Card className="p-6 text-sm text-muted-foreground">
          Nenhum relatório gerado ainda.
        </Card>
      )}
      <div className="grid gap-2">
        {reports?.map((r) => (
          <Card key={r.id} className="flex items-center justify-between p-3">
            <div>
              <div className="font-medium">{r.nome}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(r.createdAt).toLocaleString("pt-BR")} ·{" "}
                {(r.size / 1024).toFixed(0)} KB · v{r.versao}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{r.syncStatus}</Badge>
              <Button size="sm" variant="outline" onClick={() => download(r.id!, r.nome)}>
                <FileDown className="mr-1 h-3 w-3" /> Baixar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(r.id!)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
