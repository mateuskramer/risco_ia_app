import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin, isSessionPayload } from "@/lib/auth";

// Snapshot completo do sistema, na visão de admin. Um JSON só, contendo
// tudo que foi feito até agora: usuários (sem senha), riscos (com histórico
// de versões do prompt) e projetos (com todas as rodadas de análise e seus
// achados). Não inclui o texto extraído do PDF nem os bytes do arquivo em
// si — senão o JSON estoura de tamanho fácil.
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!isSessionPayload(session)) return session;

  // ---------- Usuários ----------
  const usersResult = await pool.query(
    `SELECT id_user, name, email, role, status, created_at
     FROM users
     ORDER BY id_user`
  );
  const users = usersResult.rows.map((u) => ({
    id: u.id_user,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.created_at,
  }));

  // ---------- Riscos (com histórico de versões do prompt) ----------
  const risksResult = await pool.query(
    `SELECT id_risk, name, description, prompt, active, updated_at, updated_by, history
     FROM risk
     ORDER BY id_risk`
  );
  const risks = risksResult.rows.map((r) => {
    const history = Array.isArray(r.history) ? r.history : [];
    return {
      id: r.id_risk,
      name: r.name,
      description: r.description,
      prompt: r.prompt,
      active: r.active,
      updatedAt: r.updated_at,
      updatedBy: r.updated_by,
      // versão atual conta como a mais recente + o que já veio no histórico
      versionCount: history.length + 1,
      previousVersions: history.map(
        (h: { prompt: string; updated_at: string; updated_by: string }, i: number) => ({
          version: i + 1,
          prompt: h.prompt,
          updatedAt: h.updated_at,
          updatedBy: h.updated_by,
        })
      ),
    };
  });

  // ---------- Projetos (com todas as análises, agrupadas por rodada) ----------
  const projectsResult = await pool.query(
    `SELECT p.id_project, p.title, p.abstract, p.date, p.id_user,
            u.name AS owner_name, u.email AS owner_email
     FROM project p
     JOIN users u ON u.id_user = p.id_user
     ORDER BY p.date DESC`
  );

  // Puxa TODAS as linhas de análise de todos os projetos numa query só, e
  // agrupa em memória — muito mais barato que uma query por projeto.
  const analysesResult = await pool.query(
    `SELECT pr.id_project, pr.id_risk, r.name AS risk_name, pr.level,
            pr.level_description, pr.probability, pr.false_positive, pr.solved,
            pr.output, pr.analyzed_by, pr.created_at
     FROM project_risk pr
     JOIN risk r ON r.id_risk = pr.id_risk
     ORDER BY pr.id_project, pr.created_at, pr.id_risk`
  );

  // Agrupa por projeto -> por rodada (mesmo created_at = mesma rodada de análise)
  const analysesByProject = new Map<number, Map<string, typeof analysesResult.rows>>();
  for (const row of analysesResult.rows) {
    const key = new Date(row.created_at).toISOString();
    if (!analysesByProject.has(row.id_project)) analysesByProject.set(row.id_project, new Map());
    const rounds = analysesByProject.get(row.id_project)!;
    if (!rounds.has(key)) rounds.set(key, []);
    rounds.get(key)!.push(row);
  }

  const projects = projectsResult.rows.map((p) => {
    const roundsMap = analysesByProject.get(p.id_project) ?? new Map();
    // ordena rodadas cronologicamente e enumera como version 1, 2, 3, ...
    const analysisVersions = [...roundsMap.entries()]
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([at, findings], i) => ({
        version: i + 1,
        analyzedAt: at,
        analyzedBy: findings[0]?.analyzed_by ?? null,
        findings: findings.map((f: (typeof analysesResult.rows)[number]) => ({
          riskId: f.id_risk,
          riskName: f.risk_name,
          score: Number(f.level),
          tier: f.level_description,
          probability: f.probability,
          solved: f.solved,
          falsePositive: f.false_positive,
          justificativa: f.output?.justificativa ?? null,
          impacto: f.output?.impacto ?? null,
          mitigacao: f.output?.mitigacao ?? null,
          trechos: f.output?.trechos ?? [],
          status: f.output?.status ?? "aberto",
        })),
      }));

    return {
      id: p.id_project,
      title: (p.title as string).replace(/\.pdf$/i, ""),
      fileName: p.title,
      description: p.abstract ?? "",
      uploadedAt: p.date,
      owner: {
        id: p.id_user,
        name: p.owner_name,
        email: p.owner_email,
      },
      totalAnalyses: analysisVersions.length,
      analysisVersions,
    };
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    generatedBy: { id: session.userId, name: session.name, email: session.email },
    counts: {
      users: users.length,
      risks: risks.length,
      projects: projects.length,
      totalAnalysisRuns: projects.reduce((acc, p) => acc + p.totalAnalyses, 0),
    },
    users,
    risks,
    projects,
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="snapshot-completo-${stamp}.json"`,
    },
  });
}