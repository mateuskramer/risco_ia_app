"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UserFormDialog } from "@/components/user-form-dialog";
import { useAuth } from "@/lib/auth-context";
import { AppUser, Role } from "@/lib/types";
import * as api from "@/lib/storage";
import { toast } from "sonner";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function UsuariosTab() {
  const { session } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setUsers(await api.listUsers());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRoleChange(user: AppUser, role: Role) {
    if (user.id === session?.userId) {
      toast.error("Você não pode alterar seu próprio nível de acesso.");
      return;
    }
    await api.updateUser(user.id, { role });
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));
    toast.success("Nível de acesso atualizado.");
  }

  async function handleStatusToggle(user: AppUser, active: boolean) {
    if (user.id === session?.userId) {
      toast.error("Você não pode desativar sua própria conta.");
      return;
    }
    const status = active ? "ativo" : "inativo";
    await api.updateUser(user.id, { status });
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status } : u)));
    toast.success(active ? "Usuário ativado." : "Usuário desativado.");
  }

  async function handleDelete(user: AppUser) {
    if (user.id === session?.userId) {
      toast.error("Você não pode excluir sua própria conta.");
      return;
    }
    if (!window.confirm(`Excluir a conta de ${user.name}? Essa ação não pode ser desfeita.`)) return;
    await api.deleteUser(user.id);
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    toast.success("Usuário excluído.");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Usuários</h3>
          <p className="text-sm text-muted-foreground">Gerencie quem tem acesso ao sistema e o nível de cada pessoa.</p>
        </div>
        <UserFormDialog onCreated={(u) => setUsers((prev) => [...prev, u])} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Nível de acesso</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.name}
                      {user.id === session?.userId && (
                        <Badge variant="outline" className="ml-2 align-middle">
                          você
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Select value={user.role} onValueChange={(v) => handleRoleChange(user, v as Role)}>
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Usuário</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={user.status === "ativo"}
                        onCheckedChange={(checked) => handleStatusToggle(user, checked)}
                      />
                    </TableCell>
                    <TableCell className="font-data text-sm text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" title="Excluir" onClick={() => handleDelete(user)}>
                        <Trash2 className="h-4 w-4" />
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
