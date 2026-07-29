import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search as SearchIcon, ExternalLink, Copy, Link2, ListChecks, Star } from "lucide-react";
import { search, type SearchHit } from "@/lib/biblioteca/search";
import { db } from "@/lib/biblioteca/db";
import { createChecklistFromSource } from "@/lib/biblioteca/checklist";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  inspectionId: number | null;
}

export function BibliotecaSheet({ open, onOpenChange, inspectionId }: Props) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await search(q);
        setHits(r);
      } catch (e) {
        console.error(e);
        toast.error("Falha ao pesquisar.");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function copyTrecho(hit: SearchHit) {
    try {
      await navigator.clipboard.writeText(
        `"${hit.snippet}"\n\n— ${hit.doc.nome}${hit.doc.orgao ? " · " + hit.doc.orgao : ""} · página ${hit.page}`,
      );
      toast.success("Trecho copiado com fonte.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  async function useInInspection(hit: SearchHit) {
    if (!inspectionId) {
      toast.error("Nenhuma inspeção ativa. Abra uma inspeção primeiro.");
      return;
    }
    await db.inspectionRefs.add({
      inspectionId,
      docId: hit.docId,
      docNome: hit.doc.nome,
      orgao: hit.doc.orgao,
      versao: hit.doc.versao,
      page: hit.page,
      trecho: hit.snippet,
      createdAt: Date.now(),
    });
    toast.success("Referência vinculada à inspeção.");
  }

  async function genChecklist(hit: SearchHit) {
    const id = await createChecklistFromSource({
      titulo: `${hit.doc.nome} — pág. ${hit.page}`,
      procedimento: hit.snippet,
      inspectionId: inspectionId ?? undefined,
      sourceDocId: hit.docId,
      sourceDocNome: hit.doc.nome,
      sourcePage: hit.page,
      sourceTrecho: hit.snippet,
    });
    toast.success("Checklist criado.");
    onOpenChange(false);
    navigate({ to: "/checklists/$id", params: { id: String(id) } });
  }

  async function fav(hit: SearchHit) {
    await db.favorites.add({
      docId: hit.docId,
      page: hit.page,
      snippet: hit.snippet,
      createdAt: Date.now(),
    });
    toast.success("Favoritado.");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>📚 Biblioteca Técnica</SheetTitle>
        </SheetHeader>
        <div className="mt-3 flex flex-col gap-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Pesquisar norma, patologia, procedimento…"
              className="pl-9 h-11 text-base"
              inputMode="search"
            />
          </div>
          {loading && <p className="text-xs text-muted-foreground">Pesquisando…</p>}
          {!loading && q && hits.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum resultado.</p>
          )}
          <div className="flex flex-col gap-2">
            {hits.map((h) => (
              <Card key={`${h.docId}:${h.page}`} className="p-3">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-sm font-medium">{h.doc.nome}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    pág. {h.page}
                  </Badge>
                  {h.doc.orgao && (
                    <Badge variant="outline" className="text-[10px]">
                      {h.doc.orgao}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs italic text-muted-foreground">
                  “{h.snippet}”
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      navigate({
                        to: "/biblioteca/doc/$docId",
                        params: { docId: String(h.docId) },
                        search: { page: h.page, q },
                      });
                    }}
                  >
                    <ExternalLink className="mr-1 h-3 w-3" /> Abrir
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copyTrecho(h)}>
                    <Copy className="mr-1 h-3 w-3" /> Copiar
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => useInInspection(h)}
                    disabled={!inspectionId}
                  >
                    <Link2 className="mr-1 h-3 w-3" /> Usar aqui
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => genChecklist(h)}>
                    <ListChecks className="mr-1 h-3 w-3" /> Checklist
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => fav(h)}>
                    <Star className="mr-1 h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
