"use client";

import { useEffect, useMemo, useState } from "react";
import { Cpu, Loader2, History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { SystemSettings } from "@/lib/types";
import { LLM_MODEL_GROUPS, CUSTOM_MODEL_VALUE, isKnownModel } from "@/lib/models";
import * as api from "@/lib/storage";
import { toast } from "sonner";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function SystemModelCard() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [modelSelect, setModelSelect] = useState<string>(LLM_MODEL_GROUPS[0].options[0].value);
  const [customModel, setCustomModel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSystemSettings().then((s) => {
      setSettings(s);
      if (s.model) {
        const known = isKnownModel(s.model);
        setModelSelect(known ? s.model : CUSTOM_MODEL_VALUE);
        setCustomModel(known ? "" : s.model);
      }
      setLoading(false);
    });
  }, []);

  const finalModel = useMemo(
    () => (modelSelect === CUSTOM_MODEL_VALUE ? customModel.trim() : modelSelect),
    [modelSelect, customModel]
  );

  const dirty = finalModel !== "" && finalModel !== settings?.model;

  async function handleSave() {
    if (!session || !finalModel) return;
    setSaving(true);
    try {
      const updated = await api.updateSystemModel(finalModel, session);
      setSettings(updated);
      toast.success("Modelo de IA do sistema atualizado.");
    } catch {
      toast.error("Não foi possível salvar o modelo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cpu className="h-4 w-4" /> Modelo de IA do sistema
        </CardTitle>
        <CardDescription>Usado por todos os riscos ao analisar um projeto — um modelo único para todos os prompts.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={modelSelect} onValueChange={setModelSelect}>
                <SelectTrigger className="sm:max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LLM_MODEL_GROUPS.map((group) => (
                    <SelectGroup key={group.provider}>
                      <SelectLabel>{group.provider}</SelectLabel>
                      {group.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                          {opt.note ? ` · ${opt.note}` : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                  <SelectGroup>
                    <SelectLabel>Outro</SelectLabel>
                    <SelectItem value={CUSTOM_MODEL_VALUE}>Personalizado…</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {modelSelect === CUSTOM_MODEL_VALUE && (
                <Input
                  className="font-data sm:max-w-xs"
                  placeholder="id do modelo, ex.: anthropic/claude-sonnet-5"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                />
              )}
              <Button onClick={handleSave} disabled={!dirty || saving} className="sm:ml-auto">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>

            {!settings?.model && (
              <p className="text-xs text-muted-foreground">
                Nenhum modelo configurado ainda — os riscos não conseguem analisar projetos até você salvar um aqui.
              </p>
            )}

            {settings && settings.history.length > 0 && (
              <details>
                <summary className="flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
                  <History className="h-3.5 w-3.5" /> Ver {settings.history.length} modelo(s) anterior(es)
                </summary>
                <ul className="mt-2 flex flex-col gap-1 border-l border-border pl-3">
                  {[...settings.history].reverse().map((h, i) => (
                    <li key={i} className="font-data text-xs text-muted-foreground">
                      {h.model} · {h.updatedBy} · {formatDateTime(h.updatedAt)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
