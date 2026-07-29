import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Search, FolderOpen, Settings } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Via Norma – Assistente Técnico de Campo" },
      {
        name: "description",
        content:
          "Portal do Via Norma. Acesse a Biblioteca Técnica offline com normas, procedimentos e patologias.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Via Norma</h1>
        <p className="mt-2 text-muted-foreground">
          Assistente técnico de campo para fiscalização rodoviária.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/biblioteca">
          <Card className="group flex h-full flex-col gap-2 p-6 transition-colors hover:border-primary hover:bg-accent/40">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <BookOpen className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold">📚 Biblioteca Técnica</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Consulte normas, procedimentos e patologias — mesmo offline. Resposta com documento,
              página e trecho original.
            </p>
          </Card>
        </Link>

        <Link to="/biblioteca/documentos">
          <Card className="group flex h-full flex-col gap-2 p-6 transition-colors hover:border-primary hover:bg-accent/40">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <FolderOpen className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold">Documentos</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Navegue pelos documentos cadastrados por categoria, órgão e ano.
            </p>
          </Card>
        </Link>

        <Link to="/biblioteca">
          <Card className="group flex h-full flex-col gap-2 p-6 transition-colors hover:border-primary hover:bg-accent/40">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <Search className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold">Pesquisa Rápida</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Busque por palavra-chave, sinônimo ou categoria — resultados citando a fonte oficial.
            </p>
          </Card>
        </Link>

        <Link to="/biblioteca/admin">
          <Card className="group flex h-full flex-col gap-2 p-6 transition-colors hover:border-primary hover:bg-accent/40">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <Settings className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold">Administração</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Importe PDF/TXT, organize por categoria e mantenha a base offline atualizada.
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
