"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, FileText, Search, Trash2, RefreshCw, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/risk-badge";
import { PdfUploadDialog } from "@/components/pdf-upload-dialog";
import { useAuth } from "@/lib/auth-context";
import { RiskDocument } from "@/lib/types";
import * as api from "@/lib/storage";
import { toast } from "sonner";

const STATUS_LABEL: Record<RiskDocument["status"], string> = {
  pendente: "Pendente",
  processando: "Processando",
  concluido: "Concluído",
  erro: "Erro",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ProjetosPage() {
  const { session } = useAuth();
  const isAdmin = session?.role === "admin";
  const [docs, setDocs] = useState<RiskDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const d = await api.listDocuments();
    setDocs(d);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const scoped = useMemo(() => {
    const base = isAdmin ? docs : docs.filter((d) => d.ownerId === session?.userId);
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q) ||
        d.ownerName.toLowerCase().includes(q)
    );
  }, [docs, isAdmin, session, query]);

  async function handleReanalyze(id: string) {
    if (!session) return;
    setReanalyzingId(id);
    try {
      const updated = await api.reanalyzeDocument(id);
      setDocs((prev) => prev.map((d) => (d.id === id ? updated : d)));
      toast.success("Reanálise concluída. Uma nova versão foi adicionada ao histórico.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível reanalisar o projeto.");
    } finally {
      setReanalyzingId(null);
    }
  }

  async function handleDelete(id: string) {
    await api.deleteDocument(id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
    toast.success("Projeto removido.");
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Projetos</h2>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Todos os projetos enviados pela organização. Você só altera os seus."
              : "Projetos que você enviou para análise."}
          </p>
        </div>
        <PdfUploadDialog onUploaded={(doc) => setDocs((prev) => [doc, ...prev])} />
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={isAdmin ? "Buscar por projeto, descrição ou responsável…" : "Buscar por projeto ou descrição…"}
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : scoped.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Nenhum projeto por aqui</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Envie o primeiro projeto (PDF) para receber o score de risco calculado pelos riscos configurados.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  {isAdmin && <TableHead>Enviado por</TableHead>}
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risco</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scoped.map((doc) => {
                  const canManage = doc.ownerId === session?.userId;
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="max-w-md break-words whitespace-normal">
                        <Link href={`/projetos/${doc.id}`} className="flex items-start gap-2 hover:text-primary leading-snug">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="break-all whitespace-normal font-medium">{doc.title}</span>
                            {doc.description && (
                              <span className="text-xs font-normal text-muted-foreground line-clamp-2">
                                {doc.description}
                              </span>
                            )}
                          </div>
                        </Link>
                      </TableCell>
                      {isAdmin && <TableCell className="text-muted-foreground">{doc.ownerName}</TableCell>}
                      <TableCell className="font-data text-sm text-muted-foreground">{formatDate(doc.uploadedAt)}</TableCell>
                      <TableCell className="font-data text-sm text-muted-foreground">v{doc.currentVersion}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{STATUS_LABEL[doc.status]}</TableCell>
                      <TableCell>
                        {doc.findings.length > 0 ? (
                          <RiskBadge tier={doc.tier} score={doc.overallScore} />
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Pendente de análise
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canManage && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Reanalisar"
                                disabled={reanalyzingId === doc.id}
                                onClick={() => handleReanalyze(doc.id)}
                              >
                                {reanalyzingId === doc.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                              <Button variant="ghost" size="icon" title="Excluir" onClick={() => handleDelete(doc.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" asChild title="Ver detalhes">
                            <Link href={`/projetos/${doc.id}`}>
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
