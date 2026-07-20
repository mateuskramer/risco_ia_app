import { z } from "zod";
import { callInstitutionalGpt } from "./institutional-gpt-client";

export const riskFindingSchema = z.object({
  score: z.number().min(0).max(100).describe("0 = nenhum risco, 100 = risco máximo"),
  justificativa: z.string().min(1).describe("explicação curta e objetiva da pontuação"),
  trechos: z
    .array(
      z.object({
        citacao: z.string().min(1).describe("trecho literal e curto do documento que embasa o achado"),
        pagina: z.number().nullable().describe("número da página, se identificável; null caso contrário"),
      })
    )
    .min(1)
    .describe("pelo menos um trecho citado que sustente a pontuação"),
});

export type RiskFindingResult = z.infer<typeof riskFindingSchema>;

// Prompt do agente em inglês.
const AGENT_INSTRUCTIONS =
  "You are a document risk-analysis agent. Base your assessment exclusively on the text provided, " +
  "never invent information that is not in the document. Always cite at least one short, literal " +
  "excerpt (a few sentences) that supports your score. If the document does not contain elements of " +
  "this risk, assign a low score and say so in the justification.";

const JSON_SHAPE_INSTRUCTION =
  'Respond with ONLY a valid JSON object (no markdown, no code fences) matching exactly this shape: ' +
  '{"score": number 0-100, "justificativa": string, "trechos": [{"citacao": string, "pagina": number|null}]}';

// Modelo único do sistema: gateway institucional (ver institutional-gpt-client.ts).
// Esse endpoint só devolve texto, então pedimos JSON puro no prompt e
// validamos a resposta com o mesmo schema que o resto do app espera.
export async function analyzeRisk(
  documentText: string,
  riskName: string,
  riskPrompt: string
): Promise<RiskFindingResult> {
  const input =
    `${AGENT_INSTRUCTIONS}\n\n${JSON_SHAPE_INSTRUCTION}\n\n` +
    `RISK TO EVALUATE: ${riskName}\n\nAGENT INSTRUCTIONS:\n${riskPrompt}\n\n---\nDOCUMENT:\n${documentText}`;

  const rawText = await callInstitutionalGpt(input);
  const cleaned = rawText.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Resposta do modelo não é um JSON válido para o risco "${riskName}": ${(err as Error).message}`);
  }
  return riskFindingSchema.parse(parsed);
}

// Roda os agentes de todos os riscos ativos em paralelo (uma chamada por
// risco, não uma chamada só com tudo junto — ver conversa sobre o porquê).
export async function analyzeAllRisks(
  documentText: string,
  risks: { id: number; name: string; prompt: string }[]
): Promise<Array<{ riskId: number; riskName: string; result: RiskFindingResult }>> {
  return Promise.all(
    risks.map(async (risk) => ({
      riskId: risk.id,
      riskName: risk.name,
      result: await analyzeRisk(documentText, risk.name, risk.prompt),
    }))
  );
}
