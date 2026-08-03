import { useEffect, useRef, useState, useCallback, KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageCircle, Pencil, AlertTriangle, Sparkles, ShieldCheck, ShieldAlert, ShieldX, ShoppingCart } from "lucide-react";
import { IconPlus, IconMicrophone, IconPlayerStopFilled, IconArrowUp, IconX, IconFileText, IconPhoto } from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "@/shared/cart/CartProvider";
import { getServiceBySlug } from "@/shared/data/catalog";
import { startWavRecording, type WavRecorder } from "@/lib/quero-armas/wavRecorder";

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
  compact?: boolean;
}

const SUGESTOES = [
  "O que preciso para comprar uma arma como policial civil?",
  "Como consigo a posse de arma pra me defender e defender a minha família",
  "Como funciona o registro CAC?",
];

const NIVEL_META: Record<NivelConfianca, { label: string; icon: JSX.Element; fg: string; bg: string }> = {
  alta:  { label: "Confiança alta",  icon: <ShieldCheck className="h-3 w-3" />, fg: OK,    bg: OK_BG    },
  media: { label: "Confiança média", icon: <ShieldAlert className="h-3 w-3" />, fg: AMBER, bg: AMBER_BG },
  baixa: { label: "Confiança baixa", icon: <ShieldX     className="h-3 w-3" />, fg: RED,   bg: RED_BG   },
};

type AnexoChat = {
  localId: string;
  id: string | null;
  nome_arquivo: string;
  mime_type: string;
  tamanho_bytes: number;
  previewUrl: string | null;
  texto_extraido: string | null;
  status: "enviando" | "lendo" | "pronto" | "erro";
  erro?: string | null;
};

export function CentralAjudaCliente({ cliente, compact }: CentralAjudaClienteProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [proto, setProto] = useState<ProtocoloAtivo | null>(null);
  const [protocolosAnteriores, setProtocolosAnteriores] = useState<ProtocoloResumo[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [reabertoBannerFor, setReabertoBannerFor] = useState<string | null>(null);
  const [anexos, setAnexos] = useState<AnexoChat[]>([]);
  const [gravando, setGravando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const navigate = useNavigate();
  const { addItem } = useCart();

  const scrollRef = useRef<HTMLDivElement>(null);
  // Primeiro nome em capitalização natural (o banco costuma guardar em CAIXA ALTA).
  const primeiroNome = (() => {
    const raw = (cliente?.nome_completo || "").trim().split(/\s+/)[0] || "";
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : "";
  })();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<WavRecorder | null>(null);

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
    const anexosProntos = anexos.filter((a) => a.status === "pronto" && a.id);
    if (query.length < 2 && anexosProntos.length === 0) return;
    const queryFinal =
      query.length >= 2
        ? query
        : `Analise o que enviei em anexo: ${anexosProntos.map((a) => a.nome_arquivo).join(", ")}`;

    setInput("");
    setAnexos([]);
    const startIso = new Date().toISOString();
    const startMs = Date.now();
    const userMsg: Mensagem = {
      id: `u-${Date.now()}`,
      role: "user",
      content:
        anexosProntos.length > 0
          ? `${queryFinal}\n\n📎 ${anexosProntos.map((a) => a.nome_arquivo).join(", ")}`
          : queryFinal,
      createdAt: startIso,
    };
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
        body: JSON.stringify({
          query: queryFinal,
          sessao_id: proto?.sessaoId ?? null,
          historico,
          limit: 5,
          anexos: anexosProntos.map((a) => ({
            id: a.id,
            nome_arquivo: a.nome_arquivo,
            mime_type: a.mime_type,
            texto_extraido: a.texto_extraido,
          })),
        }),
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
  }, [cliente, loading, mensagens, proto?.sessaoId, carregarAnteriores, anexos]);

  // ── Anexos ────────────────────────────────────────────────────────────
  const MAX_ANEXO_BYTES = 20 * 1024 * 1024;

  const anexarArquivos = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const { data: sess } = await supabase.auth.getSession();
    const jwt = sess.session?.access_token;
    const userId = sess.session?.user?.id;
    if (!jwt || !userId) { toast.error("Faça login novamente para enviar arquivos."); return; }

    for (const file of Array.from(files).slice(0, 5)) {
      if (file.size > MAX_ANEXO_BYTES) { toast.error(`${file.name}: arquivo maior que 20 MB.`); continue; }
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const isImg = file.type.startsWith("image/");
      setAnexos((prev) => [...prev, {
        localId, id: null, nome_arquivo: file.name, mime_type: file.type,
        tamanho_bytes: file.size, previewUrl: isImg ? URL.createObjectURL(file) : null,
        texto_extraido: null, status: "enviando",
      }]);

      try {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
        const path = `${userId}/${localId}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("qa-chat-anexos")
          .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upErr) throw new Error(upErr.message);

        setAnexos((prev) => prev.map((a) => a.localId === localId ? { ...a, status: "lendo" } : a));

        const res = await fetch(`${SUPABASE_URL}/functions/v1/qa-chat-anexo-processar`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}`, apikey: PUBLISHABLE_KEY },
          body: JSON.stringify({
            storage_path: path, nome_arquivo: file.name, mime_type: file.type,
            tamanho_bytes: file.size, sessao_id: proto?.sessaoId ?? null,
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Falha ao ler o arquivo.");
        setAnexos((prev) => prev.map((a) => a.localId === localId
          ? { ...a, id: j.id, texto_extraido: j.texto_extraido ?? null, status: "pronto", erro: j.erro ?? null }
          : a));
      } catch (e: any) {
        setAnexos((prev) => prev.map((a) => a.localId === localId
          ? { ...a, status: "erro", erro: e?.message ?? "Falha no envio" } : a));
        toast.error(`${file.name}: ${e?.message ?? "falha no envio"}`);
      }
    }
  }, [proto?.sessaoId]);

  function removerAnexo(localId: string) {
    setAnexos((prev) => {
      const alvo = prev.find((a) => a.localId === localId);
      if (alvo?.previewUrl) URL.revokeObjectURL(alvo.previewUrl);
      return prev.filter((a) => a.localId !== localId);
    });
  }

  // ── Voz → texto ───────────────────────────────────────────────────────
  async function alternarGravacao() {
    if (transcrevendo) return;
    if (gravando && recorderRef.current) {
      const rec = recorderRef.current;
      recorderRef.current = null;
      setGravando(false);
      setTranscrevendo(true);
      try {
        const blob = await rec.stop();
        if (blob.size < 2048) { toast.error("Gravação vazia. Tente novamente."); return; }
        const { data: sess } = await supabase.auth.getSession();
        const jwt = sess.session?.access_token ?? PUBLISHABLE_KEY;
        const fd = new FormData();
        fd.append("file", blob, "gravacao.wav");
        const res = await fetch(`${SUPABASE_URL}/functions/v1/qa-chat-transcrever`, {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}`, apikey: PUBLISHABLE_KEY },
          body: fd,
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Falha ao transcrever.");
        const texto = (j?.text || "").trim();
        if (!texto) { toast.error("Não consegui entender o áudio."); return; }
        setInput((prev) => (prev ? `${prev} ${texto}` : texto));
        setTimeout(() => inputRef.current?.focus(), 0);
      } catch (e: any) {
        toast.error(e?.message ?? "Falha ao transcrever o áudio.");
      } finally {
        setTranscrevendo(false);
      }
      return;
    }
    try {
      recorderRef.current = await startWavRecording();
      setGravando(true);
    } catch {
      toast.error("Não consegui acessar o microfone. Verifique a permissão.");
    }
  }

  function novaConversa() {
    if (loading) return;
    setMensagens([]);
    setInput("");
    setProto(null);
    setReabertoBannerFor(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
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
    <div className={`w-full max-w-full overflow-x-hidden ${compact ? "h-full min-h-0" : ""}`} style={{ background: PAPER, fontFamily: "Inter, sans-serif", color: INK }}>
      {/* Grid */}
      <div className={`px-4 md:px-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] ${compact ? "h-full min-h-0 pt-0 pb-3 lg:pb-4 items-stretch" : "py-4"}`}>
        {/* Chat */}
        <div className="bg-white flex flex-col overflow-hidden min-w-0 h-full min-h-0" style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 16, minHeight: compact ? 0 : 620 }}>
          {showReaberto && proto && (
            <div className="mx-5 mt-3 px-3 py-2 flex items-start gap-2" style={{ background: AMBER_BG, borderLeft: `3px solid ${AMBER}`, borderRadius: 10 }}>
              <Sparkles className="h-4 w-4 mt-0.5 shrink-0" style={{ color: AMBER }} />
              <div className="text-[12px]" style={{ color: "#78350F" }}>
                Retomando o protocolo <strong>{proto.protocolo}</strong>, aberto em <strong>{fmtDMYHM(proto.protocoloData)}</strong>.
              </div>
            </div>
          )}

          <div
            ref={scrollRef}
            className={`flex-1 min-h-0 overflow-y-auto py-4 ${mensagens.length === 0 && !initLoading ? "flex flex-col justify-end px-0" : "px-5 space-y-4"}`}
            style={{ background: "#FFFFFF" }}
          >
            {initLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : mensagens.length === 0 ? (
              <div className="flex flex-col items-start text-left gap-3 pb-10">
                <h2
                  className="text-left px-5"
                  style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 22, lineHeight: 1.1, letterSpacing: "0.01em", color: INK }}
                >
                  Olá, <span style={{ color: BRAND }}>{primeiroNome}</span>
                </h2>
                <div className="w-full overflow-x-auto no-scrollbar">
                  <div className="flex items-stretch gap-2 px-5 w-max">
                    {SUGESTOES.map((s) => (
                      <button
                        key={s}
                        onClick={() => enviar(s)}
                        className="shrink-0 max-w-[240px] text-left text-[11.5px] px-3 py-2 bg-white border transition-colors hover:bg-slate-50"
                        style={{ borderColor: CARD_BORDER, borderRadius: 999, color: INK_2, lineHeight: 1.3 }}
                      >
                        <span className="block truncate">{s}</span>
                      </button>
                    ))}
                  </div>
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
                        <div className="bg-white" style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 16 }}>
                          <div className="flex items-center gap-2 px-4 pt-3">
                            <span className="uppercase" style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 12, letterSpacing: "0.16em", color: INK }}>Klal</span>
                          </div>
                          <div className="px-4 py-3">
                            {!m.isStreaming && m.aprovadaKb === false && (
                              <div className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 mb-2" style={{ background: "hsl(0 70% 96%)", color: "hsl(0 60% 40%)", borderRadius: 8 }}>
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                Resposta sinalizada pela nossa equipe como incorreta ou desatualizada
                              </div>
                            )}
                            {!m.isStreaming && m.conteudoCorrigido && (
                              <div className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 mb-2" style={{ background: `${BRAND}12`, color: BRAND, borderRadius: 8 }}>
                                <Pencil className="h-3 w-3 shrink-0" />
                                Resposta corrigida pela equipe
                              </div>
                            )}
                            {m.content ? (
                              <div className="prose prose-sm max-w-none prose-p:my-2.5 prose-headings:mt-4 prose-headings:mb-2 prose-strong:text-slate-900 prose-li:my-1 prose-ul:my-2" style={{ color: INK, fontSize: 14, lineHeight: 1.6 }}>
                                <ReactMarkdown>{m.isStreaming ? m.content + "▊" : (m.conteudoCorrigido || m.content)}</ReactMarkdown>
                              </div>
                            ) : m.isStreaming ? (
                              <div className="flex items-center gap-1 py-1 text-[11px]" style={{ color: INK_2 }}>
                                <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: INK_2 }} />
                                <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: INK_2, animationDelay: "150ms" }} />
                                <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: INK_2, animationDelay: "300ms" }} />
                              </div>
                            ) : null}
                            {!m.isStreaming && (m.fontes && m.fontes.length > 0) && (
                              <div className="mt-3 pt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]" style={{ borderTop: `1px dashed ${CARD_BORDER}`, color: INK }}>
                                <span>
                                  <span style={{ fontWeight: 700 }}>Fontes:</span>{" "}
                                  {m.fontes.slice(0, 6).map((f, i) => {
                                    const raw = f.titulo_norma || f.titulo_doc || "Fonte";
                                    const label = raw.startsWith("QA: ") ? "Klal — resposta aprovada" : raw;
                                    return <span key={i} style={{ color: INK_2 }}>{i > 0 ? " · " : ""}{label}</span>;
                                  })}
                                </span>
                              </div>
                            )}
                            {!m.isStreaming && m.servicoSugerido && (
                              <div className="mt-3 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ background: "#FAFAFA", border: `1px solid ${CARD_BORDER}`, borderLeft: `3px solid ${BRAND}`, borderRadius: 10 }}>
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
                                  style={{ background: BRAND, borderRadius: 10, fontFamily: OSWALD, fontWeight: 700, fontSize: 11.5, letterSpacing: "0.16em" }}
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
                <button onClick={() => escalarParaEquipe(ultimaAssistente.content)} disabled={escalating} className="uppercase inline-flex items-center gap-1.5 px-3 py-2 text-white disabled:opacity-60" style={{ background: INK, borderRadius: 10, fontFamily: OSWALD, fontWeight: 600, fontSize: 11, letterSpacing: "0.16em" }}>
                  {escalating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                  Não resolveu? Falar com a equipe
                </button>
              </div>
            )}
          </div>

          <div className="p-2 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,text/plain,.txt,.csv,.md,.json"
              className="hidden"
              onChange={(e) => { anexarArquivos(e.target.files); e.currentTarget.value = ""; }}
            />
            <div className="flex flex-col" style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 14, background: "#FFFFFF" }}>
              {/* Anexos — sempre acima do campo de texto */}
              {anexos.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3 pt-3">
                  {anexos.map((a) => {
                    const carregando = a.status === "enviando" || a.status === "lendo";
                    const erro = a.status === "erro";
                    return (
                      <div
                        key={a.localId}
                        className="relative flex items-center gap-2 pl-2 pr-6 py-1.5 max-w-[220px]"
                        style={{
                          background: erro ? RED_BG : "#FAFAFA",
                          border: `1px solid ${erro ? "#F3C6C6" : LINE}`,
                          borderRadius: 10,
                        }}
                      >
                        {a.previewUrl ? (
                          <img src={a.previewUrl} alt="" className="object-cover shrink-0" style={{ width: 30, height: 30, borderRadius: 7 }} />
                        ) : (
                          <span className="inline-flex items-center justify-center shrink-0" style={{ width: 30, height: 30, borderRadius: 7, background: "#F2F2F2", color: INK_2 }}>
                            {a.mime_type.startsWith("image/") ? <IconPhoto size={15} /> : <IconFileText size={15} />}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-[11.5px]" style={{ color: INK }}>{a.nome_arquivo}</span>
                          <span className="block text-[10px]" style={{ color: erro ? RED : INK_2 }}>
                            {carregando ? (a.status === "enviando" ? "Enviando…" : "Lendo…") : erro ? (a.erro || "Falhou") : "Pronto"}
                          </span>
                        </span>
                        {carregando && <Loader2 className="h-3 w-3 animate-spin shrink-0" style={{ color: INK_2 }} />}
                        <button
                          onClick={() => removerAnexo(a.localId)}
                          aria-label={`Remover ${a.nome_arquivo}`}
                          className="absolute inline-flex items-center justify-center"
                          style={{ top: -6, right: -6, width: 18, height: 18, borderRadius: 999, background: INK, color: "#FFFFFF" }}
                        >
                          <IconX size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <textarea
                ref={inputRef}
                rows={2}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
                }}
                onKeyDown={onKeyDown}
                placeholder={gravando ? "Gravando… toque no microfone para parar" : "Digite sua dúvida para o Klal..."}
                disabled={loading || !cliente}
                className="w-full px-3 pt-3 text-[14px] bg-transparent border-0 focus:outline-none focus:ring-0 disabled:text-slate-400 resize-none"
                style={{ color: INK, minHeight: 60, maxHeight: 180, lineHeight: 1.45 }}
              />

              {/* Barra de controles — abaixo do campo */}
              <div className="flex items-center gap-1.5 px-2.5 pb-2.5 pt-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || !cliente}
                  title="Adicionar arquivos"
                  aria-label="Adicionar arquivos"
                  className="inline-flex items-center justify-center transition-colors disabled:opacity-40 hover:bg-slate-50"
                  style={{ width: 32, height: 32, borderRadius: 999, border: `1px solid ${CARD_BORDER}`, color: INK }}
                >
                  <IconPlus size={17} />
                </button>
                <button
                  onClick={alternarGravacao}
                  disabled={loading || !cliente || transcrevendo}
                  title={gravando ? "Parar gravação" : "Ditar por voz"}
                  aria-label={gravando ? "Parar gravação" : "Ditar por voz"}
                  className="inline-flex items-center justify-center transition-colors disabled:opacity-40 hover:bg-slate-50"
                  style={{
                    width: 32, height: 32, borderRadius: 999,
                    border: `1px solid ${gravando ? BRAND : CARD_BORDER}`,
                    background: gravando ? BRAND : "transparent",
                    color: gravando ? "#FFFFFF" : INK,
                  }}
                >
                  {transcrevendo ? <Loader2 className="h-4 w-4 animate-spin" /> : gravando ? <IconPlayerStopFilled size={14} /> : <IconMicrophone size={17} />}
                </button>

                <span className="flex-1 truncate text-[10.5px] uppercase" style={{ fontFamily: OSWALD, letterSpacing: "0.14em", color: INK_2 }}>
                  {gravando ? "Gravando" : transcrevendo ? "Transcrevendo" : anexos.length > 0 ? `${anexos.length} anexo(s)` : ""}
                </span>

                <button
                  onClick={() => enviar(input)}
                  disabled={
                    loading || !cliente ||
                    (input.trim().length < 2 && anexos.filter((a) => a.status === "pronto").length === 0)
                  }
                  title="Enviar"
                  aria-label="Enviar"
                  className="inline-flex items-center justify-center shrink-0 transition-colors disabled:opacity-40"
                  style={{ width: 32, height: 32, borderRadius: 999, background: BRAND, color: "#FFFFFF" }}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <IconArrowUp size={17} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Rail */}
        <div className={`space-y-4 min-w-0 ${compact ? "hidden lg:block lg:overflow-y-auto" : ""}`}>
          <div className="bg-white p-3.5" style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 16 }}>
            <div className="uppercase mb-2" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 11, letterSpacing: "0.18em", color: INK_2 }}>Protocolo atual</div>
            <div style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 18, letterSpacing: "0.06em", color: INK, wordBreak: "break-all" }}>
              {proto?.protocolo || "—"}
            </div>
            <div className="grid grid-cols-1 gap-x-3 gap-y-4 mt-4">
              <div className="pt-3" style={{ borderTop: `1px solid ${LINE}` }}>
                <div className="uppercase mt-1" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 9.5, letterSpacing: "0.18em", color: INK_2 }}>Aberto</div>
                <div style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 14, color: INK }}>{proto ? fmtDMYHM(proto.protocoloData) : "—"}</div>
              </div>
              <div className="pt-3" style={{ borderTop: `1px solid ${LINE}` }}>
                <div className="uppercase mt-1" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 9.5, letterSpacing: "0.18em", color: INK_2 }}>Expira em</div>
                <div style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 16, color: isAtiva ? BRAND : INK_2 }}>{proto ? `${expiraEmMin}min` : "—"}</div>
              </div>
              <div className="pt-3" style={{ borderTop: `1px solid ${LINE}` }}>
                <div className="uppercase mt-1" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 9.5, letterSpacing: "0.18em", color: INK_2 }}>Mensagens</div>
                <div style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 14, color: INK }}>{mensagensCount}</div>
              </div>
              <div className="pt-3" style={{ borderTop: `1px solid ${LINE}` }}>
                <div className="uppercase mt-1" style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 9.5, letterSpacing: "0.18em", color: INK_2 }}>Confiança média</div>
                <div style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 14, color: INK }}>{confMediaLabel}</div>
              </div>
            </div>
            <div className="text-[11px] mt-3" style={{ color: INK_2, lineHeight: 1.5 }}>
              Se ficar 30min sem interação, o protocolo encerra. Nova pergunta abre novo protocolo — exceto se o assunto for o mesmo.
            </div>
          </div>

          <div className="bg-white p-3.5" style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 16 }}>
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
                    <div key={i} className="px-3 py-2" style={{ background: "#FAFAFA", borderLeft: `3px solid ${BRAND}`, borderRadius: 10 }}>
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

          <div className="bg-white p-3.5" style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 16 }}>
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
                  <div key={p.sessaoId} className="flex items-center justify-between px-3 py-2" style={{ background: "#FAFAFA", borderRadius: 10 }} title={p.titulo || ""}>
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
