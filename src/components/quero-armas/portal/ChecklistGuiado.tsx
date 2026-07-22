// ============================================================================
// ChecklistGuiado — Orquestrador (camada NOVA, aditiva)
// ----------------------------------------------------------------------------
// Montado UMA vez no portal. Responsável por:
//   1. Abrir o modal quando qualquer <ChecklistGuiadoBotao/> for clicado (bus).
//
// Regra de produto:
// - Pendências podem aparecer na tela, mas o Hub Documental só abre quando o
//   cliente clica em uma pendência clara ou em um botão explícito de envio.
// - Não existe auto-popup por pendência genérica nem por contrato validado.
// ============================================================================

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { onAbrirChecklistGuiado, AbrirChecklistPayload } from "@/lib/quero-armas/checklistGuiadoBus";
import ChecklistGuiadoModal from "./ChecklistGuiadoModal";
import { ClienteDocsHubModal } from "@/components/quero-armas/clientes/ClienteDocsHubModal";

interface Props {
  clienteId: number;
  /** chamado quando o assistente altera algo (para recarregar contadores do portal) */
  onUpdated?: () => void;
}

// Mapeamento processo → hub (espelho do ChecklistGuiadoModal)
const PROCESSO_TO_HUB: Record<string, string> = {
  rg_com_cpf: "cin",
  comprovante_endereco_ano_2022: "comprovante_residencia",
  comprovante_endereco_ano_2023: "comprovante_residencia",
  comprovante_endereco_ano_2024: "comprovante_residencia",
  comprovante_endereco_ano_2025: "comprovante_residencia",
  comprovante_endereco_ano_2026: "comprovante_residencia",
  comprovante_endereco_ano_2027: "comprovante_residencia",
  certidao_antecedentes_policia_civil_sp: "antecedentes_criminais",
  certidao_crimes_eleitorais_tse: "antecedentes_eleitoral",
  certidao_crimes_militares_stm: "antecedentes_militar",
  certidao_criminal_tjmsp: "antecedentes_militar",
  certidao_federal_trf3_regional: "antecedentes_federal_trf3_regional",
  certidao_federal_trf3_sjsp_jef: "antecedentes_federal_sjsp_jef",
  certidao_tjsp_distribuicao_criminal: "antecedentes_estadual_distribuicao",
  certidao_tjsp_execucoes_criminais: "antecedentes_estadual_execucoes",
  comprovante_filiacao_entidade_tiro: "comprovante_clube_tiro",
  declaracao_habitualidade_clube: "comprovante_habitualidade",
  declaracao_compromisso_habitualidade: "comprovante_habitualidade",
  declaracao_compromisso_treino: "declaracao_correlata",
  renda_nf_empresa: "renda_nf_recente",
  renda_qsa: "renda_cartao_cnpj",
  atestado_capacidade_tecnica: "laudo_capacidade_tecnica",
};

function toHubTipo(processoTipo: string): string {
  return PROCESSO_TO_HUB[processoTipo] ?? processoTipo;
}

export default function ChecklistGuiado({ clienteId, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [processoIdAlvo, setProcessoIdAlvo] = useState<string | null>(null);
  const [focusDocId, setFocusDocId] = useState<string | null>(null);

  // Hub Documental direto ao clicar em pendência específica
  const [hubOpen, setHubOpen] = useState(false);
  const [hubTipo, setHubTipo] = useState<string | undefined>(undefined);
  const [hubCustomerId, setHubCustomerId] = useState<string | null>(null);

  // 1) abertura manual via bus (com payload opcional vindo do botão clicado)
  useEffect(() => {
    const off = onAbrirChecklistGuiado(async (payload?: AbrirChecklistPayload) => {
      // Clique em pendência específica → Hub Documental direto
      if (payload?.focusDocId) {
        try {
          const [docRes, cliRes] = await Promise.all([
            supabase.from("qa_processo_documentos" as any)
              .select("tipo_documento")
              .eq("id", payload.focusDocId)
              .maybeSingle(),
            supabase.from("qa_clientes" as any)
              .select("customer_id")
              .eq("id", clienteId)
              .maybeSingle(),
          ]);
          const tipo = (docRes as any).data?.tipo_documento ?? "outro";
          setHubTipo(toHubTipo(tipo));
          setHubCustomerId((cliRes as any).data?.customer_id ?? null);
        } catch {
          setHubTipo("outro");
          setHubCustomerId(null);
        }
        setHubOpen(true);
        return;
      }
      // Abertura genérica por clique explícito no botão global.
      setProcessoIdAlvo(payload?.processoId ?? null);
      setFocusDocId(payload?.focusDocId ?? null);
      setOpen(true);
    });
    return off;
  }, [clienteId]);

  if (!clienteId) return null;

  return (
    <>
      <ClienteDocsHubModal
        open={hubOpen}
        onClose={() => setHubOpen(false)}
        customerId={hubCustomerId}
        qaClienteId={clienteId}
        mode="portal"
        defaultTipo={hubTipo}
        pendingHubTipos={hubTipo ? [hubTipo] : []}
        clienteCpf={null}
        clienteNome={null}
        clienteDataNascimento={null}
        clienteNomeMae={null}
        docsAprovados={[]}
        onSaved={() => {
          setHubOpen(false);
          onUpdated?.();
        }}
      />
      <ChecklistGuiadoModal
        clienteId={clienteId}
        open={open}
        onClose={() => {
          setOpen(false);
          setProcessoIdAlvo(null);
          setFocusDocId(null);
        }}
        processoIdInicial={processoIdAlvo}
        focusDocIdInicial={focusDocId}
        onUpdated={onUpdated}
      />
    </>
  );
}
