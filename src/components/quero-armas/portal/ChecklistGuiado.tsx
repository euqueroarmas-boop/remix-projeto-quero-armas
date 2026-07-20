// ============================================================================
// ChecklistGuiado — Orquestrador (camada NOVA, aditiva)
// ----------------------------------------------------------------------------
// Montado UMA vez no portal. Responsável por:
//   1. Abrir o modal quando qualquer <ChecklistGuiadoBotao/> for clicado (bus).
//   2. Disparar o POP-UP AUTOMÁTICO logo após o contrato ser ASSINADO/VALIDADO
//      (qa_contracts.status === "validated"), via Realtime + checagem na carga.
//
// O auto-popup acontece UMA vez por contrato validado (guard em localStorage),
// para não incomodar a cada login. O botão manual continua sempre disponível.
// Nada existente é alterado — só observamos qa_contracts (mesma tabela que o
// ContratoBlock já lê) e reaproveitamos o engine do assistente.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { onAbrirChecklistGuiado, AbrirChecklistPayload } from "@/lib/quero-armas/checklistGuiadoBus";
import { contarPendentesClienteGuia } from "@/lib/quero-armas/checklistGuiadoEngine";
import ChecklistGuiadoModal from "./ChecklistGuiadoModal";
import { ClienteDocsHubModal } from "@/components/quero-armas/clientes/ClienteDocsHubModal";

interface Props {
  clienteId: number;
  /** chamado quando o assistente altera algo (para recarregar contadores do portal) */
  onUpdated?: () => void;
}

const guardKey = (contractId: string) => `qa_checklist_guiado_auto_${contractId}`;

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

  const contratoIdRef = useRef<string | null>(null);
  // Garante que o auto-popup por pendências documentais aconteça UMA única vez
  // por entrada na página — se o cliente fechar o assistente, não reabre sozinho
  // na mesma sessão (regra explícita do produto).
  const autoOpenedRef = useRef(false);

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
      // Abertura genérica (auto-open, botão global) → modal legado direto
      setProcessoIdAlvo(payload?.processoId ?? null);
      setFocusDocId(payload?.focusDocId ?? null);
      setOpen(true);
    });
    return off;
  }, [clienteId]);

  // 1.b) AUTO-ABERTURA POR PENDÊNCIAS DOCUMENTAIS
  // Assim que o portal monta e o cliente é identificado, contamos itens
  // pendentes (ausentes, reprovados/invalidos, divergentes, em análise ou
  // perguntas sem resposta) somando todos os processos elegíveis. Se houver
  // qualquer pendência, abrimos o assistente automaticamente — uma vez só.
  useEffect(() => {
    if (!clienteId) return;
    if (autoOpenedRef.current) return;
    let cancel = false;
    (async () => {
      try {
        // Antes de contar pendências, roda a revisão de exigências para que
        // itens do checklist já cobertos por documentos aprovados do
        // Hub de Documentos sejam marcados como cumpridos (status
        // `dispensado_por_reaproveitamento`) — evita pedir upload duplicado.
        try {
          await supabase.rpc("qa_processo_rever_exigencias" as any, {
            p_cliente_id: clienteId,
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[ChecklistGuiado] rever_exigencias falhou (silencioso)", e);
        }
        const pendentes = await contarPendentesClienteGuia(clienteId);
        // eslint-disable-next-line no-console
        console.info("[ChecklistGuiado] auto-open check", { clienteId, pendentes });
        if (cancel) return;
        if (pendentes > 0 && !autoOpenedRef.current) {
          autoOpenedRef.current = true;
          setOpen(true);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[ChecklistGuiado] auto-open error", e);
        /* silencioso — feature opcional, nunca derruba o portal */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [clienteId]);

  // helper: tenta auto-abrir se o contrato está validado e há itens pendentes
  const tentarAutoAbrir = async (contractId: string) => {
    try {
      if (localStorage.getItem(guardKey(contractId))) return; // já mostrado para este contrato
      const pendentes = await contarPendentesClienteGuia(clienteId);
      if (pendentes <= 0) return;
      localStorage.setItem(guardKey(contractId), "1");
      setOpen(true);
    } catch {
      /* silencioso — nunca derruba o portal */
    }
  };

  // 2) carga inicial: descobre o contrato mais recente e checa se já está validado
  useEffect(() => {
    if (!clienteId) return;
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("qa_contracts" as any)
          .select("id, status")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancel || !data) return;
        contratoIdRef.current = (data as any).id;
        if ((data as any).status === "validated") {
          await tentarAutoAbrir((data as any).id);
        }
      } catch {
        /* ignora — feature opcional */
      }
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  // 3) Realtime: assim que o contrato do cliente virar "validated", abre o pop-up
  useEffect(() => {
    if (!clienteId) return;
    const ch = supabase
      .channel(`qa_cg_contracts_${clienteId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "qa_contracts", filter: `cliente_id=eq.${clienteId}` },
        (payload: any) => {
          const novo = payload?.new;
          if (novo?.status === "validated" && novo?.id) {
            contratoIdRef.current = novo.id;
            tentarAutoAbrir(novo.id);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
