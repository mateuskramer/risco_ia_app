"use client";

import { useEffect, useState } from "react";
import { Loader2, Bot, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { AgentPrompt } from "@/lib/types";
import * as api from "@/lib/storage";
import { toast } from "sonner";

interface AgentPromptDialogProps {
  agent?: AgentPrompt;
  onSaved: (agent: AgentPrompt) => void;
  trigger?: React.ReactNode;
}

export function AgentPromptDialog({ agent, onSaved, trigger }: AgentPromptDialogProps) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [riskName, setRiskName] = useState(agent?.riskName ?? "");
  const [description, setDescription] = useState(agent?.description ?? "");
  const [prompt, setPrompt] = useState(agent?.prompt ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(agent);

  useEffect(() => {
    if (open) {
      setRiskName(agent?.riskName ?? "");
      setDescription(agent?.description ?? "");
      setPrompt(agent?.prompt ?? "");
      setError(null);
    }
  }, [open, agent]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setError(null);
    try {
      const saved =
        isEdit && agent
          ? await api.updateAgentPrompt(agent.id, { riskName, description, prompt })
          : await api.createAgentPrompt(riskName, description, prompt);
      toast.success(isEdit ? "Risco atualizado. A versão anterior ficou salva no histórico." : "Risco criado.");
      onSaved(saved);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o risco.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4" /> Novo risco
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4" /> {isEdit ? "Editar risco" : "Novo risco"}
          </DialogTitle>
          <DialogDescription>
            Defina o risco a ser avaliado e o prompt que a IA deve seguir ao ler cada projeto. Todos os
            riscos usam o mesmo modelo de IA, configurado no topo desta página.
            {isEdit && " Alterar o prompt cria uma nova versão; a anterior continua disponível no histórico."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="risk-name">Nome do risco</Label>
            <Input
              id="risk-name"
              placeholder="Ex.: Risco Financeiro"
              value={riskName}
              onChange={(e) => setRiskName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="risk-desc">Descrição curta</Label>
            <Input
              id="risk-desc"
              placeholder="O que esse risco avalia, em uma frase"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="risk-prompt">Prompt do risco</Label>
            <Textarea
              id="risk-prompt"
              className="min-h-40 font-data text-sm"
              placeholder="Instruções que a IA deve seguir ao analisar o projeto…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
            />
          </div>

          {error && <p className="rounded-md bg-risk-high-bg px-3 py-2 text-sm text-risk-high">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Criar risco"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
