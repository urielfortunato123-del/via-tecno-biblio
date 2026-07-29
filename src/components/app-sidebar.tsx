import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  BookOpen,
  Search,
  Star,
  History,
  Settings,
  FolderOpen,
  ClipboardList,
  FileText,
  Library,
  Download,
} from "lucide-react";
import { openInstallPromptManually } from "@/components/InstallPwaPrompt";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useOnlineStatus } from "@/lib/biblioteca/hooks";

const mainItems = [
  { title: "Início", url: "/", icon: Home },
  { title: "Inspeções", url: "/inspecao", icon: ClipboardList },
  { title: "Relatórios", url: "/relatorios", icon: FileText },
];

const bibItems = [
  { title: "Pesquisar", url: "/biblioteca", icon: Search },
  { title: "Documentos", url: "/biblioteca/documentos", icon: FolderOpen },
  { title: "Glossário", url: "/biblioteca/glossario", icon: Library },
  { title: "Favoritos", url: "/biblioteca/favoritos", icon: Star },
  { title: "Histórico", url: "/biblioteca/historico", icon: History },
  { title: "Administração", url: "/biblioteca/admin", icon: Settings },
];

export function AppSidebar() {
  const currentPath = useRouterState({
    select: (r) => r.location.pathname,
  });
  const online = useOnlineStatus();
  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-3 py-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Via Norma</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              online ? "bg-emerald-500" : "bg-amber-500"
            }`}
            aria-hidden
          />
          {online ? "Online" : "Offline"}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton asChild isActive={isActive(it.url)}>
                    <Link to={it.url} className="flex items-center gap-2">
                      <it.icon className="h-4 w-4" />
                      <span>{it.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>📚 Biblioteca Técnica</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {bibItems.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton asChild isActive={isActive(it.url)}>
                    <Link to={it.url} className="flex items-center gap-2">
                      <it.icon className="h-4 w-4" />
                      <span>{it.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
