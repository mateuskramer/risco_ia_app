import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession, isSessionPayload } from "@/lib/auth";
import { fetchProjectsWithLatestFindings, mapProjectRow } from "@/lib/projects-db";

async function countVersions(projectId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT psr.created_at) AS n
     FROM project_section_risk psr
     JOIN project_section ps ON ps.id_project_section = psr.id_project_section
     WHERE ps.id_project = $1`,
    [projectId]
  );
  return Number(rows[0]?.n ?? 0) || 1;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!isSessionPayload(session)) return session;
  const { id } = await params;
  const projectId = Number(id);

  const [row] = await fetchProjectsWithLatestFindings(projectId);
  if (!row) {
    return NextResponse.json(null, { status: 404 });
  }
  // Admin vê tudo; usuário comum só vê o que é dele.
  if (session.role !== "admin" && row.owner_id !== session.userId) {
    return NextResponse.json({ error: "Você não tem acesso a este documento." }, { status: 403 });
  }
  const version = await countVersions(projectId);
  return NextResponse.json(mapProjectRow(row, version));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!isSessionPayload(session)) return session;
  const { id } = await params;
  const projectId = Number(id);

  // Mesmo admin só apaga o que é dele — só visualiza o resto.
  const owner = await pool.query("SELECT id_user FROM project WHERE id_project = $1", [projectId]);
  if (owner.rows.length === 0) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }
  if (owner.rows[0].id_user !== session.userId) {
    return NextResponse.json({ error: "Você só pode excluir documentos que enviou." }, { status: 403 });
  }

  await pool.query("DELETE FROM project WHERE id_project = $1", [projectId]);
  return NextResponse.json({ ok: true });
}
