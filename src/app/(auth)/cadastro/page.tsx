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

export default function CadastroPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      await register(name, email, password);
      toast.success("Conta criada com sucesso.");
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm animate-slide-up">
      <CardHeader>
        <CardTitle className="text-xl">Criar conta</CardTitle>
        <CardDescription>Leva menos de um minuto.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome completo</Label>
            <Input id="name" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
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
              autoComplete="new-password"
              placeholder="Mínimo de 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Repita a senha"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            Criar conta
          </Button>
        </form>

        <p className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          Sua senha é enviada por HTTPS e gravada no banco só como hash (bcrypt) — o servidor nunca
          guarda a senha em texto puro.
        </p>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem uma conta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
