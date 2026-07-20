import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { extractPdfText } from "@/lib/pdf-text";
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
  return Number(rows[0]?.n ?? 0) || 1;
}

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!isSessionPayload(session)) return session;

  // Admin vê tudo; usuário comum só vê o que é dele.
  const scopeUserId = session.role === "admin" ? undefined : session.userId;
  const rows = await fetchProjectsWithLatestFindings(undefined, scopeUserId);
  const withVersions = await Promise.all(
    rows.map(async (row) => mapProjectRow(row, await countVersions(row.id_project)))
  );
  return NextResponse.json(withVersions);
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!isSessionPayload(session)) return session;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie o campo file." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const documentText = await extractPdfText(buffer);

  // FASE 1 — sempre salva o projeto e o arquivo, independente do que
  // acontecer com a análise depois. É isso que garante "Abrir PDF" e
  // "Relatório" funcionarem mesmo se a IA falhar ou ainda nem tiver rodado.
  const client = await pool.connect();
  let projectId: number;
  let sectionId: number;
  try {
    await client.query("BEGIN");
    const projectResult = await client.query(
      `INSERT INTO project (id_user, title, text, midia) VALUES ($1, $2, $3, $4)
       RETURNING id_project`,
      [session.userId, file.name, documentText, buffer]
    );
    projectId = projectResult.rows[0].id_project;

    const sectionResult = await client.query(
      `INSERT INTO project_section (id_project, description, content) VALUES ($1, $2, $3)
       RETURNING id_project_section`,
      [projectId, "Documento completo", documentText]
    );
    sectionId = sectionResult.rows[0].id_project_section;
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Falha ao salvar o projeto.";
    return NextResponse.json({ error: `Não foi possível salvar o projeto: ${message}` }, { status: 500 });
  } finally {
    client.release();
  }

  // FASE 2 — tenta analisar. Se falhar (ou não houver risco ativo), o
  // projeto já está salvo de qualquer forma: devolve 201 com um aviso em
  // vez de descartar o upload. O usuário pode reanalisar depois.
  const risksResult = await pool.query(
    "SELECT id_risk, name, prompt FROM risk WHERE active = true ORDER BY id_risk"
  );

  if (risksResult.rows.length === 0) {
    const [row] = await fetchProjectsWithLatestFindings(projectId);
    return NextResponse.json(
      {
        ...mapProjectRow(row, 1),
        warning: "Nenhum risco ativo configurado — o projeto foi salvo, mas ainda não foi analisado.",
      },
      { status: 201 }
    );
  }

  try {
    const risks = risksResult.rows.map((r) => ({ id: r.id_risk, name: r.name, prompt: r.prompt }));
    const analyses = await analyzeAllRisks(documentText, risks);

    const analyzedAt = new Date(); // mesmo timestamp pra todos os achados desta rodada = 1 "versão"
    for (const a of analyses) {
      await pool.query(
        `INSERT INTO project_section_risk (id_risk, id_project_section, level, level_description, output, analyzed_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          a.riskId,
          sectionId,
          a.result.score,
          tierFromScore(a.result.score),
          JSON.stringify({ justificativa: a.result.justificativa, trechos: a.result.trechos }),
          session.name,
          analyzedAt,
        ]
      );
    }

    const [row] = await fetchProjectsWithLatestFindings(projectId);
    return NextResponse.json(mapProjectRow(row, 1), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao analisar o documento.";
    const [row] = await fetchProjectsWithLatestFindings(projectId);
    return NextResponse.json(
      {
        ...mapProjectRow(row, 1),
        warning: `Projeto salvo, mas a análise falhou: ${message}. Você pode tentar reanalisar depois.`,
      },
      { status: 201 }
    );
  }
}
