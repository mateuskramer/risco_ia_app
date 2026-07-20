"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const ADMIN_ONLY_PREFIXES = ["/configuracoes"];

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isBlocked = session.role !== "admin" && ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p));

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <AppTopbar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isBlocked ? (
            <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-risk-high-bg text-risk-high">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold">Acesso restrito</h2>
              <p className="text-sm text-muted-foreground">
                Esta área é exclusiva para administradores. Fale com um administrador se precisar de acesso.
              </p>
              <Button asChild variant="outline" className="mt-2">
                <Link href="/dashboard">Voltar ao dashboard</Link>
              </Button>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
