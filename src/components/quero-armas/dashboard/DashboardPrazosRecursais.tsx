/**
 * Dashboard — Prazos Recursais (PF: Posse, Porte e CRAF)
 *
 * Trigger: item com data_notificacao OU data_indeferimento preenchida E
 * serviço sendo Posse PF (id=2), Porte PF (id=3) ou CRAF PF (id=26).
 * Janela: D = data mais recente entre notificação/indeferimento; prazo = D+10
 * (Lei 9.784/99 art. 59 + Decreto 9.847/19 art. 10).
 * Vencidos NÃO aparecem (filtra diasRestantes >= 0).
 * Cores por dias restantes: 🟢 8–10 · 🟡 5–7 · 🔴 0–4.
 *
 * FKs em produção:
 *   - qa_itens_venda.venda_id  → qa_vendas.id_legado
 *   - qa_vendas.cliente_id     → qa_clientes.id_legado
 *
 * Layout: grid de até 9 cards pequenos (mais antigo → mais novo). 10º card "+N".
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, Copy } from "lucide-react";
import { useWidgetLoader } from "@/hooks/useWidgetLoader";
import WidgetStateView from "./WidgetStateView";
import { loadQADashboardSnapshot } from "./dashboardSnapshot";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ItemRow {
  id: number;
  venda_id: number;            // → qa_vendas.id_legado
  servico_id: number | null;
  status: string | null;
  data_indeferimento: string | null;
  data_notificacao: string | null;
  data_recurso_administrativo: string | null;
  numero_processo: string | null;
  numero_requerimento: string | null;
  numero_posse: string | null;
  numero_porte: string | null;
  numero_craf: string | null;
}
interface VendaRow { id: number; id_legado: number | null; cliente_id: number | null; }
interface ClienteRow { id: number; id_legado: number | null; nome_completo: string | null; cpf: string | null; }

interface PrazoRow {
  itemId: number;
  clienteIdLegado: number | null;
  clienteId: number | null;
  clienteNome: string;
  cpf: string | null;
  cadastroCrId: number | null;
  protocolo: string | null;
  tipo: "Posse" | "Porte" | "CRAF";
  /** Tipo do evento que disparou a contagem (NOTIFICAÇÃO ou INDEFERIMENTO). */
  evento: "NOTIFICAÇÃO" | "INDEFERIMENTO";
  /** Status atual do serviço (ex.: "RECURSO ADMINISTRATIVO", "INDEFERIDO"). */
  status: string | null;
  dataEvento: string;
  dataLimite: string;
  diasRestantes: number;
}

const MAX_CARDS = 9; // 9 cards individuais + 1 card "+N"
// IDs dos serviços PF que disparam prazo recursal
const SERVICOS_PF_RECURSO: Record<number, "Posse" | "Porte" | "CRAF"> = {
  2: "Posse",   // Posse na Polícia Federal
  3: "Porte",   // Porte na Polícia Federal
  26: "CRAF",   // CRAF na Polícia Federal
};

// Hoje no fuso local (evita drift UTC que joga o dia para trás em BRT/-03)
const todayISO = () => {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
// Diferença em dias usando UTC puro nas duas pontas (sem efeito de timezone)
const diffDays = (a: string, b: string) => {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const aUTC = Date.UTC(ay, am - 1, ad);
  const bUTC = Date.UTC(by, bm - 1, bd);
  return Math.round((bUTC - aUTC) / 86_400_000);
};
const addDaysISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

function toneFor(dias: number) {
  // dias = dias restantes até o limite (D+10). Sempre 0..10 aqui (vencidos já filtrados).
  if (dias <= 4) return { dot: "bg-rose-600",    text: "text-rose-700",    border: "border-rose-200",    bg: "bg-rose-50",    label: "CRÍTICO" };
  if (dias <= 7) return { dot: "bg-amber-500",   text: "text-amber-700",   border: "border-amber-200",   bg: "bg-amber-50",   label: "ATENÇÃO" };
  return            { dot: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200", bg: "bg-white",     label: "EM PRAZO" };
}

export default function DashboardPrazosRecursais() {
  const { state, data, reload } = useWidgetLoader<PrazoRow[]>(async (signal) => {
    const snapshot = await loadQADashboardSnapshot(signal);
    const servicoIdsPF = Object.keys(SERVICOS_PF_RECURSO).map(Number);
    const itensList = snapshot.itens.filter(
      (item) =>
        (item.data_indeferimento || item.data_notificacao) &&
        item.servico_id != null &&
        servicoIdsPF.includes(item.servico_id)
    ) as ItemRow[];
    if (!itensList.length) return [];

    const vendaLegadoIds = Array.from(new Set(itensList.map(i => i.venda_id)));
    const vendas = snapshot.vendas.filter((venda) => venda.id_legado != null && vendaLegadoIds.includes(venda.id_legado)) as VendaRow[];
    const clienteLegadoIds = Array.from(new Set(vendas.map(v => v.cliente_id).filter(Boolean) as number[]));
    const clientes = snapshot.clientes.filter(
      (cliente) => cliente.id_legado != null && clienteLegadoIds.includes(cliente.id_legado)
    ) as ClienteRow[];

    const vMap = new Map(vendas.map(v => [v.id_legado, v]));
    const cMap = new Map(clientes.map(c => [c.id_legado, c]));

    // Mapa cliente_id -> cadastro_cr.id (para revelação on-demand via edge function)
    const clienteInternalIds = clientes.map(c => c.id);
    const cadastroMap = new Map<number, number>();
    if (clienteInternalIds.length) {
      const { data: crRows } = await supabase
        .from("qa_cadastro_cr" as any)
        .select("id, cliente_id")
        .in("cliente_id", clienteInternalIds as any);
      for (const row of (crRows as any[] | null) || []) {
        if (row?.cliente_id && row?.id && !cadastroMap.has(row.cliente_id)) {
          cadastroMap.set(row.cliente_id, Number(row.id));
        }
      }
    }

    const today = todayISO();
    const built: PrazoRow[] = [];
    for (const it of itensList) {
      const tipo = it.servico_id ? SERVICOS_PF_RECURSO[it.servico_id] : null;
      if (!tipo) continue;
      const venda = vMap.get(it.venda_id);
      const cliente = venda?.cliente_id != null ? cMap.get(venda.cliente_id) : null;
      if (!cliente) continue;
      // Usa a data mais recente entre Notificação e Indeferimento como gatilho
      // do prazo recursal — assim o card reflete a janela ativa.
      const dNotif = it.data_notificacao || null;
      const dIndef = it.data_indeferimento || null;
      let dEvento: string | null = null;
      let evento: "NOTIFICAÇÃO" | "INDEFERIMENTO" = "INDEFERIMENTO";
      if (dNotif && dIndef) {
        if (dNotif >= dIndef) { dEvento = dNotif; evento = "NOTIFICAÇÃO"; }
        else { dEvento = dIndef; evento = "INDEFERIMENTO"; }
      } else if (dNotif) {
        dEvento = dNotif; evento = "NOTIFICAÇÃO";
      } else if (dIndef) {
        dEvento = dIndef; evento = "INDEFERIMENTO";
      }
      if (!dEvento) continue;
      const dLimite = addDaysISO(dEvento, 10);
      const diasRestantes = diffDays(today, dLimite);
      if (diasRestantes < 0 || diasRestantes > 10) continue;
      built.push({
        itemId: it.id,
        clienteIdLegado: cliente.id_legado ?? null,
        clienteId: cliente.id ?? null,
        clienteNome: cliente.nome_completo || `Cliente #${cliente.id}`,
        cpf: cliente.cpf ?? null,
        cadastroCrId: cliente.id != null ? cadastroMap.get(cliente.id) ?? null : null,
        protocolo:
          (it.servico_id === 2
            ? it.numero_posse
            : it.servico_id === 3
              ? it.numero_requerimento
              : it.servico_id === 26
                ? it.numero_craf
                : it.numero_processo) ??
          it.numero_processo ??
          it.numero_requerimento ??
          it.numero_posse ??
          it.numero_porte ??
          it.numero_craf ??
          null,
        tipo,
        evento,
        status: it.status ?? null,
        dataEvento: dEvento,
        dataLimite: dLimite,
        diasRestantes,
      });
    }
    built.sort((a, b) => a.diasRestantes - b.diasRestantes);
    return built;
  }, [], { timeoutMs: 6000 });

  const rows = data ?? [];
  const visible = useMemo(() => rows.slice(0, MAX_CARDS), [rows]);
  const overflow = useMemo(() => rows.slice(MAX_CARDS), [rows]);

  if (state === "loading") {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Prazos Processuais — 10 Dias · Lei 9.784/99 (PF)</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Carregando…</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-center shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (state === "error" || state === "timeout") {
    return (
      <WidgetStateView
        title="Prazos Processuais — 10 Dias · Lei 9.784/99 (PF)"
        state={state}
        onRetry={reload}
      />
    );
  }

  if (!rows.length) return null;

  return (
    <div className="space-y-4">
      {/* Header — mesmo padrão do Monitoramento de Exames */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
          Prazos Processuais — 10 Dias · Lei 9.784/99 (PF)
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {rows.length} cliente(s) em prazo legal de manifestação · ordenado do mais antigo ao mais novo
        </p>
      </div>

      {/* Grid de cards pequenos — 2/3/5 colunas */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-slate-100">
          {visible.map(r => {
            const tone = toneFor(r.diasRestantes);
            const link = r.clienteIdLegado
              ? `/clientes?cliente=${r.clienteIdLegado}`
              : `/clientes`;
            const [ly, lm, ld] = r.dataLimite.split("-");
            const dataLimiteBr = `${ld}/${lm}/${ly}`;
            const cpfFmt = r.cpf ? r.cpf.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : null;
            const handleCopy = (e: React.MouseEvent, label: string, value: string | null | undefined) => {
              e.preventDefault();
              e.stopPropagation();
              if (!value) {
                toast.error(`${label} indisponível`);
                return;
              }
              navigator.clipboard.writeText(value).then(
                () => toast.success(`${label} copiado`),
                () => toast.error(`Falha ao copiar ${label}`)
              );
            };
            return (
              <Link
                key={r.itemId}
                to={link}
                title={`${r.clienteNome} — ${r.tipo} PF · ${r.evento} · prazo fatal ${dataLimiteBr}`}
                className={`group flex flex-col gap-1.5 px-3 py-3 ${tone.bg} hover:bg-slate-50 transition-colors min-h-[88px]`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${tone.dot} shrink-0`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${tone.text}`}>
                    {tone.label}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-slate-900 leading-tight line-clamp-2 group-hover:text-blue-700 group-hover:underline uppercase">
                  {r.clienteNome}
                </div>
                <div className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500 leading-none">
                  {r.tipo} PF · {r.evento}
                </div>
                {r.status && (
                  <div className="text-[8.5px] font-bold uppercase tracking-wider text-blue-700 leading-none truncate">
                    Status: {r.status}
                  </div>
                )}
                <div className="flex flex-col gap-0.5 -mx-1">
                  <button
                    type="button"
                    onClick={(e) => handleCopy(e, "Protocolo", r.protocolo)}
                    className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-200/60 text-[9px] font-mono text-slate-700 truncate"
                    title={r.protocolo ? `Copiar protocolo: ${r.protocolo}` : "Sem protocolo"}
                  >
                    <Copy className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                    <span className="truncate">PROT: {r.protocolo || "—"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleCopy(e, "CPF", cpfFmt)}
                    className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-200/60 text-[9px] font-mono text-slate-700 truncate"
                    title={cpfFmt ? `Copiar CPF: ${cpfFmt}` : "Sem CPF"}
                  >
                    <Copy className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                    <span className="truncate">CPF: {cpfFmt || "—"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleCopy(e, "Senha Gov", r.senhaGov)}
                    className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-200/60 text-[9px] font-mono text-slate-700 truncate"
                    title={r.senhaGov ? "Copiar Senha Gov" : "Sem senha gov"}
                  >
                    <Copy className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                    <span className="truncate">GOV: {r.senhaGov || "—"}</span>
                  </button>
                </div>
                <div className="mt-auto flex items-baseline gap-1">
                  <span className={`text-xl font-black leading-none ${tone.text}`}>{r.diasRestantes}</span>
                  <span className={`text-[9px] font-bold uppercase ${tone.text}`}>d. restantes</span>
                </div>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-rose-600 leading-none">
                  Fatal: {dataLimiteBr}
                </div>
              </Link>
            );
          })}

          {/* 10º card = agregador "+N" */}
          {overflow.length > 0 && (
            <div
              className="flex flex-col items-center justify-center gap-1 px-3 py-3 bg-slate-50 min-h-[88px]"
              title={overflow.map(o => `${o.clienteNome} (${o.diasRestantes}d)`).join(" · ")}
            >
              <Plus className="h-4 w-4 text-slate-500" />
              <span className="text-2xl font-black text-slate-700 leading-none">+{overflow.length}</span>
              <span className="text-[9px] font-bold uppercase text-slate-500 text-center">
                outros em prazo
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
