import { callInstitutionalGpt } from "./institutional-gpt-client";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function answerQuestion(
  documentText: string,
  question: string,
  history: ChatMessage[]
): Promise<string> {
  const historyText = history
    .map((m) => `${m.role === "user" ? "Usuário" : "Assistente"}: ${m.content}`)
    .join("\n");

  const input =
    "Você responde perguntas sobre o documento abaixo, com base exclusivamente nele. " +
    "Se a resposta não estiver no texto, diga claramente que essa informação não consta no " +
    "documento — nunca invente. Seja direto e, quando fizer sentido, cite o trecho que embasa " +
    "a resposta.\n\n" +
    `DOCUMENTO:\n${documentText}\n\n` +
    (historyText ? `HISTÓRICO DA CONVERSA:\n${historyText}\n\n` : "") +
    `PERGUNTA: ${question}`;

  return callInstitutionalGpt(input);
}
