import { useEffect, useRef, useState, useCallback, KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Loader2, Send, HelpCircle, MessageCircle, Plus, BookOpen, Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

const BRAND = "#7A1F2B";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Fonte = {
  tipo: "legislacao" | "documento";
  titulo_norma: string | null;
  titulo_doc: string | null;
};

type Mensagem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  fontes?: Fonte[];
  isStreaming?: boolean;
};

interface CentralAjudaClienteProps {
  cliente: { id: number; nome_completo: string; cpf?: string | null } | null;
}

const SUGESTOES = [
  "O que preciso para comprar uma arma como policial civil?",
  "Quais documentos o vigilante precisa para a CNV?",
  "Como funciona o registro CAC?",
];

export function CentralAjudaCliente({ cliente }: CentralAjudaClienteProps) {
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ao montar: procura a sessão mais recente (<24h) e carrega mensagens.
  useEffect(() => {
    if (!cliente) { setInitLoading(false); return; }
    let alive = true;
    (async () => {
      try {
        const { data: sessoes } = await (supabase as any)
          .from("qa_chat_sessoes")
          .select("id, updated_at")
          .eq("cliente_id", cliente.id)
          .order("updated_at", { ascending: false })
          .limit(1);
        const recente = (sessoes ?? [])[0];
        if (
          recente &&
          new Date(recente.updated_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
        ) {
          const { data: msgs } = await (supabase as any)
            .from("qa_chat_mensagens")
            .select("id, role, content, fontes, created_at")
            .eq("sessao_id", recente.id)
            .order("created_at", { ascending: true })
            .limit(50);
          if (!alive) return;
          setSessaoId(recente.id);
          setMensagens(
            ((msgs ?? []) as any[]).map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              fontes: Array.isArray(m.fontes) ? m.fontes : [],
            })),
          );
        }
      } finally {
        if (alive) setInitLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [cliente?.id]);

  // Auto-scroll para o fim.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens]);

  // Autosize textarea (1→4 linhas).
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const max = 4 * 24 + 16; // ~4 linhas
    ta.style.height = Math.min(ta.scrollHeight, max) + "px";
  }, [input]);

  const enviar = useCallback(async (texto: string) => {
    if (!cliente || loading) return;
    const query = texto.trim();
    if (query.length < 2) return;

    setInput("");
    const userMsg: Mensagem = {
      id: `u-${Date.now()}`,
      role: "user",
      content: query,
    };
    const asstId = `a-${Date.now()}`;
    const asstMsg: Mensagem = {
      id: asstId,
      role: "assistant",
      content: "",
      fontes: [],
      isStreaming: true,
    };

    // histórico enviado: até 10 pares (20 mensagens) já completos.
    const historico = mensagens
      .filter((m) => !m.isStreaming && m.content.trim().length > 0)
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    setMensagens((prev) => [...prev, userMsg, asstMsg]);
    setLoading(true);

    let localSessaoId = sessaoId;
    let localFontes: Fonte[] = [];

    try {
      const { data: sess } = await supabase.auth.getSession();
      const jwt = sess.session?.access_token ?? PUBLISHABLE_KEY;

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/qa-kb-search-cliente`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
            apikey: PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            query,
            sessao_id: sessaoId,
            historico,
            limit: 5,
          }),
        },
      );

      if (!res.ok || !res.body) {
        // fallback: talvez retorno JSON (sem streaming)
        try {
          const j = await res.json();
          if (j?.error) throw new Error(j.error);
          if (j?.answer) {
            setMensagens((prev) =>
              prev.map((m) =>
                m.id === asstId
                  ? { ...m, content: j.answer, isStreaming: false }
                  : m,
              ),
            );
            return;
          }
        } catch (_) { /* ignore */ }
        throw new Error("Falha ao consultar a Central de Ajuda.");
      }

      const contentType = res.headers.get("Content-Type") || "";
      if (!contentType.includes("text/event-stream")) {
        const j = await res.json();
        setMensagens((prev) =>
          prev.map((m) =>
            m.id === asstId
              ? {
                  ...m,
                  content: j?.answer ?? "Sem resposta.",
                  isStreaming: false,
                }
              : m,
          ),
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;
          if (payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === "token" && evt.content) {
              full += evt.content;
              setMensagens((prev) =>
                prev.map((m) =>
                  m.id === asstId ? { ...m, content: full } : m,
                ),
              );
            } else if (evt.type === "meta" && Array.isArray(evt.fontes)) {
              localFontes = evt.fontes;
            } else if (evt.type === "session" && evt.sessao_id) {
              localSessaoId = evt.sessao_id;
              setSessaoId(evt.sessao_id);
            } else if (evt.type === "error") {
              throw new Error(evt.message || "Erro no streaming.");
            }
          } catch (e) {
            // ignora chunk malformado
          }
        }
      }

      setMensagens((prev) =>
        prev.map((m) =>
          m.id === asstId
            ? { ...m, content: full || m.content, fontes: localFontes, isStreaming: false }
            : m,
        ),
      );
    } catch (e: any) {
      setMensagens((prev) =>
        prev.map((m) =>
          m.id === asstId
            ? {
                ...m,
                content:
                  "Não consegui responder agora. Tente novamente em instantes ou fale com a equipe pelo WhatsApp.",
                isStreaming: false,
              }
            : m,
        ),
      );
      toast.error(e?.message ?? "Erro ao consultar a Central de Ajuda.");
    } finally {
      setLoading(false);
      // Suprime warning de var não usada em produção.
      void localSessaoId;
    }
  }, [cliente, loading, mensagens, sessaoId]);

  function novaConversa() {
    if (loading) return;
    setSessaoId(null);
    setMensagens([]);
    setInput("");
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar(input);
    }
  }

  function escalarParaEquipe(ultimaResposta: string) {
    if (!cliente) {
      toast.error("Faça login novamente para falar com a equipe.");
      return;
    }
    const ultimaPergunta =
      [...mensagens].reverse().find((m) => m.role === "user")?.content ?? "";
    if (!ultimaPergunta) return;

    const cpfPart = cliente.cpf ? `, CPF ${cliente.cpf}` : "";
    const respostaPart = ultimaResposta ? `A resposta que recebi foi:\n${ultimaResposta}\n\n` : "";
    const texto =
      `Olá! Sou ${cliente.nome_completo}${cpfPart}.\n\n` +
      `Perguntei na Central de Ajuda: "${ultimaPergunta}"\n\n` +
      respostaPart +
      `Isso não resolveu minha dúvida, pode me ajudar?`;
    const url = `https://wa.me/5511978481919?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank", "noopener,noreferrer");

    setEscalating(true);
    (async () => {
      try {
        await (supabase as any)
          .from("qa_central_ajuda_perguntas")
          .insert({
            cliente_id: cliente.id,
            pergunta: ultimaPergunta,
            resposta_ia: ultimaResposta || null,
            artigos_relacionados: [],
            status: "escalada_whatsapp",
          });
      } finally {
        setEscalating(false);
      }
    })();
  }

  const ultimaAssistente = [...mensagens].reverse().find(
    (m) => m.role === "assistant" && !m.isStreaming && m.content.trim().length > 0,
  );

  return (
    <div className="flex flex-col h-[88vh] min-h-[650px] m-0 p-0 bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" style={{ color: BRAND }} />
          <div>
            <div className="text-sm font-semibold text-slate-900">Central de Ajuda</div>
            <div className="text-[11px] text-slate-500">Klal — Assistente Quero Armas</div>
          </div>
        </div>
        {mensagens.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={novaConversa}
            disabled={loading}
            className="text-slate-600 hover:text-slate-900"
          >
            <Plus className="h-4 w-4 mr-1" /> Nova conversa
          </Button>
        )}
      </div>

      {/* Mensagens */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2 md:px-3 py-3 space-y-3 bg-slate-50/50"
      >
        {initLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex flex-col items-center text-center py-8 md:py-12 gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: `${BRAND}12`, color: BRAND }}
            >
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="text-base md:text-lg font-semibold text-slate-900">
                Olá{cliente ? `, ${cliente.nome_completo.split(" ")[0]}` : ""}! Sou o Klal, assistente da Quero Armas. Como posso ajudar?
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Tire dúvidas sobre documentos, prazos, exigências e legislação.
              </div>
            </div>
            <div className="w-full max-w-md space-y-2 pt-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="w-full text-left text-sm px-3 py-2.5 rounded-md bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-slate-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          mensagens.map((m) => (
            <div
              key={m.id}
              className={`flex w-full ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`${m.role === "user" ? "max-w-[80%]" : "w-full"}`}>
                {m.role === "user" ? (
                  <div
                    className="rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm text-white shadow-sm whitespace-pre-wrap break-words"
                    style={{ background: BRAND }}
                  >
                    {m.content}
                  </div>
                ) : (
                  <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 bg-white border border-slate-200 text-sm text-slate-800 shadow-sm">
                    {m.content ? (
                      <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-headings:my-2 prose-strong:text-slate-900">
                        <ReactMarkdown>
                          {m.isStreaming ? m.content + "▊" : m.content}
                        </ReactMarkdown>
                      </div>
                    ) : m.isStreaming ? (
                      <div className="flex items-center gap-1 py-1 text-slate-400 text-xs">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: "150ms" }} />
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: "300ms" }} />
                      </div>
                    ) : null}
                    {!m.isStreaming && m.fontes && m.fontes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100">
                        {m.fontes.slice(0, 6).map((f, i) => {
                          const raw = f.titulo_norma || f.titulo_doc || "Fonte";
                          const isAprovada =
                            typeof raw === "string" && raw.startsWith("QA: ");
                          const label = isAprovada
                            ? "Klal — resposta anterior aprovada"
                            : raw;
                          return (
                            <span
                              key={i}
                              className={
                                isAprovada
                                  ? "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border"
                                  : "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200"
                              }
                              style={
                                isAprovada
                                  ? {
                                      background: "hsl(352 33% 97%)",
                                      color: "hsl(352 60% 30%)",
                                      borderColor: "hsl(352 33% 88%)",
                                    }
                                  : undefined
                              }
                            >
                              {isAprovada ? (
                                <MessageCircle className="h-3 w-3" />
                              ) : (
                                <BookOpen className="h-3 w-3" />
                              )}
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {ultimaAssistente && (
          <div className="flex justify-start">
            <Button
              variant="outline"
              size="sm"
              onClick={() => escalarParaEquipe(ultimaAssistente.content)}
              disabled={escalating}
              className="text-xs border-slate-200 text-slate-700 hover:bg-white"
            >
              {escalating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
              )}
              Não resolveu? Falar com a equipe
            </Button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-white px-2 py-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Digite sua dúvida para o Klal..."
            disabled={loading || !cliente}
            rows={1}
            className="flex-1 resize-none px-2 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-50 disabled:text-slate-400 leading-6"
            style={{ maxHeight: 112 }}
          />
          <Button
            onClick={() => enviar(input)}
            disabled={loading || !cliente || input.trim().length < 2}
            size="icon"
            className="shrink-0 h-10 w-10"
            style={{ background: BRAND, color: "white" }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="text-[10px] text-slate-400 mt-1.5 px-0">
          Enter envia · Shift+Enter quebra linha
        </div>
      </div>
    </div>
  );
}
