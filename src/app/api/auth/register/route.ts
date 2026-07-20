import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hashPassword, signSession, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!name || !email || password.length < 6) {
    return NextResponse.json(
      { error: "Nome, e-mail e senha (mínimo 6 caracteres) são obrigatórios." },
      { status: 400 }
    );
  }

  const existing = await pool.query("SELECT id_user FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: "Já existe uma conta com este e-mail." }, { status: 409 });
  }

  // Bootstrap: o primeiro usuário do sistema vira admin automaticamente
  // (senão ninguém conseguiria acessar Usuários/Agentes pra promover alguém).
  const countResult = await pool.query("SELECT COUNT(*)::int AS n FROM users");
  const isFirstUser = countResult.rows[0].n === 0;

  const passwordHash = await hashPassword(password);
  const inserted = await pool.query(
    `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)
     RETURNING id_user, name, email, role`,
    [name, email, passwordHash, isFirstUser ? "admin" : "user"]
  );
  const user = inserted.rows[0];

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
