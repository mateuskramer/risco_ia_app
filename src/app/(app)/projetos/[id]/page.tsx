"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Trash2,
  EyeOff,
  FileText,
  User,
  CalendarDays,
  ExternalLink,
  Download,
  FileDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RiskGauge } from "@/components/risk-gauge";
import { RiskBadge } from "@/components/risk-badge";
import { PdfHistoryTimeline } from "@/components/pdf-history-timeline";
import { PdfChat } from "@/components/pdf-chat";
import { useAuth } from "@/lib/auth-context";
import { DocumentHistoryEntry, RiskDocument } from "@/lib/types";
import * as api from "@/lib/storage";
import { toast } from "sonner";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function ProjetoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [doc, setDoc] = useState<RiskDocument | null | undefined>(undefined);
  const [history, setHistory] = useState<DocumentHistoryEntry[]>([]);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [exporting, setExporting] = useState<"md" | "pdf" | null>(null);

  const load = useCallback(async () => {
    const [d, h] = await Promise.all([api.getDocument(params.id), api.getDocumentHistory(params.id)]);
    setDoc(d);
    setHistory(h);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (doc === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (doc === null) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-16 text-center">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Projeto não encontrado</h2>
        <Button variant="outline" asChild>
          <Link href="/projetos">Voltar para Projetos</Link>
        </Button>
      </div>
    );
  }

  const isAdmin = session?.role === "admin";
  const canManage = doc.ownerId === session?.userId;

  async function handleReanalyze() {
    if (!session || !doc) return;
    const isFirstAnalysis = doc.findings.length === 0;
    setReanalyzing(true);
    try {
      const updated = await api.reanalyzeDocument(doc.id);
      setDoc(updated);
      const h = await api.getDocumentHistory(doc.id);
      setHistory(h);
      toast.success(
        isFirstAnalysis
          ? "Análise concluída."
          : "Nova versão criada no histórico — nada foi sobrescrito."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível analisar o projeto.");
    } finally {
      setReanalyzing(false);
    }
  }

  async function handleDelete() {
    if (!doc) return;
    await api.deleteDocument(doc.id);
    toast.success("Projeto removido.");
    router.replace("/projetos");
  }

  async function handleExportReport(format: "md" | "pdf") {
    if (!doc) return;
    setExporting(format);
    try {
      const res = await fetch(`/api/projects/${doc.id}/report?format=${format}`, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao gerar relatório.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-${doc.fileName.replace(/\.pdf$/i, "")}.${format === "md" ? "md" : "pdf"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar o relatório.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 animate-fade-in">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/projetos">
          <ArrowLeft className="h-4 w-4" /> Voltar para Projetos
        </Link>
      </Button>

      {isAdmin && !canManage && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/60 px-4 py-2.5 text-sm text-muted-foreground">
          <EyeOff className="h-4 w-4 shrink-0" />
          Você está visualizando um projeto de <span className="font-medium text-foreground">{doc.ownerName}</span>.
          Como administrador, você pode ver tudo, mas só quem enviou pode reanalisar ou excluir.
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <FileText className="h-5 w-5 text-muted-foreground" />
            {doc.fileName}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> {doc.ownerName}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> {formatDate(doc.uploadedAt)}
            </span>
            <span className="font-data">versão atual: v{doc.currentVersion}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href={`/api/projects/${doc.id}/file`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> Abrir PDF
            </a>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={exporting !== null}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                Relatório
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportReport("pdf")}>
                <Download className="h-4 w-4" /> Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportReport("md")}>
                <Download className="h-4 w-4" /> Exportar Markdown
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canManage && (
            <>
              <Button variant="outline" onClick={handleReanalyze} disabled={reanalyzing}>
                {reanalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {doc.findings.length === 0 ? "Analisar agora" : "Reanalisar"}
              </Button>
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            </>
          )}
        </div>
      </div>

      {doc.findings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Este projeto ainda não foi analisado</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                O PDF já está salvo — dá pra abrir ele acima. A análise de risco ainda não rodou com
                sucesso {canManage ? '(clique em "Analisar agora" acima pra tentar).' : "."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <Card className="flex flex-col items-center justify-center gap-3 py-8">
            <CardDescription>Score de risco atual</CardDescription>
            <RiskGauge score={doc.overallScore} size="lg" />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Principais riscos encontrados</CardTitle>
              <CardDescription>Um score por tipo de risco configurado.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {[...doc.findings]
                .sort((a, b) => b.score - a.score)
                .map((f) => (
                  <div key={f.id} className="flex flex-col gap-1.5 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">{f.riskName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{f.description}</p>
                    </div>
                    <RiskBadge tier={f.tier} score={f.score} className="w-fit shrink-0" />
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      )}

      <PdfChat documentId={doc.id} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de versões</CardTitle>
          <CardDescription>Cada reanálise soma uma versão nova — o histórico nunca é sobrescrito.</CardDescription>
        </CardHeader>
        <CardContent>
          <PdfHistoryTimeline entries={history} />
        </CardContent>
      </Card>
    </div>
  );
}
