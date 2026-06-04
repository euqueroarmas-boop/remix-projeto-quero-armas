/**
 * ArsenalCRAFEditModal — F1B-2
 *
 * Modal de edição manual de um documento CRAF em qa_documentos_cliente.
 * Usado tanto para corrigir extração da IA quanto para cadastrar manual.
 *
 * REGRA CRÍTICA: o campo MODELO é obrigatório e bloqueia salvamento se
 * estiver vazio ou contiver termos genéricos ("arma", "pistola", etc).
 *
 * Quando o usuário escolhe vincular o CRAF a uma arma da Bancada Tática,
 * a tabela `qa_cliente_armas_manual` é atualizada com numero_craf + dados.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MODELO_INVALIDOS = new Set([
  "", "arma", "pistola", "revolver", "revólver", "n/a", "na",
  "nao informado", "não informado", "carabina", "espingarda", "fuzil",
]);

export function isModeloCRAFInvalido(m: string | null | undefined): boolean {
  if (!m) return true;
  const norm = m.trim().toLowerCase().replace(/\s+/g, " ");
  if (norm.length < 2) return true;
  return MODELO_INVALIDOS.has(norm);
}

interface Doc {
  id: string;
  qa_cliente_id: number;
  numero_documento: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  orgao_emissor: string | null;
  arma_marca: string | null;
  arma_modelo: string | null;
  arma_calibre: string | null;
  arma_numero_serie: string | null;
  ia_dados_extraidos: any;
  ia_status: string | null;
}

interface ArmaBancada {
  id: number;
  marca: string | null;
  modelo: string | null;
  calibre: string | null;
  numero_serie: string | null;
  numero_craf: string | null;
  numero_sigma: string | null;
}

interface Props {
  doc: Doc;
  clienteId: number;
  onClose: () => void;
  onSaved: () => void;
}

function isoToDdMm(s: string | null | undefined): string {
  if (!s) return "";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}
function ddMmToIso(s: string): string | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function applyDateMask(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export default function ArsenalCRAFEditModal({ doc, clienteId, onClose, onSaved }: Props) {
  const [numero, setNumero] = useState(doc.numero_documento || "");
  const [emissao, setEmissao] = useState(isoToDdMm(doc.data_emissao));
  const [validade, setValidade] = useState(isoToDdMm(doc.data_validade));
  const [orgao, setOrgao] = useState(doc.orgao_emissor || "");
  const [marca, setMarca] = useState(doc.arma_marca || "");
  const [modelo, setModelo] = useState(doc.arma_modelo || "");
  const [calibre, setCalibre] = useState(doc.arma_calibre || "");
  const [serie, setSerie] = useState(doc.arma_numero_serie || "");
  const [sigma, setSigma] = useState((doc.ia_dados_extraidos as any)?.sigma_ou_sinarm || "");
  const [armas, setArmas] = useState<ArmaBancada[]>([]);
  const [vincularArmaId, setVincularArmaId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("qa_cliente_armas_manual" as any)
        .select("id,marca,modelo,calibre,numero_serie,numero_craf,numero_sigma")
        .eq("qa_cliente_id", clienteId)
        .order("id", { ascending: false });
      setArmas(((data as any[]) || []) as ArmaBancada[]);
      // Auto-sugere arma com mesmo número de série
      if (doc.arma_numero_serie) {
        const match = (data as any[] || []).find((a) =>
          a.numero_serie && a.numero_serie.trim().toUpperCase() === doc.arma_numero_serie?.trim().toUpperCase());
        if (match) setVincularArmaId(String(match.id));
      }
    })();
  }, [clienteId, doc.arma_numero_serie]);

  const modeloInvalido = useMemo(() => isModeloCRAFInvalido(modelo), [modelo]);

  const onSave = async () => {
    if (modeloInvalido) {
      toast.error("Modelo da arma é obrigatório e não foi identificado automaticamente.");
      return;
    }
    if (!numero.trim()) {
      toast.error("Número do CRAF é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      const updates: any = {
        numero_documento: numero.trim().toUpperCase(),
        data_emissao: ddMmToIso(emissao),
        data_validade: ddMmToIso(validade),
        orgao_emissor: orgao.trim().toUpperCase() || null,
        arma_marca: marca.trim().toUpperCase() || null,
        arma_modelo: modelo.trim().toUpperCase(),
        arma_calibre: calibre.trim().toUpperCase() || null,
        arma_numero_serie: serie.trim().toUpperCase() || null,
        ia_status: "concluido",
        validado_admin: true,
        validado_em: new Date().toISOString(),
        ia_dados_extraidos: {
          ...(doc.ia_dados_extraidos || {}),
          sigma_ou_sinarm: sigma.trim().toUpperCase() || null,
          modelo_invalido: false,
          editado_manualmente_em: new Date().toISOString(),
        },
      };
      const { error } = await supabase
        .from("qa_documentos_cliente" as any)
        .update(updates)
        .eq("id", doc.id);
      if (error) throw error;

      // Vínculo opcional com arma da Bancada Tática
      if (vincularArmaId) {
        const armaId = Number(vincularArmaId);
        const armaUpdates: any = {
          numero_craf: numero.trim().toUpperCase(),
          updated_at: new Date().toISOString(),
        };
        if (sigma.trim()) armaUpdates.numero_sigma = sigma.trim().toUpperCase();
        if (marca.trim()) armaUpdates.marca = marca.trim().toUpperCase();
        if (modelo.trim()) armaUpdates.modelo = modelo.trim().toUpperCase();
        if (calibre.trim()) armaUpdates.calibre = calibre.trim().toUpperCase();
        if (serie.trim()) armaUpdates.numero_serie = serie.trim().toUpperCase();
        const { error: aErr } = await supabase
          .from("qa_cliente_armas_manual" as any)
          .update(armaUpdates)
          .eq("id", armaId)
          .eq("qa_cliente_id", clienteId);
        if (aErr) toast.error(`CRAF salvo, mas falhou vincular à arma: ${aErr.message}`);
      }

      toast.success("CRAF salvo.");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar CRAF.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#f6f5f1" }}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <h3 className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-800">
            Editar CRAF
          </h3>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3 p-4 text-[12px]">
          <Field label="Número do CRAF *" value={numero} onChange={setNumero} uppercase />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data emissão" value={emissao} onChange={(v) => setEmissao(applyDateMask(v))} placeholder="DD/MM/AAAA" />
            <Field label="Data validade" value={validade} onChange={(v) => setValidade(applyDateMask(v))} placeholder="DD/MM/AAAA" />
          </div>
          <Field label="Órgão emissor" value={orgao} onChange={setOrgao} uppercase placeholder="POLÍCIA FEDERAL / EXÉRCITO" />
          <Field label="SIGMA ou SINARM" value={sigma} onChange={setSigma} uppercase />

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">Dados da arma</div>
            <div className="space-y-3">
              <Field label="Marca" value={marca} onChange={setMarca} uppercase />
              <Field
                label="Modelo *"
                value={modelo}
                onChange={setModelo}
                uppercase
                error={modeloInvalido ? "Modelo da arma é obrigatório e não foi identificado automaticamente" : undefined}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Calibre" value={calibre} onChange={setCalibre} uppercase />
                <Field label="Nº de série" value={serie} onChange={setSerie} uppercase />
              </div>
            </div>
          </div>

          {armas.length > 0 && (
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Vincular à arma da Bancada Tática
              </label>
              <select
                value={vincularArmaId}
                onChange={(e) => setVincularArmaId(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px] uppercase"
              >
                <option value="">— Não vincular —</option>
                {armas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {[a.marca, a.modelo, a.calibre].filter(Boolean).join(" ").toUpperCase()}
                    {a.numero_serie ? ` • SÉRIE ${a.numero_serie}` : ""}
                    {a.numero_craf ? ` • CRAF ${a.numero_craf}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving || modeloInvalido}
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-50"
            style={{ background: "#7A1F2B" }}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Salvar CRAF
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, uppercase, error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  uppercase?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-600">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
        placeholder={placeholder}
        className={`h-9 w-full rounded-md border px-2 text-[12px] ${uppercase ? "uppercase" : ""} ${
          error ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"
        }`}
      />
      {error && <p className="mt-1 text-[10px] font-semibold text-red-600">{error}</p>}
    </div>
  );
}