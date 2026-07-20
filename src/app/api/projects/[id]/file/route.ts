import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession, isSessionPayload } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!isSessionPayload(session)) return session;
  const { id } = await params;

  const result = await pool.query("SELECT title, id_user, midia FROM project WHERE id_project = $1", [id]);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }
  const row = result.rows[0];
  if (session.role !== "admin" && row.id_user !== session.userId) {
    return NextResponse.json({ error: "Você não tem acesso a este projeto." }, { status: 403 });
  }
  if (!row.midia) {
    return NextResponse.json({ error: "Arquivo original não está disponível para este projeto." }, { status: 404 });
  }

  const safeName = (row.title || "documento.pdf").replace(/"/g, "");
  return new NextResponse(row.midia, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, max-age=0, no-cache",
    },
  });
}
