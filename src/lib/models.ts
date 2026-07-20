export interface LlmModelOption {
  value: string;
  label: string;
  note?: string;
}

export interface LlmModelGroup {
  provider: string;
  options: LlmModelOption[];
}

// O sistema usa só o gateway institucional (ver institutional-gpt-client.ts)
// — não há mais seleção real de provider. Mantido "Personalizado" só pra
// permitir trocar o id do modelo institucional sem precisar editar código.
export const LLM_MODEL_GROUPS: LlmModelGroup[] = [
  {
    provider: "Institucional",
    options: [{ value: "gpt-5.1", label: "GPT-5.1 (gateway institucional)" }],
  },
];

export const CUSTOM_MODEL_VALUE = "__custom__";

export function isKnownModel(value: string) {
  return LLM_MODEL_GROUPS.some((g) => g.options.some((o) => o.value === value));
}
