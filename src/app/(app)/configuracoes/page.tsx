"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RiscosTab } from "@/components/settings/riscos-tab";
import { UsuariosTab } from "@/components/settings/usuarios-tab";
import { ProjetosTab } from "@/components/settings/projetos-tab";

export default function ConfiguracoesPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold">Configurações</h2>
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
