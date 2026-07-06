import { useEffect, useRef, useState, useCallback, KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageCircle, Pencil, AlertTriangle, Sparkles, ShieldCheck, ShieldAlert, ShieldX, ShoppingCart } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "@/shared/cart/CartProvider";
import { getServiceBySlug } from "@/shared/data/catalog";

const BRAND = "#7A1F2B";
const INK = "#0A0A0A";
const INK_2 = "#6A6A6A";
const PAPER = "#F2F2F2";
const CARD_BORDER = "#E5E5E5";
const LINE = "#EFEFEF";
const OK = "#2F8F4A";
const OK_BG = "#E3F2E8";
const AMBER = "#B45309";
const AMBER_BG = "#FEF3C7";
const RED = "#B91C1C";
const RED_BG = "#FEE2E2";
const OSWALD = "Oswald, 'Inter', sans-serif";

const INACTIVITY_MS = 30 * 60 * 1000;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Fonte = {
  tipo: "legislacao" | "documento";
  titulo_norma: string | null;
  titulo_doc: string | null;
};

type NivelConfianca = "alta" | "media" | "baixa";

type ServicoSugerido = {
  id: string;
  slug: string;
  nome: string;
  preco_cents: number;
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
  nivelConfianca?: NivelConfianca | null;
  servicoSugerido?: ServicoSugerido | null;
  servicoSugeridoSlug?: string | null;
};

type ProtocoloAtivo = {
  sessaoId: string;
  protocolo: string;
  protocoloData: string; // created_at ISO original
  lastActivityAt: string;
  status: "ativo" | "encerrado";
  reaberto?: boolean;
};

type ProtocoloResumo = {
  sessaoId: string;
  protocolo: string | null;
  createdAt: string;
  updatedAt: string;
  status: "ativo" | "encerrado";
  titulo: string | null;
};

const SP_TZ = "America/Sao_Paulo";

function twoDigits(n: number) { return n.toString().padStart(2, "0"); }
function fmtHM(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso); if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: SP_TZ });
}
function fmtHMS(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso); if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: SP_TZ });
}
function fmtDMYHM(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso); if (isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: SP_TZ });
}
function labelRelativo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const spNow = new Date(now.toLocaleString("en-US", { timeZone: SP_TZ }));
  const spThen = new Date(d.toLocaleString("en-US", { timeZone: SP_TZ }));
  const dayMs = 86400000;
  const diffDays = Math.floor((spNow.setHours(0,0,0,0) - spThen.setHours(0,0,0,0)) / dayMs);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) {
    const dia = d.toLocaleDateString("pt-BR", { weekday: "long", timeZone: SP_TZ });
    return dia.charAt(0).toUpperCase() + dia.slice(1);
  }
  return d.toLocaleDateString("pt-BR", { timeZone: SP_TZ });
}
function formatTimestamp(iso: string | undefined): string {
  if (!iso) return "";
  return `${labelRelativo(iso)} às ${fmtHM(iso)}`;
}

interface CentralAjudaClienteProps {
  cliente: { id: number; nome_completo: string; cpf?: string | null } | null;
}

const SUGESTOES = [
  "O que preciso para comprar uma arma como policial civil?",
  "Quais documentos o vigilante precisa para a CNV?",
  "Como funciona o registro CAC?",
];

const NIVEL_META: Record<NivelConfianca, { label: string; icon: JSX.Element; fg: string; bg: string }> = {
  alta:  { label: "Confiança alta",  icon: <ShieldCheck className="h-3 w-3" />, fg: OK,    bg: OK_BG    },
  media: { label: "Confiança média", icon: <ShieldAlert className="h-3 w-3" />, fg: AMBER, bg: AMBER_BG },
  baixa: { label: "Confiança baixa", icon: <ShieldX     className="h-3 w-3" />, fg: RED,   bg: RED_BG   },
};

export function CentralAjudaCliente({ cliente }: CentralAjudaClienteProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [proto, setProto] = useState<ProtocoloAtivo | null>(null);
  const [protocolosAnteriores, setProtocolosAnteriores] = useState<ProtocoloResumo[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [reabertoBannerFor, setReabertoBannerFor] = useState<string | null>(null);
  const navigate = useNavigate();
  const { addItem } = useCart();

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  const carregarAnteriores = useCallback(async (excludeId?: string) => {
    if (!cliente) return;
    try {
      const { data } = await (supabase as any)
        .from("qa_chat_sessoes")
        .select("id, numero_protocolo, titulo, status, created_at, updated_at, last_activity_at")
        .eq("cliente_id", cliente.id)
        .order("last_activity_at", { ascending: false })
        .limit(10);
      const arr = ((data ?? []) as any[])
        .filter((s) => !excludeId || s.id !== excludeId)
        .map((s) => ({
          sessaoId: s.id,
          protocolo: s.numero_protocolo ?? null,
          createdAt: s.created_at,
          updatedAt: s.last_activity_at || s.updated_at,
          status: (s.status || "ativo") as "ativo" | "encerrado",
          titulo: s.titulo ?? null,
        } as ProtocoloResumo));
      setProtocolosAnteriores(arr);
    } catch (_) { /* best-effort */ }
  }, [cliente?.id]);

  // Ao montar: procura a sessão mais recente e carrega mensagens se ainda ativa (<30min).
  useEffect(() => {
    if (!cliente) { setInitLoading(false); return; }
    let alive = true;
    (async () => {
      try {
        const { data: sessoes } = await (supabase as any)
          .from("qa_chat_sessoes")
          .select("id, numero_protocolo, status, created_at, last_activity_at")
          .eq("cliente_id", cliente.id)
          .order("last_activity_at", { ascending: false })
          .limit(1);
        const recente = (sessoes ?? [])[0] as any;
        if (
          recente &&
          recente.status === "ativo" &&
          new Date(recente.last_activity_at).getTime() > Date.now() - INACTIVITY_MS
        ) {
          const { data: msgs } = await (supabase as any)
            .from("qa_chat_mensagens")
            .select("id, role, content, fontes, created_at, aprovada_kb, conteudo_corrigido, nivel_confianca")
            .eq("sessao_id", recente.id)
            .order("created_at", { ascending: true })
            .limit(50);
          if (!alive) return;
          setProto({
            sessaoId: recente.id,
            protocolo: recente.numero_protocolo || "—",
            protocoloData: recente.created_at,
            lastActivityAt: recente.last_activity_at,
            status: "ativo",
          });
          const restauradas: Mensagem[] = ((msgs ?? []) as any[]).map((m) => ({
            id: m.id, role: m.role, content: m.content,
            fontes: Array.isArray(m.fontes) ? m.fontes : [],
            aprovadaKb: m.aprovada_kb, conteudoCorrigido: m.conteudo_corrigido,
            createdAt: m.created_at ?? undefined,
            nivelConfianca: (m.nivel_confianca as NivelConfianca | null) ?? null,
            servicoSugeridoSlug: (m as any).servico_sugerido_slug ?? null,
          }));
          setMensagens(restauradas);
          // Resolve o serviço para cada mensagem cujo slug ainda esteja ativo.
          const slugs = Array.from(
            new Set(
              restauradas
                .map((m) => m.servicoSugeridoSlug)
                .filter((s): s is string => !!s),
            ),
          );
          for (const slug of slugs) {
            getServiceBySlug(slug)
              .then((res) => {
                if (!alive || !res) return;
                const svc: ServicoSugerido = {
                  id: res.service.id,
                  slug: res.service.slug,
                  nome: res.service.name,
                  preco_cents: res.service.base_price_cents,
                };
                setMensagens((prev) =>
                  prev.map((m) => (m.servicoSugeridoSlug === slug ? { ...m, servicoSugerido: svc } : m)),
                );
              })
              .catch(() => { /* serviço saiu do catálogo — mantém sem CTA */ });
          }
        }
        await carregarAnteriores(recente?.id);
      } finally {
        if (alive) setInitLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [cliente?.id, carregarAnteriores]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens]);

  const enviar = useCallback(async (texto: string) => {
    if (!cliente || loading) return;
    const query = texto.trim();
    if (query.length < 2) return;

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
    let localNivel: NivelConfianca | null = null;
    let localServico: ServicoSugerido | null = null;

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
        body: JSON.stringify({ query, sessao_id: proto?.sessaoId ?? null, historico, limit: 5 }),
      });

      if (!res.ok || !res.body) {
        try {
          const j = await res.json();
          if (j?.error) throw new Error(j.error);
          if (j?.answer) {
            setMensagens((prev) => prev.map((m) => m.id === asstId
              ? { ...m, content: j.answer, isStreaming: false, finishedAt: new Date().toISOString(), latencyMs: Date.now() - startMs }
              : m));
            return;
          }
        } catch (_) { /* ignore */ }
        throw new Error("Falha ao consultar a Central de Ajuda.");
      }

      const contentType = res.headers.get("Content-Type") || "";
      if (!contentType.includes("text/event-stream")) {
        const j = await res.json();
        setMensagens((prev) => prev.map((m) => m.id === asstId
          ? { ...m, content: j?.answer ?? "Sem resposta.", isStreaming: false, finishedAt: new Date().toISOString(), latencyMs: Date.now() - startMs }
          : m));
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
            } else if (evt.type === "session") {
              const nova: ProtocoloAtivo = {
                sessaoId: evt.sessao_id,
                protocolo: evt.protocolo || "—",
                protocoloData: evt.protocolo_data || new Date().toISOString(),
                lastActivityAt: new Date().toISOString(),
                status: "ativo",
                reaberto: !!evt.reaberto,
              };
              setProto(nova);
              if (evt.reaberto) setReabertoBannerFor(evt.sessao_id);
            } else if (evt.type === "confianca" && evt.nivel) {
              localNivel = evt.nivel as NivelConfianca;
              setMensagens((prev) => prev.map((m) => m.id === asstId ? { ...m, nivelConfianca: localNivel } : m));
            } else if (evt.type === "servico_sugerido" && evt.servico) {
              localServico = evt.servico as ServicoSugerido;
              setMensagens((prev) => prev.map((m) => m.id === asstId ? { ...m, servicoSugerido: localServico, servicoSugeridoSlug: localServico?.slug ?? null } : m));
            } else if (evt.type === "error") {
              throw new Error(evt.message || "Erro no streaming.");
            }
          } catch { /* chunk malformado */ }
        }
      }

      setMensagens((prev) => prev.map((m) => m.id === asstId
        ? { ...m, content: full || m.content, fontes: localFontes, isStreaming: false, finishedAt: new Date().toISOString(), latencyMs: Date.now() - startMs, nivelConfianca: localNivel, servicoSugerido: localServico ?? m.servicoSugerido ?? null, servicoSugeridoSlug: localServico?.slug ?? m.servicoSugeridoSlug ?? null }
        : m));
      // Refresh rail
      carregarAnteriores(proto?.sessaoId);
    } catch (e: any) {
      setMensagens((prev) => prev.map((m) => m.id === asstId
        ? { ...m, content: "Não consegui responder agora. Tente novamente em instantes ou fale com a equipe pelo WhatsApp.", isStreaming: false, finishedAt: new Date().toISOString(), nivelConfianca: "baixa" }
        : m));
      toast.error(e?.message ?? "Erro ao consultar a Central de Ajuda.");
    } finally {
      setLoading(false);
    }
  }, [cliente, loading, mensagens, proto?.sessaoId, carregarAnteriores]);

  function novaConversa() {
    if (loading) return;
    setMensagens([]);
    setInput("");
    setProto(null);
    setReabertoBannerFor(null);
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
    const protoPart = proto ? ` — Protocolo ${proto.protocolo}` : "";
    const respostaPart = ultimaResposta ? `A resposta que recebi foi:\n${ultimaResposta}\n\n` : "";
    const texto =
      `Olá! Sou ${cliente.nome_completo}${cpfPart}${protoPart}.\n\n` +
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

  const expiraEmMin = proto
    ? Math.max(0, Math.round((new Date(proto.lastActivityAt).getTime() + INACTIVITY_MS - now) / 60000))
    : 30;
  const isAtiva = proto ? expiraEmMin > 0 && proto.status === "ativo" : false;
  const nivelCounts = mensagens.reduce((acc, m) => {
    if (m.role === "assistant" && m.nivelConfianca) acc[m.nivelConfianca] = (acc[m.nivelConfianca] || 0) + 1;
    return acc;
  }, {} as Record<NivelConfianca, number>);
  const totalConf = (nivelCounts.alta || 0) + (nivelCounts.media || 0) + (nivelCounts.baixa || 0);
  const confMediaLabel = totalConf === 0
    ? "—"
    : (nivelCounts.alta || 0) >= Math.max(nivelCounts.media || 0, nivelCounts.baixa || 0)
      ? "Alta" : (nivelCounts.media || 0) >= (nivelCounts.baixa || 0) ? "Média" : "Baixa";

  const mensagensCount = mensagens.filter((m) => !m.isStreaming).length;
  const anteriores = protocolosAnteriores.filter((p) => !proto || p.sessaoId !== proto.sessaoId).slice(0, 5);
  const showReaberto = proto?.reaberto && reabertoBannerFor === proto.sessaoId;

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
              Assistente jurídico e consultor da Quero Armas
            </p>
          </div>
          <div className="flex flex-wrap items-stretch gap-2">
            {cliente && (
              <div className="uppercase px-3 py-2 bg-white border" style={{ borderColor: CARD_BORDER, fontFamily: OSWALD, fontWeight: 600, fontSize: 11, letterSpacing: "0.14em", color: INK }}>
                Cliente: {cliente.nome_completo}
              </div>
            )}
            <div className="uppercase px-3 py-2 bg-white border-2" style={{ borderColor: INK, fontFamily: OSWALD, fontWeight: 700, fontSize: 11, letterSpacing: "0.14em", color: INK }}>
              Protocolo {proto?.protocolo || "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="px-4 md:px-8 py-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* Chat */}
        <div className="bg-white flex flex-col overflow-hidden" style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 16, minHeight: 620 }}>
          <div className="flex items-start justify-between px-5 py-4 border-b" style={{ borderColor: LINE }}>
            <div>
              <div className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 13, letterSpacing: "0.16em", color: INK }}>
                Conversa em andamento
              </div>
              <div className="mt-1 text-[12px]" style={{ color: INK_2 }}>
                {proto
                  ? <>Iniciada {labelRelativo(proto.protocoloData).toLowerCase()} às {fmtHM(proto.protocoloData)} · Expira em {expiraEmMin}min de inatividade</>
                  : "Envie sua primeira dúvida para abrir um protocolo"}
              </div>
            </div>
            <span className="uppercase inline-flex items-center gap-1.5 px-2.5 py-1" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 10.5, letterSpacing: "0.16em", background: isAtiva ? OK_BG : "#F2F2F2", color: isAtiva ? OK : INK_2, borderRadius: 8 }}>
              <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: isAtiva ? OK : INK_2 }} />
              {isAtiva ? "Ativa" : proto ? "Expirada" : "Aguardando"}
            </span>
          </div>

          {showReaberto && proto && (
            <div className="mx-5 mt-3 px-3 py-2 flex items-start gap-2" style={{ background: AMBER_BG, borderLeft: `3px solid ${AMBER}`, borderRadius: 10 }}>
              <Sparkles className="h-4 w-4 mt-0.5 shrink-0" style={{ color: AMBER }} />
              <div className="text-[12px]" style={{ color: "#78350F" }}>
                Retomando o protocolo <strong>{proto.protocolo}</strong>, aberto em <strong>{fmtDMYHM(proto.protocoloData)}</strong>.
              </div>
            </div>
          )}

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
                    <button key={s} onClick={() => enviar(s)} className="w-full text-left text-[13px] px-3 py-2.5 bg-white border transition-colors hover:bg-slate-50" style={{ borderColor: CARD_BORDER, borderRadius: 10, color: INK }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {proto && (
                  <div className="flex items-center justify-center">
                    <span className="uppercase inline-flex items-center gap-2 px-3 py-1 bg-white border" style={{ borderColor: CARD_BORDER, fontFamily: OSWALD, fontWeight: 600, fontSize: 10.5, letterSpacing: "0.18em", color: INK_2, borderRadius: 10 }}>
                      {labelRelativo(proto.protocoloData)} · {fmtHM(proto.protocoloData)} · Protocolo {proto.protocolo}
                    </span>
                  </div>
                )}
                {mensagens.map((m) => {
                  if (m.role === "user") {
                    return (
                      <div key={m.id} className="flex justify-end">
                        <div className="max-w-[80%]">
                          <div className="px-3.5 py-2 text-[14px] text-white whitespace-pre-wrap break-words" style={{ background: BRAND, borderRadius: 10 }}>
                            {m.content}
                          </div>
                          {m.createdAt && (
                            <div className="text-right mt-1" style={{ fontFamily: OSWALD, fontWeight: 500, fontSize: 10.5, letterSpacing: "0.14em", color: INK_2 }}>
                              {formatTimestamp(m.createdAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  const nivel = m.nivelConfianca || null;
                  const nMeta = nivel ? NIVEL_META[nivel] : null;
                  return (
                    <div key={m.id} className="flex justify-start">
                      <div className="w-full max-w-[92%]">
                        <div className="bg-white" style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 4 }}>
                          <div className="flex items-center gap-2 px-4 pt-3">
                            <span className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 12, letterSpacing: "0.16em", color: INK }}>Klal</span>
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
                            {!m.isStreaming && ((m.fontes && m.fontes.length > 0) || nMeta) && (
                              <div className="mt-3 pt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]" style={{ borderTop: `1px dashed ${CARD_BORDER}`, color: INK }}>
                                {m.fontes && m.fontes.length > 0 && (
                                  <span>
                                    <span style={{ fontWeight: 700 }}>Fontes:</span>{" "}
                                    {m.fontes.slice(0, 6).map((f, i) => {
                                      const raw = f.titulo_norma || f.titulo_doc || "Fonte";
                                      const label = raw.startsWith("QA: ") ? "Klal — resposta aprovada" : raw;
                                      return <span key={i} style={{ color: INK_2 }}>{i > 0 ? " · " : ""}{label}</span>;
                                    })}
                                  </span>
                                )}
                                {nMeta && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 uppercase" style={{ background: nMeta.bg, color: nMeta.fg, borderRadius: 2, fontFamily: OSWALD, fontWeight: 600, fontSize: 10, letterSpacing: "0.14em" }}>
                                    {nMeta.icon} {nMeta.label}
                                  </span>
                                )}
                              </div>
                            )}
                            {!m.isStreaming && m.servicoSugerido && (
                              <div className="mt-3 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ background: "#FAFAFA", border: `1px solid ${CARD_BORDER}`, borderLeft: `3px solid ${BRAND}`, borderRadius: 2 }}>
                                <div className="min-w-0">
                                  <div className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 10, letterSpacing: "0.18em", color: INK_2 }}>
                                    Serviço recomendado pela Quero Armas
                                  </div>
                                  <div className="truncate mt-0.5" style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 15, color: INK, letterSpacing: "0.02em" }}>
                                    {m.servicoSugerido.nome}
                                  </div>
                                  <div className="text-[12px] mt-0.5" style={{ color: INK_2 }}>
                                    A partir de{" "}
                                    <strong style={{ color: INK }}>
                                      {(m.servicoSugerido.preco_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </strong>
                                    {" · "}
                                    <Link to={`/servicos/${m.servicoSugerido.slug}`} className="underline underline-offset-2" style={{ color: INK_2 }}>
                                      ver detalhes do serviço
                                    </Link>
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    if (!m.servicoSugerido) return;
                                    addItem({
                                      service_id: m.servicoSugerido.id,
                                      service_slug: m.servicoSugerido.slug,
                                      service_name: m.servicoSugerido.nome,
                                      unit_price_cents: m.servicoSugerido.preco_cents,
                                      quantity: 1,
                                    });
                                    toast.success("Serviço adicionado ao carrinho.");
                                    navigate("/carrinho");
                                  }}
                                  className="uppercase inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white shrink-0"
                                  style={{ background: BRAND, borderRadius: 2, fontFamily: OSWALD, fontWeight: 700, fontSize: 11.5, letterSpacing: "0.16em" }}
                                >
                                  <ShoppingCart className="h-3.5 w-3.5" />
                                  Contratar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        {!m.isStreaming && m.createdAt && (
                          <div className="mt-1" style={{ fontFamily: OSWALD, fontWeight: 500, fontSize: 10.5, letterSpacing: "0.14em", color: INK_2 }}>
                            {formatTimestamp(m.finishedAt || m.createdAt)}
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
              {proto?.protocolo || "—"}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <div className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 9.5, letterSpacing: "0.18em", color: INK_2 }}>Aberto</div>
                <div style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 14, color: INK }}>{proto ? fmtDMYHM(proto.protocoloData) : "—"}</div>
              </div>
              <div>
                <div className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 9.5, letterSpacing: "0.18em", color: INK_2 }}>Expira em</div>
                <div style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 16, color: isAtiva ? BRAND : INK_2 }}>{proto ? `${expiraEmMin}min` : "—"}</div>
              </div>
              <div>
                <div className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 9.5, letterSpacing: "0.18em", color: INK_2 }}>Mensagens</div>
                <div style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 14, color: INK }}>{mensagensCount}</div>
              </div>
              <div>
                <div className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 9.5, letterSpacing: "0.18em", color: INK_2 }}>Confiança média</div>
                <div style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 14, color: INK }}>{confMediaLabel}</div>
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
                {anteriores.map((p) => (
                  <div key={p.sessaoId} className="flex items-center justify-between px-3 py-2" style={{ background: "#FAFAFA", borderRadius: 2 }} title={p.titulo || ""}>
                    <span className="uppercase truncate" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 12, letterSpacing: "0.08em", color: INK, maxWidth: 170 }}>
                      {p.protocolo || "—"}
                    </span>
                    <span className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 500, fontSize: 11, letterSpacing: "0.14em", color: INK_2 }}>
                      {labelRelativo(p.updatedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
