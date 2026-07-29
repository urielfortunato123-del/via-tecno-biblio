import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES } from "@/lib/biblioteca/categories";
import { db, type DocStatus } from "@/lib/biblioteca/db";
import { importDocument } from "@/lib/biblioteca/import";
import { deleteDocument } from "@/lib/biblioteca/import";
import { rebuildIndex } from "@/lib/biblioteca/search";
import { toast } from "sonner";
import { Trash2, Upload, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/biblioteca/admin")({
  component: AdminPage,
});

function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<string>(CATEGORIES[0]);
  const [orgao, setOrgao] = useState("");
  const [ano, setAno] = useState<string>("");
  const [versao, setVersao] = useState("");
  const [status, setStatus] = useState<DocStatus>("vigente");
  const [autor, setAutor] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [importing, setImporting] = useState(false);

  const docs = useLiveQuery(
    () => db.docs.orderBy("createdAt").reverse().toArray(),
    [],
    [],
  );
  const totalPages = useLiveQuery(() => db.pages.count(), [], 0);

  async function handleImport() {
    if (!file) {
      toast.error("Selecione um arquivo PDF ou TXT.");
      return;
    }
    if (!nome.trim()) {
      toast.error("Informe o nome do documento.");
      return;
    }
    setImporting(true);
    try {
      const docId = await importDocument(file, {
        nome,
        descricao,
        categoria,
        orgao: orgao || undefined,
        ano: ano ? Number(ano) : undefined,
        versao: versao || undefined,
        status,
        autor: autor || undefined,
        observacoes: observacoes || undefined,
      });
      toast.success(`Documento importado (#${docId}).`);
      setFile(null);
      setNome("");
      setDescricao("");
      setOrgao("");
      setAno("");
      setVersao("");
      setAutor("");
      setObservacoes("");
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Falha ao importar. Verifique o arquivo.",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Upload className="h-4 w-4" /> Importar documento
        </h2>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="arq">Arquivo (PDF ou TXT)</Label>
            <Input
              id="arq"
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !nome) setNome(f.name.replace(/\.[^.]+$/, ""));
              }}
            />
            {file && (
              <p className="mt-1 text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="desc">Descrição</Label>
            <Textarea
              id="desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria *</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as DocStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vigente">Vigente</SelectItem>
                  <SelectItem value="revogado">Revogado</SelectItem>
                  <SelectItem value="substituido">Substituído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="orgao">Órgão</Label>
              <Input
                id="orgao"
                value={orgao}
                onChange={(e) => setOrgao(e.target.value)}
                placeholder="DER, DNIT…"
              />
            </div>
            <div>
              <Label htmlFor="ano">Ano</Label>
              <Input
                id="ano"
                type="number"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="versao">Versão</Label>
              <Input id="versao" value={versao} onChange={(e) => setVersao(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="autor">Autor</Label>
            <Input id="autor" value={autor} onChange={(e) => setAutor(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importando…" : "Importar"}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await rebuildIndex();
                toast.success("Índice reconstruído.");
              }}
            >
              <RefreshCw className="mr-1 h-3 w-3" /> Reconstruir índice
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            PDFs escaneados sem texto selecionável ficarão marcados como “OCR pendente”. Uma
            camada OCR pode ser conectada nesta mesma arquitetura no futuro.
          </p>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Documentos cadastrados</h2>
          <span className="text-xs text-muted-foreground">
            {docs?.length ?? 0} documentos · {totalPages ?? 0} páginas indexadas
          </span>
        </div>
        {(!docs || docs.length === 0) && (
          <p className="text-sm text-muted-foreground">
            Nenhum documento importado ainda.
          </p>
        )}
        <div className="grid gap-2">
          {docs?.map((d) => (
            <div
              key={d.id}
              className="flex items-start gap-2 rounded-md border p-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="font-medium">{d.nome}</span>
                  <Badge variant="secondary">{d.categoria}</Badge>
                  {d.orgao && <Badge variant="outline">{d.orgao}</Badge>}
                  {d.protected && <Badge>Padrão</Badge>}
                  {!d.hasText && <Badge variant="destructive">OCR pendente</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {d.numPages} página(s) · {d.status}
                </div>
              </div>
              {!d.protected ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    if (confirm(`Excluir "${d.nome}"?`)) {
                      try {
                        await deleteDocument(d.id!);
                        toast.success("Documento excluído.");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Falha.");
                      }
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              ) : (
                <span className="text-[10px] text-muted-foreground">protegido</span>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
