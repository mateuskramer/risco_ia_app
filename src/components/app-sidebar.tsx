"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  ShieldCheck,
  FileText,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { RiskDocument } from "@/lib/types";
import * as api from "@/lib/storage";

export function AppSidebar() {
  const pathname = usePathname();
  const { session } = useAuth();
  const isAdmin = session?.role === "admin";
  const [projects, setProjects] = useState<RiskDocument[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const docs = await api.listDocuments();
        setProjects(docs);
      } catch (err) {
        console.error("Erro ao carregar projetos na barra lateral:", err);
      } finally {
        setLoadingProjects(false);
      }
    })();
  }, [pathname]);

  const isProjectsActive = pathname.startsWith("/projetos");

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-card sm:flex sticky top-0 h-screen transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Topo do Sidebar (Logo + Botão de Recolher/Expandir) */}
      <div className={cn("flex h-16 items-center border-b border-border px-3", isCollapsed ? "justify-center" : "justify-between px-4")}>
        {!isCollapsed && (
          <div className="flex items-center gap-2 truncate">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="font-data text-sm font-semibold tracking-wide truncate">Gestão de Riscos</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          title={isCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
        >
          {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto p-2.5 gap-1">
        {/* Item Dashboard */}
        <Link
          href="/dashboard"
          title="Dashboard"
          className={cn(
            "flex items-center gap-2.5 rounded-md py-2 text-sm font-medium transition-colors",
            isCollapsed ? "justify-center px-0" : "px-3",
            pathname === "/dashboard" || pathname.startsWith("/dashboard/")
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          )}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Dashboard</span>}
        </Link>

        {/* Item Projetos */}
        <div className="flex flex-col gap-1 mt-1">
          <div
            className={cn(
              "flex items-center rounded-md text-sm font-medium transition-colors group",
              isCollapsed ? "justify-center py-2" : "justify-between px-3 py-2",
              isProjectsActive
                ? "bg-accent text-accent-foreground font-semibold"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <Link
              href="/projetos"
              title="Projetos"
              className={cn("flex items-center gap-2.5 flex-1", isCollapsed && "justify-center")}
            >
              <FolderKanban className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>Projetos</span>}
            </Link>

            {!isCollapsed && (
              <div className="flex items-center gap-1.5">
                {projects.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {projects.length}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setProjectsOpen(!projectsOpen)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                  title={projectsOpen ? "Recolher projetos" : "Expandir projetos"}
                >
                  {projectsOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Sub-lista de Projetos (se expandido) */}
          {!isCollapsed && projectsOpen && (
            <div className="ml-3 flex flex-col gap-0.5 border-l border-border/60 pl-2 my-1 animate-fade-in">
              {loadingProjects ? (
                <span className="px-2 py-1 text-[11px] text-muted-foreground italic">Carregando...</span>
              ) : projects.length === 0 ? (
                <span className="px-2 py-1 text-[11px] text-muted-foreground italic">Nenhum projeto</span>
              ) : (
                projects.map((p) => {
                  const isCurrentProject = pathname === `/projetos/${p.id}`;
                  return (
                    <Link
                      key={p.id}
                      href={`/projetos/${p.id}`}
                      title={p.fileName}
                      className={cn(
                        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors truncate",
                        isCurrentProject
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
                      <span className="truncate">{p.fileName}</span>
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>
      </nav>

      {isAdmin && (
        <div className="p-2.5 border-t border-border/40">
          <Link
            href="/configuracoes"
            title="Configurações"
            className={cn(
              "flex items-center gap-2.5 rounded-md py-2 text-sm font-medium transition-colors",
              isCollapsed ? "justify-center px-0" : "px-3",
              pathname.startsWith("/configuracoes")
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span>Configurações</span>}
          </Link>
        </div>
      )}

      <div className={cn("border-t border-border p-3 text-xs text-muted-foreground truncate", isCollapsed && "text-center text-[10px]")}>
        {isCollapsed ? (isAdmin ? "Admin" : "User") : isAdmin ? "Perfil: administrador" : "Perfil: usuário"}
      </div>
    </aside>
  );
}
