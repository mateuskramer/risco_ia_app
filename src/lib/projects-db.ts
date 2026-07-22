import { pool } from "@/lib/db";
import { cleanFileName } from "@/lib/utils";

export type Tier = "baixo" | "medio" | "alto";

export function tierFromScore(score: number): Tier {
  if (score < 40) return "baixo";
  if (score < 70) return "medio";
  return "alto";
}

interface FindingRow {
  riskId: number;
  riskName: string;
  score: string; // vem como string do DECIMAL
  tier: Tier;
  probability?: string;
  false_positive?: boolean | number;
  solved?: boolean | number;
  output: {
    justificativa?: string;
    probabilidade?: string;
    impacto?: string;
    mitigacao?: string;
    trechos?: { citacao: string; pagina: number | null }[];
    status?: "aberto" | "resolvido" | "falso_positivo";
  } | null;
}

export interface ProjectRow {
  id_project: number;
  title: string;
  abstract: string | null;
  date: string;
  owner_id: number;
  owner_name: string;
  findings: FindingRow[] | null;
}

// Última análise de cada risco, para cada projeto — relação direta project -> project_risk
const LATEST_FINDINGS_CTE = `
  WITH latest AS (
    SELECT DISTINCT ON (pr.id_project, pr.id_risk)
      pr.id_project,
      pr.id_risk,
      r.name AS risk_name,
      pr.level,
      pr.level_description,
      pr.probability,
      pr.false_positive,
      pr.solved,
      pr.output,
      pr.created_at
    FROM project_risk pr
    JOIN risk r ON r.id_risk = pr.id_risk
    ORDER BY pr.id_project, pr.id_risk, pr.created_at DESC
  )
`;

export async function fetchProjectsWithLatestFindings(
  whereProjectId?: number,
  scopeUserId?: number
): Promise<ProjectRow[]> {
  const conditions: string[] = [];
  const values: number[] = [];
  if (whereProjectId !== undefined) {
    values.push(whereProjectId);
    conditions.push(`p.id_project = $${values.length}`);
  }
  if (scopeUserId !== undefined) {
    values.push(scopeUserId);
    conditions.push(`p.id_user = $${values.length}`);
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `${LATEST_FINDINGS_CTE}
     SELECT
       p.id_project, p.title, p.abstract, p.date, u.id_user AS owner_id, u.name AS owner_name,
       COALESCE(
         json_agg(
           json_build_object(
             'riskId', latest.id_risk,
             'riskName', latest.risk_name,
             'score', latest.level,
             'tier', latest.level_description,
             'probability', latest.probability,
             'false_positive', latest.false_positive,
             'solved', latest.solved,
             'output', latest.output
           )
         ) FILTER (WHERE latest.id_risk IS NOT NULL),
         '[]'
       ) AS findings
     FROM project p
     JOIN users u ON u.id_user = p.id_user
     LEFT JOIN latest ON latest.id_project = p.id_project
     ${whereClause}
     GROUP BY p.id_project, p.title, p.abstract, p.date, u.id_user, u.name
     ORDER BY p.date DESC`,
    values
  );
  return rows;
}

export function overallScore(findings: FindingRow[]): number {
  const openFindings = findings.filter((f) => {
    if (f.solved === true || f.solved === 1 || f.false_positive === true || f.false_positive === 1) return false;
    const status = f.output?.status ?? "aberto";
    return status === "aberto";
  });
  if (openFindings.length === 0) return 0;
  const sum = openFindings.reduce((acc, f) => acc + Number(f.score), 0);
  return Math.round(sum / openFindings.length);
}

// Histórico completo: todas as rodadas de análise
export async function getProjectHistory(projectId: number) {
  const { rows } = await pool.query(
    `SELECT pr.created_at, pr.id_risk, r.name AS risk_name, pr.level, pr.level_description, pr.probability, pr.output, pr.analyzed_by
     FROM project_risk pr
     JOIN risk r ON r.id_risk = pr.id_risk
     WHERE pr.id_project = $1
     ORDER BY pr.created_at DESC`,
    [projectId]
  );

  const batches = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = new Date(r.created_at).toISOString();
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key)!.push(r);
  }

  return [...batches.entries()]
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .map(([at, findings], i, arr) => {
      const overall = Math.round(findings.reduce((acc, f) => acc + Number(f.level), 0) / findings.length);
      return {
        at,
        version: arr.length - i,
        analyzedBy: findings[0]?.analyzed_by ?? "sistema",
        overallScore: overall,
        tier: tierFromScore(overall),
        findings: findings.map((f) => ({
          riskName: f.risk_name,
          score: Number(f.level),
          tier: f.level_description,
          probability: f.probability || f.output?.probabilidade || "Média",
          impact: f.output?.impacto || "Médio",
          description: f.output?.justificativa ?? "",
        })),
      };
    });
}

export function mapProjectRow(row: ProjectRow, currentVersion: number) {
  const findings = row.findings ?? [];
  const score = overallScore(findings);
  const description = (row.abstract ?? "").trim();
  // `fileName` sempre passa por cleanFileName (protege registros antigos
  // salvos antes desse fix). `title` é o mesmo nome limpo, sem `.pdf` — é
  // o que aparece na UI; `fileName` continua com `.pdf` pra
  // download/relatório referirem ao arquivo real.
  const cleanedFileName = cleanFileName(row.title);
  const titleNoExt = cleanedFileName.replace(/\.pdf$/i, "");
  return {
    id: String(row.id_project),
    fileName: cleanedFileName,
    title: titleNoExt,
    description,
    ownerId: String(row.owner_id),
    ownerName: row.owner_name,
    uploadedAt: row.date,
    status: findings.length > 0 ? ("concluido" as const) : ("pendente" as const),
    currentVersion,
    overallScore: score,
    tier: tierFromScore(score),
    findings: findings.map((f) => {
      let statusValue: "aberto" | "resolvido" | "falso_positivo" = f.output?.status ?? "aberto";
      if (f.solved === true || f.solved === 1) statusValue = "resolvido";
      if (f.false_positive === true || f.false_positive === 1) statusValue = "falso_positivo";

      return {
        id: `${row.id_project}-${f.riskId}`,
        riskName: f.riskName,
        score: Number(f.score),
        tier: f.tier,
        probability: f.probability || f.output?.probabilidade || "Média",
        impact: f.output?.impacto ?? "Médio",
        description: f.output?.justificativa ?? "",
        mitigation: f.output?.mitigacao ?? "",
        excerpts: (f.output?.trechos ?? []).map((t) => ({ citation: t.citacao, page: t.pagina })),
        status: statusValue,
        agentPromptId: String(f.riskId),
      };
    }),
  };
}

// ---------- Funções de Persistência do Chat no Banco de Dados ----------

export async function getProjectChats(projectId: number) {
  const { rows } = await pool.query(
    `SELECT id_chat, title, created_at FROM chat WHERE id_project = $1 ORDER BY created_at DESC`,
    [projectId]
  );
  return rows;
}

export async function createProjectChat(projectId: number, title = "Nova conversa") {
  const { rows } = await pool.query(
    `INSERT INTO chat (id_project, title) VALUES ($1, $2) RETURNING id_chat, title, created_at`,
    [projectId, title]
  );
  return rows[0];
}

export async function updateChatTitle(chatId: number, title: string) {
  await pool.query(`UPDATE chat SET title = $1 WHERE id_chat = $2`, [title, chatId]);
}

export async function deleteProjectChat(chatId: number) {
  await pool.query(`DELETE FROM chat WHERE id_chat = $1`, [chatId]);
}

export async function getChatInteractions(chatId: number) {
  const { rows } = await pool.query(
    `SELECT id_interaction, text, source, created_at FROM chat_interaction WHERE id_chat = $1 ORDER BY created_at ASC`,
    [chatId]
  );
  return rows.map((r) => ({
    id: r.id_interaction,
    role: r.source === "user" || r.source === 1 || r.source === "1" ? ("user" as const) : ("assistant" as const),
    content: r.text,
    createdAt: r.created_at,
  }));
}

export async function addChatInteraction(chatId: number, text: string, source: "user" | "assistant" | number) {
  const sourceValue = typeof source === "number" ? (source === 1 ? "user" : "assistant") : source;
  const { rows } = await pool.query(
    `INSERT INTO chat_interaction (id_chat, text, source) VALUES ($1, $2, $3) RETURNING id_interaction, text, source, created_at`,
    [chatId, text, sourceValue]
  );
  return rows[0];
}
