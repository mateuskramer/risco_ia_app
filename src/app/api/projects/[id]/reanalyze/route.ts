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

  const sectionResult = await pool.query(
    "SELECT id_project_section FROM project_section WHERE id_project = $1 LIMIT 1",
    [projectId]
  );
  if (sectionResult.rows.length === 0) {
    return NextResponse.json({ error: "Documento sem seção associada." }, { status: 422 });
  }
  const sectionId = sectionResult.rows[0].id_project_section;

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

    // Cada reanálise é um INSERT novo, nunca um UPDATE — a rodada anterior
    // continua intacta no histórico (ver project_section_risk). E se o Gemini
    // falhar no meio, o ROLLBACK abaixo garante que não fica uma rodada pela metade.
    const analyzedAt = new Date();
    for (const a of analyses) {
      await client.query(
        `INSERT INTO project_section_risk (id_risk, id_project_section, level, level_description, output, analyzed_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          a.riskId,
          sectionId,
          a.result.score,
          tierFromScore(a.result.score),
          JSON.stringify({ justificativa: a.result.justificativa, trechos: a.result.trechos }),
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
