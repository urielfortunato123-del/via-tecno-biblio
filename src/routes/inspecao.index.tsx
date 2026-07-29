import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, type InspectionRecord } from "@/lib/biblioteca/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/inspecao/")({
  head: () => ({
    meta: [
      { title: "Inspeções em Campo – Via Norma" },
      {
        name: "description",
        content:
          "Gerencie inspeções de campo com consulta à Biblioteca Técnica, checklists e relatórios offline.",
      },
      { property: "og:title", content: "Inspeções em Campo – Via Norma" },
      { property: "og:description", content: "Modo Campo com consulta à Biblioteca Técnica." },
    ],
  }),
  component: InspectionsPage,
});

function InspectionsPage() {
  const inspections = useLiveQuery(
    () => db.inspections.orderBy("updatedAt").reverse().toArray(),
    [],
    [],
  );
  const [titulo, setTitulo] = useState("");
  const navigate = useNavigate();

  async function createNew() {
    const now = Date.now();
    const rec: InspectionRecord = {
      titulo: titulo.trim() || `Inspeção ${new Date(now).toLocaleString("pt-BR")}`,
      status: "rascunho",
      createdAt: now,
      updatedAt: now,
      syncStatus: "local",
      createdBy: "local",
    };
    const id = await db.inspections.add(rec);
    setTitulo("");
    navigate({ to: "/inspecao/$id", params: { id: String(id) } });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Inspeções em Campo</h1>
      </div>
      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Título da nova inspeção (opcional)"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
          <Button onClick={createNew}>
            <Plus className="mr-1 h-4 w-4" /> Nova inspeção
          </Button>
        </div>
      </Card>

      <div className="mt-4 grid gap-2">
        {(!inspections || inspections.length === 0) && (
          <Card className="p-6 text-sm text-muted-foreground">
            Nenhuma inspeção ainda. Crie a primeira acima.
          </Card>
        )}
        {inspections?.map((i) => (
          <Link
            key={i.id}
            to="/inspecao/$id"
            params={{ id: String(i.id) }}
            className="block"
          >
            <Card className="p-3 transition-colors hover:border-primary hover:bg-accent/40">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{i.titulo}</span>
                <Badge variant={i.status === "concluida" ? "default" : "secondary"}>
                  {i.status}
                </Badge>
                {i.rodovia && <Badge variant="outline">{i.rodovia}</Badge>}
                {i.km && <Badge variant="outline">km {i.km}</Badge>}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Atualizada em {new Date(i.updatedAt).toLocaleString("pt-BR")} · sync:{" "}
                {i.syncStatus}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
