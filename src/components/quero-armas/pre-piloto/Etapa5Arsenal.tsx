import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChevronRight, FolderOpen, Upload, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClienteDocsHubModal } from "@/components/quero-armas/clientes/ClienteDocsHubModal";
import { toast } from "sonner";
import type { ArquivoUpload, ClienteSalvo } from "./PrePilotoWizard";

interface Props {
  clienteSalvo: ClienteSalvo;
  arquivos: ArquivoUpload[];
  onAvancar: () => void;
  onVoltar: () => void;
}

const TIPO_LABELS: Record<string, string> = {
  cin: "CIN/RG",
  cpf: "CPF",
  comprovante_residencia: "Comprovante de Residência",
  laudo_psicologico: "Laudo Psicológico",
  laudo_capacidade_tecnica: "Laudo de Capacidade Técnica",
  antecedentes_criminais: "Antecedentes Criminais",
  comprovante_renda: "Comprovante de Renda",
  gov_br: "Print GOV.BR",
  outro: "Outro",
};

export default function Etapa5Arsenal({ clienteSalvo, arquivos, onAvancar, onVoltar }: Props) {
  const [hubOpen, setHubOpen] = useState(false);
  const [hubTipo, setHubTipo] = useState<string | undefined>(undefined);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [enviados, setEnviados] = useState<Set<string>>(new Set());

  // Agrupa arquivos por tipo único
  const tiposUnicos = [...new Set(arquivos.map((a) => a.tipo))];

  async function abrirHub(tipo: string) {
    try {
      const { data } = await supabase
        .from("qa_clientes" as any)
        .select("customer_id")
        .eq("id", clienteSalvo.id)
        .maybeSingle();
      setCustomerId((data as any)?.customer_id ?? null);
    } catch { setCustomerId(null); }
    setHubTipo(tipo);
    setHubOpen(true);
  }

  function onSaved() {
    setHubOpen(false);
    setEnviados((prev) => new Set([...prev, hubTipo ?? ""]));
    toast.success("Documento salvo no Hub!");
  }

  const todosEnviados = tiposUnicos.length > 0 && tiposUnicos.every((t) => enviados.has(t));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold mb-1">Etapa 5 — Hub Documental</h2>
        <p className="text-xs text-muted-foreground">
          Abra o Hub Documental para cada tipo de documento e faça o upload. O cliente <strong>{clienteSalvo.nome_completo}</strong> já está vinculado.
        </p>
      </div>

      <div className="space-y-2">
        {tiposUnicos.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Nenhum arquivo foi enviado na Etapa 1.</p>
        )}
        {tiposUnicos.map((tipo) => {
          const qtd = arquivos.filter((a) => a.tipo === tipo).length;
          const enviado = enviados.has(tipo);
          return (
            <div key={tipo} className="flex items-center justify-between bg-muted/40 rounded px-3 py-2">
              <div className="flex items-center gap-2">
                {enviado
                  ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                <span className="text-xs font-medium">{TIPO_LABELS[tipo] || tipo}</span>
                <span className="text-[11px] text-muted-foreground">({qtd} arquivo{qtd !== 1 ? "s" : ""})</span>
              </div>
              <Button
                size="sm"
                variant={enviado ? "outline" : "default"}
                onClick={() => abrirHub(tipo)}
                className={`text-xs gap-1 h-7 ${enviado ? "" : "bg-[#7B1C2E] hover:bg-[#6a1827] text-white"}`}
              >
                <Upload className="w-3 h-3" />
                {enviado ? "Reabrir" : "Abrir Hub"}
              </Button>
            </div>
          );
        })}
      </div>

      {tiposUnicos.length > 0 && !todosEnviados && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <FolderOpen className="w-3.5 h-3.5" />
          Envie ao menos um tipo de documento antes de avançar, ou pule esta etapa.
        </p>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" size="sm" onClick={onVoltar} className="text-xs gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </Button>
        <Button
          size="sm"
          onClick={onAvancar}
          className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1"
        >
          {todosEnviados ? "Ir para Piloto" : "Pular e continuar"} <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      <ClienteDocsHubModal
        open={hubOpen}
        onClose={() => setHubOpen(false)}
        customerId={customerId}
        qaClienteId={clienteSalvo.id}
        mode="arsenal"
        defaultTipo={hubTipo}
        pendingHubTipos={hubTipo ? [hubTipo] : []}
        clienteCpf={clienteSalvo.cpf}
        clienteNome={clienteSalvo.nome_completo}
        clienteDataNascimento={null}
        clienteNomeMae={null}
        docsAprovados={[]}
        onSaved={onSaved}
      />
    </div>
  );
}
