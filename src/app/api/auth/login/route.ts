import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyPassword, signSession, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "E-mail e senha são obrigatórios." }, { status: 400 });
  }

  const result = await pool.query(
    "SELECT id_user, name, email, password, role, status FROM users WHERE email = $1",
    [email]
  );
  const user = result.rows[0];

  // Mesma mensagem genérica pra usuário inexistente e senha errada —
  // não dar dica de qual dos dois está errado (evita enumerar e-mails cadastrados).
  if (!user) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }
  if (user.status === "inativo") {
    return NextResponse.json(
      { error: "Este usuário está inativo. Contate um administrador." },
      { status: 403 }
    );
  }
  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  const token = await signSession({ userId: user.id_user, name: user.name, email: user.email, role: user.role });
  const res = NextResponse.json({
    userId: String(user.id_user),
    name: user.name,
    email: user.email,
    role: user.role,
  });
  setSessionCookie(res, token);
  return res;
}
