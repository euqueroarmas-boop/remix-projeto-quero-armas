import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDown, ArrowUp, Inbox, Lock, CheckCircle2, Clock3, AlertTriangle, HelpCircle, Settings2, RefreshCw } from "lucide-react";
import { trilhaDoProcesso, trilhaCompacta, type DocTrilha } from "@/lib/quero-armas/trilhaChecklist";
import { useDragScroll } from "@/hooks/useDragScroll";

/**
 * Painel editorial de progresso por cliente.
 * Lista TODOS os processos ativos (decisão do cliente), densa, sem cards.
 * Todas as colunas são ordenáveis.
 */

interface Row {
  processo_id: string;
  cliente_id: number;
  cliente_nome: string | null;
  cliente_email?: string | null;
  servico_nome: string | null;
  fase: string;
  total_docs: number;
  entregues: number;
  proximo_doc: string | null;
  proximo_tipo?: string | null;
  dias_parado: number;
  cobrancas: number;
  criado_em: string;
  /** Espelho da área do cliente — já vinham da função e não eram exibidos. */
  grupo_atual?: string | null;
  grupo_total?: number | null;
  grupo_concluidos?: number | null;
  /** Leitura por grupos: em qual grupo está e quantos faltam. */
  grupos_total?: number | null;
  grupo_indice?: number | null;
  grupos_concluidos?: number | null;
  grupos_restantes?: number | null;
  documentos_pendentes?: number | null;
  perguntas_pendentes?: number | null;
  em_analise?: number | null;
  dispensados?: number | null;
  reaproveitados?: number | null;
  bloqueado_por_prerequisito?: boolean | null;
  /** Novas leituras operacionais. */
  online?: boolean | null;
  ultimo_acesso?: string | null;
  efetiva_status?: string | null;
  protocolo_numero?: string | null;
}

type SortKey =
  | "cliente_nome" | "servico_nome" | "fase" | "progresso" | "proximo_doc"
  | "dias_parado" | "cobrancas" | "criado_em"
  | "online" | "efetiva" | "protocolo";

type ColDef = { key: SortKey; label: string; largura: number; titulo?: string };

const COLS: ColDef[] = [
  { key: "cliente_nome", label: "CLIENTE", largura: 250 },
  { key: "online", label: "ONLINE", largura: 116, titulo: "Acesso do cliente ao portal nos últimos 15 minutos" },
  { key: "fase", label: "ETAPA ATUAL", largura: 200 },
  { key: "progresso", label: "PROGRESSO", largura: 236 },
  { key: "proximo_doc", label: "PRÓXIMO PASSO", largura: 210 },
  { key: "efetiva", label: "EF. NECESSIDADE", largura: 150, titulo: "Situação da narrativa de efetiva necessidade" },
  { key: "protocolo", label: "PROTOCOLO", largura: 168, titulo: "Número do protocolo emitido para este serviço" },
  { key: "criado_em", label: "ABERTO EM", largura: 104 },
  { key: "cobrancas", label: "COBRANÇAS", largura: 104, titulo: "Cobranças automáticas por inatividade já enviadas (1ª aos 15 dias, depois semanal)" },
  { key: "dias_parado", label: "PARADO", largura: 96 },
];

const LS_LARGURAS = "qa_painel_progresso_larguras";
const LS_VISIVEIS = "qa_painel_progresso_visiveis";

/** Colunas do modo "credenciados não localizados" (substituem daqui pra frente). */
type CredKey = "cred_nome" | "cred_endereco" | "cred_cidade" | "cred_telefone" | "cred_situacao";
const COLS_CRED: { key: CredKey; label: string; largura: number }[] = [
  { key: "cred_nome", label: "NOME / REGISTRO", largura: 240 },
  { key: "cred_endereco", label: "ENDEREÇO", largura: 300 },
  { key: "cred_cidade", label: "CIDADE / ESTADO", largura: 150 },
  { key: "cred_telefone", label: "TELEFONE", largura: 140 },
  { key: "cred_situacao", label: "SITUAÇÃO", largura: 120 },
];

type CredRow = {
  id: string;
  tipo: string;
  nome: string;
  registro: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  cliente_nome: string | null;
  qa_cliente_id: number | null;
  situacao: string;
};

/* Cores semânticas travadas: verde = em dia, âmbar = atenção, vermelho = crítico. */
const VERDE = "#0F7A45";
const VERDE_BG = "#F1FAF4";
const AMBAR = "#8A6A17";
const AMBAR_BG = "#FDFAF1";
const VERMELHO = "#7A1F2B";
const VERMELHO_BG = "#FDF4F5";
const TINTA = "#0A0A0A";
const TINTA_2 = "#3A3A3A";
const TINTA_3 = "#6A6A6A";

type Saude = "ok" | "atencao" | "critico";

function saudeDe(d: number): Saude {
  if (d >= 15) return "critico";
  if (d >= 7) return "atencao";
  return "ok";
}

function corSensor(d: number) {
  const s = saudeDe(d);
  return s === "critico" ? VERMELHO : s === "atencao" ? AMBAR : VERDE;
}

function fundoSensor(d: number) {
  const s = saudeDe(d);
  return s === "critico" ? VERMELHO_BG : s === "atencao" ? AMBAR_BG : VERDE_BG;
}

function corProgresso(pct: number, dias: number) {
  if (pct >= 100) return VERDE;
  return corSensor(dias);
}

function Chip({
  children, cor, fundo, titulo, quebra, miudo,
}: { children: React.ReactNode; cor: string; fundo: string; titulo?: string; quebra?: boolean; miudo?: boolean }) {
  return (
    <span
      title={titulo}
      className={`inline-flex min-h-[22px] max-w-full items-center gap-1 rounded-full px-2 py-0 text-left uppercase leading-[1.25] tracking-[0.06em] ${
        miudo ? "text-[10.5px] font-medium" : "text-[10.5px] font-medium"
      } ${quebra ? "[overflow-wrap:anywhere]" : "break-words"}`}
      style={{ background: fundo, color: cor }}
    >
      {children}
    </span>
  );
}

type ContadorKey = "todos" | "online" | "pronto" | "analise" | "pendencia" | "parado" | "bloqueado";

/** "3 HOJE · 12 NO TOTAL" — leitura de quantas vezes o cliente entrou no portal. */
function fmtEntradas(a?: { hoje: number; total: number }) {
  return { hoje: a?.hoje ?? 0, total: a?.total ?? 0 };
}

function fmtData(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "—"; }
}

/** "HOJE 14:32" / "12/08 09:10" — leitura curta do último acesso. */
function fmtAcesso(d?: string | null) {
  if (!d) return "SEM ACESSO";
  try {
    const dt = new Date(d);
    const hoje = new Date();
    const hora = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const mesmoDia = dt.toDateString() === hoje.toDateString();
    return mesmoDia ? `HOJE ${hora}` : `${dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}`;
  } catch { return "—"; }
}

/** Situação da efetiva necessidade em rótulo curto + cor. */
function efetivaVisual(status?: string | null): { label: string; cor: string; fundo: string } | null {
  const s = String(status ?? "").trim().toLowerCase();
  if (!s) return null;
  if (["aprovado", "aprovada", "concluido", "concluída", "concluido_cliente", "finalizado"].includes(s)) {
    return { label: "APROVADA", cor: VERDE, fundo: VERDE_BG };
  }
  if (["revisao", "em_revisao", "revisao_humana", "aguardando_revisao", "pendente_revisao", "aguardando_equipe"].includes(s)) {
    return { label: "EM REVISÃO", cor: AMBAR, fundo: AMBAR_BG };
  }
  if (["reprovado", "reprovada", "recusado", "devolvido", "devolvida"].includes(s)) {
    return { label: s.startsWith("devolvid") ? "DEVOLVIDA" : "REPROVADA", cor: VERMELHO, fundo: VERMELHO_BG };
  }
  return { label: s.replace(/_/g, " ").toUpperCase(), cor: AMBAR, fundo: AMBAR_BG };
}

/** Rota real da ficha do cliente: aba Clientes abre o cadastro via ?cliente=ID. */
function rotaCadastroCliente(clienteId: number) {
  return `/clientes?cliente=${clienteId}&tab=dados`;
}

/** "GRUPO 4 DE 7 · FALTAM 4" — leitura de quanto falta para terminar o processo. */
function LinhaGrupos({ r }: { r: Row }) {
  const total = r.grupos_total ?? 0;
  if (total <= 0) return null;
  const indice = r.grupo_indice ?? 0;
  const restantes = r.grupos_restantes ?? 0;
  return (
    <div className="text-[10.5px] font-medium uppercase tracking-[0.08em]" style={{ color: TINTA_3 }}>
      {indice > 0 ? `GRUPO ${indice} DE ${total}` : `${total} GRUPOS`}
      {" · "}
      {restantes > 0 ? `FALTAM ${restantes}` : "TODOS CONCLUÍDOS"}
    </div>
  );
}

export default function DashboardProgressoClientes() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("dias_parado");
  const [asc, setAsc] = useState(false);
  const [trilhas, setTrilhas] = useState<Record<string, string[]>>({});
  const [filtroTrilha, setFiltroTrilha] = useState<string | null>(null);
  const [contador, setContador] = useState<ContadorKey>("todos");
  /** Modo credenciados: troca as colunas a partir de PRÓXIMO PASSO. */
  const [modoCred, setModoCred] = useState<"psicologo" | "instrutor_tiro" | null>(null);
  const [credRows, setCredRows] = useState<CredRow[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [configAberta, setConfigAberta] = useState(false);
  const [larguras, setLarguras] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(LS_LARGURAS) ?? "{}"); } catch { return {}; }
  });
  const [visiveis, setVisiveis] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(LS_VISIVEIS) ?? "{}"); } catch { return {}; }
  });
  const tabelaScroll = useDragScroll<HTMLDivElement>();
  const trilhasScroll = useDragScroll<HTMLDivElement>();
  const resize = useRef<{ key: string; startX: number; startW: number } | null>(null);

  useEffect(() => { localStorage.setItem(LS_LARGURAS, JSON.stringify(larguras)); }, [larguras]);
  useEffect(() => { localStorage.setItem(LS_VISIVEIS, JSON.stringify(visiveis)); }, [visiveis]);

  /** Credenciados (psicólogos e IAT) não localizados na base da PF. */
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const { data } = await supabase
        .from("qa_psico_nao_localizados" as any)
        .select("id, tipo, nome, registro, endereco, cidade, uf, telefone, cliente_nome, qa_cliente_id, situacao")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!cancelado) setCredRows(((data as any[]) ?? []) as CredRow[]);
    })();
    return () => { cancelado = true; };
  }, []);

  /** Clicar fora do painel devolve as colunas normais do cliente. */
  useEffect(() => {
    if (!modoCred) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setModoCred(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [modoCred]);

  const credPorCliente = useMemo(() => {
    const mapa: Record<number, CredRow[]> = {};
    for (const c of credRows) {
      if (modoCred && c.tipo !== modoCred) continue;
      if (c.qa_cliente_id == null) continue;
      (mapa[c.qa_cliente_id] ||= []).push(c);
    }
    return mapa;
  }, [credRows, modoCred]);

  const credContadores = useMemo(() => ({
    psicologo: credRows.filter((c) => c.tipo !== "instrutor_tiro").length,
    instrutor_tiro: credRows.filter((c) => c.tipo === "instrutor_tiro").length,
  }), [credRows]);

  /** CLIENTE nunca some; as demais respeitam a engrenagem. */
  const colunas = useMemo(() => {
    const base = COLS.filter((c) => c.key === "cliente_nome" || visiveis[c.key] !== false);
    if (!modoCred) return base;
    // No modo credenciados, tudo a partir de PRÓXIMO PASSO vira a ficha do profissional.
    const corte = base.findIndex((c) => c.key === "proximo_doc");
    const mantidas = corte >= 0 ? base.slice(0, corte) : base;
    return [...mantidas, ...(COLS_CRED as unknown as ColDef[])];
  }, [visiveis, modoCred]);
  const larguraDe = (c: ColDef) => larguras[c.key] ?? c.largura;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resize.current;
      if (!r) return;
      e.preventDefault();
      const nova = Math.max(72, Math.min(640, r.startW + (e.clientX - r.startX)));
      setLarguras((prev) => ({ ...prev, [r.key]: nova }));
    };
    const onUp = () => { resize.current = null; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [recarregando, setRecarregando] = useState(false);
  /** email -> { hoje, total } de entradas no portal. */
  const [acessos, setAcessos] = useState<Record<string, { hoje: number; total: number }>>({});
  /** Totais globais de acessos ao portal (hoje e desde o início). */
  const [acessosGlobais, setAcessosGlobais] = useState<{ hoje: number; total: number }>({ hoje: 0, total: 0 });
  const carregarRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const carregar = async () => {
      try {
        setRecarregando(true);
        const { data } = await supabase.rpc("qa_painel_progresso_clientes" as any);
        const lista = ((data as any[]) ?? []) as Row[];
        if (cancelled) return;
        setRows(lista);

        const ids = lista.map((r) => r.processo_id).filter(Boolean);

        // Contagem de entradas no portal por cliente (hoje e histórico).
        const { data: logins } = await supabase
          .from("qa_cliente_login_eventos")
          .select("email, created_at")
          .not("email", "is", null)
          .order("created_at", { ascending: false })
          .limit(5000);
        const hojeStr = new Date().toDateString();
        const mapaAcessos: Record<string, { hoje: number; total: number }> = {};
        for (const l of ((logins as any[]) ?? [])) {
          const email = String(l.email ?? "").trim().toLowerCase();
          if (!email) continue;
          const item = (mapaAcessos[email] ||= { hoje: 0, total: 0 });
          item.total += 1;
          if (new Date(l.created_at).toDateString() === hojeStr) item.hoje += 1;
        }
        if (!cancelled) setAcessos(mapaAcessos);

        // Totais globais exatos (não limitados pelo select acima).
        const inicioHoje = new Date();
        inicioHoje.setHours(0, 0, 0, 0);
        const [{ count: totalGeral }, { count: totalHoje }] = await Promise.all([
          supabase.from("qa_cliente_login_eventos").select("id", { count: "exact", head: true }),
          supabase
            .from("qa_cliente_login_eventos")
            .select("id", { count: "exact", head: true })
            .gte("created_at", inicioHoje.toISOString()),
        ]);
        if (!cancelled) setAcessosGlobais({ hoje: totalHoje ?? 0, total: totalGeral ?? 0 });

        if (ids.length > 0) {
          const [{ data: docs }, { data: procs }] = await Promise.all([
            supabase
              .from("qa_processo_documentos")
              .select("processo_id, tipo_documento, status")
              .in("processo_id", ids),
            supabase
              .from("qa_processos")
              .select("id, condicao_profissional")
              .in("id", ids),
          ]);
          const condicaoPorProcesso: Record<string, string | null> = {};
          for (const p of ((procs as any[]) ?? [])) condicaoPorProcesso[p.id] = p.condicao_profissional ?? null;

          const porProcesso: Record<string, DocTrilha[]> = {};
          for (const d of ((docs as any[]) ?? [])) {
            (porProcesso[d.processo_id] ||= []).push({ tipo: d.tipo_documento, status: d.status });
          }
          const mapa: Record<string, string[]> = {};
          for (const pid of ids) {
            mapa[pid] = trilhaDoProcesso(porProcesso[pid] ?? [], condicaoPorProcesso[pid]);
          }
          if (!cancelled) setTrilhas(mapa);
        }
        if (!cancelled) setAtualizadoEm(new Date());
      } catch (e) {
        console.warn("[DashboardProgressoClientes]", e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) { setLoading(false); setRecarregando(false); }
      }
    };

    carregarRef.current = () => { void carregar(); };
    void carregar();

    // Atualização automática: a cada 60s, ao voltar o foco e em tempo real.
    timer = window.setInterval(() => { if (!document.hidden) void carregar(); }, 60_000);
    const onVisivel = () => { if (!document.hidden) void carregar(); };
    document.addEventListener("visibilitychange", onVisivel);
    window.addEventListener("focus", onVisivel);

    const canal = supabase
      .channel("painel-progresso-clientes")
      .on("postgres_changes", { event: "*", schema: "public", table: "qa_processo_documentos" }, () => { void carregar(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "qa_processos" }, () => { void carregar(); })
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisivel);
      window.removeEventListener("focus", onVisivel);
      supabase.removeChannel(canal);
    };
  }, []);

  const trilhasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    Object.values(trilhas).forEach((ls) => ls.forEach((l) => set.add(l)));
    const lista = [...set].sort();
    return rows.some((r) => r.online) ? ["ONLINE", ...lista] : lista;
  }, [trilhas, rows]);

  /** Processos bloqueados não têm documentos — herdam a trilha dos outros processos do mesmo cliente. */
  const trilhasEfetivas = useMemo(() => {
    const porCliente: Record<number, Set<string>> = {};
    for (const r of rows) {
      const ls = trilhas[r.processo_id] ?? [];
      if (ls.length === 0) continue;
      porCliente[r.cliente_id] = new Set([...(porCliente[r.cliente_id] ?? []), ...ls]);
    }
    const mapa: Record<string, string[]> = {};
    for (const r of rows) {
      const proprias = trilhas[r.processo_id] ?? [];
      mapa[r.processo_id] = proprias.length > 0 ? proprias : [...(porCliente[r.cliente_id] ?? [])];
    }
    return mapa;
  }, [rows, trilhas]);

  const contadores = useMemo(() => {
    const ativos = rows.filter((r) => !r.bloqueado_por_prerequisito);
    const pronto = ativos.filter((r) => r.total_docs > 0 && r.entregues >= r.total_docs).length;
    const analise = ativos.filter((r) => (r.em_analise ?? 0) > 0).length;
    const pendencia = ativos.filter((r) => (r.documentos_pendentes ?? 0) + (r.perguntas_pendentes ?? 0) > 0).length;
    const parado = ativos.filter((r) => r.dias_parado >= 15).length;
    const bloqueado = rows.filter((r) => !!r.bloqueado_por_prerequisito).length;
    const online = ativos.filter((r) => !!r.online).length;
    return { todos: ativos.length, online, pronto, analise, pendencia, parado, bloqueado };
  }, [rows]);

  const filtradas = useMemo(() => {
    // Processos "aguardando etapa anterior" só aparecem quando o filtro BLOQUEADOS está ativo.
    let base = contador === "bloqueado" ? rows : rows.filter((r) => !r.bloqueado_por_prerequisito);
    if (modoCred) base = base.filter((r) => (credPorCliente[r.cliente_id] ?? []).length > 0);
    if (filtroTrilha === "ONLINE") base = base.filter((r) => !!r.online);
    else if (filtroTrilha) base = base.filter((r) => (trilhasEfetivas[r.processo_id] ?? []).includes(filtroTrilha));
    switch (contador) {
      case "online": base = base.filter((r) => !!r.online); break;
      case "pronto": base = base.filter((r) => r.total_docs > 0 && r.entregues >= r.total_docs); break;
      case "analise": base = base.filter((r) => (r.em_analise ?? 0) > 0); break;
      case "pendencia": base = base.filter((r) => (r.documentos_pendentes ?? 0) + (r.perguntas_pendentes ?? 0) > 0); break;
      case "parado": base = base.filter((r) => r.dias_parado >= 15); break;
      case "bloqueado": base = base.filter((r) => !!r.bloqueado_por_prerequisito); break;
      default: break;
    }
    return base;
  }, [rows, trilhasEfetivas, filtroTrilha, contador, modoCred, credPorCliente]);

  const ordenadas = useMemo(() => {
    const val = (r: Row) => {
      switch (sortKey) {
        case "progresso": return r.total_docs > 0 ? r.entregues / r.total_docs : 0;
        case "dias_parado": return r.dias_parado;
        case "cobrancas": return r.cobrancas;
        case "criado_em": return new Date(r.criado_em).getTime();
        case "online": return r.online ? 2 : (r.ultimo_acesso ? 1 : 0);
        case "efetiva": return String(r.efetiva_status ?? "").toLowerCase();
        case "protocolo": return String(r.protocolo_numero ?? "").toLowerCase();
        default: return String((r as any)[sortKey] ?? "").toLowerCase();
      }
    };
    return [...filtradas].sort((a, b) => {
      const va = val(a); const vb = val(b);
      if (va === vb) return 0;
      return (va > vb ? 1 : -1) * (asc ? 1 : -1);
    });
  }, [filtradas, sortKey, asc]);

  const toggle = (k: SortKey) => {
    if (String(k).startsWith("cred_")) return;
    if (k === sortKey) setAsc(v => !v);
    else { setSortKey(k); setAsc(k === "cliente_nome" || k === "servico_nome" || k === "proximo_doc"); }
  };

  if (loading) return null;

  return (
    <div ref={wrapperRef} className="qa-card overflow-hidden">
      <div className="relative px-4 py-3 border-b border-[#E4E4E4] flex items-center gap-2">
        <h3 className="text-[11.5px] uppercase tracking-[0.14em] font-bold" style={{ color: TINTA }}>
          PROGRESSO DOS CLIENTES
        </h3>
        <button
          type="button"
          aria-label="Escolher colunas"
          title="Escolher colunas"
          onClick={() => setConfigAberta((v) => !v)}
          className="rounded-full p-1 text-[#9A9A9A] hover:text-[#0A0A0A] transition-colors"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Atualizar agora"
          title="Atualizar agora"
          onClick={() => carregarRef.current()}
          className="rounded-full p-1 text-[#9A9A9A] hover:text-[#0A0A0A] transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${recarregando ? "animate-spin" : ""}`} />
        </button>
        {atualizadoEm && (
          <span className="text-[9px] uppercase tracking-[0.12em] font-bold" style={{ color: TINTA_3 }}>
            ATUALIZADO ÀS {atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <span className="ml-auto self-start text-[10px] uppercase tracking-wider font-bold" style={{ color: TINTA_3 }}>
          {filtradas.length === rows.length ? `${rows.length} ATIVOS` : `${filtradas.length} DE ${rows.length}`}
        </span>

        {configAberta && (
          <div className="absolute left-4 top-[44px] z-30 w-[240px] rounded-sm border border-[#DADADA] bg-white p-3 shadow-lg">
            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: TINTA_3 }}>
              COLUNAS VISÍVEIS
            </div>
            <div className="space-y-1.5">
              {COLS.filter((c) => c.key !== "cliente_nome").map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: TINTA_2 }}>
                  <input
                    type="checkbox"
                    checked={visiveis[c.key] !== false}
                    onChange={(e) => setVisiveis((v) => ({ ...v, [c.key]: e.target.checked }))}
                    className="h-3 w-3 accent-[#7A1F2B]"
                  />
                  {c.label}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { setLarguras({}); setVisiveis({}); }}
              className="mt-3 w-full rounded-sm border border-[#DADADA] px-2 py-1 text-[9.5px] font-bold uppercase tracking-[0.12em] hover:border-[#0A0A0A]"
              style={{ color: TINTA_2 }}
            >
              RESTAURAR PADRÃO
            </button>
          </div>
        )}
      </div>

      {/* CONTADORES VISUAIS — clicáveis como filtro */}
      <div className="px-4 py-3 border-b border-[#E4E4E4] grid grid-cols-3 md:grid-cols-9 gap-2">
        {([
          { k: "todos", label: "ATIVOS", v: contadores.todos, cor: TINTA, fundo: "#F4F4F4" },
          { k: "online", label: "ONLINE AGORA", v: contadores.online, cor: VERDE, fundo: VERDE_BG },
          { k: "pronto", label: "PRONTOS", v: contadores.pronto, cor: VERDE, fundo: VERDE_BG },
          { k: "analise", label: "EM ANÁLISE", v: contadores.analise, cor: AMBAR, fundo: AMBAR_BG },
          { k: "pendencia", label: "COM PENDÊNCIA", v: contadores.pendencia, cor: AMBAR, fundo: AMBAR_BG },
          { k: "parado", label: "PARADOS 15+", v: contadores.parado, cor: VERMELHO, fundo: VERMELHO_BG },
          { k: "bloqueado", label: "BLOQUEADOS", v: contadores.bloqueado, cor: VERMELHO, fundo: VERMELHO_BG },
        ] as { k: ContadorKey; label: string; v: number; cor: string; fundo: string }[]).map((c) => (
          <button
            key={c.k}
            type="button"
            onClick={() => {
              setFiltroTrilha(null);
              setContador((v) => (v === c.k ? "todos" : c.k));
            }}
            className={`rounded-sm border px-3 py-2 text-left transition-colors ${
              contador === c.k ? "border-[#0A0A0A]" : "border-[#E4E4E4] hover:border-[#BDBDBD]"
            }`}
            style={{ background: contador === c.k ? c.fundo : "#FFFFFF" }}
          >
            <div className="text-[18px] font-bold tabular-nums leading-none" style={{ color: c.cor }}>
              {c.v}
            </div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: TINTA_3 }}>
              {c.label}
            </div>
            {c.k === "online" && (
              <div className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.1em] tabular-nums leading-[1.35]" style={{ color: TINTA_3 }}>
                <div>{acessosGlobais.hoje} ACESSOS HOJE</div>
                <div>{acessosGlobais.total} DESDE O INÍCIO</div>
              </div>
            )}
          </button>
        ))}

        {/* Credenciados não localizados na base da PF — clique troca as colunas. */}
        {([
          { t: "psicologo" as const, label: "PSICÓLOGO S/ PF", v: credContadores.psicologo },
          { t: "instrutor_tiro" as const, label: "IAT S/ PF", v: credContadores.instrutor_tiro },
        ]).map((c) => (
          <button
            key={c.t}
            type="button"
            title="Profissionais citados em laudos que não foram localizados na base de credenciados da Polícia Federal"
            onClick={() => setModoCred((v) => (v === c.t ? null : c.t))}
            className={`rounded-sm border px-3 py-2 text-left transition-colors ${
              modoCred === c.t ? "border-[#0A0A0A]" : "border-[#E4E4E4] hover:border-[#BDBDBD]"
            }`}
            style={{ background: modoCred === c.t ? VERMELHO_BG : "#FFFFFF" }}
          >
            <div className="text-[18px] font-bold tabular-nums leading-none" style={{ color: VERMELHO }}>{c.v}</div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: TINTA_3 }}>{c.label}</div>
            <div className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: TINTA_3 }}>
              NÃO LOCALIZADO NA PF
            </div>
          </button>
        ))}
      </div>

      {trilhasDisponiveis.length > 0 && (
        <div ref={trilhasScroll.ref} className="px-4 py-2 border-b border-[#E4E4E4] flex items-center gap-1.5 overflow-x-auto no-scrollbar select-none">
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] mr-1" style={{ color: TINTA_3 }}>TRILHA</span>
          {trilhasDisponiveis.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFiltroTrilha((v) => (v === t ? null : t))}
              className={`shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full border transition-colors ${
                filtroTrilha === t
                  ? "border-[#0A0A0A] text-[#0A0A0A] font-bold bg-[#F4F4F4]"
                  : "border-[#DADADA] text-[#3A3A3A] hover:border-[#0A0A0A]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {filtradas.length === 0 ? (
        <div className="px-4 py-6 text-center text-[11px] font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2 w-full" style={{ color: TINTA_3 }}>
          <Inbox className="h-3.5 w-3.5" /> NENHUM PROCESSO ATIVO
        </div>
      ) : (
        <>
        {/* MOBILE: lista compacta */}
        <div className="md:hidden">
          <div className="px-4 py-2 border-b border-[#E4E4E4] flex items-center gap-2 overflow-x-auto no-scrollbar">
            {COLS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                className={`shrink-0 inline-flex items-center gap-1 text-[9.5px] uppercase tracking-[0.12em] font-bold px-2 py-1 rounded-full border transition-colors ${
                  sortKey === c.key
                    ? "border-[#0A0A0A] text-[#0A0A0A]"
                    : "border-[#DADADA] text-[#3A3A3A]"
                }`}
              >
                {c.label}
                {sortKey === c.key && (asc ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />)}
              </button>
            ))}
          </div>
          {ordenadas.map((r) => {
            const pct = r.total_docs > 0 ? Math.round((r.entregues / r.total_docs) * 100) : 0;
            const pendencias = (r.documentos_pendentes ?? 0) + (r.perguntas_pendentes ?? 0);
            return (
              <Link
                key={r.processo_id}
                to={rotaCadastroCliente(r.cliente_id)}
                className="block px-4 py-3 border-b border-[#EFEFEF] active:bg-[#FAFAFA]"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[12.5px] font-bold uppercase truncate flex-1" style={{ color: TINTA }}>
                    {r.cliente_nome ?? "—"}
                  </span>
                  <Chip cor={corSensor(r.dias_parado)} fundo={fundoSensor(r.dias_parado)} titulo="Dias sem movimento">
                    {r.dias_parado}d
                  </Chip>
                </div>
                <div className="text-[10px] font-medium uppercase tracking-wider truncate" style={{ color: TINTA_3 }}>
                  {r.servico_nome ?? "—"}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11.5px] font-bold tabular-nums w-12" style={{ color: TINTA }}>
                    {r.entregues}/{r.total_docs}
                  </span>
                  <div className="flex-1 h-[6px] bg-[#EDEDED] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: corProgresso(pct, r.dias_parado) }} />
                  </div>
                  <span className="text-[12.5px] font-bold uppercase tabular-nums" style={{ color: TINTA_2 }}>{pct}%</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {r.bloqueado_por_prerequisito ? (
                    <Chip cor={VERMELHO} fundo={VERMELHO_BG}><Lock className="h-3 w-3" />AGUARDA ETAPA ANTERIOR</Chip>
                  ) : (
                    <Chip cor={TINTA} fundo="#F4F4F4">
                      {r.grupo_atual ?? r.fase}
                      {(r.grupo_total ?? 0) > 0 ? ` ${r.grupo_concluidos ?? 0}/${r.grupo_total}` : ""}
                    </Chip>
                  )}
                  <LinhaGrupos r={r} />
                  {(r.em_analise ?? 0) > 0 && <Chip cor={AMBAR} fundo={AMBAR_BG}><Clock3 className="h-3 w-3" />{r.em_analise} EM ANÁLISE</Chip>}
                  {pendencias > 0 && <Chip miudo cor={VERMELHO} fundo={VERMELHO_BG}><AlertTriangle className="h-3 w-3" />{pendencias} PENDENTE(S)</Chip>}
                  {pct >= 100 && <Chip cor={VERDE} fundo={VERDE_BG}><CheckCircle2 className="h-3 w-3" />PRONTO</Chip>}
                  {r.cobrancas > 0 && <Chip cor={TINTA_2} fundo="#F4F4F4">{r.cobrancas} COB.</Chip>}
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden text-[10.5px] font-medium uppercase" style={{ color: TINTA_2 }}>
                  {r.proximo_tipo === "pergunta" && <HelpCircle className="h-3 w-3 shrink-0" />}
                  <span className="min-w-0 flex-1 truncate">{r.proximo_doc ?? "—"}</span>
                </div>
                {(trilhasEfetivas[r.processo_id] ?? []).length > 0 && (
                  <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] truncate" style={{ color: TINTA_3 }}>
                    {trilhaCompacta(trilhasEfetivas[r.processo_id]).join(" · ")}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {/* DESKTOP: tabela */}
        <div
          ref={tabelaScroll.ref}
          className="hidden md:block overflow-auto"
          style={{ maxHeight: "calc(100vh - 300px)", minHeight: 320 }}
        >
          <table className="border-collapse" style={{ width: colunas.reduce((s, c) => s + larguraDe(c), 0), minWidth: "100%", tableLayout: "fixed" }}>
            <colgroup>
              {colunas.map((c) => (<col key={c.key} style={{ width: larguraDe(c) }} />))}
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-[#DADADA] bg-[#FAFAFA] [&>th]:bg-[#FAFAFA]">
                {colunas.map((c) => (
                  <th key={c.key} className="relative px-3 py-2 text-left align-bottom border-r border-[#EFEFEF] last:border-r-0" title={c.titulo}>
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className="flex w-full items-end justify-start gap-1 break-words text-left text-[10px] font-bold uppercase leading-[1.15] tracking-[0.12em] text-[#3A3A3A] transition-colors hover:text-[#0A0A0A]"
                    >
                      {c.label}
                      {sortKey === c.key && (asc ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />)}
                    </button>
                    <span
                      role="separator"
                      aria-label={`Redimensionar coluna ${c.label}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        resize.current = { key: c.key, startX: e.clientX, startW: larguraDe(c) };
                        document.body.style.userSelect = "none";
                      }}
                      onDoubleClick={() => setLarguras((prev) => { const n = { ...prev }; delete n[c.key]; return n; })}
                      className="absolute right-0 top-0 h-full w-[6px] cursor-col-resize hover:bg-[#DADADA]"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((r, i) => {
                const pct = r.total_docs > 0 ? Math.round((r.entregues / r.total_docs) * 100) : 0;
                const pendencias = (r.documentos_pendentes ?? 0) + (r.perguntas_pendentes ?? 0);
                const ef = efetivaVisual(r.efetiva_status);
                const creds = credPorCliente[r.cliente_id] ?? [];
                const celulas: Record<string, React.ReactNode> = {
                  cred_nome: (
                    <div className="space-y-1.5">
                      {creds.map((c) => (
                        <div key={c.id}>
                          <div className="text-[12.5px] font-bold uppercase leading-[1.2]" style={{ color: TINTA }}>{c.nome}</div>
                          <div className="text-[10.5px] font-medium uppercase" style={{ color: TINTA_3 }}>
                            {c.registro || "SEM REGISTRO"} · {c.tipo === "instrutor_tiro" ? "INSTRUTOR DE TIRO" : "PSICÓLOGO"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ),
                  cred_endereco: (
                    <div className="space-y-1.5 text-[10.5px] font-medium uppercase leading-[1.3]" style={{ color: TINTA_2 }}>
                      {creds.map((c) => (<div key={c.id}>{c.endereco || "—"}</div>))}
                    </div>
                  ),
                  cred_cidade: (
                    <div className="space-y-1.5 text-[10.5px] font-medium uppercase" style={{ color: TINTA_2 }}>
                      {creds.map((c) => (<div key={c.id}>{c.cidade ? `${c.cidade}${c.uf ? ` / ${c.uf}` : ""}` : c.uf || "—"}</div>))}
                    </div>
                  ),
                  cred_telefone: (
                    <div className="space-y-1.5 text-[10.5px] font-medium tabular-nums" style={{ color: TINTA_2 }}>
                      {creds.map((c) => (<div key={c.id}>{c.telefone || "—"}</div>))}
                    </div>
                  ),
                  cred_situacao: (
                    <div className="flex flex-wrap gap-1">
                      {creds.map((c) => (
                        <Chip
                          key={c.id}
                          cor={c.situacao === "pendente" ? VERMELHO : VERDE}
                          fundo={c.situacao === "pendente" ? VERMELHO_BG : VERDE_BG}
                          quebra
                        >
                          {c.situacao}
                        </Chip>
                      ))}
                    </div>
                  ),
                  cliente_nome: (
                    <>
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-[7px] h-2 w-2 shrink-0 rounded-full"
                          style={{ background: corSensor(r.dias_parado) }}
                          title="Sinalizador de movimento"
                        />
                      <Link to={rotaCadastroCliente(r.cliente_id)} className="block min-w-0">
                        <div className="flex min-h-[22px] items-center text-[12.5px] font-bold uppercase break-words leading-[1.2]" style={{ color: TINTA }}>
                          {r.cliente_nome ?? "—"}
                        </div>
                        <div className="mt-[2px] text-[10.5px] font-medium uppercase tracking-wider break-words leading-[1.25]" style={{ color: TINTA_2 }}>
                          {r.servico_nome ?? "—"}
                        </div>
                        {(trilhasEfetivas[r.processo_id] ?? []).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(trilhasEfetivas[r.processo_id] ?? []).map((t) => (
                              <span
                                key={t}
                                className="rounded-full border border-[#DADADA] px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-[0.1em]"
                                style={{ color: TINTA_3 }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </Link>
                      </div>
                    </>
                  ),
                  online: (() => {
                    const e = fmtEntradas(acessos[String(r.cliente_email ?? "").trim().toLowerCase()]);
                    return (
                      <div className="space-y-1">
                        {r.online
                          ? <Chip cor={VERDE} fundo={VERDE_BG} titulo="Acesso nos últimos 15 minutos">ONLINE</Chip>
                          : <Chip cor={VERMELHO} fundo={VERMELHO_BG} titulo="Sem acesso nos últimos 15 minutos">OFFLINE</Chip>}
                        <div className="text-[10.5px] font-medium uppercase tracking-[0.06em]" style={{ color: TINTA_3 }} title="Último acesso · entradas hoje">
                          {fmtAcesso(r.ultimo_acesso)} · {e.hoje} HOJE
                        </div>
                        <div className="text-[10.5px] font-medium uppercase tracking-[0.06em]" style={{ color: TINTA_3 }} title="Total de entradas no portal">
                          · {e.total} NO TOTAL
                        </div>
                      </div>
                    );
                  })(),
                  servico_nome: null,
                  fase: (
                    <>
                      {r.bloqueado_por_prerequisito ? (
                        <Chip cor={VERMELHO} fundo={VERMELHO_BG}><Lock className="h-3 w-3" />AGUARDA ETAPA ANTERIOR</Chip>
                      ) : (
                        <div className="space-y-1">
                          <Chip cor={TINTA} fundo="#F4F4F4">{r.grupo_atual ?? r.fase}</Chip>
                          <LinhaGrupos r={r} />
                          {(r.grupo_total ?? 0) > 0 && (
                            <div className="text-[10.5px] font-medium uppercase tabular-nums" style={{ color: TINTA_2 }}>
                              PASSO {r.grupo_concluidos ?? 0} DE {r.grupo_total} NESTA ETAPA
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ),
                  progresso: (
                    <>
                       <div className="flex min-h-[22px] w-full min-w-0 items-center gap-2">
                        <span className="shrink-0 text-[10.5px] font-medium tabular-nums" style={{ color: TINTA }}>
                          {r.entregues}/{r.total_docs}
                        </span>
                        <div className="min-w-0 flex-1 h-[6px] bg-[#EDEDED] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: corProgresso(pct, r.dias_parado) }} />
                        </div>
                        <span className="shrink-0 w-10 text-[10.5px] font-medium uppercase tabular-nums text-right" style={{ color: TINTA_2 }}>{pct}%</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {pct >= 100 && <Chip cor={VERDE} fundo={VERDE_BG}><CheckCircle2 className="h-3 w-3" />PRONTO</Chip>}
                        {(r.em_analise ?? 0) > 0 && <Chip cor={AMBAR} fundo={AMBAR_BG}><Clock3 className="h-3 w-3" />{r.em_analise} EM ANÁLISE</Chip>}
                        {pendencias > 0 && <Chip miudo cor={VERMELHO} fundo={VERMELHO_BG}><AlertTriangle className="h-3 w-3" />{pendencias} PENDENTE(S)</Chip>}
                        {(r.perguntas_pendentes ?? 0) > 0 && <Chip cor={AMBAR} fundo={AMBAR_BG}><HelpCircle className="h-3 w-3" />{r.perguntas_pendentes} CADASTRO</Chip>}
                        {(r.reaproveitados ?? 0) > 0 && (
                          <Chip miudo cor={TINTA_3} fundo="#F4F4F4" titulo="Documentos aproveitados do histórico do cliente">
                            {r.reaproveitados} REAPROVEITADOS
                          </Chip>
                        )}
                        {(r.dispensados ?? 0) > 0 && (
                          <Chip miudo cor={TINTA_3} fundo="#F4F4F4" titulo="Exigências do caminho que o cliente não seguiu — não se aplicam a este processo">
                            {r.dispensados} NÃO SE APLICA
                          </Chip>
                        )}
                      </div>
                    </>
                  ),
                  proximo_doc: (
                    <span className="flex min-h-[22px] min-w-0 items-center gap-1.5 text-[10.5px] font-medium uppercase" style={{ color: TINTA }}>
                      {r.proximo_tipo === "pergunta" && <HelpCircle className="h-3.5 w-3.5 shrink-0" style={{ color: AMBAR }} />}
                      <span className="min-w-0 flex-1 break-words leading-[1.25]">{r.proximo_doc ?? "—"}</span>
                    </span>
                  ),
                  efetiva: ef
                    ? <Chip cor={ef.cor} fundo={ef.fundo} titulo="Efetiva necessidade" quebra>{ef.label}</Chip>
                    : <span className="flex min-h-[22px] items-center text-[10.5px] font-medium uppercase" style={{ color: TINTA_3 }}>—</span>,
                  protocolo: r.protocolo_numero
                    ? <Chip cor={VERDE} fundo={VERDE_BG} titulo="Protocolo emitido" quebra>{r.protocolo_numero}</Chip>
                    : <span className="flex min-h-[22px] items-center text-left text-[10.5px] font-medium uppercase leading-[1.25]" style={{ color: TINTA_3 }}>SEM PROTOCOLO</span>,
                  criado_em: (
                    <span className="flex min-h-[22px] items-center text-left text-[10.5px] font-medium tabular-nums" style={{ color: TINTA_2 }}>{fmtData(r.criado_em)}</span>
                  ),
                  cobrancas: (
                    <span
                      className="flex min-h-[22px] items-center text-left text-[10.5px] font-medium tabular-nums"
                      style={{ color: (r.cobrancas ?? 0) > 0 ? VERMELHO : TINTA_3 }}
                      title="Cobranças automáticas por inatividade já enviadas (1ª aos 15 dias, depois semanal)"
                    >
                      {r.cobrancas > 0 ? r.cobrancas : "—"}
                    </span>
                  ),
                  dias_parado: (
                    <Chip cor={corSensor(r.dias_parado)} fundo={fundoSensor(r.dias_parado)} titulo="Dias sem movimento">
                      {r.dias_parado}d
                    </Chip>
                  ),
                };
                return (
                  <tr
                    key={r.processo_id}
                    className="border-b border-[#EFEFEF] hover:bg-[#F6F6F6]"
                    style={{ background: i % 2 === 1 ? "#FCFCFC" : "#FFFFFF" }}
                  >
                    {colunas.map((c) => (
                      <td key={c.key} className="border-r border-[#F3F3F3] px-3 py-3 text-left align-top last:border-r-0 [overflow-wrap:anywhere]">
                        {celulas[c.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      <div className="px-4 py-2.5 border-t border-[#E4E4E4] flex flex-wrap items-center gap-3 text-[9.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: TINTA_2 }}>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: VERDE }} />ATÉ 6 DIAS</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: AMBAR }} />7 A 14 DIAS</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: VERMELHO }} />15+ (COBRANÇA SEMANAL AUTOMÁTICA)</span>
      </div>
    </div>
  );
}
