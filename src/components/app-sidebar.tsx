"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, Settings, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projetos", label: "Projetos", icon: FolderKanban },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { session } = useAuth();
  const isAdmin = session?.role === "admin";

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card sm:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <span className="font-data text-sm font-semibold tracking-wide">Gestão de Riscos</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {isAdmin && (
        <div className="p-3">
          <Link
            href="/configuracoes"
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/configuracoes")
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
        </div>
      )}
      <div className="border-t border-border p-3 text-xs text-muted-foreground">
        {isAdmin ? "Perfil: administrador" : "Perfil: usuário"}
      </div>
    </aside>
  );
}
