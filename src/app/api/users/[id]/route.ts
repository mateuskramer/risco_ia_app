import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin, isSessionPayload } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!isSessionPayload(session)) return session;
  const { id } = await params;

  if (String(session.userId) === id) {
    return NextResponse.json({ error: "Você não pode alterar a própria conta por aqui." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { role, status, name } = body as { role?: string; status?: string; name?: string };

  const { rows } = await pool.query(
    `UPDATE users SET
       role = COALESCE($1, role),
       status = COALESCE($2, status),
       name = COALESCE($3, name)
     WHERE id_user = $4
     RETURNING id_user, name, email, role, status, created_at`,
    [role ?? null, status ?? null, name?.trim() ?? null, id]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }
  const u = rows[0];
  return NextResponse.json({
    id: String(u.id_user),
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.created_at,
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!isSessionPayload(session)) return session;
  const { id } = await params;

  if (String(session.userId) === id) {
    return NextResponse.json({ error: "Você não pode excluir a própria conta." }, { status: 400 });
  }

  try {
    const result = await pool.query("DELETE FROM users WHERE id_user = $1", [id]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "23503") {
      return NextResponse.json(
        { error: "Este usuário já enviou documentos e não pode ser excluído. Desative-o em vez de apagar." },
        { status: 409 }
      );
    }
    throw err;
  }
}
