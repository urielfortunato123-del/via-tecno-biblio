import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db, type ChecklistItemStatus } from "@/lib/biblioteca/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/checklists/$id")({
  component: ChecklistEditor,
});

const SECOES: Array<{ key: "antes" | "durante" | "depois" | "fotos" | "medicao" | "observacoes"; label: string }> = [
  { key: "antes", label: "Antes" },
  { key: "durante", label: "Durante" },
  { key: "depois", label: "Depois" },
  { key: "fotos", label: "Fotos" },
  { key: "medicao", label: "Medição" },
  { key: "observacoes", label: "Observações" },
];

function ChecklistEditor() {
  const { id } = Route.useParams();
  const clId = Number(id);
  const navigate = useNavigate();

  const cl = useLiveQuery(() => db.checklists.get(clId), [clId]);
  const items = useLiveQuery(
    () => db.checklistItems.where("checklistId").equals(clId).sortBy("ordem"),
    [clId],
    [],
  );

  const [newItem, setNewItem] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (cl?.observacoes) setObs(cl.observacoes);
  }, [cl?.observacoes]);

  if (!cl) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  async function setStatus(itemId: number, status: ChecklistItemStatus) {
    await db.checklistItems.update(itemId, { status });
  }
  async function addItem() {
    if (!newItem.trim()) return;
    const maxOrder = (items ?? []).reduce((m, i) => Math.max(m, i.ordem), 0);
    await db.checklistItems.add({
      checklistId: clId,
      secao: "observacoes",
      texto: newItem.trim(),
      status: "pendente",
      ordem: maxOrder + 1,
      isCustom: true,
      createdAt: Date.now(),
    });
    setNewItem("");
  }
  async function conclude() {
    await db.checklists.update(clId, {
      status: "concluido",
      completedAt: Date.now(),
      updatedAt: Date.now(),
      observacoes: obs,
    });
    toast.success("Checklist concluído.");
  }
  async function saveDraft() {
    await db.checklists.update(clId, { observacoes: obs, updatedAt: Date.now() });
    toast.success("Rascunho salvo.");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/inspecao" })}>
          <ArrowLeft className="mr-1 h-3 w-3" /> Voltar
        </Button>
        <h1 className="text-lg font-semibold">{cl.titulo}</h1>
        <Badge variant={cl.status === "concluido" ? "default" : "secondary"}>{cl.status}</Badge>
      </div>
      {cl.sourceDocId && (
        <p className="mb-3 text-xs text-muted-foreground">
          Fonte: {cl.sourceDocNome} · pág. {cl.sourcePage}{" "}
          <Link
            to="/biblioteca/doc/$docId"
            params={{ docId: String(cl.sourceDocId) }}
            search={{ page: cl.sourcePage ?? 1, q: "" }}
            className="text-primary underline"
          >
            (abrir norma)
          </Link>
        </p>
      )}

      {SECOES.map((s) => {
        const sec = (items ?? []).filter((i) => i.secao === s.key);
        if (sec.length === 0) return null;
        return (
          <Card key={s.key} className="mb-3 p-3">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {s.label}
            </h3>
            <div className="flex flex-col gap-1">
              {sec.map((i) => (
                <div key={i.id} className="flex items-start gap-2 rounded-md border p-2">
                  <div className="min-w-0 flex-1 text-sm">
                    <div>{i.texto}</div>
                    {i.sourcePage && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        Extraído da norma · pág. {i.sourcePage}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {(["ok", "nao_conforme", "na"] as const).map((st) => (
                      <Button
                        key={st}
                        size="sm"
                        variant={i.status === st ? "default" : "outline"}
                        className="h-7 px-2 text-[10px]"
                        onClick={() => setStatus(i.id!, st)}
                      >
                        {st === "ok" ? "OK" : st === "nao_conforme" ? "NC" : "N/A"}
                      </Button>
                    ))}
                    {i.isCustom && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => db.checklistItems.delete(i.id!)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      <Card className="p-3">
        <h3 className="mb-2 text-sm font-semibold">Adicionar item</h3>
        <div className="flex gap-2">
          <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Novo item…" />
          <Button onClick={addItem}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <Card className="mt-3 p-3">
        <h3 className="mb-2 text-sm font-semibold">Observações finais</h3>
        <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
        <div className="mt-2 flex gap-2">
          <Button variant="outline" onClick={saveDraft}>
            Salvar rascunho
          </Button>
          <Button onClick={conclude}>
            <CheckCircle2 className="mr-1 h-4 w-4" /> Concluir
          </Button>
        </div>
      </Card>
    </div>
  );
}
