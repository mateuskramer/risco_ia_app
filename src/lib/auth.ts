import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_SECRET = process.env.AUTH_SECRET;

function getSecret(): Uint8Array {
  if (!SESSION_COOKIE_SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET não definida. Gere uma com: openssl rand -base64 32");
    }
    console.warn(
      "[auth] AUTH_SECRET não definida — usando um segredo de desenvolvimento. Defina AUTH_SECRET em produção."
    );
  }
  return new TextEncoder().encode(SESSION_COOKIE_SECRET || "dev-only-secret-troque-em-producao");
}

export const SESSION_COOKIE = "riscoia_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 dias

export type Role = "admin" | "user";

export interface SessionPayload {
  userId: number;
  name: string;
  email: string;
  role: Role;
}

// ---------- Senha ----------

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ---------- Sessão (JWT em cookie httpOnly) ----------

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return Promise.resolve(null);
  return verifySessionToken(token);
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

// ---------- Helpers de autorização pras rotas ----------

export async function requireSession(req: NextRequest): Promise<SessionPayload | NextResponse> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  return session;
}

export async function requireAdmin(req: NextRequest): Promise<SessionPayload | NextResponse> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Apenas administradores podem fazer isso." }, { status: 403 });
  }
  return session;
}

export function isSessionPayload(value: SessionPayload | NextResponse): value is SessionPayload {
  return !(value instanceof NextResponse);
}
