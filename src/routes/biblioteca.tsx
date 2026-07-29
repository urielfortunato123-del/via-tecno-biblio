import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/biblioteca")({
  head: () => ({
    meta: [
      { title: "Biblioteca Técnica – Via Norma" },
      {
        name: "description",
        content:
          "Biblioteca Técnica offline: pesquise em normas e procedimentos com citação de documento, página e trecho.",
      },
      { property: "og:title", content: "Biblioteca Técnica – Via Norma" },
      {
        property: "og:description",
        content: "Centro de conhecimento técnico offline para fiscalização rodoviária.",
      },
    ],
  }),
  component: BibliotecaLayout,
});

function BibliotecaLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: "/biblioteca", label: "Pesquisar" },
    { to: "/biblioteca/documentos", label: "Documentos" },
    { to: "/biblioteca/favoritos", label: "Favoritos" },
    { to: "/biblioteca/historico", label: "Histórico" },
    { to: "/biblioteca/admin", label: "Admin" },
  ];
  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 px-3 py-6 sm:px-4">
      <div className="mb-4 min-w-0 border-b pb-3">
        <h1 className="mb-2 text-xl font-semibold break-words">📚 Biblioteca Técnica</h1>
        <nav
          className="-mx-1 flex gap-1 overflow-x-auto whitespace-nowrap px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {tabs.map((t) => {
            const active = t.to === "/biblioteca" ? path === t.to : path.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
