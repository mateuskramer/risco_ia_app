import { AgentPrompt, AppUser, DocumentHistoryEntry, RiskDocument, RiskFindingStatus, Role, Session, SystemSettings } from "./types";

// Config global de modelo de IA: ainda cosmético no front (quem manda de
// verdade é a env var GOOGLE_MODEL no backend) — próximo passo é persistir
// isso numa tabela de configuração de verdade.
const SETTINGS_KEY = "risk-app:settings";

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers:
      init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json", ...init.headers }
        : init?.headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status} ao chamar ${path}`);
  }
  return res.json();
}

// ---------- Auth / Usuários — backend real (bcrypt + cookie httpOnly) ----------

export async function login(email: string, password: string): Promise<Session> {
  return api<Session>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export async function register(name: string, email: string, password: string): Promise<Session> {
  return api<Session>("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
}

// A sessão não fica mais acessível via JS (cookie httpOnly) — pra saber quem
// está logado, pergunta pro servidor.
export async function getSession(): Promise<Session | null> {
  return api<Session | null>("/api/auth/me");
}

export async function logout(): Promise<void> {
  await api("/api/auth/logout", { method: "POST" });
}

export async function listUsers(): Promise<AppUser[]> {
  return api<AppUser[]>("/api/users");
}

export async function createUser(name: string, email: string, password: string, role: Role): Promise<AppUser> {
  return api<AppUser>("/api/users", { method: "POST", body: JSON.stringify({ name, email, password, role }) });
}

export async function updateUser(id: string, patch: Partial<Pick<AppUser, "role" | "status" | "name">>): Promise<void> {
  await api(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteUser(id: string): Promise<void> {
  await api(`/api/users/${id}`, { method: "DELETE" });
}

// ---------- Documentos (PDFs) — backend real (Postgres + Gemini) ----------

export async function listDocuments(): Promise<RiskDocument[]> {
  return api<RiskDocument[]>("/api/projects");
}

export async function getDocument(id: string): Promise<RiskDocument | null> {
  try {
    return await api<RiskDocument>(`/api/projects/${id}`);
  } catch {
    return null;
  }
}

export async function listAllHistory(): Promise<DocumentHistoryEntry[]> {
  return [];
}

export async function getDocumentHistory(id: string): Promise<DocumentHistoryEntry[]> {
  interface ApiHistoryEntry {
    at: string;
    version: number;
    analyzedBy: string;
    overallScore: number;
    tier: DocumentHistoryEntry["tier"];
    findings: {
      riskName: string;
      score: number;
      tier: DocumentHistoryEntry["tier"];
      probability?: string;
      impact?: string;
      description: string;
    }[];
  }
  try {
    const raw = await api<ApiHistoryEntry[]>(`/api/projects/${id}/history`);
    return raw.map((h) => ({
      id: `${id}-v${h.version}`,
      documentId: id,
      version: h.version,
      action: h.version === 1 ? "upload" : "reanalise",
      actorId: "",
      actorName: h.analyzedBy,
      at: h.at,
      note: h.version === 1 ? "Upload do documento e primeira análise dos agentes de IA." : "Reanálise solicitada pelo usuário.",
      overallScore: h.overallScore,
      tier: h.tier,
      findings: h.findings.map((f, i) => ({
        id: `${id}-v${h.version}-${i}`,
        riskName: f.riskName,
        score: f.score,
        tier: f.tier,
        probability: f.probability || "Média",
        impact: f.impact || "Médio",
        description: f.description,
        mitigation: "",
        excerpts: [],
        status: "aberto" as const,
        agentPromptId: null,
      })),
    }));
  } catch (err) {
    console.error("Erro ao obter histórico do documento:", err);
    return [];
  }
}

// owner não é mais passado pelo cliente — o backend identifica quem é pelo cookie de sessão.
// O upload agora sempre "sucede" em salvar o projeto — se a análise falhar,
// a resposta vem com um campo `warning` em vez de erro, e o projeto já
// existe (dá pra abrir o PDF e tentar reanalisar depois).
export async function uploadDocument(file: File, description = ""): Promise<RiskDocument & { warning?: string }> {
  const form = new FormData();
  form.append("file", file);
  if (description.trim()) form.append("description", description.trim());
  return api<RiskDocument & { warning?: string }>("/api/projects", { method: "POST", body: form });
}

export async function reanalyzeDocument(id: string): Promise<RiskDocument> {
  return api<RiskDocument>(`/api/projects/${id}/reanalyze`, { method: "POST" });
}

export async function deleteDocument(id: string): Promise<void> {
  await api(`/api/projects/${id}`, { method: "DELETE" });
}

export async function updateFindingStatus(documentId: string, riskId: string, status: RiskFindingStatus): Promise<RiskDocument> {
  return api<RiskDocument>(`/api/projects/${documentId}/risks/${riskId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// ---------- Agentes de IA (prompts) — backend real (tabela risk, admin only) ----------

export async function listAgentPrompts(): Promise<AgentPrompt[]> {
  return api<AgentPrompt[]>("/api/risks");
}

// Qualquer usuário pode chamar isso (diferente de listAgentPrompts, que é
// admin only) — usado só pra saber se o upload pode ser liberado.
export async function hasActiveRisks(): Promise<boolean> {
  const { hasActive } = await api<{ hasActive: boolean }>("/api/risks/status");
  return hasActive;
}

export async function createAgentPrompt(riskName: string, description: string, prompt: string): Promise<AgentPrompt> {
  return api<AgentPrompt>("/api/risks", { method: "POST", body: JSON.stringify({ riskName, description, prompt }) });
}

export async function updateAgentPrompt(
  id: string,
  patch: { riskName?: string; description?: string; prompt?: string; active?: boolean }
): Promise<AgentPrompt> {
  return api<AgentPrompt>(`/api/risks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteAgentPrompt(id: string): Promise<void> {
  await api(`/api/risks/${id}`, { method: "DELETE" });
}

// ---------- Configuração global de modelo de IA (ainda cosmética) ----------

const EMPTY_SETTINGS: SystemSettings = { model: null, updatedAt: null, updatedBy: null, history: [] };

export async function getSystemSettings(): Promise<SystemSettings> {
  return readLocal<SystemSettings>(SETTINGS_KEY, EMPTY_SETTINGS);
}

export async function updateSystemModel(model: string, actor: Session): Promise<SystemSettings> {
  const current = readLocal<SystemSettings>(SETTINGS_KEY, EMPTY_SETTINGS);
  const updated: SystemSettings = {
    model,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.name,
    history:
      current.model && current.updatedAt && current.updatedBy
        ? [...current.history, { model: current.model, updatedAt: current.updatedAt, updatedBy: current.updatedBy }]
        : current.history,
  };
  writeLocal(SETTINGS_KEY, updated);
  return updated;
}
