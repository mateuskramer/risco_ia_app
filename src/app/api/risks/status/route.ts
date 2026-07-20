import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession, isSessionPayload } from "@/lib/auth";

// Só um booleano — diferente de GET /api/risks (que exige admin porque
// devolve os prompts inteiros). Qualquer usuário logado pode perguntar
// "dá pra enviar um projeto agora?" sem precisar ver a configuração dos riscos.
export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!isSessionPayload(session)) return session;

  const { rows } = await pool.query("SELECT 1 FROM risk WHERE active = true LIMIT 1");
  return NextResponse.json({ hasActive: rows.length > 0 });
}
