import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/biblioteca/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BibliotecaSheet } from "@/components/biblioteca/BibliotecaSheet";
import { BookOpen, ArrowLeft, Save, Camera, FileDown, ListChecks, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { generateAndSaveReport } from "@/lib/biblioteca/report-pdf";

export const Route = createFileRoute("/inspecao/$id")({
  component: InspectionEditor,
});

function InspectionEditor() {
  const { id } = Route.useParams();
  const inspectionId = Number(id);
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [gen, setGen] = useState(false);

  const rec = useLiveQuery(
    () => db.inspections.get(inspectionId),
    [inspectionId],
  );
  const refs = useLiveQuery(
    () => db.inspectionRefs.where("inspectionId").equals(inspectionId).toArray(),
    [inspectionId],
    [],
  );
  const photos = useLiveQuery(
    () => db.inspectionPhotos.where("inspectionId").equals(inspectionId).toArray(),
    [inspectionId],
    [],
  );
  const checklists = useLiveQuery(
    () => db.checklists.where("inspectionId").equals(inspectionId).toArray(),
    [inspectionId],
    [],
  );

  const [form, setForm] = useState({
    titulo: "",
    rodovia: "",
    km: "",
    sentido: "",
    regional: "",
    municipio: "",
    empresa: "",
    servico: "",
    fiscal: "",
    descricao: "",
    observacoes: "",
  });

  useEffect(() => {
    if (rec) {
      setForm({
        titulo: rec.titulo ?? "",
        rodovia: rec.rodovia ?? "",
        km: rec.km ?? "",
        sentido: rec.sentido ?? "",
        regional: rec.regional ?? "",
        municipio: rec.municipio ?? "",
        empresa: rec.empresa ?? "",
        servico: rec.servico ?? "",
        fiscal: rec.fiscal ?? "",
        descricao: rec.descricao ?? "",
        observacoes: rec.observacoes ?? "",
      });
    }
  }, [rec]);

  async function save(nextStatus?: "rascunho" | "concluida") {
    await db.inspections.update(inspectionId, {
      ...form,
      status: nextStatus ?? rec?.status ?? "rascunho",
      updatedAt: Date.now(),
    });
    toast.success(nextStatus === "concluida" ? "Inspeção concluída." : "Salvo.");
  }

  async function addPhoto(file: File, fase: "antes" | "durante" | "depois" | "geral") {
    await db.inspectionPhotos.add({
      inspectionId,
      fase,
      blob: file,
      legenda: file.name,
      createdAt: Date.now(),
    });
    toast.success("Foto anexada.");
  }

  async function onGenReport() {
    setGen(true);
    try {
      await save();
      const r = await generateAndSaveReport(inspectionId);
      const url = URL.createObjectURL(r.blob);
      window.open(url, "_blank");
      if (r.saved) {
        toast.success("Relatório gerado e salvo no histórico.");
      } else {
        toast.warning(r.error ?? "Relatório gerado — não foi possível salvar localmente.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar relatório.");
    } finally {
      setGen(false);
    }
  }

  if (!rec) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/inspecao" })}>
          <ArrowLeft className="mr-1 h-3 w-3" /> Voltar
        </Button>
        <h1 className="text-lg font-semibold">{form.titulo || "Inspeção"}</h1>
        <Badge variant={rec.status === "concluida" ? "default" : "secondary"}>
          {rec.status}
        </Badge>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setSheetOpen(true)}
            className="h-10"
          >
            <BookOpen className="mr-1 h-4 w-4" /> Consultar Biblioteca Técnica
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Título</Label>
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div>
            <Label>Rodovia</Label>
            <Input value={form.rodovia} onChange={(e) => setForm({ ...form, rodovia: e.target.value })} />
          </div>
          <div>
            <Label>Km</Label>
            <Input value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} />
          </div>
          <div>
            <Label>Sentido</Label>
            <Input value={form.sentido} onChange={(e) => setForm({ ...form, sentido: e.target.value })} />
          </div>
          <div>
            <Label>Regional</Label>
            <Input value={form.regional} onChange={(e) => setForm({ ...form, regional: e.target.value })} />
          </div>
          <div>
            <Label>Município</Label>
            <Input value={form.municipio} onChange={(e) => setForm({ ...form, municipio: e.target.value })} />
          </div>
          <div>
            <Label>Empresa executora</Label>
            <Input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
          </div>
          <div>
            <Label>Serviço</Label>
            <Input value={form.servico} onChange={(e) => setForm({ ...form, servico: e.target.value })} />
          </div>
          <div>
            <Label>Fiscal responsável</Label>
            <Input value={form.fiscal} onChange={(e) => setForm({ ...form, fiscal: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Descrição da ocorrência / serviço</Label>
            <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => save()} className="h-10">
            <Save className="mr-1 h-4 w-4" /> Salvar
          </Button>
          {rec.status !== "concluida" && (
            <Button variant="outline" onClick={() => save("concluida")} className="h-10">
              <CheckCircle2 className="mr-1 h-4 w-4" /> Concluir inspeção
            </Button>
          )}
          <Button variant="secondary" onClick={onGenReport} disabled={gen} className="h-10">
            <FileDown className="mr-1 h-4 w-4" /> {gen ? "Gerando…" : "Gerar Relatório PDF"}
          </Button>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Fotos ({photos?.length ?? 0})</h3>
            <div className="flex flex-wrap gap-1">
              {(["antes", "durante", "depois"] as const).map((fase) => (
                <label
                  key={fase}
                  className="cursor-pointer rounded-md border px-2 py-1 text-xs hover:bg-accent"
                >
                  <Camera className="mr-1 inline h-3 w-3" />
                  {fase}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void addPhoto(f, fase);
                      e.target.value = "";
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {photos?.map((p) => (
              <PhotoThumb key={p.id} id={p.id!} />
            ))}
            {photos?.length === 0 && (
              <p className="col-span-3 text-xs text-muted-foreground">Sem fotos.</p>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Normas vinculadas ({refs?.length ?? 0})</h3>
          {refs?.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhuma. Abra a Biblioteca Técnica e use “Usar aqui”.
            </p>
          )}
          <div className="flex flex-col gap-1">
            {refs?.map((r) => (
              <div key={r.id} className="rounded-md border p-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="font-medium">{r.docNome}</span>
                  <Badge variant="outline" className="text-[10px]">
                    pág. {r.page}
                  </Badge>
                </div>
                <p className="mt-1 italic text-muted-foreground">“{r.trecho}”</p>
                <div className="mt-1 flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                  >
                    <Link
                      to="/biblioteca/doc/$docId"
                      params={{ docId: String(r.docId) }}
                      search={{ page: r.page, q: "" }}
                    >
                      Abrir
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => db.inspectionRefs.delete(r.id!)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 md:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Checklists ({checklists?.length ?? 0})
            </h3>
          </div>
          {checklists?.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Use “Checklist” em um resultado da Biblioteca para gerar um baseado no procedimento.
            </p>
          )}
          <div className="grid gap-1">
            {checklists?.map((c) => (
              <Link
                key={c.id}
                to="/checklists/$id"
                params={{ id: String(c.id) }}
                className="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-accent"
              >
                <span>
                  <ListChecks className="mr-1 inline h-3 w-3" />
                  {c.titulo}
                </span>
                <Badge variant={c.status === "concluido" ? "default" : "secondary"}>
                  {c.status}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <BibliotecaSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        inspectionId={inspectionId}
      />
    </div>
  );
}

function PhotoThumb({ id }: { id: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    (async () => {
      const rec = await db.inspectionPhotos.get(id);
      if (rec) {
        u = URL.createObjectURL(rec.blob);
        setUrl(u);
      }
    })();
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [id]);
  return (
    <div className="relative aspect-square overflow-hidden rounded border bg-muted">
      {url && <img src={url} alt="foto" className="h-full w-full object-cover" />}
      <Button
        size="icon"
        variant="destructive"
        className="absolute right-1 top-1 h-6 w-6"
        onClick={() => db.inspectionPhotos.delete(id)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
