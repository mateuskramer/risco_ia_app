"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, Pencil, Trash2, History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AgentPromptDialog } from "@/components/agent-prompt-dialog";
import { SystemModelCard } from "@/components/system-model-card";
import { AgentPrompt } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import * as api from "@/lib/storage";
import { toast } from "sonner";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function RiscosTab() {
  const { session } = useAuth();
  const [risks, setRisks] = useState<AgentPrompt[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setRisks(await api.listAgentPrompts());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggleActive(risk: AgentPrompt, active: boolean) {
    if (!session) return;
    const saved = await api.updateAgentPrompt(risk.id, { active });
    setRisks((prev) => prev.map((r) => (r.id === risk.id ? saved : r)));
    toast.success(active ? "Risco ativado." : "Risco desativado — ele deixa de rodar em novas análises.");
  }

  async function handleDelete(risk: AgentPrompt) {
    if (!window.confirm(`Remover o risco "${risk.riskName}"? Essa ação não pode ser desfeita.`)) return;
    await api.deleteAgentPrompt(risk.id);
    setRisks((prev) => prev.filter((r) => r.id !== risk.id));
    toast.success("Risco removido.");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Riscos</h3>
        </div>
        <AgentPromptDialog onSaved={(r) => setRisks((prev) => [...prev, r])} />
      </div>

      <SystemModelCard />

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : risks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Nenhum risco configurado</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Crie o primeiro risco para começar a analisar os projetos enviados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {risks.map((risk) => (
            <Card key={risk.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    {risk.riskName}
                    {!risk.active && (
                      <Badge variant="outline" className="text-muted-foreground">
                        inativo
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">{risk.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={risk.active} onCheckedChange={(v) => handleToggleActive(risk, v)} />
                  <AgentPromptDialog
                    agent={risk}
                    onSaved={(saved) => setRisks((prev) => prev.map((r) => (r.id === risk.id ? saved : r)))}
                    trigger={
                      <Button variant="ghost" size="icon" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <Button variant="ghost" size="icon" title="Excluir" onClick={() => handleDelete(risk)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <pre className="whitespace-pre-wrap rounded-md bg-muted px-3 py-2.5 font-data text-xs leading-relaxed text-foreground">
                  {risk.prompt}
                </pre>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-data">
                    versão {risk.currentVersion} · atualizado por {risk.updatedBy} em {formatDateTime(risk.updatedAt)}
                  </span>
                  {risk.history.length > 0 && (
                    <details className="group">
                      <summary className="flex cursor-pointer items-center gap-1 font-medium text-foreground [&::-webkit-details-marker]:hidden">
                        <History className="h-3.5 w-3.5" /> Ver {risk.history.length} versão(ões) anterior(es)
                      </summary>
                      <ul className="mt-2 flex flex-col gap-2 border-l border-border pl-3">
                        {[...risk.history].reverse().map((v) => (
                          <li key={v.version}>
                            <p className="font-data text-xs text-muted-foreground">
                              v{v.version} · {v.updatedBy} · {formatDateTime(v.updatedAt)}
                            </p>
                            <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted/60 px-3 py-2 font-data text-xs leading-relaxed text-muted-foreground">
                              {v.prompt}
                            </pre>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
