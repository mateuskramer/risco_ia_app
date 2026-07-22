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

  const isSolved = status === "resolvido";
  const isFalsePositive = status === "falso_positivo";

  const updated = await pool.query(
    `WITH latest AS (
       SELECT pr.id_project_risk
       FROM project_risk pr
       WHERE pr.id_project = $1 AND pr.id_risk = $2
       ORDER BY pr.created_at DESC
       LIMIT 1
     )
     UPDATE project_risk pr
     SET output = jsonb_set(COALESCE(pr.output, '{}'::jsonb), '{status}', to_jsonb($3::text), true),
         solved = $4,
         false_positive = $5
     FROM latest
     WHERE pr.id_project_risk = latest.id_project_risk
     RETURNING pr.id_project_risk`,
    [projectId, riskIdNumber, status, isSolved, isFalsePositive]
  );
  if (updated.rows.length === 0) {
    return NextResponse.json({ error: "Risco nao encontrado neste documento." }, { status: 404 });
  }

  const [row] = await fetchProjectsWithLatestFindings(projectId);
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT pr.created_at) AS n
     FROM project_risk pr
     WHERE pr.id_project = $1`,
    [projectId]
  );
  return NextResponse.json(mapProjectRow(row, Number(rows[0]?.n ?? 1) || 1));
}
