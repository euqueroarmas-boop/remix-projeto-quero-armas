/**
 * BLOCO 4 — Drill-down do KPI Alertas Globais.
 *
 * Lista detalhada dos alertas reais do cliente, agrupados por gravidade
 * (vermelho → laranja → amarelo). Não consulta banco: recebe via props
 * a lista já consolidada pela engine (`StatusUnificado`).
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { CorStatus, StatusUnificado } from "@/lib/quero-armas/statusUnificado";
import { COR_BADGE_CLASS, COR_DOT_CLASS } from "@/lib/quero-armas/statusUnificado";

export interface AlertaItem {
  id: string;
  /** Título humano do item (ex.: "CR Nº 123", "GLOCK G25 · CAL 9MM"). */
  titulo: string;
  /** Tipo curto (CR, CRAF, GTE, EXAME, PROCESSO, DOCUMENTO, AUTORIZAÇÃO). */
  tipo: string;
  status: StatusUnificado;
  /** ISO yyyy-mm-dd, quando aplicável. */
  dataVencimento: string | null;
  /** Dias restantes; negativo = vencido; null = sem data. */
  diasRestantes: number | null;
}

const COR_RANK: Record<CorStatus, number> = {
  vermelho: 1,
  laranja: 2,
  amarelo: 3,
  azul: 4,
  verde: 5,
  cinza: 6,
};

const COR_LABEL: Record<CorStatus, string> = {
  vermelho: "CRÍTICO",
  laranja: "ATENÇÃO",
  amarelo: "MONITORAR",
  azul: "EM ANDAMENTO",
  verde: "EM DIA",
  cinza: "SEM DADO",
};

function formatData(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}

function formatDias(d: number | null): string {
  if (d === null) return "—";
  if (d < 0) return `vencido há ${Math.abs(d)}d`;
  if (d === 0) return "vence hoje";
  return `${d}d restantes`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  alertas: AlertaItem[];
}

export function AlertasDrillDownModal({ open, onClose, alertas }: Props) {
  // Ordena por gravidade e depois por dias restantes (mais crítico primeiro).
  const ordenados = [...alertas].sort((a, b) => {
    const ra = COR_RANK[a.status.cor] ?? 99;
    const rb = COR_RANK[b.status.cor] ?? 99;
    if (ra !== rb) return ra - rb;
    const da = a.diasRestantes ?? 9999;
    const db = b.diasRestantes ?? 9999;
    return da - db;
  });

  // Agrupa por gravidade (apenas as 3 cores de alerta).
  const grupos: { cor: CorStatus; itens: AlertaItem[] }[] = [];
  for (const cor of ["vermelho", "laranja", "amarelo"] as CorStatus[]) {
    const itens = ordenados.filter((a) => a.status.cor === cor);
    if (itens.length > 0) grupos.push({ cor, itens });
  }

  const total = ordenados.length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden bg-white text-slate-900 border-slate-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 uppercase tracking-wide">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            ALERTAS DE VENCIMENTO
          </DialogTitle>
          <DialogDescription className="text-slate-600 text-xs">
            {total === 0
              ? "Nenhum alerta crítico no momento."
              : `${total} ${total === 1 ? "item exige" : "itens exigem"} atenção.`}
          </DialogDescription>
        </DialogHeader>

        {total === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <ShieldCheck className="h-10 w-10 text-emerald-600" />
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">TUDO EM DIA</p>
            <p className="text-xs text-slate-500">
              Nenhum documento, processo ou autorização exige ação imediata.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-4">
              {grupos.map((g) => (
                <section key={g.cor}>
                  <header className="mb-2 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${COR_DOT_CLASS[g.cor]}`} />
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-700">
                      {COR_LABEL[g.cor]} · {g.itens.length}
                    </h3>
                  </header>
                  <ul className="space-y-2">
                    {g.itens.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-bold uppercase text-slate-900">
                              {a.titulo}
                            </p>
                            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                              {a.tipo}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${COR_BADGE_CLASS[a.status.cor]}`}
                          >
                            {a.status.label}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="text-slate-600">
                            {a.dataVencimento ? `Vence em ${formatData(a.dataVencimento)}` : "Sem data"}
                          </span>
                          <span className="font-mono text-[10px] text-slate-700">
                            {formatDias(a.diasRestantes)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}