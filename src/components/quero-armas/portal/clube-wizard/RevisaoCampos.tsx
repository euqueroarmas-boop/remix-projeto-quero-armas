// ============================================================================
// RevisaoCampos
// ----------------------------------------------------------------------------
// Exibe os campos finais (clube + filiação) com edição inline antes de
// confirmar e chamar qa-clube-sugerir.
// ============================================================================
import { ClubeFiliacaoFormState } from "./types";

interface Props {
  state: ClubeFiliacaoFormState;
  onChange: (next: ClubeFiliacaoFormState) => void;
  origem: "catalogo" | "declaracao" | "manual";
  readonlyNome?: boolean;
}

const LABELS: Array<{ key: keyof ClubeFiliacaoFormState; label: string; placeholder?: string; upper?: boolean }> = [
  { key: "nome_clube", label: "Nome do clube", upper: true },
  { key: "cnpj", label: "CNPJ", placeholder: "00.000.000/0000-00" },
  { key: "numero_cr", label: "Número do CR" },
  { key: "data_cr", label: "Validade do CR", placeholder: "DD/MM/AAAA" },
  { key: "endereco", label: "Endereço completo", upper: true },
  { key: "cidade", label: "Cidade", upper: true },
  { key: "uf", label: "UF", placeholder: "SP" },
  { key: "numero_filiacao", label: "Número de filiação" },
  { key: "validade_filiacao", label: "Validade da filiação", placeholder: "DD/MM/AAAA" },
];

const ORIGEM_LABEL: Record<Props["origem"], string> = {
  catalogo: "Catálogo Quero Armas",
  declaracao: "Declaração enviada",
  manual: "Preenchido por você",
};

export default function RevisaoCampos({ state, onChange, origem, readonlyNome }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[14px] font-extrabold text-slate-900">Revise antes de confirmar</h4>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
          Origem: {ORIGEM_LABEL[origem]}
        </span>
      </div>
      <p className="text-[12px] text-slate-500">Você pode ajustar qualquer dado abaixo antes de confirmar.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LABELS.map((f) => {
          const isLocked = readonlyNome && f.key === "nome_clube";
          return (
            <div key={f.key} className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{f.label}</label>
              <input
                value={state[f.key] || ""}
                readOnly={isLocked}
                onChange={(e) => {
                  const v = f.upper ? e.target.value.toUpperCase() : e.target.value;
                  onChange({ ...state, [f.key]: v });
                }}
                placeholder={f.placeholder}
                className={
                  "w-full rounded-lg border bg-white px-3 py-2 text-[13px] uppercase outline-none " +
                  (isLocked
                    ? "border-slate-200 text-slate-500 bg-slate-50 cursor-not-allowed"
                    : "border-slate-300 text-slate-900 focus:border-[#7A1F2B] focus:ring-2 focus:ring-[#FBE2E6]")
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}