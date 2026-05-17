/**
 * cadastroMiraSnapshot — wrapper client-side da edge function
 * `qa-cadastro-mira-snapshot`. Usado pelas etapas do /cadastro Mira para
 * alimentar o painel "Novos Cadastros Recebidos" da Equipe Quero Armas
 * em paridade com o cadastro público legado.
 *
 * NUNCA bloqueia o fluxo do usuário: se a snapshot falhar, apenas loga.
 * NÃO toca checkout, pagamento, contrato, processo, checklist, WMTi ou
 * substituição documental.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CadastroRefinadoState } from "@/pages/quero-armas/cadastro-refinado/hooks/useCadastroRefinadoState";

export type MiraSnapshotStatus =
  | "em_preenchimento"
  | "documentos_enviados"
  | "revisao_cliente"
  | "aguardando_pagamento"
  | "concluido"
  | "abandonado";

export interface MiraSnapshotExtras {
  snapshot_id?: string | null;
  cliente_id_vinculado?: string | null;
  venda_id?: string | number | null;
  contexto?: Record<string, unknown> | null;
}

function pathOrNull(state: CadastroRefinadoState, key: string): string | null {
  const it = state.documentos?.[key];
  if (!it) return null;
  if (it.status !== "enviado") return null;
  return it.storagePath || null;
}

/**
 * Envia o snapshot operacional ao backend. Sempre resolve — nunca rejeita,
 * para não interromper o fluxo de cadastro do cliente.
 */
export async function enviarSnapshotCadastroMira(
  state: CadastroRefinadoState,
  status: MiraSnapshotStatus,
  extras: MiraSnapshotExtras = {},
): Promise<{ ok: boolean; snapshot_id?: string | null }> {
  const d = state.dadosPessoais;
  if (!d?.nome_completo || !d?.cpf || !d?.email || !d?.telefone) {
    // Sem dados mínimos não há snapshot útil — não enviar.
    return { ok: false };
  }
  const payload = {
    snapshot_id: extras.snapshot_id ?? null,
    status,
    nome_completo: d.nome_completo,
    cpf: d.cpf,
    email: d.email,
    telefone_principal: d.telefone,
    data_nascimento: d.data_nascimento || null,
    end1_cep: d.endereco_cep || null,
    end1_logradouro: d.endereco_logradouro || null,
    end1_numero: d.endereco_numero || null,
    end1_complemento: d.endereco_complemento || null,
    end1_bairro: d.endereco_bairro || null,
    end1_cidade: d.endereco_cidade || null,
    end1_estado: d.endereco_estado || null,
    objetivo_principal: state.perfilV2 || null,
    servico_interesse: state.servicoSlug || null,
    servico_principal: state.servicoSlug || null,
    catalogo_slug: state.servicoSlug || null,
    documento_identidade_path: pathOrNull(state, "doc_identidade"),
    comprovante_endereco_path: pathOrNull(state, "doc_endereco"),
    selfie_path: pathOrNull(state, "doc_selfie"),
    cliente_id_vinculado: extras.cliente_id_vinculado ?? null,
    venda_id: extras.venda_id ?? null,
    contexto: extras.contexto ?? { origem_ui: state.origem || null },
  };

  try {
    const { data, error } = await supabase.functions.invoke(
      "qa-cadastro-mira-snapshot",
      { body: payload },
    );
    if (error) {
      console.warn("[cadastro-mira-snapshot] falhou (ignorado):", error?.message || error);
      return { ok: false };
    }
    return { ok: true, snapshot_id: (data as any)?.snapshot_id ?? null };
  } catch (e: any) {
    console.warn("[cadastro-mira-snapshot] exceção (ignorado):", e?.message || e);
    return { ok: false };
  }
}