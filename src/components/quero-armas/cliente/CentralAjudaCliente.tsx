import { useEffect, useRef, useState, useCallback, KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageCircle, Pencil, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

const BRAND = "#7A1F2B";
const INK = "#0A0A0A";
const INK_2 = "#6A6A6A";
const PAPER = "#F2F2F2";
const CARD_BORDER = "#E5E5E5";
const LINE = "#EFEFEF";
const OK = "#2F8F4A";
const OK_BG = "#E3F2E8";
const OSWALD = "Oswald, 'Inter', sans-serif";

const INACTIVITY_MS = 30 * 60 * 1000;
const PROTOCOLS_KEY = "qa_klal_protocolos_v1";

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
  aprovadaKb?: boolean | null;
  conteudoCorrigido?: string | null;
  createdAt?: string;
  finishedAt?: string;
  latencyMs?: number;
  confidence?: number;
};

type ProtocoloSalvo = {
  id: string;
  startedAt: string;
  updatedAt: string;
  subject: string;
  messagesCount: number;
  confidenceAvg: number;
  sessaoId?: string | null;
};

function twoDigits(n: number) { return n.toString().padStart(2, "0"); }
function threeDigits(n: number) { return n.toString().padStart(3, "0"); }

function loadProtocolos(): ProtocoloSalvo[] {
  try {
    const raw = localStorage.getItem(PROTOCOLS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveProtocolos(list: ProtocoloSalvo[]) {
  try { localStorage.setItem(PROTOCOLS_KEY, JSON.stringify(list.slice(-30))); } catch {}
}
function novoProtocoloId(list: ProtocoloSalvo[]): string {
  const d = new Date();
  const prefix = `KLA-${d.getFullYear()}-${twoDigits(d.getMonth() + 1)}-${twoDigits(d.getDate())}`;
  const seqHoje = list.filter((p) => p.id.startsWith(prefix)).length + 1;
  return `${prefix}-${threeDigits(seqHoje)}`;
}
function palavrasChave(t: string): Set<string> {
  return new Set(
    (t || "").toLowerCase().replace(/[^a-zà-ú0-9\s]/gi, " ").split(/\s+/).filter((w) => w.length >= 4),
  );
}
function mesmoAssunto(a: string, b: string): boolean {
  const A = palavrasChave(a), B = palavrasChave(b);
  if (A.size === 0 || B.size === 0) return false;
  let inter = 0; A.forEach((w) => { if (B.has(w)) inter++; });
  const jaccard = inter / (A.size + B.size - inter);
  return jaccard >= 0.28;
}
function confidenceFromFontes(n: number): number {
  if (n >= 3) return 0.94;
  if (n === 2) return 0.82;
  if (n === 1) return 0.70;
  return 0.45;
}
function fmtHM(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso); if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtHMS(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso); if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDMY(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso); if (isNaN(d.getTime())) return "";
  return `${twoDigits(d.getDate())}/${twoDigits(d.getMonth() + 1)} ${fmtHM(iso)}`;
}
function labelRelativo(iso: string): string {
  const d = new Date(iso); const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  return `${twoDigits(d.getDate())}/${twoDigits(d.getMonth() + 1)}`;
}

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
  const [protocolos, setProtocolos] = useState<ProtocoloSalvo[]>([]);
  const [protocoloAtual, setProtocoloAtual] = useState<ProtocoloSalvo | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { setProtocolos(loadProtocolos()); }, []);

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
        if (recente && new Date(recente.updated_at).getTime() > Date.now() - 24 * 60 * 60 * 1000) {
          const { data: msgs } = await (supabase as any)
            .from("qa_chat_mensagens")
            .select("id, role, content, fontes, created_at, aprovada_kb, conteudo_corrigido")
            .eq("sessao_id", recente.id)
            .order("created_at", { ascending: true })
            .limit(50);
          if (!alive) return;
          setSessaoId(recente.id);
          setMensagens(((msgs ?? []) as any[]).map((m) => ({
            id: m.id, role: m.role, content: m.content,
            fontes: Array.isArray(m.fontes) ? m.fontes : [],
            aprovadaKb: m.aprovada_kb, conteudoCorrigido: m.conteudo_corrigido,
            createdAt: m.created_at ?? undefined,
            confidence: Array.isArray(m.fontes) ? confidenceFromFontes(m.fontes.length) : undefined,
          })));
        }
      } finally {
        if (alive) setInitLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [cliente?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens]);

  const resolverProtocolo = useCallback((pergunta: string): ProtocoloSalvo => {
    const list = loadProtocolos();
    const nowIso = new Date().toISOString();
    const ativo = protocoloAtual;
    if (ativo && Date.now() - new Date(ativo.updatedAt).getTime() < INACTIVITY_MS) {
      const upd: ProtocoloSalvo = { ...ativo, updatedAt: nowIso };
      const next = list.map((p) => (p.id === upd.id ? upd : p));
      saveProtocolos(next); setProtocolos(next); setProtocoloAtual(upd);
      return upd;
    }
    const reabrir = [...list].reverse().find((p) => mesmoAssunto(p.subject, pergunta));
    if (reabrir) {
      const upd: ProtocoloSalvo = { ...reabrir, updatedAt: nowIso };
      const next = list.map((p) => (p.id === upd.id ? upd : p));
      saveProtocolos(next); setProtocolos(next); setProtocoloAtual(upd);
      return upd;
    }
    const novo: ProtocoloSalvo = {
      id: novoProtocoloId(list), startedAt: nowIso, updatedAt: nowIso,
      subject: pergunta, messagesCount: 0, confidenceAvg: 0, sessaoId,
    };
    const next = [...list, novo];
    saveProtocolos(next); setProtocolos(next); setProtocoloAtual(novo);
    return novo;
  }, [protocoloAtual, sessaoId]);

  const atualizarProtocoloComResposta = useCallback((protoId: string, novaConfianca: number) => {
    setProtocolos((prev) => {
      const next = prev.map((p) => {
        if (p.id !== protoId) return p;
        const nMsgs = p.messagesCount + 1;
        const avg = ((p.confidenceAvg * p.messagesCount) + novaConfianca) / nMsgs;
        return { ...p, messagesCount: nMsgs, confidenceAvg: avg, updatedAt: new Date().toISOString() };
      });
      saveProtocolos(next);
      const atual = next.find((p) => p.id === protoId) || null;
      if (atual) setProtocoloAtual(atual);
      return next;
    });
  }, []);

  const enviar = useCallback(async (texto: string) => {
    if (!cliente || loading) return;
    const query = texto.trim();
    if (query.length < 2) return;

    const proto = resolverProtocolo(query);
    setInput("");
    const startIso = new Date().toISOString();
    const startMs = Date.now();
    const userMsg: Mensagem = { id: `u-${Date.now()}`, role: "user", content: query, createdAt: startIso };
    const asstId = `a-${Date.now()}`;
    const asstMsg: Mensagem = { id: asstId, role: "assistant", content: "", fontes: [], isStreaming: true, createdAt: startIso };

    const historico = mensagens
      .filter((m) => !m.isStreaming && m.content.trim().length > 0)
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    setMensagens((prev) => [...prev, userMsg, asstMsg]);
    setLoading(true);

    let localFontes: Fonte[] = [];

    try {
      const { data: sess } = await supabase.auth.getSession();
      const jwt = sess.session?.access_token ?? PUBLISHABLE_KEY;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/qa-kb-search-cliente`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
          apikey: PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ query, sessao_id: sessaoId, historico, limit: 5 }),
      });

      if (!res.ok || !res.body) {
        try {
          const j = await res.json();
          if (j?.error) throw new Error(j.error);
          if (j?.answer) {
            setMensagens((prev) => prev.map((m) => m.id === asstId
              ? { ...m, content: j.answer, isStreaming: false, finishedAt: new Date().toISOString(), latencyMs: Date.now() - startMs, confidence: confidenceFromFontes(0) }
              : m));
            atualizarProtocoloComResposta(proto.id, confidenceFromFontes(0));
            return;
          }
        } catch (_) { /* ignore */ }
        throw new Error("Falha ao consultar a Central de Ajuda.");
      }

      const contentType = res.headers.get("Content-Type") || "";
      if (!contentType.includes("text/event-stream")) {
        const j = await res.json();
        setMensagens((prev) => prev.map((m) => m.id === asstId
          ? { ...m, content: j?.answer ?? "Sem resposta.", isStreaming: false, finishedAt: new Date().toISOString(), latencyMs: Date.now() - startMs, confidence: confidenceFromFontes(0) }
          : m));
        atualizarProtocoloComResposta(proto.id, confidenceFromFontes(0));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ""; let full = "";
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
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === "token" && evt.content) {
              full += evt.content;
              setMensagens((prev) => prev.map((m) => m.id === asstId ? { ...m, content: full } : m));
            } else if (evt.type === "meta" && Array.isArray(evt.fontes)) {
              localFontes = evt.fontes;
            } else if (evt.type === "session" && evt.sessao_id) {
              setSessaoId(evt.sessao_id);
            } else if (evt.type === "error") {
              throw new Error(evt.message || "Erro no streaming.");
            }
          } catch { /* chunk malformado */ }
        }
      }

      const conf = confidenceFromFontes(localFontes.length);
      setMensagens((prev) => prev.map((m) => m.id === asstId
        ? { ...m, content: full || m.content, fontes: localFontes, isStreaming: false, finishedAt: new Date().toISOString(), latencyMs: Date.now() - startMs, confidence: conf }
        : m));
      atualizarProtocoloComResposta(proto.id, conf);
    } catch (e: any) {
      setMensagens((prev) => prev.map((m) => m.id === asstId
        ? { ...m, content: "Não consegui responder agora. Tente novamente em instantes ou fale com a equipe pelo WhatsApp.", isStreaming: false, finishedAt: new Date().toISOString(), confidence: 0 }
        : m));
      toast.error(e?.message ?? "Erro ao consultar a Central de Ajuda.");
    } finally {
      setLoading(false);
    }
  }, [cliente, loading, mensagens, sessaoId, resolverProtocolo, atualizarProtocoloComResposta]);

  function novaConversa() {
    if (loading) return;
    setSessaoId(null);
    setMensagens([]);
    setInput("");
    setProtocoloAtual(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar(input);
    }
  }

  function escalarParaEquipe(ultimaResposta: string) {
    if (!cliente) { toast.error("Faça login novamente para falar com a equipe."); return; }
    const ultimaPergunta = [...mensagens].reverse().find((m) => m.role === "user")?.content ?? "";
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
        await (supabase as any).from("qa_central_ajuda_perguntas").insert({
          cliente_id: cliente.id, pergunta: ultimaPergunta,
          resposta_ia: ultimaResposta || null, artigos_relacionados: [],
          status: "escalada_whatsapp",
        });
      } finally { setEscalating(false); }
    })();
  }

  const ultimaAssistente = [...mensagens].reverse().find(
    (m) => m.role === "assistant" && !m.isStreaming && m.content.trim().length > 0,
  );

  const proto = protocoloAtual;
  const expiraEmMin = proto
    ? Math.max(0, Math.round((new Date(proto.updatedAt).getTime() + INACTIVITY_MS - now) / 60000))
    : 30;
  const isAtiva = proto ? expiraEmMin > 0 : false;
  const confMediaPct = proto ? Math.round((proto.confidenceAvg || 0) * 100) : 0;
  const anteriores = [...protocolos].filter((p) => !proto || p.id !== proto.id).reverse().slice(0, 5);

  const ultimasFontes: Fonte[] = (() => {
    const seen = new Set<string>();
    const out: Fonte[] = [];
    for (let i = mensagens.length - 1; i >= 0 && out.length < 5; i--) {
      const fs = mensagens[i].fontes || [];
      for (const f of fs) {
        const key = (f.titulo_norma || f.titulo_doc || "").trim();
        if (!key || seen.has(key)) continue;
        seen.add(key); out.push(f);
        if (out.length >= 5) break;
      }
    }
    return out;
  })();

  return (
    <div className="w-full" style={{ background: PAPER, fontFamily: "Inter, sans-serif", color: INK }}>
      {/* Header */}
      <div className="px-4 md:px-8 pt-6 pb-4 border-b" style={{ borderColor: CARD_BORDER }}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 26, letterSpacing: "0.06em", color: INK, lineHeight: 1.05 }}>
              Central de Ajuda · Klal
            </h1>
            <p className="uppercase mt-1" style={{ fontFamily: OSWALD, fontWeight: 500, fontSize: 11, letterSpacing: "0.18em", color: INK_2 }}>
              Chat central + rail de contexto
            </p>
          </div>
          <div className="flex flex-wrap items-stretch gap-2">
            {cliente && (
              <div className="uppercase px-3 py-2 bg-white border" style={{ borderColor: CARD_BORDER, fontFamily: OSWALD, fontWeight: 600, fontSize: 11, letterSpacing: "0.14em", color: INK }}>
                Cliente: {cliente.nome_completo}
              </div>
            )}
            <div className="uppercase px-3 py-2 bg-white border-2" style={{ borderColor: INK, fontFamily: OSWALD, fontWeight: 700, fontSize: 11, letterSpacing: "0.14em", color: INK }}>
              Protocolo #{proto?.id || "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="px-4 md:px-8 py-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Chat */}
        <div className="bg-white flex flex-col" style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 4, minHeight: 620 }}>
          <div className="flex items-start justify-between px-5 py-4 border-b" style={{ borderColor: LINE }}>
            <div>
              <div className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 13, letterSpacing: "0.16em", color: INK }}>
                Conversa em andamento
              </div>
              <div className="mt-1 text-[12px]" style={{ color: INK_2 }}>
                {proto
                  ? <>Iniciada {labelRelativo(proto.startedAt).toLowerCase()} às {fmtHM(proto.startedAt)} · Expira em {expiraEmMin}min de inatividade</>
                  : "Envie sua primeira dúvida para abrir um protocolo"}
              </div>
            </div>
            <span className="uppercase inline-flex items-center gap-1.5 px-2.5 py-1" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 10.5, letterSpacing: "0.16em", background: isAtiva ? OK_BG : "#F2F2F2", color: isAtiva ? OK : INK_2, borderRadius: 2 }}>
              <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: isAtiva ? OK : INK_2 }} />
              {isAtiva ? "Ativa" : proto ? "Expirada" : "Aguardando"}
            </span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ background: "#FFFFFF" }}>
            {initLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : mensagens.length === 0 ? (
              <div className="flex flex-col items-center text-center py-10 gap-4">
                <div className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 15, letterSpacing: "0.08em", color: INK }}>
                  Olá{cliente ? `, ${cliente.nome_completo.split(" ")[0]}` : ""}
                </div>
                <div className="text-[12px]" style={{ color: INK_2 }}>
                  Sou o Klal, assistente da Quero Armas. Como posso ajudar?
                </div>
                <div className="w-full max-w-md space-y-2 pt-2">
                  {SUGESTOES.map((s) => (
                    <button key={s} onClick={() => enviar(s)} className="w-full text-left text-[13px] px-3 py-2.5 bg-white border transition-colors hover:bg-slate-50" style={{ borderColor: CARD_BORDER, borderRadius: 2, color: INK }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {proto && (
                  <div className="flex items-center justify-center">
                    <span className="uppercase inline-flex items-center gap-2 px-3 py-1 bg-white border" style={{ borderColor: CARD_BORDER, fontFamily: OSWALD, fontWeight: 600, fontSize: 10.5, letterSpacing: "0.18em", color: INK_2, borderRadius: 2 }}>
                      {labelRelativo(proto.startedAt)} · {fmtHM(proto.startedAt)} · Protocolo {isAtiva ? "aberto" : "encerrado"}
                    </span>
                  </div>
                )}
                {mensagens.map((m) => {
                  if (m.role === "user") {
                    return (
                      <div key={m.id} className="flex justify-end">
                        <div className="max-w-[80%]">
                          <div className="px-3.5 py-2 text-[14px] text-white whitespace-pre-wrap break-words" style={{ background: BRAND, borderRadius: 4 }}>
                            {m.content}
                          </div>
                          {m.createdAt && (
                            <div className="text-right mt-1" style={{ fontFamily: OSWALD, fontWeight: 500, fontSize: 10.5, letterSpacing: "0.14em", color: INK_2 }}>
                              {fmtHMS(m.createdAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  const confPct = m.confidence != null
                    ? Math.round(m.confidence * 100)
                    : (m.fontes && m.fontes.length ? Math.round(confidenceFromFontes(m.fontes.length) * 100) : null);
                  return (
                    <div key={m.id} className="flex justify-start">
                      <div className="w-full max-w-[92%]">
                        <div className="bg-white" style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 4 }}>
                          <div className="flex items-center gap-2 px-4 pt-3">
                            <span className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 12, letterSpacing: "0.16em", color: INK }}>Klal</span>
                            {!m.isStreaming && confPct != null && (
                              <span className="uppercase px-2 py-0.5" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 10, letterSpacing: "0.16em", background: OK_BG, color: OK, borderRadius: 2 }}>
                                Confiança {confPct}%
                              </span>
                            )}
                          </div>
                          <div className="px-4 py-3">
                            {!m.isStreaming && m.aprovadaKb === false && (
                              <div className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 mb-2" style={{ background: "hsl(0 70% 96%)", color: "hsl(0 60% 40%)", borderRadius: 2 }}>
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                Resposta sinalizada pela nossa equipe como incorreta ou desatualizada
                              </div>
                            )}
                            {!m.isStreaming && m.conteudoCorrigido && (
                              <div className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 mb-2" style={{ background: `${BRAND}12`, color: BRAND, borderRadius: 2 }}>
                                <Pencil className="h-3 w-3 shrink-0" />
                                Resposta corrigida pela equipe
                              </div>
                            )}
                            {m.content ? (
                              <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-headings:my-2 prose-strong:text-slate-900" style={{ color: INK, fontSize: 14, lineHeight: 1.55 }}>
                                <ReactMarkdown>{m.isStreaming ? m.content + "▊" : (m.conteudoCorrigido || m.content)}</ReactMarkdown>
                              </div>
                            ) : m.isStreaming ? (
                              <div className="flex items-center gap-1 py-1 text-[11px]" style={{ color: INK_2 }}>
                                <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: INK_2 }} />
                                <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: INK_2, animationDelay: "150ms" }} />
                                <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: INK_2, animationDelay: "300ms" }} />
                              </div>
                            ) : null}
                            {!m.isStreaming && m.fontes && m.fontes.length > 0 && (
                              <div className="mt-3 pt-3 text-[12px]" style={{ borderTop: `1px dashed ${CARD_BORDER}`, color: INK }}>
                                <span style={{ fontWeight: 700 }}>Fontes:</span>{" "}
                                {m.fontes.slice(0, 6).map((f, i) => {
                                  const raw = f.titulo_norma || f.titulo_doc || "Fonte";
                                  const label = raw.startsWith("QA: ") ? "Klal — resposta aprovada" : raw;
                                  return <span key={i} style={{ color: INK_2 }}>{i > 0 ? " · " : ""}{label}</span>;
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        {!m.isStreaming && m.createdAt && (
                          <div className="mt-1" style={{ fontFamily: OSWALD, fontWeight: 500, fontSize: 10.5, letterSpacing: "0.14em", color: INK_2 }}>
                            {fmtHMS(m.finishedAt || m.createdAt)}
                            {m.latencyMs ? <> · gerado em {(m.latencyMs / 1000).toFixed(1)}s</> : null}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {ultimaAssistente && (
              <div className="flex justify-start pt-1">
                <button onClick={() => escalarParaEquipe(ultimaAssistente.content)} disabled={escalating} className="uppercase inline-flex items-center gap-1.5 px-3 py-2 text-white disabled:opacity-60" style={{ background: INK, borderRadius: 2, fontFamily: OSWALD, fontWeight: 600, fontSize: 11, letterSpacing: "0.16em" }}>
                  {escalating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                  Não resolveu? Falar com a equipe
                </button>
              </div>
            )}
          </div>

          <div className="border-t px-4 py-3 flex gap-2" style={{ borderColor: LINE }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Digite sua dúvida para o Klal..."
              disabled={loading || !cliente}
              className="flex-1 px-3 py-2.5 text-[14px] bg-white border focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
              style={{ borderColor: CARD_BORDER, borderRadius: 2, color: INK }}
            />
            <button
              onClick={() => enviar(input)}
              disabled={loading || !cliente || input.trim().length < 2}
              className="uppercase px-5 text-white disabled:opacity-60"
              style={{ background: BRAND, borderRadius: 2, fontFamily: OSWALD, fontWeight: 700, fontSize: 12, letterSpacing: "0.16em", minWidth: 110 }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Enviar"}
            </button>
          </div>
        </div>

        {/* Rail */}
        <div className="space-y-4">
          <div className="bg-white p-4" style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 4 }}>
            <div className="uppercase mb-2" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 11, letterSpacing: "0.18em", color: INK_2 }}>Protocolo atual</div>
            <div style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 20, letterSpacing: "0.06em", color: INK, wordBreak: "break-all" }}>
              #{proto?.id || "—"}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <div className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 9.5, letterSpacing: "0.18em", color: INK_2 }}>Aberto</div>
                <div style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 14, color: INK }}>{proto ? fmtDMY(proto.startedAt) : "—"}</div>
              </div>
              <div>
                <div className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 9.5, letterSpacing: "0.18em", color: INK_2 }}>Expira em</div>
                <div style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 16, color: isAtiva ? BRAND : INK_2 }}>{proto ? `${expiraEmMin}min` : "—"}</div>
              </div>
              <div>
                <div className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 9.5, letterSpacing: "0.18em", color: INK_2 }}>Mensagens</div>
                <div style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 14, color: INK }}>{proto ? proto.messagesCount : 0}</div>
              </div>
              <div>
                <div className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 9.5, letterSpacing: "0.18em", color: INK_2 }}>Confiança média</div>
                <div style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 14, color: INK }}>{confMediaPct ? `${confMediaPct}%` : "—"}</div>
              </div>
            </div>
            <div className="text-[11px] mt-3" style={{ color: INK_2, lineHeight: 1.5 }}>
              Se ficar 30min sem interação, o protocolo encerra. Nova pergunta abre novo protocolo — exceto se o assunto for o mesmo.
            </div>
          </div>

          <div className="bg-white p-4" style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 4 }}>
            <div className="uppercase mb-3" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 11, letterSpacing: "0.18em", color: INK_2 }}>Fontes consultadas</div>
            {ultimasFontes.length === 0 ? (
              <div className="text-[12px]" style={{ color: INK_2 }}>As fontes citadas nas respostas aparecerão aqui.</div>
            ) : (
              <div className="space-y-2">
                {ultimasFontes.map((f, i) => {
                  const raw = (f.titulo_norma || f.titulo_doc || "Fonte").trim();
                  const isAprovada = raw.startsWith("QA: ");
                  const label = isAprovada ? "Klal — resposta anterior aprovada" : raw;
                  return (
                    <div key={i} className="px-3 py-2" style={{ background: "#FAFAFA", borderLeft: `3px solid ${BRAND}`, borderRadius: 2 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: INK }}>{label}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: INK_2 }}>
                        {f.tipo === "legislacao" ? "Legislação · base oficial" : "Documento aprovado"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white p-4" style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 4 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 11, letterSpacing: "0.18em", color: INK_2 }}>Protocolos anteriores</div>
              {mensagens.length > 0 && (
                <button onClick={novaConversa} disabled={loading} className="uppercase text-[10px]" style={{ fontFamily: OSWALD, fontWeight: 600, letterSpacing: "0.16em", color: BRAND }}>
                  + Novo
                </button>
              )}
            </div>
            {anteriores.length === 0 ? (
              <div className="text-[12px]" style={{ color: INK_2 }}>Nenhum protocolo anterior.</div>
            ) : (
              <div className="space-y-1.5">
                {anteriores.map((p) => {
                  const shortId = p.id.slice(-3);
                  return (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2" style={{ background: "#FAFAFA", borderRadius: 2 }} title={p.subject}>
                      <span className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 12, letterSpacing: "0.08em", color: INK }}>
                        #KLA-…{shortId}
                      </span>
                      <span className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 500, fontSize: 11, letterSpacing: "0.14em", color: INK_2 }}>
                        {labelRelativo(p.updatedAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
