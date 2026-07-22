import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession, isSessionPayload } from "@/lib/auth";
import { getProjectHistory } from "@/lib/projects-db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!isSessionPayload(session)) return session;
  const { id } = await params;
  const projectId = Number(id);

  const owner = await pool.query("SELECT id_user FROM project WHERE id_project = $1", [projectId]);
  if (owner.rows.length === 0) {
    return NextResponse.json([]);
  }
  if (session.role !== "admin" && owner.rows[0].id_user !== session.userId) {
    return NextResponse.json({ error: "Você não tem acesso a este documento." }, { status: 403 });
  }

  const history = await getProjectHistory(projectId);
  return NextResponse.json(history);
}
