"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Login realizado com sucesso.");
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm animate-slide-up">
      <CardHeader>
        <CardTitle className="text-xl">Entrar</CardTitle>
        <CardDescription>Acesse com o e-mail e a senha cadastrados.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="voce@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="rounded-md bg-risk-high-bg px-3 py-2 text-sm text-risk-high" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting} className="mt-1">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Entrar
          </Button>
        </form>

        <p className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          A senha é verificada no servidor com hash bcrypt; a sessão fica num cookie httpOnly, não
          acessível por JavaScript.
        </p>

        <div className="mt-4 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          Ainda não tem conta? O <span className="font-medium text-foreground">primeiro cadastro</span> do
          sistema vira administrador automaticamente.
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-medium text-primary hover:underline">
            Cadastre-se
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
