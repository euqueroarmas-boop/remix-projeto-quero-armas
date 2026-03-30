import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send, Bot, User, Loader2, Save, Trash2, Terminal, Sparkles,
  AlertTriangle, CheckCircle2, RefreshCw, Copy, GitCommit,
} from "lucide-react";
import { toast } from "sonner";

type MessageStatus = "sending" | "streaming" | "done" | "error" | "retrying";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  saved?: boolean;
  status?: MessageStatus;
  retryCount?: number;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dev-chat`;
const PATCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/execute-code-patch`;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 20_000;

const QUICK_COMMANDS = [
  "Analisar erros recentes do sistema",
  "Sugerir melhorias de conversão",
  "Verificar SEO das páginas principais",
  "Listar componentes que precisam de refatoração",
  "Analisar funil de vendas",
];

const StatusIndicator = ({ status }: { status?: MessageStatus }) => {
  if (!status || status === "done") return null;
  const map: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    sending: { icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />, label: "Enviando...", cls: "text-muted-foreground" },
    streaming: { icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />, label: "Recebendo...", cls: "text-primary" },
    retrying: { icon: <RefreshCw className="h-2.5 w-2.5 animate-spin" />, label: "Tentando novamente...", cls: "text-yellow-500" },
    error: { icon: <AlertTriangle className="h-2.5 w-2.5" />, label: "Falhou", cls: "text-destructive" },
  };
  const s = map[status];
  if (!s) return null;
  return (
    <span className={`flex items-center gap-1 text-[9px] ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
};

const CodeBlock = ({ code, lang }: { code: string; lang: string }) => {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  const lines = code.split("\n");
  const fileMatch = lines[0]?.match(/^\/\/\s*(.+\.\w+)/);
  const filePath = fileMatch?.[1]?.trim();

  const handleApply = async () => {
    if (!filePath) { toast.error("Caminho do arquivo não detectado no código"); return; }
    setApplying(true);
    try {
      const token = sessionStorage.getItem("admin_token") || "";
      const resp = await fetch(PATCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "x-admin-token": token,
        },
        body: JSON.stringify({
          file_path: filePath,
          content: code,
          commit_message: `fix(auto): patch via DevChat — ${filePath}`,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      setApplied(data.commit_sha?.slice(0, 7) || "ok");
      toast.success(`Commit aplicado: ${data.commit_sha?.slice(0, 7)}`);
    } catch (e) {
      toast.error(`Falha ao aplicar: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="my-2 rounded-md border border-border overflow-hidden">
      <div className="flex items-center justify-between bg-muted/80 px-2.5 py-1 gap-1">
        <span className="text-[10px] text-muted-foreground font-mono truncate">
          {filePath || lang || "code"}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={handleCopy} className="h-5 px-1.5 text-[9px] gap-1 text-muted-foreground hover:text-primary">
            <Copy className="h-2.5 w-2.5" /> Copiar
          </Button>
          {filePath && !applied && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleApply}
              disabled={applying}
              className="h-5 px-1.5 text-[9px] gap-1 text-muted-foreground hover:text-primary"
            >
              {applying ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <GitCommit className="h-2.5 w-2.5" />}
              {applying ? "Aplicando..." : "Aplicar"}
            </Button>
          )}
          {applied && (
            <span className="flex items-center gap-1 text-[9px] text-primary px-1.5">
              <CheckCircle2 className="h-2.5 w-2.5" /> {applied}
            </span>
          )}
        </div>
      </div>
      <pre className="p-2.5 overflow-x-auto text-[11px] leading-relaxed bg-background">
        <code className="text-foreground/90 font-mono">{code}</code>
      </pre>
    </div>
  );
};

const MessageContent = ({ content }: { content: string }) => {
  // Split content into text and code blocks
  const parts: { type: "text" | "code"; content: string; lang?: string }[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", content: match[2].trim(), lang: match[1] || "ts" });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }

  if (parts.length === 0) {
    return <div className="whitespace-pre-wrap break-words leading-relaxed">{content}</div>;
  }

  return (
    <div className="break-words leading-relaxed">
      {parts.map((part, i) =>
        part.type === "code" ? (
          <CodeBlock key={i} code={part.content} lang={part.lang || "ts"} />
        ) : (
          <span key={i} className="whitespace-pre-wrap">{part.content}</span>
        )
      )}
    </div>
  );
};

const DevChatPanel = forwardRef<HTMLDivElement>((_props, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const getAdminToken = () => sessionStorage.getItem("admin_token") || "";

  const fetchWithTimeout = async (url: string, opts: RequestInit, timeoutMs: number) => {
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...opts, signal: controller.signal });
      return resp;
    } finally {
      clearTimeout(timer);
    }
  };

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;

    const userMessage: Message = { role: "user", content: msg, timestamp: new Date(), status: "sending" };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const allMessages = [...messages, userMessage].map((m) => ({ role: m.role, content: m.content }));

    let lastError = "";
    let success = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      let assistantSoFar = "";

      const upsertAssistant = (chunk: string, status: MessageStatus = "streaming") => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar, status } : m);
          }
          return [...prev, { role: "assistant", content: assistantSoFar, timestamp: new Date(), status }];
        });
      };

      try {
        if (attempt > 1) {
          setMessages((prev) => {
            const filtered = prev.filter((m, i) => !(i === prev.length - 1 && m.role === "assistant" && m.status === "error"));
            return [...filtered, { role: "assistant", content: `🔄 Tentativa ${attempt}/${MAX_RETRIES}...`, timestamp: new Date(), status: "retrying" }];
          });
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }

        const resp = await fetchWithTimeout(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "x-admin-token": getAdminToken(),
          },
          body: JSON.stringify({ action: "chat", messages: allMessages }),
        }, TIMEOUT_MS);

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
          lastError = err.error || `HTTP ${resp.status}`;

          // Don't retry auth errors
          if (resp.status === 401 || resp.status === 402) {
            throw new Error(lastError);
          }
          continue;
        }

        if (!resp.body) throw new Error("Sem corpo na resposta");

        // Remove retrying message
        setMessages((prev) => prev.filter((m) => m.status !== "retrying"));

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) upsertAssistant(content);
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Mark done
        setMessages((prev) =>
          prev.map((m, i) => i === prev.length - 1 && m.role === "assistant" ? { ...m, status: "done" } : m)
        );
        success = true;
        break;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          lastError = "Timeout: resposta demorou mais de 20s";
        } else if (e instanceof Error) {
          lastError = e.message;
          // Don't retry auth/billing errors
          if (lastError.includes("inválido") || lastError.includes("expirado") || lastError.includes("insuficientes")) {
            break;
          }
        }
        console.error(`DevChat attempt ${attempt}/${MAX_RETRIES}:`, lastError);
      }
    }

    if (!success) {
      console.error("DevChat failed after retries:", lastError);

      const fallbackContent = `❌ **Falha após ${MAX_RETRIES} tentativas**

**Erro:** ${lastError}

**O que fazer:**
${lastError.includes("Token") || lastError.includes("inválido") || lastError.includes("expirado")
  ? "→ Faça logout e login novamente no painel admin."
  : lastError.includes("Timeout")
  ? "→ Tente um comando mais curto ou aguarde alguns segundos."
  : lastError.includes("IA não configurado")
  ? "→ Verifique se LOVABLE_API_KEY está configurada nas variáveis do backend."
  : "→ Tente novamente em alguns segundos."}

**Comando original:** \`${messages.length > 0 ? allMessages[allMessages.length - 1]?.content?.slice(0, 100) : msg.slice(0, 100)}\``;

      setMessages((prev) => {
        const filtered = prev.filter((m) => m.status !== "retrying");
        const last = filtered[filtered.length - 1];
        if (last?.role === "assistant") {
          return filtered.map((m, i) => i === filtered.length - 1 ? { ...m, content: fallbackContent, status: "error" } : m);
        }
        return [...filtered, { role: "assistant", content: fallbackContent, timestamp: new Date(), status: "error" }];
      });

      toast.error(`DevChat: ${lastError}`);
    }

    setIsLoading(false);
  };

  const saveToPromptIntelligence = async (msg: Message, idx: number) => {
    try {
      const resp = await fetchWithTimeout(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "x-admin-token": getAdminToken(),
        },
        body: JSON.stringify({
          action: "save",
          command: {
            summary: msg.content.slice(0, 200),
            type: "correction",
            confidence: 0.7,
            impact: 0.5,
            prompts: [{ title: "DevChat command", description: msg.content, priority: "medium" }],
          },
        }),
      }, TIMEOUT_MS);

      if (!resp.ok) throw new Error("Falha ao salvar");

      setMessages((prev) => prev.map((m, i) => (i === idx ? { ...m, saved: true } : m)));
      toast.success("Salvo no Prompt Intelligence");
    } catch {
      toast.error("Erro ao salvar no Prompt Intelligence");
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.info("Copiado!");
  };

  const retryLast = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      setMessages((prev) => prev.filter((m) => !(m.role === "assistant" && m.status === "error")));
      sendMessage(lastUser.content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => { setMessages([]); toast.info("Chat limpo"); };

  return (
    <div ref={ref} className="flex flex-col h-[calc(100vh-10rem)] max-h-[700px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">DevChat</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">IA</span>
        </div>
        <Button variant="ghost" size="sm" onClick={clearChat} className="text-xs text-muted-foreground gap-1">
          <Trash2 className="h-3 w-3" /> Limpar
        </Button>
      </div>

      {/* Quick commands */}
      {messages.length === 0 && (
        <Card className="mb-3 border-dashed">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Comandos rápidos
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_COMMANDS.map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => sendMessage(cmd)}
                  className="text-[11px] px-2.5 py-1.5 rounded-md bg-muted/50 text-foreground/80 hover:bg-primary/10 hover:text-primary transition-colors text-left"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                msg.status === "error" ? "bg-destructive/10" : "bg-primary/10"
              }`}>
                {msg.status === "error" ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                ) : msg.status === "done" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Bot className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
            )}
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : msg.status === "error"
                ? "bg-destructive/5 text-foreground border border-destructive/20"
                : "bg-muted/50 text-foreground"
            }`}>
              <MessageContent content={msg.content} />
              <div className="flex items-center justify-between mt-1.5 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] opacity-50">
                    {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <StatusIndicator status={msg.status} />
                </div>
                <div className="flex items-center gap-1">
                  {msg.role === "assistant" && (
                    <Button variant="ghost" size="sm" onClick={() => copyMessage(msg.content)} className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-primary gap-1">
                      <Copy className="h-2.5 w-2.5" /> Copiar
                    </Button>
                  )}
                  {msg.role === "assistant" && msg.status === "error" && (
                    <Button variant="ghost" size="sm" onClick={retryLast} className="h-5 px-1.5 text-[9px] text-yellow-600 hover:text-yellow-700 gap-1">
                      <RefreshCw className="h-2.5 w-2.5" /> Tentar novamente
                    </Button>
                  )}
                  {msg.role === "assistant" && !msg.saved && msg.status === "done" && (
                    <Button variant="ghost" size="sm" onClick={() => saveToPromptIntelligence(msg, i)} className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-primary gap-1">
                      <Save className="h-2.5 w-2.5" /> Salvar
                    </Button>
                  )}
                  {msg.saved && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-green-500/10 text-green-600 font-medium">Salvo</span>
                  )}
                </div>
              </div>
            </div>
            {msg.role === "user" && (
              <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-foreground/70" />
              </div>
            )}
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="bg-muted/50 rounded-lg px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite um comando..."
          rows={1}
          className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          disabled={isLoading}
        />
        <Button size="icon" onClick={() => sendMessage()} disabled={!input.trim() || isLoading} className="h-10 w-10 shrink-0">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
});

DevChatPanel.displayName = "DevChatPanel";

export default DevChatPanel;
