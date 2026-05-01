import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, FileCheck2, Trash2, Plus, Loader2 } from "lucide-react";

export type TrocaServicoPreview = {
  servico_antigo: { id: number; nome: string };
  servico_novo: { id: number; nome: string };
  reaproveitados: number;
  descartados: number;
  pendentes_reenvio: number;
  novos_inseridos: number;
  tipos_reaproveitados: string[];
  tipos_descartados: string[];
  tipos_reenvio: string[];
  tipos_inseridos: string[];
};

type Props = {
  open: boolean;
  preview: TrocaServicoPreview | null;
  saving?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const labelize = (t: string) => t.replace(/_/g, " ").toUpperCase();

/**
 * Modal obrigatório de confirmação ao trocar o serviço de uma venda
 * que já gerou processo. Mostra o impacto exato no checklist do processo
 * (documentos reaproveitados, descartados, reenviar, novos) antes de
 * o operador confirmar a operação.
 */
export function TrocaServicoConfirmDialog({ open, preview, saving, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onCancel(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em] text-slate-800">
            <RefreshCw className="h-4 w-4 text-amber-600" />
            CONFIRMAR TROCA DE SERVIÇO
          </DialogTitle>
        </DialogHeader>
        {!preview ? (
          <div className="px-5 py-8 flex items-center justify-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900 leading-snug">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  Esta venda já gerou um processo. Trocar o serviço vai
                  recalcular o checklist e atualizar o nome do processo.
                  Documentos compatíveis serão reaproveitados.
                </div>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 px-3 py-2 text-[11px]">
              <div className="text-[9px] uppercase tracking-[0.12em] text-slate-400 font-semibold mb-1">
                Mudança
              </div>
              <div className="font-bold text-slate-700 uppercase">{preview.servico_antigo.nome || "—"}</div>
              <div className="text-slate-400 my-0.5">↓</div>
              <div className="font-bold text-emerald-700 uppercase">{preview.servico_novo.nome}</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Stat
                icon={<FileCheck2 className="h-3.5 w-3.5" />}
                count={preview.reaproveitados}
                label="Reaproveitados"
                tone="emerald"
              />
              <Stat
                icon={<Trash2 className="h-3.5 w-3.5" />}
                count={preview.descartados}
                label="Descartados"
                tone="rose"
              />
              <Stat
                icon={<RefreshCw className="h-3.5 w-3.5" />}
                count={preview.pendentes_reenvio}
                label="Reenviar (vencidos)"
                tone="amber"
              />
              <Stat
                icon={<Plus className="h-3.5 w-3.5" />}
                count={preview.novos_inseridos}
                label="Novos no checklist"
                tone="indigo"
              />
            </div>

            {preview.tipos_descartados.length > 0 && (
              <DetailBlock title="Documentos que serão descartados" tipos={preview.tipos_descartados} tone="rose" />
            )}
            {preview.tipos_reaproveitados.length > 0 && (
              <DetailBlock title="Documentos reaproveitados (status mantido)" tipos={preview.tipos_reaproveitados} tone="emerald" />
            )}
            {preview.tipos_reenvio.length > 0 && (
              <DetailBlock title="Documentos vencidos (cliente terá que reenviar)" tipos={preview.tipos_reenvio} tone="amber" />
            )}
            {preview.tipos_inseridos.length > 0 && (
              <DetailBlock title="Novos documentos a coletar" tipos={preview.tipos_inseridos} tone="indigo" />
            )}
          </div>
        )}
        <DialogFooter className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex-row justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={onCancel}
            className="h-8 text-[11px] uppercase tracking-wider"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={saving || !preview}
            onClick={onConfirm}
            className="h-8 text-[11px] uppercase tracking-wider bg-amber-600 hover:bg-amber-700 text-white"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Confirmar troca
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon, count, label, tone }: { icon: React.ReactNode; count: number; label: string; tone: "emerald" | "rose" | "amber" | "indigo" }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    rose:    "bg-rose-50 border-rose-200 text-rose-800",
    amber:   "bg-amber-50 border-amber-200 text-amber-800",
    indigo:  "bg-indigo-50 border-indigo-200 text-indigo-800",
  };
  return (
    <div className={`rounded-md border px-2.5 py-2 ${colors[tone]}`}>
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.1em] font-semibold opacity-80">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold mt-0.5">{count}</div>
    </div>
  );
}

function DetailBlock({ title, tipos, tone }: { title: string; tipos: string[]; tone: "emerald" | "rose" | "amber" | "indigo" }) {
  const colors: Record<string, string> = {
    emerald: "border-emerald-200 text-emerald-900",
    rose:    "border-rose-200 text-rose-900",
    amber:   "border-amber-200 text-amber-900",
    indigo:  "border-indigo-200 text-indigo-900",
  };
  return (
    <div className={`rounded-md border px-2.5 py-2 ${colors[tone]} bg-white`}>
      <div className="text-[9px] uppercase tracking-[0.1em] font-semibold mb-1.5 opacity-80">
        {title}
      </div>
      <div className="flex flex-wrap gap-1">
        {tipos.map((t) => (
          <span key={t} className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded">
            {labelize(t)}
          </span>
        ))}
      </div>
    </div>
  );
}