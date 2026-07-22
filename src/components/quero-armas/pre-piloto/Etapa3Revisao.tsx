import { ArrowLeft, ChevronRight, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";
import type { DadosExtraidos } from "./PrePilotoWizard";

// Valida o dígito verificador do CNPJ (algoritmo da Receita Federal).
function cnpjValido(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const dv1 = calc(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = calc(d.slice(0, 12) + dv1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d === d.slice(0, 12) + String(dv1) + String(dv2);
}

interface Props {
  dadosExtraidos: DadosExtraidos;
  dadosRevisados: Record<string, string | null>;
  setDadosRevisados: (d: Record<string, string | null>) => void;
  onAvancar: () => void;
  onVoltar: () => void;
}

type Campo = { key: string; label: string; required?: boolean };

const CATEGORIAS_ORDENADAS = [
  "Dados Pessoais",
  "Documentos",
  "Contato",
  "Endereço",
  "Endereço Secundário",
  "Certificado de Registro (CR)",
  "Exames",
  "Acesso à Plataforma",
  "Outros",
] as const;

const CAMPOS_POR_CATEGORIA: Record<(typeof CATEGORIAS_ORDENADAS)[number], Campo[]> = {
  "Dados Pessoais": [
    { key: "nome_completo", label: "Nome Completo", required: true },
    { key: "cpf", label: "CPF", required: true },
    { key: "data_nascimento", label: "Data de Nascimento" },
    { key: "sexo", label: "Sexo" },
    { key: "nome_mae", label: "Nome da Mãe" },
    { key: "nome_pai", label: "Nome do Pai" },
    { key: "estado_civil", label: "Estado Civil" },
    { key: "nacionalidade", label: "Nacionalidade" },
    { key: "naturalidade_municipio", label: "Naturalidade (Município)" },
    { key: "naturalidade_uf", label: "Naturalidade (UF)" },
    { key: "naturalidade_pais", label: "Naturalidade (País)" },
    { key: "escolaridade", label: "Escolaridade" },
    { key: "profissao", label: "Profissão" },
    { key: "renda_mensal", label: "Renda Mensal" },
  ],
  "Documentos": [
    { key: "tipo_documento_identidade", label: "Tipo de Documento (RG/CIN)" },
    { key: "rg", label: "RG" },
    { key: "rg_orgao_emissor", label: "Órgão Emissor RG" },
    { key: "uf_emissor_rg", label: "UF Emissor RG" },
    { key: "data_expedicao_rg", label: "Data de Expedição RG" },
    { key: "cnh", label: "CNH" },
    { key: "ctps", label: "CTPS" },
    { key: "pis_pasep", label: "PIS/PASEP" },
    { key: "titulo_eleitor", label: "Título de Eleitor" },
    { key: "cnpj", label: "CNPJ (comprovação de ocupação lícita)" },
  ],
  "Contato": [
    { key: "email", label: "E-mail" },
    { key: "celular", label: "Celular/WhatsApp" },
    { key: "telefone_secundario", label: "Telefone Secundário" },
  ],
  "Endereço": [
    { key: "cep", label: "CEP" },
    { key: "logradouro", label: "Logradouro" },
    { key: "numero", label: "Número" },
    { key: "complemento", label: "Complemento" },
    { key: "bairro", label: "Bairro" },
    { key: "cidade", label: "Cidade" },
    { key: "estado", label: "Estado (UF)" },
    { key: "pais", label: "País" },
  ],
  "Endereço Secundário": [
    { key: "cep_secundario", label: "CEP Secundário" },
    { key: "endereco_secundario", label: "Logradouro Secundário" },
    { key: "numero_secundario", label: "Número Secundário" },
    { key: "complemento_secundario", label: "Complemento Secundário" },
    { key: "bairro_secundario", label: "Bairro Secundário" },
    { key: "cidade_secundario", label: "Cidade Secundária" },
    { key: "estado_secundario", label: "Estado Secundário" },
    { key: "pais_secundario", label: "País Secundário" },
  ],
  "Certificado de Registro (CR)": [
    { key: "cr_numero", label: "Número do CR" },
    { key: "cr_categoria", label: "Categoria (Atirador/Caçador/Colecionador)" },
    { key: "cr_data_emissao", label: "Data de Emissão" },
    { key: "cr_data_validade", label: "Data de Validade" },
    { key: "cr_orgao_emissor", label: "Órgão Emissor" },
  ],
  "Exames": [
    { key: "data_realizacao_exame_psicologico", label: "Data do Exame Psicológico" },
    { key: "data_realizacao_exame_tiro", label: "Data do Exame de Tiro" },
    { key: "validade_laudo_psicologico", label: "Validade do Laudo Psicológico (legado)" },
    { key: "validade_exame_tiro", label: "Validade do Exame de Tiro (legado)" },
  ],
  "Acesso à Plataforma": [
    { key: "senha_gov", label: "Senha GOV.BR (criptografada no banco)" },
  ],
  "Outros": [
    { key: "observacoes", label: "Observações" },
  ],
};

const CAMPOS_ORDENADOS: Campo[] = CATEGORIAS_ORDENADAS.flatMap((cat) => CAMPOS_POR_CATEGORIA[cat]);

function getConfidence(pairs: DadosExtraidos["confidence_pairs"], campo: string): number | null {
  const p = pairs.find((c) => c.campo === campo);
  return p?.confidence ?? null;
}

function confidenceColor(c: number | null): string {
  if (c === null) return "";
  if (c >= 0.85) return "border-green-400 bg-green-50";
  if (c >= 0.6) return "border-yellow-400 bg-yellow-50";
  return "border-red-400 bg-red-50";
}

function confidenceBadge(c: number | null) {
  if (c === null) return null;
  const pct = Math.round(c * 100);
  const color = c >= 0.85 ? "text-green-700 bg-green-100" : c >= 0.6 ? "text-yellow-700 bg-yellow-100" : "text-red-700 bg-red-100";
  return <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${color}`}>{pct}%</span>;
}

export default function Etapa3Revisao({ dadosExtraidos, dadosRevisados, setDadosRevisados, onAvancar, onVoltar }: Props) {
  const { lookupCep, lookupCnpj, cepLoading, cnpjLoading } = useBrasilApiLookup();

  // Todo campo sai em maiúsculas — padrão de documentos brasileiros — exceto
  // e-mail e senha GOV.BR, que são transcrição literal (nunca alterados).
  const CAMPOS_SEM_MAIUSCULA = new Set(["email", "senha_gov"]);
  const set = (campo: string, valor: string) =>
    setDadosRevisados({
      ...dadosRevisados,
      [campo]: CAMPOS_SEM_MAIUSCULA.has(campo) ? (valor || null) : (valor ? valor.toUpperCase() : null),
    });

  // Digitar o CEP nesta tela é uma correção deliberada da equipe (diferente
  // da extração automática da IA, que não deve sobrescrever o que já leu do
  // documento sem revisão humana). Aqui a pessoa está conferindo o CEP de
  // propósito — CEP/Correios costuma ser mais confiável que o texto digitado
  // por um atendente de concessionária, então o resultado sempre sobrescreve
  // logradouro/bairro/cidade/estado.
  const handleCepBlur = async (valorDigitado: string) => {
    const digits = valorDigitado.replace(/\D/g, "");
    if (digits.length !== 8) return;
    const resultado = await lookupCep(digits);
    if (!resultado) return;
    const rua = resultado.street?.toUpperCase();
    const bairro = resultado.neighborhood?.toUpperCase();
    const cidade = resultado.city?.toUpperCase();
    const estado = resultado.state?.toUpperCase();
    setDadosRevisados({
      ...dadosRevisados,
      cep: valorDigitado,
      ...(rua ? { logradouro: rua, endereco: rua } : {}),
      ...(bairro ? { bairro } : {}),
      ...(cidade ? { cidade } : {}),
      ...(estado ? { estado } : {}),
    });
  };

  // CNPJ nesta tela é evidência de ocupação lícita do cliente PF (Estatuto
  // do Desarmamento), não cadastro de empresa — enriquece só profissão e
  // observações. Digitar aqui é correção deliberada, então sempre sobrescreve.
  const handleCnpjBlur = async (valorDigitado: string) => {
    const digits = valorDigitado.replace(/\D/g, "");
    if (digits.length !== 14) return;
    if (!cnpjValido(digits)) {
      toast.error("CNPJ inválido — dígito verificador não confere. Confira o número digitado.");
      return;
    }
    const resultado = await lookupCnpj(digits);
    if (!resultado?.razao_social) {
      toast.error("CNPJ não encontrado na Receita Federal.");
      return;
    }
    const profissao = [
      `SÓCIO/PROPRIETÁRIO — ${resultado.razao_social}`,
      resultado.cnae_fiscal_descricao,
    ].filter(Boolean).join(" — ").toUpperCase();
    const enderecoEmpresa = [
      resultado.logradouro,
      resultado.numero && `nº ${resultado.numero}`,
      resultado.complemento,
      resultado.bairro,
      resultado.municipio && resultado.uf ? `${resultado.municipio}/${resultado.uf}` : resultado.municipio,
      resultado.cep && `CEP ${resultado.cep}`,
    ].filter(Boolean).join(", ");
    const notaCnpj = [
      `CNPJ informado: ${valorDigitado}.`,
      `Razão social: ${resultado.razao_social}.`,
      resultado.nome_fantasia && `Nome fantasia: ${resultado.nome_fantasia}.`,
      resultado.cnae_fiscal_descricao && `Atividade: ${resultado.cnae_fiscal_descricao}.`,
      enderecoEmpresa && `Endereço: ${enderecoEmpresa}.`,
      resultado.ddd_telefone_1 && `Telefone: ${resultado.ddd_telefone_1}.`,
    ].filter(Boolean).join(" ").toUpperCase();
    const observacoesAtuais = (dadosRevisados.observacoes || "").trim();
    setDadosRevisados({
      ...dadosRevisados,
      cnpj: valorDigitado,
      profissao,
      observacoes: [observacoesAtuais, notaCnpj].filter(Boolean).join(" "),
    });
    toast.success(`Dados da empresa preenchidos: ${resultado.razao_social}`);
  };

  // Campos com confiança baixa
  const alertas = dadosExtraidos.confidence_pairs.filter((p) => p.confidence < 0.6 && p.valor);
  const temObrigatorios = !!(dadosRevisados.nome_completo?.trim() && dadosRevisados.cpf?.trim());

  // Campos extraídos que não têm categoria mapeada caem em "Outros",
  // junto de observações — evita perder dado extraído sem bagunçar as
  // seções conhecidas.
  const camposExtras = Object.keys(dadosExtraidos.campos).filter(
    (k) => !CAMPOS_ORDENADOS.some((c) => c.key === k)
  );
  const camposPorCategoria: Record<string, Campo[]> = {
    ...CAMPOS_POR_CATEGORIA,
    "Outros": [
      ...CAMPOS_POR_CATEGORIA["Outros"],
      ...camposExtras
        .filter((k) => k !== "acervo")
        .map((k) => ({ key: k, label: k.replace(/_/g, " ") })),
    ],
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold mb-1">Etapa 3 — Revisão dos Dados</h2>
        <p className="text-xs text-muted-foreground">
          Confira e corrija os dados extraídos pela IA antes de salvar. As cores indicam o nível de confiança da extração.
        </p>
      </div>

      {alertas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-800">Campos com baixa confiança — revise</p>
            <ul className="text-xs text-amber-700 mt-0.5 list-disc list-inside">
              {alertas.map((a) => (
                <li key={a.campo}>{a.campo.replace(/_/g, " ")}: <em>{a.valor}</em></li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {dadosExtraidos.warnings?.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <p className="text-xs font-semibold text-blue-800">Avisos da IA</p>
          <ul className="text-xs text-blue-700 mt-0.5 list-disc list-inside">
            {dadosExtraidos.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <div className="space-y-6">
        {CATEGORIAS_ORDENADAS.map((categoria) => {
          const campos = camposPorCategoria[categoria];
          const temAlgumValor = campos.some((c) => dadosRevisados[c.key] || dadosExtraidos.campos[c.key]);
          // Seções totalmente vazias (nenhum campo extraído nem preenchido)
          // ficam ocultas — evita mostrar "Endereço Secundário" ou "Exames"
          // em branco quando o cliente não tem esses dados.
          if (categoria !== "Dados Pessoais" && categoria !== "Endereço" && !temAlgumValor) return null;
          return (
            <div key={categoria}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 pb-1 border-b">
                {categoria}
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {campos.map((campo) => {
                  const { key, label } = campo;
                  const required = (campo as { required?: boolean }).required;
                  const conf = getConfidence(dadosExtraidos.confidence_pairs, key);
                  const valor = dadosRevisados[key] ?? "";
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[11px] font-medium">
                          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                        </Label>
                        {confidenceBadge(conf)}
                        {key === "cep" && cepLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                        {key === "cnpj" && cnpjLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>
                      <Input
                        value={valor || ""}
                        onChange={(e) => set(key, e.target.value)}
                        onBlur={
                          key === "cep" ? (e) => handleCepBlur(e.target.value)
                          : key === "cnpj" ? (e) => handleCnpjBlur(e.target.value)
                          : undefined
                        }
                        className={`text-xs h-7 ${confidenceColor(conf)}`}
                        placeholder={required ? "Obrigatório" : "Não extraído"}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" size="sm" onClick={onVoltar} className="text-xs gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </Button>
        <Button
          onClick={onAvancar}
          disabled={!temObrigatorios}
          className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1"
          size="sm"
        >
          Salvar Cliente <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
