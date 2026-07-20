"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Loader2, TrendingUp, Clock, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskGauge } from "@/components/risk-gauge";
import { RISK_TIER_LABEL, RISK_TIER_TEXT_CLASS, RISK_TIER_BG_CLASS } from "@/lib/risk";
import { DocumentHistoryEntry, RiskDocument, RiskTier } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import * as api from "@/lib/storage";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "há poucos minutos";
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

const ACTION_LABEL: Record<DocumentHistoryEntry["action"], string> = {
  upload: "enviou",
  reanalise: "reanalisou",
  edicao: "editou",
  status: "atualizou o status de",
};

export default function DashboardPage() {
  const { session } = useAuth();
  const isAdmin = session?.role === "admin";
  const [docs, setDocs] = useState<RiskDocument[]>([]);
  const [history, setHistory] = useState<DocumentHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [d, h] = await Promise.all([api.listDocuments(), api.listAllHistory()]);
      setDocs(d);
      setHistory(h);
      setLoading(false);
    })();
  }, []);

  const scopedDocs = useMemo(
    () => (isAdmin ? docs : docs.filter((d) => d.ownerId === session?.userId)),
    [docs, isAdmin, session]
  );

  // Só entram na distribuição de risco e no score médio os projetos que
  // realmente já têm alguma análise — um projeto "pendente" não é risco
  // baixo, é "ainda não sabemos".
  const analyzedDocs = useMemo(() => scopedDocs.filter((d) => d.findings.length > 0), [scopedDocs]);

  const scopedHistory = useMemo(() => {
    const docIds = new Set(scopedDocs.map((d) => d.id));
    return history.filter((h) => docIds.has(h.documentId)).slice(0, 8);
  }, [history, scopedDocs]);

  const counts = useMemo(() => {
    const c: Record<RiskTier, number> = { baixo: 0, medio: 0, alto: 0 };
    analyzedDocs.forEach((d) => c[d.tier]++);
    return c;
  }, [analyzedDocs]);

  const avgScore = useMemo(() => {
    if (analyzedDocs.length === 0) return 0;
    return Math.round(analyzedDocs.reduce((a, d) => a + d.overallScore, 0) / analyzedDocs.length);
  }, [analyzedDocs]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            Olá, {session?.name.split(" ")[0]}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Visão geral de todos os projetos analisados na organização."
              : "Visão geral dos projetos que você enviou."}
          </p>
        </div>
        <Button asChild>
          <Link href="/projetos">
            <Upload className="h-4 w-4" /> Enviar PDF
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Projetos enviados
            </CardDescription>
            <CardTitle className="font-data text-3xl">{scopedDocs.length}</CardTitle>
          </CardHeader>
        </Card>
        {(["baixo", "medio", "alto"] as RiskTier[]).map((tier) => (
          <Card key={tier}>
            <CardHeader className="pb-2">
              <CardDescription>Risco {RISK_TIER_LABEL[tier].toLowerCase()}</CardDescription>
              <CardTitle className={`font-data text-3xl ${RISK_TIER_TEXT_CLASS[tier]}`}>{counts[tier]}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className={`h-1.5 w-full overflow-hidden rounded-full ${RISK_TIER_BG_CLASS[tier]}`}>
                <div
                  className={`h-full rounded-full ${RISK_TIER_TEXT_CLASS[tier]} bg-current opacity-80`}
                  style={{ width: analyzedDocs.length ? `${(counts[tier] / analyzedDocs.length) * 100}%` : "0%" }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="flex flex-col items-center justify-center gap-2 py-8">
          <CardDescription className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Score médio de risco
          </CardDescription>
          {analyzedDocs.length > 0 ? (
            <RiskGauge score={avgScore} size="lg" />
          ) : (
            <p className="mt-4 max-w-xs text-center text-sm text-muted-foreground">
              Nenhum projeto analisado ainda. Envie um PDF na aba Projetos para ver o score aqui.
            </p>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" /> Atividade recente
            </CardTitle>
            <CardDescription>
              {isAdmin ? "Últimas ações de todos os usuários." : "Suas últimas ações."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scopedHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
            ) : (
              <ol className="flex flex-col gap-4">
                {scopedHistory.map((h) => {
                  const doc = docs.find((d) => d.id === h.documentId);
                  return (
                    <li key={h.id} className="flex items-start gap-3 text-sm">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${RISK_TIER_TEXT_CLASS[h.tier]} bg-current`} />
                      <div className="flex-1">
                        <p>
                          <span className="font-medium">{h.actorName}</span> {ACTION_LABEL[h.action]}{" "}
                          <Link href={`/projetos/${h.documentId}`} className="font-medium text-primary hover:underline">
                            {doc?.fileName ?? "projeto removido"}
                          </Link>{" "}
                          <span className="font-data text-muted-foreground">(v{h.version})</span>
                        </p>
                        <p className="font-data text-xs text-muted-foreground">
                          {timeAgo(h.at)} · score {h.overallScore} · {RISK_TIER_LABEL[h.tier]}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
