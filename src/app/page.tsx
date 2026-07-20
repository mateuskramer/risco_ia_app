"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-context";

export default function LandingPage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) router.replace("/dashboard");
  }, [loading, session, router]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4 sm:px-10">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="font-data text-sm font-semibold tracking-wide">Gestão de Riscos</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center animate-fade-in">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Gestão de Riscos</h1>
          <p className="text-sm text-muted-foreground">Análise de risco em projetos</p>
        </div>

        <div className="flex w-full max-w-xs flex-col gap-3">
          <Button size="lg" asChild>
            <Link href="/login">Entrar</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/cadastro">Cadastrar</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
