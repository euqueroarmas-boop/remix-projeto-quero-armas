/**
 * ArsenalAutorizacaoBaixaModal — F1B-3
 *
 * Registra a baixa/utilização de uma autorização de compra. Mantém histórico
 * em ia_dados_extraidos.historico_baixa[] e marca status='UTILIZADA'.
 */
import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Doc {
  id: string;
  numero_documento: string | null;
  status: string | null;
  ia_dados_extraidos: any;
}

interface Props {
  doc: Doc;
  modo: "utilizar" | "cancelar";
  onClose: () => void;
  onSaved: () => void;
}

function applyDateMask(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
function ddMmToIso(s: string): string | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export default function ArsenalAutorizacaoBaixaModal({ doc, modo, onClose, onSaved }: Props) {
  const [data, setData] = useState("");
  const [motivo, setMotivo] = useState("");
  const [serie, setSerie] = useState("");
  const [saving, setSaving] = useState(false);

  const titulo = modo === "utilizar" ? "Dar baixa / Registrar utilização" : "Cancelar autorização";
  const novoStatus = modo === "utilizar" ? "UTILIZADA" : "CANCELADA";

  const onConfirm = async () => {
    if (!data.trim()) { toast.error("Informe a data."); return; }
    if (modo === "cancelar" && !motivo.trim()) { toast.error("Informe o motivo do cancelamento."); return; }
    setSaving(true);
    try {
      const iso = ddMmToIso(data);
      if (!iso) { toast.error("Data inválida (DD/MM/AAAA)."); setSaving(false); return; }
      const historico = Array.isArray(doc.ia_dados_extraidos?.historico_baixa)
        ? [...doc.ia_dados_extraidos.historico_baixa] : [];
      const { data: userData } = await supabase.auth.getUser();
      historico.push({
        acao: novoStatus,
        data_evento: iso,
        motivo: motivo.trim().toUpperCase() || null,
        numero_serie: serie.trim().toUpperCase() || null,
        registrado_em: new Date().toISOString(),
        registrado_por: userData?.user?.id || null,
      });
      const updates: any = {
        status: novoStatus,
        ia_dados_extraidos: {
          ...(doc.ia_dados_extraidos || {}),
          historico_baixa: historico,
          ultima_baixa_em: new Date().toISOString(),
          ultima_baixa_acao: novoStatus,
        },
      };
      if (modo === "utilizar" && serie.trim()) {
        updates.arma_numero_serie = serie.trim().toUpperCase();
      }
      const { error } = await supabase
        .from("qa_documentos_cliente" as any)
        .update(updates)
        .eq("id", doc.id);
      if (error) throw error;
      toast.success(modo === "utilizar" ? "Baixa registrada." : "Autorização cancelada.");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao registrar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#f6f5f1" }}
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <h3 className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-800">{titulo}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-3 p-4 text-[12px]">
          {doc.numero_documento && (
            <p className="text-[11px] text-slate-600">
              Autorização <b>Nº {doc.numero_documento}</b>
            </p>
          )}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-600">
              {modo === "utilizar" ? "Data da utilização *" : "Data do cancelamento *"}
            </label>
            <input
              value={data}
              onChange={(e) => setData(applyDateMask(e.target.value))}
              placeholder="DD/MM/AAAA"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px]"
            />
          </div>
          {modo === "utilizar" && (
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Nº de série da arma adquirida (opcional)
              </label>
              <input
                value={serie}
                onChange={(e) => setSerie(e.target.value.toUpperCase())}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px] uppercase"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-600">
              {modo === "utilizar" ? "Observação" : "Motivo *"}
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12px]"
            />
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-50"
            style={{ background: modo === "cancelar" ? "hsl(0 70% 42%)" : "#7A1F2B" }}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Confirmar
          </button>
        </footer>
      </div>
    </div>
  );
}