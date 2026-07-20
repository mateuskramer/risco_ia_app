import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin, isSessionPayload } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any) {
  const history = row.history ?? [];
  return {
    id: String(row.id_risk),
    riskName: row.name,
    description: row.description,
    active: row.active,
    currentVersion: history.length + 1,
    prompt: row.prompt,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    history: history.map((h: { prompt: string; updated_at: string; updated_by: string }, i: number) => ({
      version: i + 1,
      prompt: h.prompt,
      updatedAt: h.updated_at,
      updatedBy: h.updated_by,
    })),
  };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!isSessionPayload(session)) return session;
  const { id } = await params;

  const body = await req.json();
  const { riskName, description, prompt, active } = body as {
    riskName?: string;
    description?: string;
    prompt?: string;
    active?: boolean;
  };

  const current = await pool.query(
    "SELECT id_risk, name, description, prompt, active, updated_at, updated_by, history FROM risk WHERE id_risk = $1",
    [id]
  );
  if (current.rows.length === 0) {
    return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
  }
  const row = current.rows[0];

  // Só versiona (empurra a versão atual pro histórico) se o PROMPT mudou —
  // trocar só o nome/descrição/ativo não conta como nova versão.
  const promptChanged = prompt !== undefined && prompt.trim() !== row.prompt;

  const { rows } = await pool.query(
    `UPDATE risk SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       prompt = COALESCE($3, prompt),
       active = COALESCE($4, active),
       updated_at = now(),
       updated_by = $5,
       history = CASE WHEN $6 THEN history || jsonb_build_array(
         jsonb_build_object('prompt', prompt, 'updated_at', updated_at, 'updated_by', updated_by)
       ) ELSE history END
     WHERE id_risk = $7
     RETURNING id_risk, name, description, prompt, active, updated_at, updated_by, history`,
    [
      riskName?.trim() ?? null,
      description?.trim() ?? null,
      prompt?.trim() ?? null,
      active ?? null,
      session.name,
      promptChanged,
      id,
    ]
  );

  return NextResponse.json(mapRow(rows[0]));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!isSessionPayload(session)) return session;
  const { id } = await params;

  try {
    const result = await pool.query("DELETE FROM risk WHERE id_risk = $1", [id]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    // FK violation: esse risco já foi usado em alguma análise (ON DELETE RESTRICT).
    const code = (err as { code?: string })?.code;
    if (code === "23503") {
      return NextResponse.json(
        { error: "Este agente já foi usado em análises e não pode ser excluído. Desative-o em vez de apagar." },
        { status: 409 }
      );
    }
    throw err;
  }
}
