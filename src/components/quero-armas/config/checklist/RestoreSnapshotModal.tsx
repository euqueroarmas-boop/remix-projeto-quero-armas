import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, RotateCcw, Loader2, AlertTriangle } from "lucide-react";

type Snapshot = {
  id: string;
  servico_id: number;
  motivo: string | null;
  payload: any[];
  criado_em: string;
};

interface Props {
  servicoId: number;
  servicoNome: string;
  onClose: () => void;
  onRestored?: () => void;
}

function fmtData(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

export default function RestoreSnapshotModal({ servicoId, servicoNome, onClose, onRestored }: Props) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("qa_servicos_documentos_snapshots" as any)
        .select("id, servico_id, motivo, payload, criado_em")
        .eq("servico_id", servicoId)
        .order("criado_em", { ascending: false });
      if (!alive) return;
      setSnapshots(((data as any[]) ?? []) as Snapshot[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [servicoId]);

  async function restaurar(snap: Snapshot) {
    if (!confirm(
      `Restaurar snapshot de ${fmtData(snap.criado_em)}?\n\n` +
      `Isso vai APAGAR o checklist atual do serviço "${servicoNome}" e recolocar ${snap.payload.length} exigência(s) do snapshot. ` +
      `Um novo snapshot do estado atual será criado antes, então você pode voltar atrás.`,
    )) return;
    setRestoringId(snap.id);
    try {
      // Snapshot do estado atual antes de restaurar
      const { data: linhasAtuais } = await supabase
        .from("qa_servicos_documentos" as any)
        .select("*")
        .eq("servico_id", servicoId);
      if (linhasAtuais && (linhasAtuais as any[]).length > 0) {
        await supabase.from("qa_servicos_documentos_snapshots" as any).insert({
          servico_id: servicoId,
          motivo: `pre_restore:${snap.id.slice(0, 8)}`,
          payload: linhasAtuais,
        });
      }
      // Apaga atual e insere payload do snapshot
      const { error: errDel } = await supabase
        .from("qa_servicos_documentos" as any)
        .delete()
        .eq("servico_id", servicoId);
      if (errDel) throw errDel;
      const payload = (snap.payload as any[]).map((row) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _oldId, created_at: _c, updated_at: _u, ...rest } = row;
        return { ...rest, servico_id: servicoId };
      });
      const { error: errIns } = await supabase
        .from("qa_servicos_documentos" as any)
        .insert(payload);
      if (errIns) throw errIns;
      toast.success(`Checklist restaurado: ${payload.length} exigência(s).`);
      onRestored?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao restaurar snapshot");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4" style={{ color: "hsl(352 60% 30%)" }} />
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Snapshots — {servicoNome}
            </div>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg hover:bg-slate-200 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 mb-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Restaurar substitui o checklist atual pelo do snapshot escolhido. Um novo snapshot é
              criado antes da restauração para que você possa voltar atrás.
            </span>
          </div>

          {loading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando snapshots…
            </div>
          ) : snapshots.length === 0 ? (
            <p className="py-8 text-center text-sm italic text-slate-400">
              Este serviço não tem snapshots. Snapshots são gerados automaticamente antes de operações destrutivas (excluir, copiar, restaurar).
            </p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-700">{fmtData(snap.criado_em)}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {snap.payload.length} exigência(s) · {snap.motivo || "sem motivo registrado"}
                    </p>
                  </div>
                  <button
                    onClick={() => restaurar(snap)}
                    disabled={restoringId === snap.id}
                    className="text-[11px] font-semibold h-7 px-3 rounded-md bg-[#7A1F2B] text-white hover:bg-[#6a1827] disabled:opacity-50 flex items-center gap-1"
                  >
                    {restoringId === snap.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    Restaurar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
