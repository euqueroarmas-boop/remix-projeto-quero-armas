import { ArrowLeft, ChevronRight, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";
import type { DadosExtraidos } from "./PrePilotoWizard";

interface Props {
  dadosExtraidos: DadosExtraidos;
  dadosRevisados: Record<string, string | null>;
  setDadosRevisados: (d: Record<string, string | null>) => void;
  onAvancar: () => void;
  onVoltar: () => void;
}

const CAMPOS_ORDENADOS: { key: string; label: string; required?: boolean }[] = [
  { key: "nome_completo", label: "Nome Completo", required: true },
  { key: "cpf", label: "CPF", required: true },
  { key: "data_nascimento", label: "Data de Nascimento" },
  { key: "nome_mae", label: "Nome da Mãe" },
  { key: "nome_pai", label: "Nome do Pai" },
  { key: "email", label: "E-mail" },
  { key: "celular", label: "Celular/WhatsApp" },
  { key: "sexo", label: "Sexo" },
  { key: "rg", label: "RG" },
  { key: "rg_orgao_emissor", label: "Órgão Emissor RG" },
  { key: "cep", label: "CEP" },
  { key: "logradouro", label: "Logradouro" },
  { key: "numero", label: "Número" },
  { key: "complemento", label: "Complemento" },
  { key: "bairro", label: "Bairro" },
  { key: "cidade", label: "Cidade" },
  { key: "estado", label: "Estado (UF)" },
  { key: "profissao", label: "Profissão" },
  { key: "renda_mensal", label: "Renda Mensal" },
  { key: "senha_gov", label: "Senha GOV.BR (criptografada no banco)" },
];

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
  const { lookupCep, cepLoading } = useBrasilApiLookup();

  const set = (campo: string, valor: string) =>
    setDadosRevisados({ ...dadosRevisados, [campo]: valor || null });

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

  // Campos com confiança baixa
  const alertas = dadosExtraidos.confidence_pairs.filter((p) => p.confidence < 0.6 && p.valor);
  const temObrigatorios = !!(dadosRevisados.nome_completo?.trim() && dadosRevisados.cpf?.trim());

  // Inclui todos os campos extraídos que não estão na lista ordenada
  const camposExtras = Object.keys(dadosExtraidos.campos).filter(
    (k) => !CAMPOS_ORDENADOS.some((c) => c.key === k)
  );

  const todosOsCampos = [
    ...CAMPOS_ORDENADOS,
    ...camposExtras.map((k) => ({ key: k, label: k.replace(/_/g, " ") })),
  ];

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {todosOsCampos.map((campo) => {
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
              </div>
              <Input
                value={valor || ""}
                onChange={(e) => set(key, e.target.value)}
                onBlur={key === "cep" ? (e) => handleCepBlur(e.target.value) : undefined}
                className={`text-xs h-7 ${confidenceColor(conf)}`}
                placeholder={required ? "Obrigatório" : "Não extraído"}
              />
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
