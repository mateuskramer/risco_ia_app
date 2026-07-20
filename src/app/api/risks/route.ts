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

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!isSessionPayload(session)) return session;

  const { rows } = await pool.query(
    "SELECT id_risk, name, description, prompt, active, updated_at, updated_by, history FROM risk ORDER BY updated_at DESC"
  );
  return NextResponse.json(rows.map(mapRow));
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!isSessionPayload(session)) return session;

  const body = await req.json();
  const { riskName, description, prompt } = body as {
    riskName?: string;
    description?: string;
    prompt?: string;
  };

  if (!riskName?.trim() || !prompt?.trim()) {
    return NextResponse.json({ error: "riskName e prompt são obrigatórios." }, { status: 400 });
  }

  const { rows } = await pool.query(
    `INSERT INTO risk (name, description, prompt, updated_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id_risk, name, description, prompt, active, updated_at, updated_by, history`,
    [riskName.trim(), description?.trim() ?? "", prompt.trim(), session.name]
  );

  return NextResponse.json(mapRow(rows[0]), { status: 201 });
}
