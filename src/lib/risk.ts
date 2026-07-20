import { RiskTier } from "./types";

export const RISK_TIER_LABEL: Record<RiskTier, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};

export const RISK_TIER_RANGE: Record<RiskTier, string> = {
  baixo: "0–40",
  medio: "40–70",
  alto: "70–100",
};

export const RISK_TIER_VAR: Record<RiskTier, { fg: string; bg: string }> = {
  baixo: { fg: "var(--risk-low)", bg: "var(--risk-low-bg)" },
  medio: { fg: "var(--risk-medium)", bg: "var(--risk-medium-bg)" },
  alto: { fg: "var(--risk-high)", bg: "var(--risk-high-bg)" },
};

export const RISK_TIER_TEXT_CLASS: Record<RiskTier, string> = {
  baixo: "text-risk-low",
  medio: "text-risk-medium",
  alto: "text-risk-high",
};

export const RISK_TIER_BG_CLASS: Record<RiskTier, string> = {
  baixo: "bg-risk-low-bg",
  medio: "bg-risk-medium-bg",
  alto: "bg-risk-high-bg",
};
