/**
 * Auditoria de Recursos Administrativos
 *
 * Classifica cada item indeferido em uma das categorias:
 *   • REVERTIDO        → entrou em recurso e foi DEFERIDO posteriormente
 *   • PERDIDO          → entrou em recurso e foi novamente INDEFERIDO (data_indeferimento_recurso)
 *   • PRAZO EXPIRADO   → entrou em recurso, sem decisão, mas se passaram > 10 dias
 *   • EM CURSO         → recurso protocolado, dentro do prazo de 10 dias
 *   • NÃO APROVEITADO  → indeferido SEM recurso protocolado (oportunidade perdida)
 *
 * Fonte: qa_itens_venda (datas de indeferimento, recurso, deferimento, indeferimento_recurso).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CheckCircle2, XCircle, Clock, AlertTriangle, FileWarning, Download } from "lucide-react";

type Categoria = "REVERTIDO" | "PERDIDO" | "PRAZO_EXPIRADO" | "EM_CURSO" | "NAO_APROVEITADO";

interface Linha {
  itemId: number;
  vendaId: number;
  clienteNome: string;
  clienteIdLegado: number | null;
  servicoNome: string;
  status: string;
  dataIndeferimento: string | null;
  dataRecurso: string | null;
  dataIndefRecurso: string | null;
  dataDeferimento: string | null;
  diasParaRecorrer: number | null; // dias entre indeferimento e recurso
  diasSemDecisao: number | null;   // dias decorridos desde recurso sem decisão
  categoria: Categoria;
}

const CAT_META: Record<Categoria, { label: string; tone: string; icon: any; desc: string }> = {
  REVERTIDO:       { label: "Revertido (Deferido)", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2, desc: "Recurso teve êxito" },
  PERDIDO:         { label: "Perdido",              tone: "bg-rose-50 text-rose-700 border-rose-200",          icon: XCircle,      desc: "Recurso indeferido" },
  PRAZO_EXPIRADO:  { label: "Prazo Expirado",       tone: "bg-amber-50 text-amber-800 border-amber-200",       icon: AlertTriangle,desc: "Sem decisão após 10 dias úteis" },
  EM_CURSO:        { label: "Em Curso",             tone: "bg-blue-50 text-blue-700 border-blue-200",          icon: Clock,        desc: "Dentro do prazo de 10 dias" },
  NAO_APROVEITADO: { label: "Não Aproveitado",      tone: "bg-zinc-100 text-zinc-700 border-zinc-300",         icon: FileWarning,  desc: "Indeferido sem recurso" },
};

function diffDays(fromISO: string | null): number | null {
  if (!fromISO) return null;
  const a = new Date(fromISO + (fromISO.length === 10 ? "T00:00:00" : ""));
  const b = new Date();
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86_400_000));
}
function diffBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const da = new Date(a + (a.length === 10 ? "T00:00:00" : ""));
  const db = new Date(b + (b.length === 10 ? "T00:00:00" : ""));
  return Math.floor((db.getTime() - da.getTime()) / 86_400_000);
}
function fmtBR(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : "—";
}

function classify(it: any): Categoria | null {
  const indef = it.data_indeferimento as string | null;
  const recurso = it.data_recurso_administrativo as string | null;
  const indefRec = it.data_indeferimento_recurso as string | null;
  const defer = it.data_deferimento as string | null;
  const status = (it.status || "").toUpperCase();

  // Só entra no relatório quem teve indeferimento OU está marcado como indeferido/recurso
  if (!indef && !recurso && !["INDEFERIDO", "RECURSO ADMINISTRATIVO"].includes(status)) return null;

  if (recurso && defer) return "REVERTIDO";
  if (recurso && indefRec) return "PERDIDO";
  if (recurso) {
    const dias = diffDays(recurso) ?? 0;
    return dias > 10 ? "PRAZO_EXPIRADO" : "EM_CURSO";
  }
  // Indeferido sem recurso → oportunidade perdida
  if (indef || status === "INDEFERIDO") return "NAO_APROVEITADO";
  return null;
}

export default function QARecursosAuditoriaPage() {
  const [loading, setLoading] = useState(true);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [filtro, setFiltro] = useState<Categoria | "TODOS">("TODOS");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: itens, error } = await supabase
          .from("qa_itens_venda" as any)
          .select("id, venda_id, servico_id, status, data_indeferimento, data_recurso_administrativo, data_indeferimento_recurso, data_deferimento")
          .or("data_indeferimento.not.is.null,data_recurso_administrativo.not.is.null,status.eq.INDEFERIDO,status.eq.RECURSO ADMINISTRATIVO");
        if (error) throw error;

        const list = (itens as any[]) || [];
        if (!list.length) { if (mounted) { setLinhas([]); setLoading(false); } return; }

        const vendaIds = Array.from(new Set(list.map(i => i.venda_id).filter(Boolean)));
        const servicoIds = Array.from(new Set(list.map(i => i.servico_id).filter(Boolean)));
        const [vRes, sRes] = await Promise.all([
          supabase.from("qa_vendas" as any).select("id, id_legado, cliente_id").in("id_legado", vendaIds),
          servicoIds.length
            ? supabase.from("qa_servicos" as any).select("id, nome_servico").in("id", servicoIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);
        const vendas = (vRes.data as any[]) || [];
        const clienteFKs = Array.from(new Set(vendas.map(v => v.cliente_id).filter(Boolean)));
        const cRes = clienteFKs.length
          ? await supabase.from("qa_clientes" as any).select("id, id_legado, nome_completo")
              .or(`id_legado.in.(${clienteFKs.join(",")}),id.in.(${clienteFKs.join(",")})`)
          : { data: [] as any[] };

        const vMap = new Map<number, any>(vendas.map((v: any) => [typeof v.id_legado === "number" ? v.id_legado : v.id, v]));
        const cMap = new Map<number, any>();
        for (const c of (cRes.data as any[]) || []) {
          const fk = (typeof c.id_legado === "number" && Number.isFinite(c.id_legado)) ? c.id_legado : c.id;
          cMap.set(fk, c);
        }
        const sMap = new Map<number, any>(((sRes.data as any[]) || []).map((s: any) => [s.id, s]));

        const built: Linha[] = [];
        for (const it of list) {
          const cat = classify(it);
          if (!cat) continue;
          const venda = vMap.get(it.venda_id);
          const cliente = venda?.cliente_id ? cMap.get(venda.cliente_id) : null;
          const servico = it.servico_id ? sMap.get(it.servico_id) : null;
          built.push({
            itemId: it.id,
            vendaId: it.venda_id,
            clienteNome: cliente?.nome_completo || "—",
            clienteIdLegado: cliente?.id_legado ?? cliente?.id ?? null,
            servicoNome: servico?.nome_servico || `Serviço #${it.servico_id ?? "?"}`,
            status: it.status || "",
            dataIndeferimento: it.data_indeferimento,
            dataRecurso: it.data_recurso_administrativo,
            dataIndefRecurso: it.data_indeferimento_recurso,
            dataDeferimento: it.data_deferimento,
            diasParaRecorrer: diffBetween(it.data_indeferimento, it.data_recurso_administrativo),
            diasSemDecisao: it.data_recurso_administrativo && !it.data_deferimento && !it.data_indeferimento_recurso
              ? diffDays(it.data_recurso_administrativo) : null,
            categoria: cat,
          });
        }
        if (mounted) setLinhas(built);
      } catch (e) {
        console.error("[QARecursosAuditoriaPage] erro:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const counts = useMemo(() => {
    const c: Record<Categoria, number> = { REVERTIDO: 0, PERDIDO: 0, PRAZO_EXPIRADO: 0, EM_CURSO: 0, NAO_APROVEITADO: 0 };
    linhas.forEach(l => { c[l.categoria]++; });
    return c;
  }, [linhas]);

  const totalDecididos = counts.REVERTIDO + counts.PERDIDO + counts.PRAZO_EXPIRADO;
  const taxaSucesso = totalDecididos > 0 ? Math.round((counts.REVERTIDO / totalDecididos) * 100) : 0;
  const recursosNaoAproveitados = counts.NAO_APROVEITADO;

  const visiveis = useMemo(
    () => filtro === "TODOS" ? linhas : linhas.filter(l => l.categoria === filtro),
    [filtro, linhas]
  );

  function exportCSV() {
    const head = ["Cliente", "Serviço", "Categoria", "Status atual", "Indeferimento", "Recurso", "Indef. Recurso", "Deferimento", "Dias p/ Recorrer", "Dias Sem Decisão"];
    const rows = visiveis.map(l => [
      l.clienteNome, l.servicoNome, CAT_META[l.categoria].label, l.status,
      fmtBR(l.dataIndeferimento), fmtBR(l.dataRecurso), fmtBR(l.dataIndefRecurso), fmtBR(l.dataDeferimento),
      l.diasParaRecorrer ?? "", l.diasSemDecisao ?? "",
    ]);
    const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `auditoria-recursos-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Dashboard
          </Link>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">AUDITORIA DE RECURSOS ADMINISTRATIVOS</h1>
          <p className="text-xs text-slate-500">Acompanhamento de êxito, perdas e oportunidades não aproveitadas em processos indeferidos.</p>
        </div>
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition"
        >
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Taxa de Êxito" value={`${taxaSucesso}%`} hint={`${counts.REVERTIDO} de ${totalDecididos} decididos`} tone="emerald" />
        <KpiCard label="Recursos Perdidos" value={counts.PERDIDO + counts.PRAZO_EXPIRADO} hint={`${counts.PERDIDO} indef. + ${counts.PRAZO_EXPIRADO} c/ prazo expirado`} tone="rose" />
        <KpiCard label="Não Aproveitados" value={recursosNaoAproveitados} hint="Indeferidos sem recurso protocolado" tone="amber" />
        <KpiCard label="Em Curso" value={counts.EM_CURSO} hint="Aguardando decisão (≤ 10 dias)" tone="blue" />
      </div>

      {/* Filtros por categoria */}
      <div className="flex flex-wrap gap-2">
        <FilterChip label={`Todos (${linhas.length})`} active={filtro === "TODOS"} onClick={() => setFiltro("TODOS")} />
        {(Object.keys(CAT_META) as Categoria[]).map(k => (
          <FilterChip key={k} label={`${CAT_META[k].label} (${counts[k]})`} active={filtro === k} onClick={() => setFiltro(k)} />
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Cliente</th>
                <th className="text-left px-3 py-2 font-semibold">Serviço</th>
                <th className="text-left px-3 py-2 font-semibold">Categoria</th>
                <th className="text-left px-3 py-2 font-semibold">Indef.</th>
                <th className="text-left px-3 py-2 font-semibold">Recurso</th>
                <th className="text-left px-3 py-2 font-semibold">Decisão</th>
                <th className="text-right px-3 py-2 font-semibold">Dias</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">Carregando…</td></tr>
              ) : visiveis.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">Nenhum registro nesta categoria.</td></tr>
              ) : visiveis.map(l => {
                const m = CAT_META[l.categoria];
                const Icon = m.icon;
                const decisao = l.dataDeferimento || l.dataIndefRecurso || null;
                return (
                  <tr key={l.itemId} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      {l.clienteIdLegado ? (
                        <Link to={`/clientes?id=${l.clienteIdLegado}`} className="font-medium text-slate-800 hover:underline">{l.clienteNome}</Link>
                      ) : <span className="font-medium text-slate-800">{l.clienteNome}</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{l.servicoNome}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${m.tone}`}>
                        <Icon className="h-3 w-3" /> {m.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-600">{fmtBR(l.dataIndeferimento)}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-600">{fmtBR(l.dataRecurso)}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-600">{fmtBR(decisao)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l.diasSemDecisao !== null
                        ? <span className={l.diasSemDecisao > 10 ? "text-rose-600 font-semibold" : "text-blue-600"}>{l.diasSemDecisao}d s/ decisão</span>
                        : l.diasParaRecorrer !== null
                          ? <span className="text-slate-500">{l.diasParaRecorrer}d p/ recorrer</span>
                          : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint, tone }: { label: string; value: string | number; hint: string; tone: "emerald"|"rose"|"amber"|"blue" }) {
  const toneClass = {
    emerald: "border-emerald-200 bg-emerald-50",
    rose: "border-rose-200 bg-rose-50",
    amber: "border-amber-200 bg-amber-50",
    blue: "border-blue-200 bg-blue-50",
  }[tone];
  const valueColor = {
    emerald: "text-emerald-700",
    rose: "text-rose-700",
    amber: "text-amber-800",
    blue: "text-blue-700",
  }[tone];
  return (
    <div className={`p-4 rounded-xl border ${toneClass}`}>
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{label}</span>
      <div className={`text-3xl font-bold tabular-nums mt-1 ${valueColor}`}>{value}</div>
      <p className="text-[10px] text-slate-500 mt-1">{hint}</p>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${
        active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
      }`}
    >{label}</button>
  );
}
