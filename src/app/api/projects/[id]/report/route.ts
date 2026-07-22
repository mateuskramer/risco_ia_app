import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession, isSessionPayload } from "@/lib/auth";
import { fetchProjectsWithLatestFindings, tierFromScore } from "@/lib/projects-db";
import { buildReportMarkdown, buildReportPdf, ReportData } from "@/lib/report";

async function countVersions(projectId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT pr.created_at) AS n
     FROM project_risk pr
     WHERE pr.id_project = $1`,
    [projectId]
  );
  return Number(rows[0]?.n ?? 0) || 1;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!isSessionPayload(session)) return session;
  const { id } = await params;
  const projectId = Number(id);
  const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "md";

  const [row] = await fetchProjectsWithLatestFindings(projectId);
  if (!row) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }
  if (session.role !== "admin" && row.owner_id !== session.userId) {
    return NextResponse.json({ error: "Você não tem acesso a este projeto." }, { status: 403 });
  }

  const findings = row.findings ?? [];
  const overallScore = findings.length === 0 ? 0 : Math.round(findings.reduce((a, f) => a + Number(f.score), 0) / findings.length);

  const data: ReportData = {
    fileName: row.title,
    ownerName: row.owner_name,
    uploadedAt: row.date,
    version: await countVersions(projectId),
    overallScore,
    tier: tierFromScore(overallScore),
    findings: findings.map((f) => ({
      riskName: f.riskName,
      score: Number(f.score),
      tier: f.tier,
      justificativa: f.output?.justificativa ?? "",
      mitigacao: f.output?.mitigacao ?? "",
      trechos: f.output?.trechos ?? [],
    })),
    generatedAt: new Date().toISOString(),
  };

  const safeName = row.title.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9-_]+/g, "-") || "relatorio";

  if (format === "md") {
    const md = buildReportMarkdown(data);
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="relatorio-${safeName}.md"`,
      },
    });
  }

  const pdfBytes = await buildReportPdf(data);
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-${safeName}.pdf"`,
    },
  });
}
