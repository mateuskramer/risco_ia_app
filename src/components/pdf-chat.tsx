"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function PdfChat({ documentId }: { documentId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, sending]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || sending) return;

    const historyBeforeThis = messages;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`/api/projects/${documentId}/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: historyBeforeThis }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Não foi possível responder.");
      }
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível responder.");
      setMessages((prev) => prev.slice(0, -1)); // remove a pergunta que falhou
      setInput(question);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4" /> Perguntar sobre o projeto
        </CardTitle>
        <CardDescription>Respostas baseadas só no texto deste PDF, não é salvo depois que você sai da página.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex max-h-80 flex-col gap-2.5 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma pergunta ainda — pergunte algo sobre o conteúdo deste projeto.
            </p>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                  m.role === "user" ? "self-end bg-primary text-primary-foreground" : "self-start bg-card border border-border"
                )}
              >
                {m.content}
              </div>
            ))
          )}
          {sending && (
            <div className="flex items-center gap-2 self-start rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            placeholder="Ex.: qual o prazo de vigência deste contrato?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
          />
          <Button type="submit" size="icon" disabled={sending || !input.trim()} aria-label="Enviar pergunta">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
