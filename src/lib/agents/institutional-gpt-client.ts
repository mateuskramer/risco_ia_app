// Cliente para o gateway institucional (formato da Responses API da OpenAI),
// tradução direta do notebook Python que vocês já usam. É uma chamada HTTP
// simples — não passa pelo SDK da OpenAI porque esse endpoint é um proxy
// próprio, não a OpenAI direto, e o SDK assume o contrato exato da OpenAI.

const INSTITUTIONAL_GPT_URL = process.env.INSTITUTIONAL_GPT_URL || "";
const INSTITUTIONAL_GPT_KEY = process.env.INSTITUTIONAL_GPT_KEY || "";
const INSTITUTIONAL_GPT_MODEL = process.env.INSTITUTIONAL_GPT_MODEL || "gpt-5.1";

interface ResponsesApiContent {
  type: string;
  text?: string;
}

interface ResponsesApiOutputItem {
  type: string;
  content?: ResponsesApiContent[];
}

interface ResponsesApiResult {
  output?: ResponsesApiOutputItem[];
}

// Equivalente ao display_markdown() do notebook — só que devolve a string
// em vez de renderizar, e já junta todos os pedaços de texto da resposta
// (o notebook só pegava o primeiro em result["output"][0]["content"][0]["text"];
// isso aqui é mais robusto se a resposta vier em vários itens).
function extractOutputText(result: ResponsesApiResult): string {
  const texts: string[] = [];
  for (const item of result.output ?? []) {
    if (item.type === "message") {
      for (const content of item.content ?? []) {
        if (content.type === "output_text" && content.text) {
          texts.push(content.text);
        }
      }
    }
  }
  return texts.join("\n\n");
}

export async function callInstitutionalGpt(input: string): Promise<string> {
  if (!INSTITUTIONAL_GPT_URL || !INSTITUTIONAL_GPT_KEY) {
    throw new Error("INSTITUTIONAL_GPT_URL / INSTITUTIONAL_GPT_KEY não configurados.");
  }

  const response = await fetch(INSTITUTIONAL_GPT_URL, {
    method: "POST",
    headers: {
      Authorization: INSTITUTIONAL_GPT_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: INSTITUTIONAL_GPT_MODEL,
      input,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Erro ${response.status} ao chamar o modelo institucional: ${body}`);
  }

  const result: ResponsesApiResult = await response.json();
  const text = extractOutputText(result);
  if (!text) {
    throw new Error("O modelo institucional não devolveu nenhum texto de saída.");
  }
  return text;
}
