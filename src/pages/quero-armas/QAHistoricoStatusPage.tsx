import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, History, Filter, Search } from "lucide-react";
import { getStatusColor } from "@/lib/quero-armas/statusColors";

interface EventoRow {
  id: string;
  criado_em: string;
  cliente_id: number | null;
  entidade: string;
  entidade_id: string;
  campo_status: string;
  status_anterior: string | null;
  status_novo: string | null;
  origem: string;
  usuario_id: string | null;
  motivo: string | null;
  detalhes: any;
  solicitacao_id: string | null;
  processo_id: string | null;
  documento_id: string | null;
}

const PAGE_SIZE = 50;

const ORIGEM_BADGE_CLASS: Record<string, string> = {
  equipe: "bg-indigo-100 text-indigo-700 border-indigo-200",
  ia: "bg-purple-100 text-purple-700 border-purple-200",
  cliente: "bg-emerald-100 text-emerald-700 border-emerald-200",
  webhook: "bg-sky-100 text-sky-700 border-sky-200",
  sistema: "bg-slate-100 text-slate-700 border-slate-200",
  cron: "bg-amber-100 text-amber-700 border-amber-200",
  importacao: "bg-orange-100 text-orange-700 border-orange-200",
};

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
  } catch {
    return iso;
  }
}

function StatusChip({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-400 text-xs uppercase tracking-wider">—</span>;
  const c = getStatusColor(value);
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.badge}`}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

function OrigemBadge({ origem }: { origem: string }) {
  const cls = ORIGEM_BADGE_CLASS[origem] ?? "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {origem}
    </span>
  );
}

export default function QAHistoricoStatusPage() {
  const [rows, setRows] = useState<EventoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [detailJson, setDetailJson] = useState<any>(null);

  // Filtros
  const [fCliente, setFCliente] = useState("");
  const [fEntidade, setFEntidade] = useState("__all__");
  const [fOrigem, setFOrigem] = useState("__all__");
  const [fCampo, setFCampo] = useState("__all__");
  const [fInicio, setFInicio] = useState("");
  const [fFim, setFFim] = useState("");
  const [fBusca, setFBusca] = useState("");

  const filtros = useMemo(() => ({
    fCliente: fCliente.trim(),
    fEntidade,
    fOrigem,
    fCampo,
    fInicio,
    fFim,
    fBusca: fBusca.trim(),
  }), [fCliente, fEntidade, fOrigem, fCampo, fInicio, fFim, fBusca]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        let q = supabase
          .from("qa_status_eventos")
          .select("*", { count: "exact" })
          .order("criado_em", { ascending: false });

        if (filtros.fCliente) {
          const n = Number(filtros.fCliente);
          if (!Number.isNaN(n)) q = q.eq("cliente_id", n);
        }
        if (filtros.fEntidade !== "__all__") q = q.eq("entidade", filtros.fEntidade);
        if (filtros.fOrigem !== "__all__") q = q.eq("origem", filtros.fOrigem);
        if (filtros.fCampo !== "__all__") q = q.eq("campo_status", filtros.fCampo);
        if (filtros.fInicio) q = q.gte("criado_em", new Date(filtros.fInicio).toISOString());
        if (filtros.fFim) {
          const end = new Date(filtros.fFim);
          end.setHours(23, 59, 59, 999);
          q = q.lte("criado_em", end.toISOString());
        }
        if (filtros.fBusca) {
          const b = filtros.fBusca;
          q = q.or(
            `entidade_id.ilike.%${b}%,status_anterior.ilike.%${b}%,status_novo.ilike.%${b}%,motivo.ilike.%${b}%`
          );
        }

        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error, count } = await q.range(from, to);
        if (!alive) return;
        if (error) throw error;
        setRows((data as EventoRow[]) ?? []);
        setTotal(count ?? 0);
      } catch (err) {
        console.error("[QAHistoricoStatus] load error:", err);
        if (alive) {
          setRows([]);
          setTotal(0);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [filtros, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetFiltros = () => {
    setFCliente("");
    setFEntidade("__all__");
    setFOrigem("__all__");
    setFCampo("__all__");
    setFInicio("");
    setFFim("");
    setFBusca("");
    setPage(0);
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-[#2563EB] text-white">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 uppercase">
            Histórico de Status
          </h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider">
            Auditoria imutável de mudanças de status • somente leitura
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 md:p-4 space-y-3">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
          <Filter className="h-3.5 w-3.5" /> Filtros
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <Input
            placeholder="CLIENTE ID"
            value={fCliente}
            onChange={(e) => { setFCliente(e.target.value.toUpperCase()); setPage(0); }}
            className="h-9 text-xs uppercase"
          />
          <Select value={fEntidade} onValueChange={(v) => { setFEntidade(v); setPage(0); }}>
            <SelectTrigger className="h-9 text-xs uppercase"><SelectValue placeholder="ENTIDADE" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">TODAS ENTIDADES</SelectItem>
              <SelectItem value="documento">DOCUMENTO</SelectItem>
              <SelectItem value="processo_documento">PROCESSO_DOCUMENTO</SelectItem>
              <SelectItem value="processo">PROCESSO</SelectItem>
              <SelectItem value="solicitacao_servico">SOLICITACAO_SERVICO</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fOrigem} onValueChange={(v) => { setFOrigem(v); setPage(0); }}>
            <SelectTrigger className="h-9 text-xs uppercase"><SelectValue placeholder="ORIGEM" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">TODAS ORIGENS</SelectItem>
              <SelectItem value="equipe">EQUIPE</SelectItem>
              <SelectItem value="ia">IA</SelectItem>
              <SelectItem value="cliente">CLIENTE</SelectItem>
              <SelectItem value="webhook">WEBHOOK</SelectItem>
              <SelectItem value="sistema">SISTEMA</SelectItem>
              <SelectItem value="cron">CRON</SelectItem>
              <SelectItem value="importacao">IMPORTACAO</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fCampo} onValueChange={(v) => { setFCampo(v); setPage(0); }}>
            <SelectTrigger className="h-9 text-xs uppercase"><SelectValue placeholder="CAMPO" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">TODOS CAMPOS</SelectItem>
              <SelectItem value="status">STATUS</SelectItem>
              <SelectItem value="status_servico">STATUS_SERVICO</SelectItem>
              <SelectItem value="status_processo">STATUS_PROCESSO</SelectItem>
              <SelectItem value="status_financeiro">STATUS_FINANCEIRO</SelectItem>
              <SelectItem value="pagamento_status">PAGAMENTO_STATUS</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={fInicio}
            onChange={(e) => { setFInicio(e.target.value); setPage(0); }}
            className="h-9 text-xs"
            placeholder="INÍCIO"
          />
          <Input
            type="date"
            value={fFim}
            onChange={(e) => { setFFim(e.target.value); setPage(0); }}
            className="h-9 text-xs"
            placeholder="FIM"
          />
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="BUSCA"
              value={fBusca}
              onChange={(e) => { setFBusca(e.target.value.toUpperCase()); setPage(0); }}
              className="h-9 text-xs uppercase pl-7"
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500">
          <div>{loading ? "Carregando…" : `${total} evento(s) encontrado(s)`}</div>
          <Button variant="ghost" size="sm" onClick={resetFiltros} className="h-7 text-[10px] uppercase">
            Limpar filtros
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <History className="h-10 w-10 mb-2 opacity-40" />
            <div className="text-xs uppercase tracking-wider">Nenhum evento encontrado</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
                  <th className="px-2 py-2 text-left font-semibold">Data/Hora</th>
                  <th className="px-2 py-2 text-left font-semibold">Cliente</th>
                  <th className="px-2 py-2 text-left font-semibold">Entidade</th>
                  <th className="px-2 py-2 text-left font-semibold">Entidade ID</th>
                  <th className="px-2 py-2 text-left font-semibold">Campo</th>
                  <th className="px-2 py-2 text-left font-semibold">Anterior</th>
                  <th className="px-2 py-2 text-left font-semibold">Novo</th>
                  <th className="px-2 py-2 text-left font-semibold">Origem</th>
                  <th className="px-2 py-2 text-left font-semibold">Usuário</th>
                  <th className="px-2 py-2 text-left font-semibold">Motivo</th>
                  <th className="px-2 py-2 text-left font-semibold">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const hasDetalhes = r.detalhes && Object.keys(r.detalhes).length > 0;
                  return (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 align-top">
                      <td className="px-2 py-2 whitespace-nowrap text-slate-600">{formatDateTime(r.criado_em)}</td>
                      <td className="px-2 py-2 text-slate-700 font-mono">{r.cliente_id ?? "—"}</td>
                      <td className="px-2 py-2 text-slate-700 uppercase tracking-wider">{r.entidade}</td>
                      <td className="px-2 py-2 text-slate-500 font-mono text-[10px] max-w-[180px] truncate" title={r.entidade_id}>
                        {r.entidade_id}
                      </td>
                      <td className="px-2 py-2 text-slate-700 uppercase tracking-wider">{r.campo_status}</td>
                      <td className="px-2 py-2"><StatusChip value={r.status_anterior} /></td>
                      <td className="px-2 py-2"><StatusChip value={r.status_novo} /></td>
                      <td className="px-2 py-2"><OrigemBadge origem={r.origem} /></td>
                      <td className="px-2 py-2 text-slate-500 font-mono text-[10px] max-w-[150px] truncate" title={r.usuario_id ?? ""}>
                        {r.usuario_id ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-slate-600 max-w-[200px] truncate" title={r.motivo ?? ""}>
                        {r.motivo ?? "—"}
                      </td>
                      <td className="px-2 py-2">
                        {hasDetalhes ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] uppercase tracking-wider text-indigo-600 hover:text-indigo-800"
                            onClick={() => setDetailJson(r.detalhes)}
                          >
                            Ver detalhes
                          </Button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {!loading && rows.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600">
            <div>Página {page + 1} de {totalPages}</div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="h-7 text-[10px] uppercase"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 text-[10px] uppercase"
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Linhas expandidas: mostradas via dialog para reaproveitar UI */}
      <Dialog open={!!detailJson} onOpenChange={(o) => !o && setDetailJson(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-wider">Detalhes do evento</DialogTitle>
          </DialogHeader>
          <pre className="text-[11px] bg-slate-50 border border-slate-200 rounded-md p-3 overflow-auto whitespace-pre-wrap break-all">
            {detailJson ? JSON.stringify(detailJson, null, 2) : ""}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}