"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, FolderKanban, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/risk-badge";
import { RiskDocument } from "@/lib/types";
import * as api from "@/lib/storage";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ProjetosTab() {
  const [docs, setDocs] = useState<RiskDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listDocuments().then((d) => {
      setDocs(d);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-lg font-semibold">Projetos</h3>
        <p className="text-sm text-muted-foreground">Visão geral de todos os projetos enviados na organização.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <FolderKanban className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Nenhum projeto enviado ainda</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Enviado por</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Risco</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="max-w-md">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{doc.title}</span>
                        {doc.description && (
                          <span className="text-xs text-muted-foreground line-clamp-2">{doc.description}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{doc.ownerName}</TableCell>
                    <TableCell className="font-data text-sm text-muted-foreground">{formatDate(doc.uploadedAt)}</TableCell>
                    <TableCell className="font-data text-sm text-muted-foreground">v{doc.currentVersion}</TableCell>
                    <TableCell>
                      <RiskBadge tier={doc.tier} score={doc.overallScore} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild title="Ver detalhes">
                        <Link href={`/projetos/${doc.id}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
