import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";
import { Tier } from "@/lib/projects-db";

export interface ReportFinding {
  riskName: string;
  score: number;
  tier: Tier;
  justificativa: string;
  mitigacao?: string;
  trechos: { citacao: string; pagina: number | null }[];
}

export interface ReportData {
  fileName: string;
  ownerName: string;
  uploadedAt: string;
  version: number;
  overallScore: number;
  tier: Tier;
  findings: ReportFinding[];
  generatedAt: string;
}

const TIER_LABEL: Record<Tier, string> = { baixo: "Baixo", medio: "Médio", alto: "Alto" };

function buildAnaliseGeral(data: ReportData): string {
  const altos = data.findings.filter((f) => f.tier === "alto");
  const medios = data.findings.filter((f) => f.tier === "medio");
  const parts: string[] = [];
  parts.push(
    `Foram avaliados ${data.findings.length} risco(s) neste projeto. O score geral foi ${data.overallScore}/100, ` +
      `classificado como risco ${TIER_LABEL[data.tier].toLowerCase()}.`
  );
  if (altos.length > 0) {
    parts.push(`${altos.length} risco(s) classificado(s) como alto: ${altos.map((f) => f.riskName).join(", ")}.`);
  }
  if (medios.length > 0) {
    parts.push(`${medios.length} risco(s) classificado(s) como médio: ${medios.map((f) => f.riskName).join(", ")}.`);
  }
  if (altos.length === 0 && medios.length === 0) {
    parts.push("Nenhum risco classificado como médio ou alto foi identificado nesta análise.");
  }
  return parts.join(" ");
}

// ---------- Markdown ----------

export function buildReportMarkdown(data: ReportData): string {
  const sorted = [...data.findings].sort((a, b) => b.score - a.score);
  const lines: string[] = [];
  lines.push("# Relatório de análise de risco", "");
  lines.push(`**Projeto:** ${data.fileName}`);
  lines.push(`**Responsável:** ${data.ownerName}`);
  lines.push(`**Data do envio:** ${new Date(data.uploadedAt).toLocaleDateString("pt-BR")}`);
  lines.push(`**Versão analisada:** v${data.version}`);
  lines.push(`**Score geral:** ${data.overallScore}/100 (${TIER_LABEL[data.tier]})`, "");
  lines.push("## Análise geral", "");
  lines.push(buildAnaliseGeral(data), "");
  lines.push("## Principais riscos", "");
  for (const f of sorted) {
    lines.push(`### ${f.riskName} — ${f.score}/100 (${TIER_LABEL[f.tier]})`, "");
    lines.push(f.justificativa || "_Sem justificativa registrada._");
    if (f.mitigacao) {
      lines.push("", `**Sugestão de mitigação:** ${f.mitigacao}`);
    }
    if (f.trechos.length > 0) {
      lines.push("", "**Trechos citados:**");
      for (const t of f.trechos) {
        lines.push(`> ${t.citacao}${t.pagina ? ` _(pág. ${t.pagina})_` : ""}`);
      }
    }
    lines.push("");
  }
  lines.push("---");
  lines.push(`_Relatório gerado em ${new Date(data.generatedAt).toLocaleString("pt-BR")}_`);
  return lines.join("\n");
}

// ---------- PDF (pdf-lib — sem precisar de navegador/Chromium) ----------

// As fontes padrão do pdf-lib (Helvetica) só suportam WinAnsiEncoding, que
// NÃO é Unicode completo — emoji, setas, caracteres CJK, ou caracteres de
// controle (comuns em texto extraído de PDF real, ou eventualmente
// devolvidos pelo modelo) fazem o drawText() quebrar com
// "WinAnsi cannot encode...". Isso substitui o que dá pra substituir por um
// equivalente e REMOVE o resto (em vez de trocar por "?"), testando
// caractere a caractere com a própria fonte — nunca deixa a geração do PDF
// quebrar por causa de um caractere inesperado.
function sanitizeForPdf(text: string, font: PDFFont): string {
  const normalized = text
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2192/g, "->")
    .replace(/\u2190/g, "<-")
    .replace(/[\u2022\u25CF]/g, "-")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

  let result = "";
  for (const ch of normalized) {
    try {
      font.widthOfTextAtSize(ch, 10); // só usado pra testar se a fonte codifica
      result += ch;
    } catch {
      // caractere não suportado (emoji, CJK, etc.) — remove em vez de
      // mostrar um "?" no lugar
    }
  }
  return result.replace(/[ \t]{2,}/g, " ").trim();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    lines.push(current);
  }
  return lines;
}

export async function buildReportPdf(data: ReportData): Promise<Uint8Array> {
  const sorted = [...data.findings].sort((a, b) => b.score - a.score);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const maxWidth = pageWidth - margin * 2;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function ensureSpace(lineHeight: number) {
    if (y - lineHeight < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function writeLine(
    text: string,
    opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {}
  ) {
    const size = opts.size ?? 11;
    const useFont = opts.bold ? fontBold : font;
    const color = opts.color ? rgb(...opts.color) : rgb(0.12, 0.14, 0.16);
    const safeText = sanitizeForPdf(text, useFont);
    for (const line of wrapText(safeText, useFont, size, maxWidth)) {
      ensureSpace(size + 4);
      page.drawText(line, { x: margin, y, size, font: useFont, color });
      y -= size + 4;
    }
    y -= opts.gap ?? 0;
  }

  writeLine("Relatório de análise de risco", { size: 18, bold: true, gap: 8 });
  writeLine(`Projeto: ${data.fileName}`);
  writeLine(`Responsável: ${data.ownerName}`);
  writeLine(`Data do envio: ${new Date(data.uploadedAt).toLocaleDateString("pt-BR")}`);
  writeLine(`Versão analisada: v${data.version}`);
  writeLine(`Score geral: ${data.overallScore}/100 (${TIER_LABEL[data.tier]})`, { bold: true, gap: 16 });

  writeLine("Análise geral", { size: 14, bold: true, gap: 6 });
  writeLine(buildAnaliseGeral(data), { gap: 18 });

  writeLine("Principais riscos", { size: 14, bold: true, gap: 8 });
  for (const f of sorted) {
    writeLine(`${f.riskName} — ${f.score}/100 (${TIER_LABEL[f.tier]})`, { size: 12, bold: true, gap: 3 });
    writeLine(f.justificativa || "Sem justificativa registrada.", { size: 10.5, gap: 4 });
    if (f.mitigacao) {
      writeLine(`Mitigação: ${f.mitigacao}`, { size: 10, color: [0.15, 0.45, 0.25], gap: 4 });
    }
    for (const t of f.trechos) {
      writeLine(`"${t.citacao}"${t.pagina ? ` (pág. ${t.pagina})` : ""}`, {
        size: 9.5,
        color: [0.42, 0.42, 0.42],
        gap: 2,
      });
    }
    y -= 10;
  }

  writeLine(`Gerado em ${new Date(data.generatedAt).toLocaleString("pt-BR")}`, {
    size: 9,
    color: [0.55, 0.55, 0.55],
  });

  return doc.save();
}