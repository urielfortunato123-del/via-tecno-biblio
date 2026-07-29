import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Search as SearchIcon, FileText, Star, ArrowRight, Mic } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/lib/biblioteca/db";
import { CATEGORIES } from "@/lib/biblioteca/categories";
import { search, type SearchHit } from "@/lib/biblioteca/search";
import { recordHistory } from "@/lib/biblioteca/hooks";
import { toast } from "sonner";

export const Route = createFileRoute("/biblioteca/")({
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState<string>("__all__");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

  const docCount = useLiveQuery(() => db.docs.count(), [], 0);
  const recentDocs = useLiveQuery(
    () => db.docs.orderBy("createdAt").reverse().limit(6).toArray(),
    [],
    [],
  );
  const recentSearches = useLiveQuery(
    () => db.history.orderBy("createdAt").reverse().limit(6).toArray(),
    [],
    [],
  );
  const favorites = useLiveQuery(
    () => db.favorites.orderBy("createdAt").reverse().limit(6).toArray(),
    [],
    [],
  );

  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await search(q, {
          categoria: categoria === "__all__" ? undefined : categoria,
        });
        setHits(res);
        if (res.length > 0) void recordHistory(q);
      } catch (e) {
        console.error(e);
        toast.error("Falha ao pesquisar");
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [q, categoria]);

  const empty = !searching && q.trim().length > 0 && hits.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="O que deseja consultar?"
              className="pl-9 text-base h-11"
              autoFocus
              inputMode="search"
            />
          </div>
          <div className="flex gap-2">
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as categorias</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              title="Pesquisa por voz (em breve)"
              onClick={() => toast.info("Pesquisa por voz será habilitada em breve.")}
            >
              <Mic className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {docCount ?? 0} documento(s) na biblioteca. As pesquisas ocorrem localmente, no dispositivo.
        </div>
      </Card>

      {docCount === 0 && (
        <Card className="border-dashed p-6 text-center">
          <div className="mx-auto max-w-lg">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold">Sua biblioteca está vazia</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nenhum documento oficial foi cadastrado. Toda resposta desta ferramenta cita a fonte
              — por isso não há dados fictícios pré-carregados. Importe seus PDFs e TXTs para
              começar.
            </p>
            <Button className="mt-4" onClick={() => navigate({ to: "/biblioteca/admin" })}>
              Importar documento
            </Button>
          </div>
        </Card>
      )}

      {searching && <div className="text-sm text-muted-foreground">Pesquisando…</div>}

      {empty && (
        <Card className="p-6">
          <p className="text-sm">
            <strong>Informação não encontrada na biblioteca técnica.</strong>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nenhum trecho corresponde a “{q}”. Tente sinônimos ou verifique se o documento oficial
            foi cadastrado.
          </p>
        </Card>
      )}

      {hits.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-muted-foreground">
            {hits.length} resultado(s) encontrado(s)
          </div>
          {hits.map((h) => (
            <ResultCard key={`${h.docId}:${h.page}`} hit={h} query={q} />
          ))}
        </div>
      )}

      {!q && (
        <div className="grid gap-4 md:grid-cols-3">
          <PanelList title="Últimas pesquisas" empty="Sem pesquisas ainda.">
            {recentSearches?.map((h) => (
              <button
                key={h.id}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => setQ(h.query)}
              >
                <span className="truncate">{h.query}</span>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </PanelList>
          <PanelList title="Favoritos" empty="Marque trechos importantes como favoritos.">
            {favorites?.map((f) => (
              <Link
                key={f.id}
                to="/biblioteca/doc/$docId"
                params={{ docId: String(f.docId) }}
                search={{ page: f.page ?? 1, q: "" }}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Star className="h-3 w-3 text-amber-500" />
                <span className="truncate">
                  Doc #{f.docId} — pág. {f.page ?? 1}
                </span>
              </Link>
            ))}
          </PanelList>
          <PanelList title="Documentos recentes" empty="Nenhum documento importado.">
            {recentDocs?.map((d) => (
              <Link
                key={d.id}
                to="/biblioteca/doc/$docId"
                params={{ docId: String(d.id) }}
                search={{ page: 1, q: "" }}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="truncate">{d.nome}</span>
              </Link>
            ))}
          </PanelList>
        </div>
      )}

      {!q && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Categorias</h3>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setCategoria(c);
                  setQ(c.split(" ")[0].toLowerCase());
                }}
                className="rounded-full border px-3 py-1 text-xs hover:bg-accent"
              >
                {c}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function PanelList({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = useMemo(
    () => Array.isArray(children) && (children as unknown[]).length > 0,
    [children],
  );
  return (
    <Card className="p-3">
      <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-col">
        {hasChildren ? children : <p className="px-2 py-1 text-xs text-muted-foreground">{empty}</p>}
      </div>
    </Card>
  );
}

function ResultCard({ hit, query }: { hit: SearchHit; query: string }) {
  const d = hit.doc;
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">{d.nome}</h3>
        <Badge variant="secondary">{d.categoria}</Badge>
        {d.orgao && <Badge variant="outline">{d.orgao}</Badge>}
        {d.ano && <Badge variant="outline">{d.ano}</Badge>}
        <Badge variant={d.status === "vigente" ? "default" : "secondary"}>{d.status}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Página {hit.page} — <span className="italic">“{hit.snippet}”</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <Link
            to="/biblioteca/doc/$docId"
            params={{ docId: String(hit.docId) }}
            search={{ page: hit.page, q: query }}
            onClick={() => void recordHistory(query, hit.docId, hit.page)}
          >
            Abrir na página {hit.page}
          </Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await db.favorites.add({
              docId: hit.docId,
              page: hit.page,
              snippet: hit.snippet,
              createdAt: Date.now(),
            });
            toast.success("Adicionado aos favoritos");
          }}
        >
          <Star className="mr-1 h-3 w-3" /> Favoritar
        </Button>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Fonte: {d.nome}
        {d.orgao ? ` · ${d.orgao}` : ""}
        {d.ano ? ` · ${d.ano}` : ""}
        {d.versao ? ` · v${d.versao}` : ""} · página {hit.page}
      </div>
    </Card>
  );
}
