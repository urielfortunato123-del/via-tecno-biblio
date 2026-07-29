import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { SmrBootstrap } from "@/components/SmrBootstrap";
import { InstallPwaPrompt } from "@/components/InstallPwaPrompt";
import { InspectionProvider } from "@/lib/biblioteca/inspection-context";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço acessado não existe ou foi movido.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocorreu um erro inesperado. Tente novamente ou volte ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" },
      { name: "theme-color", content: "#0f172a" },
      { name: "application-name", content: "Via Norma" },
      { name: "apple-mobile-web-app-title", content: "Via Norma" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "msapplication-TileColor", content: "#0f172a" },
      { name: "msapplication-TileImage", content: "/mstile-150x150.png" },
      { title: "Via Norma – Assistente Técnico de Campo" },
      {
        name: "description",
        content:
          "Sistema profissional de fiscalização rodoviária, Biblioteca Técnica Offline, inspeções de campo, checklists, relatórios e consulta ao Manual SMR.",
      },
      { name: "author", content: "Via Norma" },
      { property: "og:site_name", content: "Via Norma" },
      { property: "og:title", content: "Via Norma – Assistente Técnico de Campo" },
      {
        property: "og:description",
        content:
          "Sistema profissional de fiscalização rodoviária, Biblioteca Técnica Offline, inspeções de campo, checklists, relatórios e consulta ao Manual SMR.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/android-chrome-512.png" },
      { property: "og:image:width", content: "512" },
      { property: "og:image:height", content: "512" },
      { property: "og:image:alt", content: "Via Norma – Assistente Técnico de Campo" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Via Norma – Assistente Técnico de Campo" },
      {
        name: "twitter:description",
        content:
          "Sistema profissional de fiscalização rodoviária, Biblioteca Técnica Offline, inspeções de campo, checklists, relatórios e consulta ao Manual SMR.",
      },
      { name: "twitter:image", content: "/android-chrome-512.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <InspectionProvider>
        <SidebarProvider>
          <div className="flex min-h-[100dvh] w-full min-w-0 max-w-full overflow-x-hidden">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/80 backdrop-blur px-3 pt-[env(safe-area-inset-top)] pl-[max(env(safe-area-inset-left),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)]">
                <SidebarTrigger />
                <span className="truncate text-sm font-medium">Via Norma</span>
              </header>
              <main className="min-w-0 flex-1 overflow-x-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
                {/* Required: nested routes render here. */}
                <Outlet />
              </main>
              <footer className="border-t px-3 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pl-[max(env(safe-area-inset-left),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)] text-center text-xs text-muted-foreground">
                Desenvolvido por Uriel da Fonseca Fortunato
              </footer>
            </div>
          </div>
          <Toaster richColors position="top-right" />
          <SmrBootstrap />
        </SidebarProvider>
      </InspectionProvider>
    </QueryClientProvider>
  );
}
