/**
 * FASE 16-D — Painel Operacional de Contratações (vendas).
 *
 * Tela central para a Equipe Operacional acompanhar todas as vendas:
 *   - aguardando validação de valor;
 *   - corrigidas;
 *   - aprovadas (com ou sem processo);
 *   - reprovadas.
 *
 * Reaproveita:
 *   - RPCs de venda (Fase 16-A): qa_venda_aprovar_valor / corrigir_valor / reprovar_valor.
 *   - RPC qa_venda_to_processo (Fase 16-B) via componente GerarProcessoButton (Fase 16-C).
 *   - Eventos imutáveis registrados em qa_venda_eventos.
 *
 * NÃO toca em pagamento, checklist, documentos, arsenal nem qa_crafs.
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Inbox, RefreshCw, Loader2, Search, User, Mail, Phone, Calendar,
  CheckCircle2, XCircle, Edit3, History, ExternalLink, Filter, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { GerarProcessoButton } from "@/components/quero-armas/processos/GerarProcessoButton";

/* ─── Tipos ─── */
type StatusValidacao = "pendente" | "corrigido" | "aprovado" | "reprovado" | string;

interface VendaRow {
  id: number;
  id_legado: number | null;
  cliente_id: number; // legado em qa_vendas
  status: string | null;
  status_validacao_valor: StatusValidacao | null;
  valor_a_pagar: number | string | null;
  valor_informado_cliente: number | string | null;
  valor_aprovado: number | string | null;
  origem_proposta: string | null;
  motivo_correcao: string | null;
  data_cadastro: string | null;
  forma_pagamento: string | null;
}

interface ClienteLite {
  id: number;
  id_legado: number | null;
  nome_completo: string;
  cpf: string | null;
  email: string | null;
  celular: string | null;
}

interface ItemLite {
  venda_id: number;       // id_legado de venda
  servico_id: number;
  servico_nome?: string;
}

interface ProcessoLite {
  id: string;
  venda_id: number | null;
  servico_id: number | null;
  servico_nome: string | null;
}

interface EventoLite {
  id: string;
  venda_id: number;
  tipo_evento: string;
  descricao: string | null;
  ator: string | null;
  created_at: string;
}

/* ─── Filtros ─── */
type FiltroId = "todos" | "aguardando" | "corrigidos" | "aprovados_sem_processo" | "processo_gerado" | "reprovados";
const FILTROS: { id: FiltroId; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "aguardando", label: "Aguardando validação" },
  { id: "corrigidos", label: "Corrigidos" },
  { id: "aprovados_sem_processo", label: "Aprovados sem processo" },
  { id: "processo_gerado", label: "Processo gerado" },
  { id: "reprovados", label: "Reprovados" },
];

function fmtBRL(v: number | string | null | undefined): string {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "—";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseBRLInput(v: string): number {
  const raw = String(v || "").trim().replace(/\s/g, "").replace(/^R\$?/i, "");
  if (!raw) return NaN;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return Number(normalized);
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  try { return new Date(s).toLocaleDateString("pt-BR"); } catch { return s; }
}

function fmtDateTime(s: string | null): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleString("pt-BR"); } catch { return s; }
}

function badgeForStatus(status: StatusValidacao | null, hasProc: boolean) {
  if (status === "aprovado" && hasProc) return { txt: "Processo gerado", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  if (status === "aprovado") return { txt: "Aprovado", cls: "bg-blue-100 text-blue-700 border-blue-200" };
  if (status === "corrigido") return { txt: "Corrigido", cls: "bg-amber-100 text-amber-700 border-amber-200" };
  if (status === "reprovado") return { txt: "Reprovado", cls: "bg-red-100 text-red-700 border-red-200" };
  return { txt: "Aguardando", cls: "bg-slate-100 text-slate-600 border-slate-200" };
}

function digitsOnly(v: string): string { return (v || "").replace(/\D/g, ""); }

/* ─── Modais ─── */

interface AprovarModalProps {
  open: boolean; onClose: () => void; venda: VendaRow | null; onDone: () => void;
}
function AprovarModal({ open, onClose, venda, onDone }: AprovarModalProps) {
  const [submitting, setSubmitting] = useState(false);
  if (!venda) return null;
  const valor = Number(venda.valor_aprovado ?? venda.valor_informado_cliente ?? venda.valor_a_pagar ?? 0);

  const handle = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("qa_venda_aprovar_valor" as any, { p_venda_id: venda.id });
      if (error) throw error;
      toast.success(`Valor aprovado para venda #${venda.id_legado ?? venda.id}`);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao aprovar valor");
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && !o && onClose()}>
      <DialogContent className="max-w-md bg-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-800 text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Aprovar valor
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2 text-[12px]">
          <p className="text-slate-700">
            Confirmar aprovação do valor <b className="text-emerald-700 font-mono">{fmtBRL(valor)}</b> para a venda <b>#{venda.id_legado ?? venda.id}</b>?
          </p>
          <p className="text-slate-500 text-[11px]">
            Após aprovação, será possível gerar o processo operacional. O pagamento continua manual.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}
              className="h-10 text-xs rounded-md text-slate-600 hover:text-slate-800">Cancelar</Button>
            <Button type="button" onClick={handle} disabled={submitting}
              className="h-10 text-xs rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-60">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
              Aprovar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CorrigirModalProps {
  open: boolean; onClose: () => void; venda: VendaRow | null; onDone: () => void;
}
function CorrigirModal({ open, onClose, venda, onDone }: CorrigirModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const motivoPadrao = "CORREÇÃO OPERACIONAL DE VALOR";

  useEffect(() => {
    if (open && venda) {
      setValor(String(venda.valor_aprovado ?? venda.valor_informado_cliente ?? venda.valor_a_pagar ?? ""));
      setMotivo(motivoPadrao);
    }
  }, [open, venda]);

  if (!venda) return null;

  const handle = async () => {
    if (submitting) return;
    const num = parseBRLInput(valor);
    if (!Number.isFinite(num) || num <= 0) { toast.error("Valor inválido"); return; }
    const motivoFinal = motivo.trim() || motivoPadrao;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("qa_venda_corrigir_valor" as any, {
        p_venda_id: venda.id,
        p_valor_corrigido: num,
        p_motivo: motivoFinal,
      });
      if (error) throw error;
      toast.success(`Valor corrigido para venda #${venda.id_legado ?? venda.id}`);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao corrigir valor");
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && !o && onClose()}>
      <DialogContent className="max-w-md bg-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-800 text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-amber-600" /> Corrigir valor
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1 block">Novo valor (R$) *</label>
            <Input type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
              className="h-9 text-sm bg-slate-50 border-slate-200 text-slate-800 rounded-md font-mono" disabled={submitting} />
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1 block">Motivo da correção *</label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
              className="text-sm bg-slate-50 border-slate-200 text-slate-800 rounded-md"
              placeholder="Ex.: ajuste por taxa cartorial / inclusão de exame psicológico"
              disabled={submitting} />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}
              className="h-10 text-xs rounded-md text-slate-600 hover:text-slate-800">Cancelar</Button>
            <Button type="button" onClick={handle} disabled={submitting || !valor.trim()}
              className="h-10 text-xs rounded-md bg-amber-600 hover:bg-amber-700 text-white shadow-sm disabled:opacity-60">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Edit3 className="h-3.5 w-3.5 mr-1.5" />}
              Salvar correção
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ReprovarModalProps {
  open: boolean; onClose: () => void; venda: VendaRow | null; onDone: () => void;
}
function ReprovarModal({ open, onClose, venda, onDone }: ReprovarModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [motivo, setMotivo] = useState("");

  useEffect(() => { if (open) setMotivo(""); }, [open]);
  if (!venda) return null;

  const handle = async () => {
    if (submitting) return;
    if (!motivo.trim()) { toast.error("Motivo da reprovação é obrigatório"); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("qa_venda_reprovar_valor" as any, {
        p_venda_id: venda.id,
        p_motivo: motivo.trim(),
      });
      if (error) throw error;
      toast.success(`Venda #${venda.id_legado ?? venda.id} reprovada`);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao reprovar valor");
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && !o && onClose()}>
      <DialogContent className="max-w-md bg-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-800 text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-600" /> Reprovar valor
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <p className="text-[12px] text-slate-700">
            Reprovar a venda <b>#{venda.id_legado ?? venda.id}</b>? Essa ação fica registrada no histórico.
          </p>
          <div>
            <label className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1 block">Motivo da reprovação *</label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
              className="text-sm bg-slate-50 border-slate-200 text-slate-800 rounded-md"
              placeholder="Explique o motivo (será exibido no histórico)" disabled={submitting} />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}
              className="h-10 text-xs rounded-md text-slate-600 hover:text-slate-800">Cancelar</Button>
            <Button type="button" onClick={handle} disabled={submitting || !motivo.trim()}
              className="h-10 text-xs rounded-md bg-red-600 hover:bg-red-700 text-white shadow-sm disabled:opacity-60">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <XCircle className="h-3.5 w-3.5 mr-1.5" />}
              Reprovar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Histórico ─── */
function HistoricoModal({ open, onClose, vendaId, eventos }: {
  open: boolean; onClose: () => void; vendaId: number | null; eventos: EventoLite[];
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-800 text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <History className="h-4 w-4 text-slate-600" /> Histórico — Venda #{vendaId ?? "—"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {eventos.length === 0 ? (
            <p className="text-[12px] text-slate-500 italic">Nenhum evento registrado.</p>
          ) : eventos.map((e) => (
            <div key={e.id} className="border border-slate-200 rounded-md p-2 bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">{e.tipo_evento}</span>
                <span className="text-[10px] text-slate-400">{fmtDateTime(e.created_at)}</span>
              </div>
              {e.descricao && <p className="text-[11px] text-slate-700 mt-1">{e.descricao}</p>}
              {e.ator && <p className="text-[10px] text-slate-400 mt-0.5">por {e.ator}</p>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Página principal ─── */
export default function QAVendasPendentesPage() {
  const [loading, setLoading] = useState(true);
  const [vendas, setVendas] = useState<VendaRow[]>([]);
  const [clientes, setClientes] = useState<Map<number, ClienteLite>>(new Map());
  const [itens, setItens] = useState<ItemLite[]>([]);
  const [processos, setProcessos] = useState<ProcessoLite[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [filtro, setFiltro] = useState<FiltroId>("aguardando");
  const [busca, setBusca] = useState("");

  const [aprovarVenda, setAprovarVenda] = useState<VendaRow | null>(null);
  const [corrigirVenda, setCorrigirVenda] = useState<VendaRow | null>(null);
  const [reprovarVenda, setReprovarVenda] = useState<VendaRow | null>(null);
  const [historicoVenda, setHistoricoVenda] = useState<VendaRow | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Vendas — últimos 90 dias OU sem aprovação ainda. Limitamos a 300 p/ performance.
      const { data: vRes, error: vErr } = await supabase
        .from("qa_vendas" as any)
        .select("id, id_legado, cliente_id, status, status_validacao_valor, valor_a_pagar, valor_informado_cliente, valor_aprovado, origem_proposta, motivo_correcao, data_cadastro, forma_pagamento")
        .order("data_cadastro", { ascending: false, nullsFirst: false })
        .limit(300);
      if (vErr) throw vErr;
      const vendasData = ((vRes as any[]) ?? []) as VendaRow[];
      setVendas(vendasData);

      // 2) Clientes — buscar pelo id_legado (qa_vendas.cliente_id usa legado).
      const legadoIds = Array.from(new Set(vendasData.map((v) => v.cliente_id).filter((n) => Number.isFinite(n))));
      let clientesMap = new Map<number, ClienteLite>();
      if (legadoIds.length > 0) {
        const { data: cRes } = await supabase
          .from("qa_clientes" as any)
          .select("id, id_legado, nome_completo, cpf, email, celular")
          .in("id_legado", legadoIds);
        ((cRes as any[]) ?? []).forEach((c: ClienteLite) => {
          if (typeof c.id_legado === "number") clientesMap.set(c.id_legado, c);
        });
      }
      setClientes(clientesMap);

      // 3) Itens — venda_id = qa_vendas.id_legado.
      const vendaLegadoIds = vendasData.map((v) => v.id_legado).filter((n): n is number => typeof n === "number");
      let itensData: ItemLite[] = [];
      if (vendaLegadoIds.length > 0) {
        const { data: iRes } = await supabase
          .from("qa_itens_venda" as any)
          .select("venda_id, servico_id")
          .in("venda_id", vendaLegadoIds);
        itensData = ((iRes as any[]) ?? []) as ItemLite[];
        // Resolver nome do serviço
        const sids = Array.from(new Set(itensData.map((i) => i.servico_id))).filter((n) => Number.isFinite(n));
        if (sids.length > 0) {
          const { data: sRes } = await supabase
            .from("qa_servicos" as any)
            .select("id, nome_servico")
            .in("id", sids);
          const sMap = new Map<number, string>(((sRes as any[]) ?? []).map((s: any) => [Number(s.id), s.nome_servico]));
          itensData.forEach((i) => { i.servico_nome = sMap.get(i.servico_id); });
        }
      }
      setItens(itensData);

      // 4) Processos vinculados — venda_id = qa_vendas.id real (Fase 16-B).
      const vendaRealIds = vendasData.map((v) => Number(v.id)).filter((n) => Number.isFinite(n));
      let procData: ProcessoLite[] = [];
      if (vendaRealIds.length > 0) {
        const { data: pRes } = await supabase
          .from("qa_processos" as any)
          .select("id, venda_id, servico_id, servico_nome")
          .in("venda_id", vendaRealIds);
        procData = ((pRes as any[]) ?? []) as ProcessoLite[];
      }
      setProcessos(procData);

      // 5) Eventos — últimos 200 das vendas listadas.
      let evData: EventoLite[] = [];
      if (vendaRealIds.length > 0) {
        const { data: eRes } = await supabase
          .from("qa_venda_eventos" as any)
          .select("id, venda_id, tipo_evento, descricao, ator, created_at")
          .in("venda_id", vendaRealIds)
          .order("created_at", { ascending: false })
          .limit(500);
        evData = ((eRes as any[]) ?? []) as EventoLite[];
      }
      setEventos(evData);
    } catch (e: any) {
      console.error("[QAVendasPendentes] carregar:", e);
      toast.error("Erro ao carregar contratações: " + (e?.message ?? "desconhecido"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // ─── Derivados ───
  const procByVenda = useMemo(() => {
    const m = new Map<number, ProcessoLite>();
    processos.forEach((p) => { if (p.venda_id != null) m.set(p.venda_id, p); });
    return m;
  }, [processos]);

  const itensByVenda = useMemo(() => {
    const m = new Map<number, ItemLite[]>();
    itens.forEach((i) => {
      const arr = m.get(i.venda_id) || [];
      arr.push(i);
      m.set(i.venda_id, arr);
    });
    return m;
  }, [itens]);

  const eventosByVenda = useMemo(() => {
    const m = new Map<number, EventoLite[]>();
    eventos.forEach((e) => {
      const arr = m.get(e.venda_id) || [];
      arr.push(e);
      m.set(e.venda_id, arr);
    });
    return m;
  }, [eventos]);

  const filtradas = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    const buscaDigits = digitsOnly(busca);
    return vendas.filter((v) => {
      const status = v.status_validacao_valor || "pendente";
      const proc = procByVenda.get(v.id);
      // Filtro por categoria
      if (filtro !== "todos") {
        if (filtro === "aguardando" && !(status === "pendente" || status == null)) return false;
        if (filtro === "corrigidos" && status !== "corrigido") return false;
        if (filtro === "aprovados_sem_processo" && !(status === "aprovado" && !proc)) return false;
        if (filtro === "processo_gerado" && !proc) return false;
        if (filtro === "reprovados" && status !== "reprovado") return false;
      }
      // Busca textual
      if (buscaNorm) {
        const cli = clientes.get(v.cliente_id);
        const its = itensByVenda.get(v.id_legado ?? -1) || [];
        const haystack = [
          String(v.id_legado ?? v.id),
          cli?.nome_completo,
          cli?.email,
          cli?.cpf ? digitsOnly(cli.cpf) : "",
          ...its.map((i) => i.servico_nome || ""),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(buscaNorm) && !(buscaDigits && haystack.includes(buscaDigits))) return false;
      }
      return true;
    });
  }, [vendas, filtro, busca, procByVenda, clientes, itensByVenda]);

  // Contadores por filtro
  const counts = useMemo(() => {
    const c = { todos: 0, aguardando: 0, corrigidos: 0, aprovados_sem_processo: 0, processo_gerado: 0, reprovados: 0 };
    vendas.forEach((v) => {
      c.todos++;
      const st = v.status_validacao_valor || "pendente";
      const proc = procByVenda.get(v.id);
      if (st === "pendente" || st == null) c.aguardando++;
      if (st === "corrigido") c.corrigidos++;
      if (st === "aprovado" && !proc) c.aprovados_sem_processo++;
      if (proc) c.processo_gerado++;
      if (st === "reprovado") c.reprovados++;
    });
    return c;
  }, [vendas, procByVenda]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500">
            EQUIPE · QUERO ARMAS
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 uppercase tracking-tight mt-0.5">
            Contratações
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Vendas aguardando validação, aprovação, correção e geração de processo.
          </p>
        </div>
        <button onClick={carregar}
          className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white text-[11px] uppercase tracking-wider font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-3">
        {FILTROS.map((f) => {
          const n = (counts as any)[f.id] as number;
          const active = filtro === f.id;
          return (
            <button key={f.id} onClick={() => setFiltro(f.id)}
              className={`h-8 px-3 inline-flex items-center gap-1.5 rounded-full text-[11px] uppercase tracking-wider font-bold border transition ${
                active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}>
              {f.label}
              <span className={`px-1.5 py-0.5 rounded text-[9px] ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Busca */}
      <div className="relative mb-4">
        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, CPF, e-mail, venda nº ou serviço…"
          className="pl-9 h-10 text-sm bg-white border-slate-200 text-slate-800 rounded-md" />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="h-6 w-6 mx-auto text-slate-400 animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Inbox className="h-10 w-10 mx-auto text-slate-300 mb-3" />
          <div className="text-sm font-bold text-slate-700 uppercase">Nenhuma venda no filtro</div>
          <div className="text-xs text-slate-500 mt-1">Ajuste o filtro ou a busca para ver resultados.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map((v) => {
            const cli = clientes.get(v.cliente_id);
            const proc = procByVenda.get(v.id) || null;
            const its = itensByVenda.get(v.id_legado ?? -1) || [];
            const status = v.status_validacao_valor || "pendente";
            const badge = badgeForStatus(status, !!proc);
            const evVenda = eventosByVenda.get(v.id) || [];

            // Possível duplicidade: mesmo cliente + mesmo serviço + outra venda já com processo
            const itemSids = new Set(its.map((i) => i.servico_id));
            const possivelDuplicidade = vendas.some((v2) => {
              if (v2.id === v.id) return false;
              if (v2.cliente_id !== v.cliente_id) return false;
              const its2 = itensByVenda.get(v2.id_legado ?? -1) || [];
              return its2.some((i2) => itemSids.has(i2.servico_id));
            });

            return (
              <div key={v.id} className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Linha 1: badge + venda + data */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badge.cls}`}>{badge.txt}</span>
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Venda #{v.id_legado ?? v.id}</span>
                      <span className="text-[10px] text-slate-400 inline-flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" /> {fmtDate(v.data_cadastro)}
                      </span>
                      {v.origem_proposta && (
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                          origem: {v.origem_proposta}
                        </span>
                      )}
                      {possivelDuplicidade && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200 inline-flex items-center gap-1">
                          <AlertTriangle className="h-2.5 w-2.5" /> Possível duplicidade
                        </span>
                      )}
                    </div>

                    {/* Cliente */}
                    <div className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-0.5 text-[12px] text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-slate-400" />
                        <span className="font-bold uppercase">{cli?.nome_completo || `Cliente legado #${v.cliente_id}`}</span>
                      </div>
                      {cli?.cpf && <div className="text-slate-500">CPF {cli.cpf}</div>}
                      {cli?.email && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                          <a href={`mailto:${cli.email}`} className="text-blue-700 hover:underline truncate">{cli.email}</a>
                        </div>
                      )}
                      {cli?.celular && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <a href={`https://wa.me/${digitsOnly(cli.celular)}`} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">{cli.celular}</a>
                        </div>
                      )}
                    </div>

                    {/* Serviços */}
                    {its.length > 0 && (
                      <div className="mt-2 text-[11px] text-slate-600">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 mr-1">Serviços:</span>
                        {its.map((i, idx) => (
                          <span key={idx} className="inline-block mr-1.5">
                            {i.servico_nome || `#${i.servico_id}`}
                            {idx < its.length - 1 ? "," : ""}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Valores */}
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Informado</div>
                        <div className="font-mono text-slate-700">{fmtBRL(v.valor_informado_cliente)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Aprovado</div>
                        <div className="font-mono text-emerald-700 font-bold">{fmtBRL(v.valor_aprovado)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Status legado</div>
                        <div className="text-slate-700">{v.status || "—"}</div>
                      </div>
                    </div>

                    {v.motivo_correcao && (
                      <div className="mt-2 text-[11px] text-amber-700 italic">
                        <b>Motivo correção:</b> {v.motivo_correcao}
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex md:flex-col items-stretch gap-1.5 md:min-w-[180px]">
                    {(status === "pendente" || status == null || status === "corrigido") && (
                      <>
                        <Button onClick={() => setAprovarVenda(v)}
                          className="h-8 text-[10px] rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar valor
                        </Button>
                        <Button onClick={() => setCorrigirVenda(v)} variant="outline"
                          className="h-8 text-[10px] rounded-md border-amber-300 text-amber-700 hover:bg-amber-50">
                          <Edit3 className="h-3 w-3 mr-1" /> Corrigir
                        </Button>
                        <Button onClick={() => setReprovarVenda(v)} variant="outline"
                          className="h-8 text-[10px] rounded-md border-red-200 text-red-600 hover:bg-red-50">
                          <XCircle className="h-3 w-3 mr-1" /> Reprovar
                        </Button>
                      </>
                    )}

                    {status === "aprovado" && (
                      <div className="flex items-center gap-1">
                        <GerarProcessoButton
                          venda={v as any}
                          itens={its as any}
                          clienteNome={cli?.nome_completo || null}
                          processoExistente={proc as any}
                          onCreated={carregar}
                        />
                      </div>
                    )}

                    {status === "reprovado" && v.motivo_correcao && (
                      <div className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded p-1.5">
                        <b>Motivo:</b> {v.motivo_correcao}
                      </div>
                    )}

                    <Button onClick={() => setHistoricoVenda(v)} variant="ghost"
                      className="h-7 text-[10px] rounded-md text-slate-500 hover:text-slate-800">
                      <History className="h-3 w-3 mr-1" /> Histórico ({evVenda.length})
                    </Button>
                    {cli && (
                      <Link to={`/clientes?cliente=${cli.id}`}
                        className="h-7 px-2 text-[10px] rounded-md inline-flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50">
                        <ExternalLink className="h-3 w-3 mr-1" /> Abrir cliente
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AprovarModal open={!!aprovarVenda} venda={aprovarVenda} onClose={() => setAprovarVenda(null)} onDone={carregar} />
      <CorrigirModal open={!!corrigirVenda} venda={corrigirVenda} onClose={() => setCorrigirVenda(null)} onDone={carregar} />
      <ReprovarModal open={!!reprovarVenda} venda={reprovarVenda} onClose={() => setReprovarVenda(null)} onDone={carregar} />
      <HistoricoModal open={!!historicoVenda}
        vendaId={historicoVenda?.id_legado ?? historicoVenda?.id ?? null}
        eventos={historicoVenda ? (eventosByVenda.get(historicoVenda.id) || []) : []}
        onClose={() => setHistoricoVenda(null)} />
    </div>
  );
}