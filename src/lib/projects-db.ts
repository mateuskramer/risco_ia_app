import { pool } from "@/lib/db";

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
  output: { justificativa?: string; trechos?: { citacao: string; pagina: number | null }[] } | null;
}

export interface ProjectRow {
  id_project: number;
  title: string;
  date: string;
  owner_id: number;
  owner_name: string;
  findings: FindingRow[] | null;
}

// Última análise de cada risco, para cada projeto — usado tanto na listagem
// quanto no detalhe (estado "atual" do documento).
const LATEST_FINDINGS_CTE = `
  WITH latest AS (
    SELECT DISTINCT ON (ps.id_project, psr.id_risk)
      ps.id_project,
      psr.id_risk,
      r.name AS risk_name,
      psr.level,
      psr.level_description,
      psr.output,
      psr.created_at
    FROM project_section_risk psr
    JOIN project_section ps ON ps.id_project_section = psr.id_project_section
    JOIN risk r ON r.id_risk = psr.id_risk
    ORDER BY ps.id_project, psr.id_risk, psr.created_at DESC
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
       p.id_project, p.title, p.date, u.id_user AS owner_id, u.name AS owner_name,
       COALESCE(
         json_agg(
           json_build_object(
             'riskId', latest.id_risk,
             'riskName', latest.risk_name,
             'score', latest.level,
             'tier', latest.level_description,
             'output', latest.output
           )
         ) FILTER (WHERE latest.id_risk IS NOT NULL),
         '[]'
       ) AS findings
     FROM project p
     JOIN users u ON u.id_user = p.id_user
     LEFT JOIN latest ON latest.id_project = p.id_project
     ${whereClause}
     GROUP BY p.id_project, p.title, p.date, u.id_user, u.name
     ORDER BY p.date DESC`,
    values
  );
  return rows;
}

export function overallScore(findings: FindingRow[]): number {
  if (findings.length === 0) return 0;
  const sum = findings.reduce((acc, f) => acc + Number(f.score), 0);
  return Math.round(sum / findings.length);
}

// Histórico completo: todas as rodadas de análise (agrupadas por timestamp),
// cada uma com os achados daquela rodada — alimenta a timeline do front.
export async function getProjectHistory(projectId: number) {
  const { rows } = await pool.query(
    `SELECT psr.created_at, psr.id_risk, r.name AS risk_name, psr.level, psr.level_description, psr.output, psr.analyzed_by
     FROM project_section_risk psr
     JOIN project_section ps ON ps.id_project_section = psr.id_project_section
     JOIN risk r ON r.id_risk = psr.id_risk
     WHERE ps.id_project = $1
     ORDER BY psr.created_at DESC`,
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
          description: f.output?.justificativa ?? "",
        })),
      };
    });
}
export function mapProjectRow(row: ProjectRow, currentVersion: number) {
  const findings = row.findings ?? [];
  const score = overallScore(findings);
  return {
    id: String(row.id_project),
    fileName: row.title,
    ownerId: String(row.owner_id),
    ownerName: row.owner_name,
    uploadedAt: row.date,
    status: findings.length > 0 ? ("concluido" as const) : ("pendente" as const),
    currentVersion,
    overallScore: score,
    tier: tierFromScore(score),
    findings: findings.map((f) => ({
      id: `${row.id_project}-${f.riskId}`,
      riskName: f.riskName,
      score: Number(f.score),
      tier: f.tier,
      description: f.output?.justificativa ?? "",
      agentPromptId: String(f.riskId),
    })),
  };
}
