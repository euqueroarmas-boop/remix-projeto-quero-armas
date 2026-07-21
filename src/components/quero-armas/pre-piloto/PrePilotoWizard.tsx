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
        <h1 className="text-xl font-semibold text-[#7B1C2E]">Central de Adesão</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Extração automática de documentos → cadastro do cliente → contrato → formalização da venda
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-1">
        {ETAPAS.map((e, i) => {
          const Icon = e.icon;
          const ativa = i === etapa;
          const concluida = i < etapa;
          return (
            <div key={i} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    ativa
                      ? "bg-[#7B1C2E] text-white"
                      : concluida
                      ? "bg-[#7B1C2E]/20 text-[#7B1C2E]"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className={`text-[10px] font-medium whitespace-nowrap ${
                    ativa ? "text-[#7B1C2E]" : concluida ? "text-[#7B1C2E]/70" : "text-muted-foreground"
                  }`}
                >
                  {e.label}
                </span>
              </div>
              {i < ETAPAS.length - 1 && (
                <div
                  className={`h-px w-8 mx-1 mt-[-12px] flex-shrink-0 transition-colors ${
                    concluida ? "bg-[#7B1C2E]/40" : "bg-muted"
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
