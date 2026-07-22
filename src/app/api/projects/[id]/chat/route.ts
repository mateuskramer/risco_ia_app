import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession, isSessionPayload } from "@/lib/auth";
import { answerQuestion, ChatMessage } from "@/lib/agents/chat-with-document";
import {
  getProjectChats,
  createProjectChat,
  deleteProjectChat,
  getChatInteractions,
  addChatInteraction,
  updateChatTitle,
} from "@/lib/projects-db";

// GET: Retorna todas as conversas salvas no banco de dados para este projeto com suas interações
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!isSessionPayload(session)) return session;
  const { id } = await params;
  const projectId = Number(id);

  const projectCheck = await pool.query("SELECT id_user FROM project WHERE id_project = $1", [projectId]);
  if (projectCheck.rows.length === 0) {
    return NextResponse.json([], { status: 404 });
  }

  if (session.role !== "admin" && projectCheck.rows[0].id_user !== session.userId) {
    return NextResponse.json({ error: "Você não tem acesso a este documento." }, { status: 403 });
  }

  const chats = await getProjectChats(projectId);
  const threads = await Promise.all(
    chats.map(async (c) => {
      const messages = await getChatInteractions(c.id_chat);
      return {
        id: String(c.id_chat),
        title: c.title,
        createdAt: c.created_at,
        messages,
      };
    })
  );

  return NextResponse.json(threads);
}

// POST: Cria conversas, deleta conversas ou envia perguntas para o GPT-5.1 salvando no Banco de Dados SQL
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(req);
  if (!isSessionPayload(session)) return session;
  const { id } = await params;
  const projectId = Number(id);

  const body = await req.json().catch(() => ({}));
  const { action, chatId, question, history } = body;

  const result = await pool.query("SELECT id_user, text FROM project WHERE id_project = $1", [projectId]);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }
  const project = result.rows[0];

  if (session.role !== "admin" && project.id_user !== session.userId) {
    return NextResponse.json({ error: "Você não tem acesso a este documento." }, { status: 403 });
  }

  // Validação de segurança: se um chatId for fornecido, confirma que ele pertence a este projeto
  if (chatId) {
    const checkChat = await pool.query("SELECT id_chat FROM chat WHERE id_chat = $1 AND id_project = $2", [
      Number(chatId),
      projectId,
    ]);
    if (checkChat.rows.length === 0) {
      return NextResponse.json({ error: "Esta conversa não pertence a este projeto." }, { status: 403 });
    }
  }

  // Ação 1: Criar novo tópico de conversa no Banco de Dados
  if (action === "create_thread") {
    const newChat = await createProjectChat(projectId, body.title || "Nova conversa");
    return NextResponse.json({
      id: String(newChat.id_chat),
      title: newChat.title,
      createdAt: newChat.created_at,
      messages: [],
    });
  }

  // Ação 2: Deletar tópico de conversa do Banco de Dados
  if (action === "delete_thread" && chatId) {
    await deleteProjectChat(Number(chatId));
    return NextResponse.json({ ok: true });
  }

  // Ação 3: Enviar pergunta e salvar no Banco de Dados
  const cleanQuestion = typeof question === "string" ? question.trim() : "";
  const chatHistory: ChatMessage[] = Array.isArray(history) ? history.slice(-12) : [];

  if (!cleanQuestion) {
    return NextResponse.json({ error: "Pergunta vazia." }, { status: 400 });
  }

  try {
    // Se não veio chatId ou for inexistente, cria um novo no banco
    let currentChatId = Number(chatId);
    if (!currentChatId || isNaN(currentChatId)) {
      const newChat = await createProjectChat(projectId, cleanQuestion.substring(0, 35));
      currentChatId = newChat.id_chat;
    }

    // Se a pergunta for a primeira da conversa, atualiza o título do Chat
    if (chatHistory.length === 0) {
      const title = cleanQuestion.length > 35 ? cleanQuestion.substring(0, 35) + "..." : cleanQuestion;
      await updateChatTitle(currentChatId, title);
    }

    // Grava a pergunta do usuário no Banco
    await addChatInteraction(currentChatId, cleanQuestion, 1);

    // Pergunta ao modelo GPT-5.1
    const answer = await answerQuestion(project.text, cleanQuestion, chatHistory);

    // Grava a resposta da IA no Banco
    await addChatInteraction(currentChatId, answer, 2);

    return NextResponse.json({ answer, chatId: String(currentChatId) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao responder.";
    return NextResponse.json({ error: `Não foi possível responder: ${message}` }, { status: 502 });
  }
}
