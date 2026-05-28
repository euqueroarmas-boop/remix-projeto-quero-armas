// ============================================================================
// DivergenciasResolverPanel
// ----------------------------------------------------------------------------
// Painel exibido na fase "resultado_erro" do ChecklistGuiadoModal quando a
// IA detectou divergências entre o documento e o cadastro do cliente.
//
// Separa as divergências por GRUPO (nome, endereço, RG, CPF, data de
// nascimento, telefone/e-mail e outros) e mostra para cada grupo as ações
// possíveis (atualizar cadastro com dados do documento, certidão averbada,
// reenviar, marcar comprovante como antigo, etc.).
//
// 100% aditivo: NÃO substitui o fluxo de aprovação/reprovação por IA. Apenas
// orquestra o que o cliente pode fazer DEPOIS de receber o veredito.
// ============================================================================

import { useMemo } from "react";
import {
  AlertTriangle,
  FileText,
  Home,
  IdCard,
  Loader2,
  Phone,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  User,
} from "lucide-react";

const MARROM = "#7A1F2B";

export interface DivergenciaItem {
  campo: string;
  valor_documento?: string | null;
  valor_cadastro?: string | null;
  severidade?: "baixa" | "media" | "alta" | string | null;
}

export type GrupoDivergencia =
  | "nome"
  | "endereco"
  | "rg"
  | "cpf"
  | "data_nascimento"
  | "contato"
  | "outros";

const GRUPO_LABEL: Record<GrupoDivergencia, string> = {
  nome: "Nome diferente",
  endereco: "Endereço diferente",
  rg: "Documento de identidade diferente",
  cpf: "CPF diferente",
  data_nascimento: "Data de nascimento diferente",
  contato: "Contato diferente",
  outros: "Outras diferenças",
};

const GRUPO_ICON: Record<GrupoDivergencia, any> = {
  nome: User,
  endereco: Home,
  rg: IdCard,
  cpf: ShieldAlert,
  data_nascimento: ShieldAlert,
  contato: Phone,
  outros: AlertTriangle,
};

// Mapeia o `campo` reportado pela IA (vem em snake_case "nome", "endereco",
// "logradouro", "rg", "cpf"...) para um grupo lógico.
const CAMPO_PARA_GRUPO: Record<string, GrupoDivergencia> = {
  // Nome
  nome: "nome",
  nome_titular: "nome",
  nome_completo: "nome",
  titular: "nome",
  titular_comprovante_nome: "nome",
  // Endereço
  endereco: "endereco",
  logradouro: "endereco",
  numero: "endereco",
  complemento: "endereco",
  bairro: "endereco",
  cidade: "endereco",
  uf: "endereco",
  estado: "endereco",
  cep: "endereco",
  endereco_logradouro: "endereco",
  endereco_numero: "endereco",
  endereco_complemento: "endereco",
  endereco_bairro: "endereco",
  endereco_cidade: "endereco",
  endereco_uf: "endereco",
  endereco_estado: "endereco",
  endereco_cep: "endereco",
  // RG
  rg: "rg",
  orgao_emissor: "rg",
  emissor_rg: "rg",
  uf_emissao: "rg",
  uf_emissor_rg: "rg",
  data_emissao: "rg",
  expedicao_rg: "rg",
  // CPF / Nascimento
  cpf: "cpf",
  data_nascimento: "data_nascimento",
  // Contato
  telefone: "contato",
  celular: "contato",
  email: "contato",
};

/** Colunas de qa_clientes elegíveis para atualização em cada grupo. */
export const GRUPO_PARA_COLUNAS_CADASTRO: Record<GrupoDivergencia, string[]> = {
  nome: ["nome"],
  endereco: ["endereco", "numero", "complemento", "bairro", "cidade", "estado", "cep"],
  rg: ["rg", "emissor_rg", "uf_emissor_rg", "expedicao_rg"],
  cpf: [],
  data_nascimento: [],
  contato: ["celular"],
  outros: [],
};

function classificarCampo(campo: string): GrupoDivergencia {
  const k = String(campo || "").toLowerCase().trim();
  if (CAMPO_PARA_GRUPO[k]) return CAMPO_PARA_GRUPO[k];
  // Heurística por substring — cobre variações tipo `endereco_logradouro`,
  // `endereco_numero`, `dados_endereco_cep`, `titular_nome`, etc.
  if (/(endere[cç]o|logradouro|^rua$|avenida|travessa|^numero$|n[uú]mero|bairro|cidade|estado|^uf$|^cep$|complemento)/.test(k)) {
    return "endereco";
  }
  if (/(^nome|titular)/.test(k)) return "nome";
  if (/(^rg$|identidade|emissor|expedi[cç][aã]o)/.test(k)) return "rg";
  if (/^cpf/.test(k)) return "cpf";
  if (/nascimento/.test(k)) return "data_nascimento";
  if (/(telefone|celular|e-?mail)/.test(k)) return "contato";
  return "outros";
}

/**
 * Fallback quando o documento foi validado por uma versão antiga da IA que
 * não populou `divergencias_json`. Lê palavras-chave em `motivo_rejeicao`
 * para inferir grupos.
 */
function gruposDoMotivo(motivo: string): GrupoDivergencia[] {
  const t = String(motivo || "").toLowerCase();
  const out = new Set<GrupoDivergencia>();
  if (/\bnome\b|\btitular\b/.test(t)) out.add("nome");
  if (/\bendere[çc]o\b|\blogradour|\brua\b|\bavenida\b|\bcep\b|\bbairro\b|\bcidade\b/.test(t)) out.add("endereco");
  if (/\brg\b|\bidentidade\b|\borg[aã]o emissor\b/.test(t)) out.add("rg");
  if (/\bcpf\b/.test(t)) out.add("cpf");
  if (/\bnascimento\b/.test(t)) out.add("data_nascimento");
  if (/\btelefone\b|\bcelular\b|\be-?mail\b/.test(t)) out.add("contato");
  return Array.from(out);
}

export interface AgrupamentoDivergencias {
  grupo: GrupoDivergencia;
  itens: DivergenciaItem[];
}

export function agruparDivergencias(
  divergencias: DivergenciaItem[] | null | undefined,
  motivoRejeicao: string | null | undefined,
): AgrupamentoDivergencias[] {
  const map = new Map<GrupoDivergencia, DivergenciaItem[]>();
  const lista = Array.isArray(divergencias) ? divergencias : [];
  for (const d of lista) {
    const g = classificarCampo(d?.campo || "");
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(d);
  }
  // Fallback: motivo_rejeicao menciona grupos sem item correspondente.
  if (map.size === 0) {
    for (const g of gruposDoMotivo(motivoRejeicao || "")) {
      if (!map.has(g)) map.set(g, []);
    }
  }
  // Ordem estável: nome > endereço > rg > contato > cpf > data_nasc > outros
  const ordem: GrupoDivergencia[] = [
    "nome", "endereco", "rg", "contato", "cpf", "data_nascimento", "outros",
  ];
  return ordem
    .filter((g) => map.has(g))
    .map((g) => ({ grupo: g, itens: map.get(g) || [] }));
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export interface DivergenciasResolverPanelProps {
  divergencias: DivergenciaItem[] | null | undefined;
  motivoRejeicao: string | null | undefined;
  /** Bloqueia ações de "atualizar cadastro com X". */
  altNomeJaComprovada?: boolean;
  iniciandoAltNome?: boolean;
  podeAtualizarCadastro?: boolean;
  onIniciarAlteracaoNome: () => void;
  onAtualizarCadastroComGrupo: (grupo: GrupoDivergencia) => void;
  onMarcarComprovanteAntigo: () => void;
  onReenviarDocumento: () => void;
  /** Abre o editor de cadastro pré-preenchido com os valores atuais. */
  onEditarCadastroManual?: (grupo: GrupoDivergencia) => void;
}

export default function DivergenciasResolverPanel({
  divergencias,
  motivoRejeicao,
  altNomeJaComprovada,
  iniciandoAltNome,
  podeAtualizarCadastro = true,
  onIniciarAlteracaoNome,
  onAtualizarCadastroComGrupo,
  onMarcarComprovanteAntigo,
  onReenviarDocumento,
  onEditarCadastroManual,
}: DivergenciasResolverPanelProps) {
  const grupos = useMemo(
    () => agruparDivergencias(divergencias, motivoRejeicao),
    [divergencias, motivoRejeicao],
  );

  if (grupos.length === 0) return null;

  return (
    <div className="w-full space-y-2 text-left">
      <p className="text-[12px] text-slate-600">
        Encontramos diferenças entre o documento e seu cadastro. Resolva cada
        uma abaixo.
      </p>

      {grupos.map(({ grupo, itens }) => {
        const Icon = GRUPO_ICON[grupo];
        const oculto = grupo === "nome" && altNomeJaComprovada;
        if (oculto) return null;
        return (
          <div
            key={grupo}
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <div className="flex items-start gap-2">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: "#FBF3F4", color: MARROM }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-bold uppercase tracking-wider text-slate-700">
                  {GRUPO_LABEL[grupo]}
                </div>

                {/* Pares valor_documento × valor_cadastro */}
                {itens.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {itens.map((it, idx) => (
                      <div
                        key={`${it.campo}-${idx}`}
                        className="grid grid-cols-1 gap-1 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] sm:grid-cols-2"
                      >
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">
                            No cadastro
                          </div>
                          <div className="truncate italic text-slate-600">
                            {it.valor_cadastro?.trim() || "—"}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div
                            className="text-[10px] uppercase tracking-wider"
                            style={{ color: MARROM }}
                          >
                            No documento
                          </div>
                          <div className="truncate font-semibold text-slate-900">
                            {it.valor_documento?.trim() || "—"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Ações por grupo */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {grupo === "nome" && (
                    <>
                      <button
                        type="button"
                        disabled={!!iniciandoAltNome}
                        onClick={onIniciarAlteracaoNome}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold text-white disabled:opacity-60"
                        style={{ background: MARROM }}
                      >
                        {iniciandoAltNome ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" />
                        )}
                        Meu nome foi alterado em cartório
                      </button>
                      {podeAtualizarCadastro && (
                        <button
                          type="button"
                          onClick={() => onAtualizarCadastroComGrupo("nome")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Atualizar cadastro com este nome
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onReenviarDocumento}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Enviar outro documento
                      </button>
                    </>
                  )}

                  {grupo === "endereco" && (
                    <>
                      {podeAtualizarCadastro && (
                        <button
                          type="button"
                          onClick={() => onAtualizarCadastroComGrupo("endereco")}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold text-white"
                          style={{ background: MARROM }}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Atualizar cadastro com este endereço
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onReenviarDocumento}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Enviar comprovante atual
                      </button>
                      <button
                        type="button"
                        onClick={onMarcarComprovanteAntigo}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
                      >
                        Este comprovante é antigo
                      </button>
                    </>
                  )}

                  {grupo === "rg" && (
                    <>
                      {podeAtualizarCadastro && (
                        <button
                          type="button"
                          onClick={() => onAtualizarCadastroComGrupo("rg")}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold text-white"
                          style={{ background: MARROM }}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Atualizar cadastro com dados do documento
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onReenviarDocumento}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Enviar outro documento
                      </button>
                    </>
                  )}

                  {grupo === "contato" && (
                    <>
                      {podeAtualizarCadastro && (
                        <button
                          type="button"
                          onClick={() => onAtualizarCadastroComGrupo("contato")}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold text-white"
                          style={{ background: MARROM }}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Atualizar cadastro
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onReenviarDocumento}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
                      >
                        Manter cadastro
                      </button>
                    </>
                  )}

                  {(grupo === "cpf" || grupo === "data_nascimento") && (
                    <div className="w-full rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
                      <span className="font-bold uppercase tracking-wider">
                        Divergência sensível.{" "}
                      </span>
                      Envie outro documento ou aguarde revisão da equipe Quero
                      Armas. CPF e data de nascimento nunca são alterados
                      automaticamente.
                    </div>
                  )}

                  {grupo === "outros" && (
                    <button
                      type="button"
                      onClick={onReenviarDocumento}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Enviar outro documento
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}