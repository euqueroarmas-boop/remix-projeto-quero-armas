import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Copy, ExternalLink, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useWidgetLoader } from "@/hooks/useWidgetLoader";
import WidgetStateView from "@/components/quero-armas/dashboard/WidgetStateView";
import { loadQAPrazosEquipeRows, type QAPrazoEquipeRow } from "@/lib/quero-armas/prazosEquipe";
import { getSenhaGov } from "@/components/quero-armas/clientes/senhaGovApi";

function fmtBR(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : "—";
}

function fmtCPF(cpf: string | null) {
  if (!cpf) return "—";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function fmtPhone(phone: string | null) {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return phone;
}

function copyTextFallback(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

async function copyTextSafe(text: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback abaixo
  }
  return copyTextFallback(text);
}

export default function QAPrazosExpiradosPage() {
  const [search, setSearch] = useState("");
  const [eventoFilter, setEventoFilter] = useState<"TODOS" | QAPrazoEquipeRow["evento"]>("TODOS");
  const [govLoading, setGovLoading] = useState<Record<number, boolean>>({});

  const { state, data, reload } = useWidgetLoader<QAPrazoEquipeRow[]>(
    async (signal) => (await loadQAPrazosEquipeRows(signal)).filter((row) => row.diasRestantes < 0),
    [],
    { timeoutMs: 7000 },
  );

  const rows = data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (eventoFilter !== "TODOS" && row.evento !== eventoFilter) return false;
      if (!term) return true;
      return [
        row.clienteNome,
        row.servicoNome,
        row.protocolo,
        row.status,
        row.cpf,
        row.celular,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [rows, search, eventoFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const mais30 = rows.filter((row) => row.diasRestantes <= -30).length;
    const mandado = rows.filter((row) => row.evento === "MANDADO DE SEGURANÇA").length;
    const recursoPf = rows.filter((row) => row.evento !== "MANDADO DE SEGURANÇA").length;
    return { total, mais30, mandado, recursoPf };
  }, [rows]);

  const handleCopy = async (label: string, value: string | null | undefined) => {
    if (!value) {
      toast.error(`${label} indisponível`);
      return;
    }
    const ok = await copyTextSafe(value);
    if (ok) toast.success(`${label} copiado`);
    else toast.error(`Falha ao copiar ${label}`);
  };

  const handleCopyGov = async (row: QAPrazoEquipeRow) => {
    if (!row.cadastroCrId) {
      toast.error("Sem CR cadastrado");
      return;
    }
    setGovLoading((prev) => ({ ...prev, [row.cadastroCrId as number]: true }));
    try {
      const senha = await getSenhaGov(row.cadastroCrId, "Prazos Expirados", row.clienteId);
      if (!senha) {
        toast.info("Sem Senha Gov cadastrada");
        return;
      }
      const ok = await copyTextSafe(senha);
      if (ok) toast.success("Senha Gov copiada");
      else toast.error("Não foi possível copiar a Senha Gov");
    } catch (error: any) {
      toast.error("Senha Gov: " + (error?.message || "erro"));
    } finally {
      setGovLoading((prev) => ({ ...prev, [row.cadastroCrId as number]: false }));
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao dashboard
          </Link>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">PRAZOS EXPIRADOS</h1>
          <p className="text-xs text-slate-500">
            Fila operacional dos processos que saem do card principal quando o prazo já venceu.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total vencidos" value={stats.total} tone="rose" hint="Processos fora do prazo ativo" />
        <KpiCard label="Vencidos 30+ dias" value={stats.mais30} tone="amber" hint="Casos mais antigos para priorização" />
        <KpiCard label="Fila PF" value={stats.recursoPf} tone="slate" hint="Notificação, indeferimento ou restituição" />
        <KpiCard label="Mandado de segurança" value={stats.mandado} tone="blue" hint="Prazo decadencial de 120 dias" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, serviço, protocolo, CPF ou telefone..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7A1F2B]"
          />
        </div>
        <select
          value={eventoFilter}
          onChange={(e) => setEventoFilter(e.target.value as any)}
          className="h-9 px-3 rounded-lg border border-slate-200 text-xs uppercase tracking-wide font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7A1F2B]"
        >
          <option value="TODOS">Todos os eventos</option>
          <option value="NOTIFICAÇÃO">Notificação</option>
          <option value="INDEFERIMENTO">Indeferimento</option>
          <option value="RESTITUIÇÃO">Restituição</option>
          <option value="MANDADO DE SEGURANÇA">Mandado de Segurança</option>
        </select>
      </div>

      {state === "loading" ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : state === "error" || state === "timeout" ? (
        <WidgetStateView
          title="Prazos Expirados"
          state={state}
          onRetry={reload}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
              {filtered.length} processo(s) vencido(s)
            </div>
            <div className="text-[11px] text-slate-500">
              Ordenado do mais vencido para o menos vencido
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">
              Nenhum prazo expirado encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-3 font-semibold">Cliente</th>
                    <th className="text-left px-3 py-3 font-semibold">Serviço</th>
                    <th className="text-left px-3 py-3 font-semibold">Evento</th>
                    <th className="text-left px-3 py-3 font-semibold">Status</th>
                    <th className="text-left px-3 py-3 font-semibold">Protocolo</th>
                    <th className="text-left px-3 py-3 font-semibold">Datas</th>
                    <th className="text-right px-3 py-3 font-semibold">Atraso</th>
                    <th className="text-right px-3 py-3 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((row) => (
                    <tr key={row.itemId} className="hover:bg-slate-50/70 align-top">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-800 uppercase">{row.clienteNome}</div>
                        <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                          <div>CPF: {fmtCPF(row.cpf)}</div>
                          <div>Telefone: {fmtPhone(row.celular)}</div>
                          <div>Venda: #{row.vendaIdLegado}</div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-800">{row.servicoNome}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                          Tipo: {row.tipo}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-md border border-rose-200 bg-rose-50 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                          {row.evento}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold uppercase text-slate-700">
                          {row.status || "—"}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          Prazo legal: {row.prazoTotalDias} dias
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => handleCopy("Protocolo", row.protocolo)}
                          className="inline-flex items-center gap-1 text-slate-700 hover:text-[#7A1F2B]"
                          title={row.protocolo || "Sem protocolo"}
                        >
                          <Copy className="h-3 w-3" />
                          <span className="font-mono">{row.protocolo || "—"}</span>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="space-y-1 text-[11px] text-slate-600">
                          <div>Evento: <span className="font-semibold">{fmtBR(row.dataEvento)}</span></div>
                          <div>Fatal: <span className="font-semibold text-rose-700">{fmtBR(row.dataLimite)}</span></div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="text-lg font-black text-rose-700 tabular-nums">
                          {Math.abs(row.diasRestantes)}d
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-rose-600">
                          vencido há
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-end gap-1.5">
                          <Link
                            to={row.clienteIdLegado ? `/clientes?cliente=${row.clienteIdLegado}` : "/clientes"}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Abrir cliente <ExternalLink className="h-3 w-3" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleCopy("CPF", fmtCPF(row.cpf))}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Copy className="h-3 w-3" /> CPF
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyGov(row)}
                            disabled={!row.cadastroCrId || govLoading[row.cadastroCrId]}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {row.cadastroCrId && govLoading[row.cadastroCrId] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            Senha Gov
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "rose" | "amber" | "slate" | "blue";
}) {
  const toneMap = {
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-[#E5C2C6] bg-[#FBF3F4] text-[#7A1F2B]",
  } as const;

  return (
    <div className={`rounded-xl border p-4 ${toneMap[tone]}`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.14em]">{label}</div>
      <div className="mt-1 text-3xl font-black tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] opacity-80">{hint}</div>
    </div>
  );
}
