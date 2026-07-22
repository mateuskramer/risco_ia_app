import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession, isSessionPayload } from "@/lib/auth";
import { fetchProjectsWithLatestFindings, mapProjectRow } from "@/lib/projects-db";

const VALID_STATUSES = ["aberto", "resolvido", "falso_positivo"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; riskId: string }> }
) {
  const session = await requireSession(req);
  if (!isSessionPayload(session)) return session;

  const { id, riskId } = await params;
  const projectId = Number(id);
  const riskIdNumber = Number(riskId);
  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Status de risco invalido." }, { status: 400 });
  }

  const project = await pool.query("SELECT id_user FROM project WHERE id_project = $1", [projectId]);
  if (project.rows.length === 0) {
    return NextResponse.json({ error: "Documento nao encontrado." }, { status: 404 });
  }
  if (project.rows[0].id_user !== session.userId) {
    return NextResponse.json({ error: "Voce so pode atualizar riscos de documentos que enviou." }, { status: 403 });
  }

  const updated = await pool.query(
    `WITH latest AS (
       SELECT psr.id_project_section_risk
       FROM project_section_risk psr
       JOIN project_section ps ON ps.id_project_section = psr.id_project_section
       WHERE ps.id_project = $1 AND psr.id_risk = $2
       ORDER BY psr.created_at DESC
       LIMIT 1
     )
     UPDATE project_section_risk psr
     SET output = jsonb_set(COALESCE(psr.output, '{}'::jsonb), '{status}', to_jsonb($3::text), true)
     FROM latest
     WHERE psr.id_project_section_risk = latest.id_project_section_risk
     RETURNING psr.id_project_section_risk`,
    [projectId, riskIdNumber, status]
  );
  if (updated.rows.length === 0) {
    return NextResponse.json({ error: "Risco nao encontrado neste documento." }, { status: 404 });
  }

  const [row] = await fetchProjectsWithLatestFindings(projectId);
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT psr.created_at) AS n
     FROM project_section_risk psr
     JOIN project_section ps ON ps.id_project_section = psr.id_project_section
     WHERE ps.id_project = $1`,
    [projectId]
  );
  return NextResponse.json(mapProjectRow(row, Number(rows[0]?.n ?? 1) || 1));
}
