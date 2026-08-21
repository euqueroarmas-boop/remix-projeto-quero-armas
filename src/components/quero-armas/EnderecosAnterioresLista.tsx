// ============================================================================
// EnderecosAnterioresLista
// ----------------------------------------------------------------------------
// Onde o cliente declara os estados e cidades em que morou nos últimos 5 anos.
//
// POR QUE ISSO EXISTE
// O SINARM CAC e o SIGMA exigem certidão de antecedentes de CADA estado onde a
// pessoa residiu no período. Quem morou em São Paulo, Minas, Paraná, Rondônia e
// Rio Grande do Sul apresenta as certidões dos cinco estados.
//
// O QUE IMPORTA NO FIM
// Só o ESTADO. Várias cidades do mesmo estado geram um bloco de certidões só —
// a cidade fica como registro, para a conferência do dossiê. Por isso a lista
// aceita quantas linhas o cliente quiser e a deduplicação por estado acontece
// depois, no banco (qa_seed_certidoes_estados_anteriores).
//
// Componente CONTROLADO de propósito: quem monta a tela decide se grava em
// qa_cliente_enderecos_anteriores (portal e equipe) ou se leva junto no payload
// do cadastro público, onde o cliente ainda não existe.
// ============================================================================
import { Plus, Trash2 } from "lucide-react";

import { MunicipioSelect, UfSelect } from "@/components/quero-armas/portal/CampoLocalidadeSelect";
import {
  type EnderecoAnterior,
  estadosDistintos,
} from "@/lib/quero-armas/enderecosAnteriores";

const INPUT =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-800 " +
  "focus:border-[#7A1F2B] focus:outline-none disabled:bg-slate-50 disabled:text-slate-400";

export function EnderecosAnterioresLista({
  valor,
  onChange,
  ufAtual,
  disabled,
}: {
  valor: EnderecoAnterior[];
  onChange: (v: EnderecoAnterior[]) => void;
  /** UF do endereço do comprovante — serve só para avisar quando repete. */
  ufAtual?: string | null;
  disabled?: boolean;
}) {
  const linhas = valor.length > 0 ? valor : [{ uf: "", cidade: "" }];
  const atual = String(ufAtual || "").trim().toUpperCase();

  const editar = (i: number, patch: Partial<EnderecoAnterior>) => {
    const proximo = linhas.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
    onChange(proximo);
  };

  const remover = (i: number) => {
    const proximo = linhas.filter((_, idx) => idx !== i);
    onChange(proximo.length > 0 ? proximo : [{ uf: "", cidade: "" }]);
  };

  const estados = estadosDistintos(linhas, atual);

  return (
    <div className="space-y-2">
      {linhas.map((linha, i) => {
        const repetido = linha.uf && linha.uf.toUpperCase() === atual;
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Estado
                </label>
                <UfSelect
                  className={INPUT}
                  value={linha.uf || ""}
                  onChange={(v) => editar(i, { uf: v, cidade: "" })}
                />
              </div>
              <div className="flex-1">
                <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Cidade
                </label>
                <MunicipioSelect
                  className={INPUT}
                  uf={linha.uf || ""}
                  value={linha.cidade || ""}
                  onChange={(v) => editar(i, { cidade: v })}
                />
              </div>
              <button
                type="button"
                aria-label="Remover este endereço"
                disabled={disabled}
                onClick={() => remover(i)}
                className="mb-[1px] flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-500 transition-colors hover:border-red-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {repetido && (
              <p className="text-[10px] leading-snug text-amber-800">
                Este é o mesmo estado do seu endereço atual — ele não gera certidão
                extra, porque as certidões desse estado você já vai tirar.
              </p>
            )}
          </div>
        );
      })}

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...linhas, { uf: "", cidade: "" }])}
        className="flex h-9 items-center gap-1.5 rounded-md border border-dashed border-slate-400 px-3 text-[12px] font-bold uppercase tracking-wider text-slate-600 transition-colors hover:border-[#7A1F2B] hover:text-[#7A1F2B]"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar outro endereço
      </button>

      {estados.length > 0 && (
        <p className="text-[11px] leading-snug text-slate-600">
          Você vai precisar das certidões de{" "}
          <strong>{estados.join(", ")}</strong>
          {estados.length === 1 ? " (1 estado)" : ` (${estados.length} estados)`}, além
          das do seu estado atual. Elas aparecem no checklist em um bloco separado.
        </p>
      )}
    </div>
  );
}
