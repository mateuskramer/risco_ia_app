"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, UploadCloud, FileText, Bot, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import * as api from "@/lib/storage";
import { RiskDocument } from "@/lib/types";
import { toast } from "sonner";

export function PdfUploadDialog({ onUploaded }: { onUploaded: (doc: RiskDocument) => void }) {
  const { session } = useAuth();
  const isAdmin = session?.role === "admin";
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [hasActiveAgents, setHasActiveAgents] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCheckingSetup(true);
    api
      .hasActiveRisks()
      .then(setHasActiveAgents)
      .catch(() => setHasActiveAgents(false))
      .finally(() => setCheckingSetup(false));
  }, [open]);

  const ready = hasActiveAgents;

  async function handleUpload() {
    if (!session || !file) return;
    setAnalyzing(true);
    try {
      const doc = await api.uploadDocument(file, description);
      if (doc.warning) {
        toast.warning(doc.warning);
      } else {
        toast.success("PDF enviado e analisado pelos riscos configurados.");
      }
      onUploaded(doc);
      setOpen(false);
      setFile(null);
      setDescription("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o projeto.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !analyzing && setOpen(v)}>
      <DialogTrigger asChild>
        <Button>
          <UploadCloud className="h-4 w-4" /> Enviar PDF
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar projeto para análise</DialogTitle>
          <DialogDescription>
            O PDF é lido pelos riscos configurados em &ldquo;Configurações&rdquo; e recebe um score de
            risco de 0 a 100.
          </DialogDescription>
        </DialogHeader>

        {!checkingSetup && !ready ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center">
            <Bot className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Nenhum risco configurado ainda</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isAdmin
                  ? "Cadastre pelo menos um risco (nome + prompt) antes de enviar projetos."
                  : "Peça a um administrador para configurar os riscos antes de enviar projetos."}
              </p>
            </div>
            {isAdmin && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/configuracoes" onClick={() => setOpen(false)}>
                  Ir para Configurações <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div
            className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:border-primary/50"
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <>
                <FileText className="h-8 w-8 text-primary" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">Clique para trocar o arquivo</p>
              </>
            ) : (
              <>
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Clique para selecionar um PDF</p>
                <p className="text-xs text-muted-foreground">
                  O PDF é enviado de verdade e analisado pelos riscos configurados.
                </p>
              </>
            )}
          </div>
        )}

        {!checkingSetup && ready && (
          <div className="grid gap-2">
            <Label htmlFor="project-description" className="text-sm">
              Descrição <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="project-description"
              placeholder="Uma frase sobre o que é este projeto — aparece na listagem, ajuda a identificar."
              rows={3}
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={analyzing}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={analyzing}>
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={!file || analyzing || !ready}>
            {analyzing && <Loader2 className="h-4 w-4 animate-spin" />}
            {analyzing ? "Analisando…" : "Enviar e analisar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
