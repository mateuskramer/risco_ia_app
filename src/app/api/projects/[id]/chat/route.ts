import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession, isSessionPayload } from "@/lib/auth";
import { answerQuestion, ChatMessage } from "@/lib/agents/chat-with-document";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!isSessionPayload(session)) return session;
  const { id } = await params;
  const projectId = Number(id);

  const body = await req.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const history: ChatMessage[] = Array.isArray(body.history) ? body.history.slice(-12) : [];

  if (!question) {
    return NextResponse.json({ error: "Pergunta vazia." }, { status: 400 });
  }

  const result = await pool.query("SELECT id_user, text FROM project WHERE id_project = $1", [projectId]);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }
  const project = result.rows[0];
  // Mesma regra de visualização do resto do app: admin vê tudo, usuário comum só o que é dele.
  if (session.role !== "admin" && project.id_user !== session.userId) {
    return NextResponse.json({ error: "Você não tem acesso a este documento." }, { status: 403 });
  }

  try {
    const answer = await answerQuestion(project.text, question, history);
    return NextResponse.json({ answer });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao responder.";
    return NextResponse.json({ error: `Não foi possível responder: ${message}` }, { status: 502 });
  }
}
