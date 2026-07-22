export type Role = "admin" | "user";

export type UserStatus = "ativo" | "inativo";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
}

export type RiskTier = "baixo" | "medio" | "alto";
export type RiskFindingStatus = "aberto" | "resolvido" | "falso_positivo";

export function tierFromScore(score: number): RiskTier {
  if (score < 40) return "baixo";
  if (score < 70) return "medio";
  return "alto";
}

export interface RiskFinding {
  id: string;
  riskName: string;
  score: number;
  tier: RiskTier;
  probability: string;
  impact: string;
  description: string;
  mitigation: string;
  excerpts: { citation: string; page: number | null }[];
  status: RiskFindingStatus;
  agentPromptId: string | null;
}

export type DocumentStatus = "pendente" | "processando" | "concluido" | "erro";

export interface DocumentHistoryEntry {
  id: string;
  documentId: string;
  version: number;
  action: "upload" | "reanalise" | "edicao" | "status";
  actorId: string;
  actorName: string;
  at: string;
  note: string;
  overallScore: number;
  tier: RiskTier;
  findings: RiskFinding[];
}

export interface RiskDocument {
  id: string;
  fileName: string;
  title: string;
  description: string;
  ownerId: string;
  ownerName: string;
  uploadedAt: string;
  status: DocumentStatus;
  currentVersion: number;
  overallScore: number;
  tier: RiskTier;
  findings: RiskFinding[];
}

export interface AgentPromptVersion {
  version: number;
  prompt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface AgentPrompt {
  id: string;
  riskName: string;
  description: string;
  active: boolean;
  currentVersion: number;
  prompt: string;
  updatedAt: string;
  updatedBy: string;
  history: AgentPromptVersion[];
}

// Modelo de IA único, usado por todos os agentes/prompts. Trocar o modelo
// também é registrado sem sobrescrever a escolha anterior.
export interface SystemModelChange {
  model: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SystemSettings {
  model: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  history: SystemModelChange[];
}

export interface Session {
  userId: string;
  name: string;
  email: string;
  role: Role;
}