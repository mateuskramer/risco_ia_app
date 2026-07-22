import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { analyzeAllRisks } from "@/lib/agents/analyze-risk";
import { requireSession, isSessionPayload } from "@/lib/auth";
import { fetchProjectsWithLatestFindings, mapProjectRow, tierFromScore } from "@/lib/projects-db";

async function countVersions(projectId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT psr.created_at) AS n
     FROM project_section_risk psr
     JOIN project_section ps ON ps.id_project_section = psr.id_project_section
     WHERE ps.id_project = $1`,
    [projectId]
  );
  return Number(rows[0]?.n ?? 0);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!isSessionPayload(session)) return session;
  const { id } = await params;
  const projectId = Number(id);
  const actorName = session.name;

  const projectResult = await pool.query("SELECT id_user, text FROM project WHERE id_project = $1", [projectId]);
  if (projectResult.rows.length === 0) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }
  // Mesmo admin só reanalisa o que é dele — só visualiza o resto.
  if (projectResult.rows[0].id_user !== session.userId) {
    return NextResponse.json({ error: "Você só pode reanalisar documentos que enviou." }, { status: 403 });
  }
  const documentText: string = projectResult.rows[0].text;

  const risksResult = await pool.query(
    "SELECT id_risk, name, prompt FROM risk WHERE active = true ORDER BY id_risk"
  );
  if (risksResult.rows.length === 0) {
    return NextResponse.json(
      { error: "Nenhum agente de risco ativo configurado." },
      { status: 422 }
    );
  }

  const risks = risksResult.rows.map((r) => ({ id: r.id_risk, name: r.name, prompt: r.prompt }));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const analyses = await analyzeAllRisks(documentText, risks);

    // Cada reanálise é um INSERT novo na tabela project_risk
    const analyzedAt = new Date();
    for (const a of analyses) {
      await client.query(
        `INSERT INTO project_risk (id_project, id_risk, level, level_description, probability, false_positive, solved, output, analyzed_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          projectId,
          a.riskId,
          a.result.score,
          tierFromScore(a.result.score),
          a.result.probabilidade || "media",
          false,
          false,
          JSON.stringify({
            justificativa: a.result.justificativa,
            probabilidade: a.result.probabilidade,
            impacto: a.result.impacto,
            mitigacao: a.result.mitigacao,
            trechos: a.result.trechos,
            status: "aberto",
          }),
          actorName,
          analyzedAt,
        ]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Falha ao reanalisar o documento.";
    return NextResponse.json({ error: `Não foi possível concluir a reanálise: ${message}` }, { status: 502 });
  } finally {
    client.release();
  }

  const [row] = await fetchProjectsWithLatestFindings(projectId);
  const version = await countVersions(projectId);
  return NextResponse.json(mapProjectRow(row, version));
}
