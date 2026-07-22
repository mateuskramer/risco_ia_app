"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RiscosTab } from "@/components/settings/riscos-tab";
import { UsuariosTab } from "@/components/settings/usuarios-tab";
import { ProjetosTab } from "@/components/settings/projetos-tab";
import { toast } from "sonner";

export default function ConfiguracoesPage() {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/export", { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status} ao exportar.`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `snapshot-completo-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível exportar.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-xl font-semibold">Configurações</h2>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exportar JSON completo
        </Button>
      </div>

      <Tabs defaultValue="riscos">
        <TabsList>
          <TabsTrigger value="riscos">Riscos</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="projetos">Projetos</TabsTrigger>
        </TabsList>
        <TabsContent value="riscos">
          <RiscosTab />
        </TabsContent>
        <TabsContent value="usuarios">
          <UsuariosTab />
        </TabsContent>
        <TabsContent value="projetos">
          <ProjetosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
