import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { db } from "@/lib/biblioteca/db";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/biblioteca/glossario")({
  head: () => ({
    meta: [
      { title: "Glossário Técnico – Biblioteca Técnica" },
      {
        name: "description",
        content:
          "Glossário técnico extraído dos documentos oficiais indexados, com fonte e página.",
      },
      { property: "og:title", content: "Glossário Técnico – Biblioteca Técnica" },
      { property: "og:description", content: "Termos técnicos com fonte e página." },
    ],
  }),
  component: GlossaryPage,
});

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const PAGE_SIZE = 20;

function GlossaryPage() {
  const all = useLiveQuery(() => db.glossary.toArray(), [], []);
  const [q, setQ] = useState("");
  const [letter, setLetter] = useState<string | null>(null);
  const [pg, setPg] = useState(0);

  const filtered = useMemo(() => {
    if (!all) return [];
    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let out = all;
    if (letter) out = out.filter((t) => norm(t.term).startsWith(letter.toLowerCase()));
    if (q.trim()) {
      const nq = norm(q);
      out = out.filter((t) => norm(t.term).includes(nq) || norm(t.definition ?? "").includes(nq));
    }
    return out.sort((a, b) => a.term.localeCompare(b.term, "pt-BR"));
  }, [all, q, letter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = filtered.slice(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-3 text-xl font-semibold">Glossário Técnico</h1>
      <Card className="p-3">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPg(0);
          }}
          placeholder="Buscar termo ou definição…"
        />
        <div className="mt-2 flex flex-wrap gap-1">
          <Button
            size="sm"
            variant={!letter ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            onClick={() => {
              setLetter(null);
              setPg(0);
            }}
          >
            Todos
          </Button>
          {ALPHABET.map((l) => (
            <Button
              key={l}
              size="sm"
              variant={letter === l ? "default" : "outline"}
              className="h-7 w-7 p-0 text-xs"
              onClick={() => {
                setLetter(l);
                setPg(0);
              }}
            >
              {l}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {filtered.length} termo(s). Fonte: documentos indexados na Biblioteca Técnica.
        </p>
      </Card>

      {filtered.length === 0 && (
        <Card className="mt-3 p-6 text-sm text-muted-foreground">
          Nenhum termo encontrado. O glossário é preenchido automaticamente a partir dos
          documentos indexados.
        </Card>
      )}

      <div className="mt-3 grid gap-2">
        {page.map((t) => (
          <Card key={t.id} className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{t.term}</h3>
              {t.orgao && <Badge variant="outline">{t.orgao}</Badge>}
              <Badge variant="secondary">pág. {t.page}</Badge>
            </div>
            {t.definition ? (
              <p className="mt-1 text-sm">{t.definition}</p>
            ) : (
              <p className="mt-1 text-xs italic text-muted-foreground">
                Termo encontrado nos documentos, mas sem definição formal identificada.
              </p>
            )}
            <div className="mt-1 text-xs text-muted-foreground">
              Fonte: {t.docNome} · página {t.page}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <Button size="sm" variant="outline" asChild>
                <Link
                  to="/biblioteca/doc/$docId"
                  params={{ docId: String(t.docId) }}
                  search={{ page: t.page, q: t.term }}
                >
                  <ExternalLink className="mr-1 h-3 w-3" /> Abrir no manual
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `${t.term}${t.definition ? ": " + t.definition : ""}\n— ${t.docNome} · pág. ${t.page}`,
                  );
                  toast.success("Copiado.");
                }}
              >
                <Copy className="mr-1 h-3 w-3" /> Copiar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await db.favorites.add({
                    docId: t.docId,
                    page: t.page,
                    snippet: t.term,
                    createdAt: Date.now(),
                  });
                  toast.success("Favoritado.");
                }}
              >
                <Star className="mr-1 h-3 w-3" /> Favoritar
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setPg((p) => Math.max(0, p - 1))} disabled={pg === 0}>
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            Página {pg + 1} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPg((p) => Math.min(totalPages - 1, p + 1))}
            disabled={pg >= totalPages - 1}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
