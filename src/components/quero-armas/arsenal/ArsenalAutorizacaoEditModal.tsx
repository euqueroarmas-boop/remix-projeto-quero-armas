/**
 * ArsenalAutorizacaoEditModal — F1B-3
 *
 * Modal para cadastro manual / edição de uma Autorização de Compra.
 * Vínculo com arma da Bancada Tática é OPCIONAL e nunca sobrescreve
 * dados existentes sem confirmação explícita do usuário.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  arma_especie: string | null;
  observacoes: string | null;
  ia_dados_extraidos: any;
  ia_status: string | null;
  status: string | null;
}

interface ArmaBancada {
  id: number;
  marca: string | null;
  modelo: string | null;
  calibre: string | null;
  numero_serie: string | null;
  numero_craf: string | null;
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

export default function ArsenalAutorizacaoEditModal({ doc, clienteId, onClose, onSaved }: Props) {
  const [numero, setNumero] = useState(doc.numero_documento || "");
  const [emissao, setEmissao] = useState(isoToDdMm(doc.data_emissao));
  const [validade, setValidade] = useState(isoToDdMm(doc.data_validade));
  const [orgao, setOrgao] = useState(doc.orgao_emissor || "");
  const [especie, setEspecie] = useState(doc.arma_especie || "");
  const [marca, setMarca] = useState(doc.arma_marca || "");
  const [modelo, setModelo] = useState(doc.arma_modelo || "");
  const [calibre, setCalibre] = useState(doc.arma_calibre || "");
  const [serie, setSerie] = useState(doc.arma_numero_serie || "");
  const [obs, setObs] = useState(doc.observacoes || "");
  const [armas, setArmas] = useState<ArmaBancada[]>([]);
  const [vincularArmaId, setVincularArmaId] = useState<string>("");
  const [sobrescrever, setSobrescrever] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("qa_cliente_armas_manual" as any)
        .select("id,marca,modelo,calibre,numero_serie,numero_craf")
        .eq("qa_cliente_id", clienteId)
        .order("id", { ascending: false });
      setArmas(((data as any[]) || []) as ArmaBancada[]);
      if (doc.arma_numero_serie) {
        const match = (data as any[] || []).find((a) =>
          a.numero_serie && a.numero_serie.trim().toUpperCase() === doc.arma_numero_serie?.trim().toUpperCase());
        if (match) setVincularArmaId(String(match.id));
      }
    })();
  }, [clienteId, doc.arma_numero_serie]);

  const armaSelecionada = useMemo(
    () => armas.find((a) => String(a.id) === vincularArmaId) || null,
    [armas, vincularArmaId],
  );

  // Detecta conflito quando o usuário marca vínculo e os dados divergem.
  const conflitos = useMemo(() => {
    if (!armaSelecionada) return [] as string[];
    const out: string[] = [];
    const cmp = (campo: string, atual: string | null, novo: string) => {
      if (atual && novo && atual.trim().toUpperCase() !== novo.trim().toUpperCase())
        out.push(`${campo}: atual "${atual}" ≠ autorização "${novo}"`);
    };
    cmp("Marca", armaSelecionada.marca, marca);
    cmp("Modelo", armaSelecionada.modelo, modelo);
    cmp("Calibre", armaSelecionada.calibre, calibre);
    cmp("Nº série", armaSelecionada.numero_serie, serie);
    return out;
  }, [armaSelecionada, marca, modelo, calibre, serie]);

  const onSave = async () => {
    if (!numero.trim() && !validade.trim()) {
      toast.error("Informe ao menos número ou validade da autorização.");
      return;
    }
    setSaving(true);
    try {
      const updates: any = {
        numero_documento: numero.trim().toUpperCase() || null,
        data_emissao: ddMmToIso(emissao),
        data_validade: ddMmToIso(validade),
        orgao_emissor: orgao.trim().toUpperCase() || null,
        arma_especie: especie.trim().toUpperCase() || null,
        arma_marca: marca.trim().toUpperCase() || null,
        arma_modelo: modelo.trim().toUpperCase() || null,
        arma_calibre: calibre.trim().toUpperCase() || null,
        arma_numero_serie: serie.trim().toUpperCase() || null,
        observacoes: obs.trim() || null,
        ia_status: "concluido",
        validado_admin: true,
        validado_em: new Date().toISOString(),
        status: doc.status && doc.status !== "EM_ANALISE" ? doc.status : "VALIDA",
        ia_dados_extraidos: {
          ...(doc.ia_dados_extraidos || {}),
          editado_manualmente_em: new Date().toISOString(),
          revisao_necessaria: !!vincularArmaId && conflitos.length > 0 && !sobrescrever,
        },
      };
      const { error } = await supabase
        .from("qa_documentos_cliente" as any)
        .update(updates)
        .eq("id", doc.id);
      if (error) throw error;

      // Vínculo opcional. Só sobrescreve dados da arma se o usuário
      // confirmou explicitamente.
      if (vincularArmaId && sobrescrever) {
        const armaUpdates: any = { updated_at: new Date().toISOString() };
        if (marca.trim()) armaUpdates.marca = marca.trim().toUpperCase();
        if (modelo.trim()) armaUpdates.modelo = modelo.trim().toUpperCase();
        if (calibre.trim()) armaUpdates.calibre = calibre.trim().toUpperCase();
        if (serie.trim()) armaUpdates.numero_serie = serie.trim().toUpperCase();
        const { error: aErr } = await supabase
          .from("qa_cliente_armas_manual" as any)
          .update(armaUpdates)
          .eq("id", Number(vincularArmaId))
          .eq("qa_cliente_id", clienteId);
        if (aErr) toast.error(`Autorização salva, mas falhou atualizar arma: ${aErr.message}`);
      }

      toast.success("Autorização salva.");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar autorização.");
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
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <h3 className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-800">
            Editar autorização
          </h3>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3 p-4 text-[12px]">
          <Field label="Número da autorização" value={numero} onChange={setNumero} uppercase />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data emissão" value={emissao} onChange={(v) => setEmissao(applyDateMask(v))} placeholder="DD/MM/AAAA" />
            <Field label="Data validade *" value={validade} onChange={(v) => setValidade(applyDateMask(v))} placeholder="DD/MM/AAAA" />
          </div>
          <Field label="Órgão emissor" value={orgao} onChange={setOrgao} uppercase placeholder="POLÍCIA FEDERAL / EXÉRCITO" />

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">Arma autorizada</div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Espécie" value={especie} onChange={setEspecie} uppercase placeholder="PISTOLA / REVÓLVER" />
                <Field label="Calibre" value={calibre} onChange={setCalibre} uppercase />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Marca" value={marca} onChange={setMarca} uppercase />
                <Field label="Modelo" value={modelo} onChange={setModelo} uppercase />
              </div>
              <Field label="Nº de série" value={serie} onChange={setSerie} uppercase />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Observações
            </label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12px]"
            />
          </div>

          {armas.length > 0 && (
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Vincular à arma da Bancada Tática (opcional)
              </label>
              <select
                value={vincularArmaId}
                onChange={(e) => { setVincularArmaId(e.target.value); setSobrescrever(false); }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px] uppercase"
              >
                <option value="">— Não vincular —</option>
                {armas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {[a.marca, a.modelo, a.calibre].filter(Boolean).join(" ").toUpperCase()}
                    {a.numero_serie ? ` • SÉRIE ${a.numero_serie}` : ""}
                  </option>
                ))}
              </select>
              {vincularArmaId && conflitos.length > 0 && (
                <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-800">
                  <div className="mb-1 flex items-center gap-1 font-bold uppercase">
                    <AlertTriangle className="h-3 w-3" /> Conflito com arma vinculada
                  </div>
                  <ul className="ml-3 list-disc space-y-0.5">
                    {conflitos.map((c, i) => (<li key={i}>{c}</li>))}
                  </ul>
                  <label className="mt-2 flex items-center gap-1.5">
                    <input type="checkbox" checked={sobrescrever} onChange={(e) => setSobrescrever(e.target.checked)} />
                    <span>Sobrescrever dados da arma (confirmação manual)</span>
                  </label>
                  {!sobrescrever && (
                    <p className="mt-1 italic">
                      Sem confirmação, autorização é salva como “revisão necessária pela Equipe Quero Armas”.
                    </p>
                  )}
                </div>
              )}
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
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-50"
            style={{ background: "#7A1F2B" }}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Salvar autorização
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, uppercase,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  uppercase?: boolean;
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
        className={`h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px] ${uppercase ? "uppercase" : ""}`}
      />
    </div>
  );
}