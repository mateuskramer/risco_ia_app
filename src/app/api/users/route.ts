import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin, isSessionPayload, hashPassword } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!isSessionPayload(session)) return session;

  const { rows } = await pool.query(
    "SELECT id_user, name, email, role, status, created_at FROM users ORDER BY created_at ASC"
  );
  return NextResponse.json(
    rows.map((u) => ({
      id: String(u.id_user),
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.created_at,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!isSessionPayload(session)) return session;

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role === "admin" ? "admin" : "user";

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

  const passwordHash = await hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)
     RETURNING id_user, name, email, role, status, created_at`,
    [name, email, passwordHash, role]
  );
  const u = rows[0];
  return NextResponse.json(
    { id: String(u.id_user), name: u.name, email: u.email, role: u.role, status: u.status, createdAt: u.created_at },
    { status: 201 }
  );
}
