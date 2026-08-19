import { useState } from "react";
import { ClipboardList, FileSearch, ClipboardCheck, UserPlus, FileSignature, Play } from "lucide-react";
import Etapa1Documentos from "./Etapa1Documentos";
import Etapa2Leitura from "./Etapa2Leitura";
import Etapa3Revisao from "./Etapa3Revisao";
import Etapa4Salvar from "./Etapa4Salvar";
import Etapa5Contrato from "./Etapa5Contrato";
import Etapa6Piloto from "./Etapa6Piloto";

export type CampoExtraido = {
  campo: string;
  valor: string | null;
  confidence: number;
};

export type DadosExtraidos = {
  campos: Record<string, string | null>;
  confidence_pairs: CampoExtraido[];
  warnings: string[];
  senha_gov?: string | null;
  senha_gov_ok?: boolean;
};

export type ArquivoUpload = {
  file: File;
  tipo: string;
  preview?: string;
  /** Tipo inicial inferido antes da classificação multimodal. */
  tipo_original?: string;
  /** Confiança da IA na classificação de tipo (0..1). Preenchido em Etapa 2. */
  tipo_ia_confianca?: number;
  /** Motivo textual da IA para a classificação. */
  tipo_ia_motivo?: string;
  /** Indica que a Central aplicou o tipo sugerido pela IA antes de gravar no Hub. */
  tipo_aplicado_por_ia?: boolean;
  /**
   * A IA discordou do tipo que o operador informou, e o tipo do operador foi
   * mantido. Existe para a divergência ficar VISÍVEL: até 15/08/2026 a IA
   * sobrescrevia o tipo informado, e foi assim que uma conta de luz entrou no
   * Hub como certidão militar e uma CNH como comprovante de residência.
   */
  tipo_ia_divergente?: string;
  /**
   * Data de emissão lida pela IA na classificação (ISO AAAA-MM-DD).
   * A Etapa 4 grava esse valor e calcula a validade pela regra do tipo — sem
   * ele, todo documento da Central de Adesão entrava no Hub "SEM DATA" e os
   * alertas de vencimento nunca disparavam.
   */
  data_emissao?: string;
  /**
   * Todos os campos que a IA extraiu do documento (nome, CPF, número, órgão,
   * datas...). A Central descartava tudo isso e gravava só tipo e confiança —
   * por isso os documentos dela chegavam ao Hub sem data e sem nada para a
   * validação cruzada comparar depois.
   */
  campos_extraidos?: Record<string, unknown>;
};

export type ClienteSalvo = {
  id: number;
  nome_completo: string;
  cpf: string | null;
  email: string | null;
  celular: string | null;
  existia: boolean;
};

const ETAPAS = [
  { label: "Documentos", icon: ClipboardList },
  { label: "Leitura IA", icon: FileSearch },
  { label: "Revisão", icon: ClipboardCheck },
  { label: "Salvar", icon: UserPlus },
  { label: "Contrato", icon: FileSignature },
  { label: "Piloto", icon: Play },
];

interface PrePilotoWizardProps {
  onContratoGerado?: () => void;
}

export default function PrePilotoWizard({ onContratoGerado }: PrePilotoWizardProps = {}) {
  const [etapa, setEtapa] = useState(0);
  const [arquivos, setArquivos] = useState<ArquivoUpload[]>([]);
  const [textoPastaColado, setTextoPastaColado] = useState("");
  const [dadosExtraidos, setDadosExtraidos] = useState<DadosExtraidos | null>(null);
  const [dadosRevisados, setDadosRevisados] = useState<Record<string, string | null>>({});
  const [clienteSalvo, setClienteSalvo] = useState<ClienteSalvo | null>(null);
  const [vendaContrato, setVendaContrato] = useState<{ id: number; legado: number | null } | null>(null);

  const avancar = () => setEtapa((e) => Math.min(e + 1, ETAPAS.length - 1));
  const voltar = () => setEtapa((e) => Math.max(e - 1, 0));

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#2E3236]">Central de Adesão</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Extração automática de documentos → cadastro do cliente → contrato → formalização da venda
        </p>
      </div>

      {/* Stepper */}
      {/* No celular só o passo atual mostra o nome: com os seis nomes abertos a
          régua ficava mais larga que a tela e o último passo saía do quadro. */}
      <div className="flex items-start gap-0 mb-8 overflow-x-auto pb-6">
        {ETAPAS.map((e, i) => {
          const Icon = e.icon;
          const ativa = i === etapa;
          const concluida = i < etapa;
          return (
            <div key={i} className="flex items-start flex-shrink-0">
              {/* Largura fixa: o nome do passo fica solto por cima, senão a
                  coluna do passo atual cresce e as bolinhas saem do prumo. */}
              <div className="relative w-8 flex justify-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    ativa
                      ? "bg-[#2E3236] text-white"
                      : concluida
                      ? "bg-[#2E3236]/20 text-[#2E3236]"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className={`absolute top-9 left-1/2 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap ${
                    ativa ? "block" : "hidden sm:block"
                  } ${
                    ativa ? "text-[#2E3236]" : concluida ? "text-[#2E3236]/70" : "text-muted-foreground"
                  }`}
                >
                  {e.label}
                </span>
              </div>
              {i < ETAPAS.length - 1 && (
                <div
                  className={`h-px w-4 sm:w-8 mx-1.5 mt-4 flex-shrink-0 transition-colors ${
                    concluida ? "bg-[#2E3236]/40" : "bg-muted"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Conteúdo */}
      <div className="bg-card border rounded-lg p-5 shadow-sm">
        {etapa === 0 && (
          <Etapa1Documentos
            arquivos={arquivos}
            setArquivos={setArquivos}
            textoPastaColado={textoPastaColado}
            setTextoPastaColado={setTextoPastaColado}
            onAvancar={avancar}
          />
        )}
        {etapa === 1 && (
          <Etapa2Leitura
            arquivos={arquivos}
            setArquivos={setArquivos}
            textoPastaColado={textoPastaColado}
            onConcluido={(dados) => { setDadosExtraidos(dados); setDadosRevisados(dados.campos); avancar(); }}
            onVoltar={voltar}
          />
        )}
        {etapa === 2 && dadosExtraidos && (
          <Etapa3Revisao
            dadosExtraidos={dadosExtraidos}
            dadosRevisados={dadosRevisados}
            setDadosRevisados={setDadosRevisados}
            arquivos={arquivos}
            setArquivos={setArquivos}
            onAvancar={avancar}
            onVoltar={voltar}
          />
        )}
        {etapa === 3 && (
          <Etapa4Salvar
            dadosRevisados={dadosRevisados}
            senhagov={dadosExtraidos?.senha_gov ?? null}
            arquivos={arquivos}
            onSalvo={(c) => { setClienteSalvo(c); avancar(); }}
            onVoltar={voltar}
          />
        )}
        {etapa === 4 && clienteSalvo && (
          <Etapa5Contrato
            clienteSalvo={clienteSalvo}
            onConcluido={(vendaId, legado) => { setVendaContrato({ id: vendaId, legado }); onContratoGerado?.(); avancar(); }}
            onVoltar={voltar}
          />
        )}
        {etapa === 5 && clienteSalvo && (
          <Etapa6Piloto
            clienteSalvo={clienteSalvo}
            vendaId={vendaContrato?.id ?? null}
            onVoltar={voltar}
          />
        )}
      </div>
    </div>
  );
}
