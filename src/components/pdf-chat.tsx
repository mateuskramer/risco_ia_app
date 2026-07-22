"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, MessageCircle, Plus, Trash2, MessageSquareText, PanelLeft, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

export function PdfChat({ documentId }: { documentId: string }) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Carrega os tópicos de conversa da API do Banco de Dados
  async function loadThreadsFromApi() {
    try {
      const res = await fetch(`/api/projects/${documentId}/chat`, { credentials: "include" });
      if (res.ok) {
        const data: ChatThread[] = await res.json();
        if (data.length > 0) {
          setThreads(data);
          setActiveThreadId(data[0].id);
          return;
        }
      }
    } catch (e) {
      console.error("Erro ao carregar conversas da API:", e);
    }

    // Fallback para localStorage caso seja ambiente offline
    try {
      const saved = localStorage.getItem(`chat_threads_${documentId}`);
      if (saved) {
        const parsed: ChatThread[] = JSON.parse(saved);
        setThreads(parsed);
        if (parsed.length > 0) {
          setActiveThreadId(parsed[0].id);
          return;
        }
      }
    } catch (e) {
      console.error("Erro ao ler localStorage:", e);
    }

    // Se não tiver nenhuma, cria uma inicial
    createNewThread();
  }

  useEffect(() => {
    loadThreadsFromApi();
  }, [documentId]);

  // Persiste no localStorage em paralelo para cache imediato no front
  function saveThreadsToStorage(updatedThreads: ChatThread[]) {
    setThreads(updatedThreads);
    try {
      localStorage.setItem(`chat_threads_${documentId}`, JSON.stringify(updatedThreads));
    } catch (e) {
      console.error("Erro ao salvar no localStorage:", e);
    }
  }

  async function createNewThread() {
    try {
      const res = await fetch(`/api/projects/${documentId}/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_thread", title: "Nova conversa" }),
      });
      if (res.ok) {
        const newThread: ChatThread = await res.json();
        const updated = [newThread, ...threads];
        saveThreadsToStorage(updated);
        setActiveThreadId(newThread.id);
        return;
      }
    } catch (e) {
      console.error("Erro ao criar conversa no banco:", e);
    }

    // Fallback local se API falhar
    const localThread: ChatThread = {
      id: `thread_${Date.now()}`,
      title: "Nova conversa",
      createdAt: new Date().toISOString(),
      messages: [],
    };
    const updated = [localThread, ...threads];
    saveThreadsToStorage(updated);
    setActiveThreadId(localThread.id);
  }

  async function deleteThread(threadId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`/api/projects/${documentId}/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_thread", chatId: threadId }),
      });
    } catch (e) {
      console.error("Erro ao excluir no banco:", e);
    }

    const updated = threads.filter((t) => t.id !== threadId);
    saveThreadsToStorage(updated);
    toast.success("Conversa removida.");

    if (activeThreadId === threadId) {
      if (updated.length > 0) {
        setActiveThreadId(updated[0].id);
      } else {
        createNewThread();
      }
    }
  }

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];
  const messages = activeThread?.messages || [];

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || sending || !activeThread) return;

    const historyBeforeThis = messages;
    const userMessage: ChatMessage = { role: "user", content: question };
    const newMessages = [...historyBeforeThis, userMessage];

    const newTitle =
      activeThread.messages.length === 0
        ? question.length > 35
          ? question.substring(0, 35) + "..."
          : question
        : activeThread.title;

    const updatedThreadsBeforeSend = threads.map((t) =>
      t.id === activeThread.id ? { ...t, title: newTitle, messages: newMessages } : t
    );
    saveThreadsToStorage(updatedThreadsBeforeSend);

    setInput("");
    setSending(true);

    try {
      const res = await fetch(`/api/projects/${documentId}/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: activeThread.id,
          question,
          history: historyBeforeThis,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Não foi possível responder.");
      }

      const data = await res.json();
      const assistantMessage: ChatMessage = { role: "assistant", content: data.answer };

      const updatedThreadsAfterSend = updatedThreadsBeforeSend.map((t) =>
        t.id === activeThread.id
          ? {
              ...t,
              id: data.chatId || t.id,
              title: newTitle,
              messages: [...newMessages, assistantMessage],
            }
          : t
      );
      saveThreadsToStorage(updatedThreadsAfterSend);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível responder.");
      const rolledBack = updatedThreadsBeforeSend.map((t) =>
        t.id === activeThread.id ? { ...t, title: newTitle, messages: historyBeforeThis } : t
      );
      saveThreadsToStorage(rolledBack);
      setInput(question);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, sending]);

  return (
    <Card className="flex flex-col border border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen(!historyOpen)}
            className="h-8 gap-1.5 text-xs"
            title={historyOpen ? "Esconder histórico de conversas" : "Ver histórico de conversas"}
          >
            {historyOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            <span>Conversas ({threads.length})</span>
          </Button>
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <MessageCircle className="h-4 w-4 text-primary" />
              {activeThread?.title || "Chat com a IA"}
            </CardTitle>
          </div>
        </div>

        <Button size="sm" onClick={() => createNewThread()} className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Nova conversa
        </Button>
      </CardHeader>

      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Painel Retrátil de Histórico de Conversas */}
          {historyOpen && (
            <div className="w-60 shrink-0 flex flex-col gap-1.5 rounded-lg border border-border bg-muted/20 p-2.5 h-[calc(100vh-280px)] min-h-[350px] overflow-y-auto animate-fade-in">
              <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Histórico</span>
                <span className="text-[10px] font-normal">{threads.length} conversa(s)</span>
              </div>
              {threads.map((t) => {
                const isActive = t.id === activeThread?.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setActiveThreadId(t.id)}
                    className={cn(
                      "group flex items-center justify-between rounded-md px-2.5 py-2 text-xs cursor-pointer transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate pr-1">
                      <MessageSquareText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span className="truncate">{t.title}</span>
                    </div>
                    {threads.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => deleteThread(t.id, e)}
                        className={cn(
                          "opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity",
                          isActive ? "hover:bg-primary-foreground/20 text-primary-foreground" : "hover:bg-accent-foreground/10 text-muted-foreground"
                        )}
                        title="Excluir conversa"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Área Principal do Chat (Totalmente Espaçosa e Dinâmica) */}
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex h-[calc(100vh-280px)] min-h-[350px] flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-muted/20 p-4">
              {messages.length === 0 ? (
                <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
                  <MessageCircle className="h-8 w-8 text-primary opacity-40" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Como posso ajudar com este documento?</p>
                    <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                      Faça perguntas sobre o conteúdo do PDF. O GPT-5.1 responderá com base exclusiva no texto.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "max-w-[80%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                      m.role === "user"
                        ? "self-end bg-primary text-primary-foreground font-medium"
                        : "self-start bg-card border border-border text-foreground"
                    )}
                  >
                    {m.content}
                  </div>
                ))
              )}
              {sending && (
                <div className="flex items-center gap-2.5 self-start rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Pensando com o GPT-5.1…
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                placeholder="Digite sua pergunta sobre este projeto…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sending}
                className="h-10 text-sm"
              />
              <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={sending || !input.trim()} aria-label="Enviar pergunta">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
