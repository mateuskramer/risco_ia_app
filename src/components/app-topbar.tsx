"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FolderKanban, Settings, Menu, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/projetos", label: "Projetos", icon: FolderKanban, adminOnly: false },
  { href: "/configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
];

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/projetos": "Projetos",
  "/configuracoes": "Configurações",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

export function AppTopbar() {
  const { session, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = session?.role === "admin";

  const titleEntry = Object.keys(TITLES).find((k) => pathname === k || pathname.startsWith(k + "/"));
  const title = titleEntry ? TITLES[titleEntry] : "Gestão de Riscos";

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" /> Gestão de Riscos
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <Link href={item.href} className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <h1 className="text-base font-semibold sm:text-lg">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full outline-none" aria-label="Menu da conta">
              <Avatar>
                <AvatarFallback>{session ? initials(session.name) : "?"}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{session?.name}</span>
                <span className="text-xs font-normal text-muted-foreground">{session?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
