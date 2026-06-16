import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "qa_cadastro_refinado_state";

/**
 * Prefixos de chaves sessionStorage que pertencem EXCLUSIVAMENTE ao fluxo
 * do cadastro refinado / checkout guiado. Tudo que começar com isto é
 * apagado em um "hard reset". NÃO inclui auth do Supabase, carrinho global
 * ou qualquer chave fora desse fluxo.
 */
const CADASTRO_STORAGE_PREFIXES = ["qa_cadastro_", "qa_checkout_"] as const;

/**
 * Limpa de forma síncrona todas as chaves de sessionStorage relacionadas
 * ao cadastro refinado. Exportado para que a página possa chamar ANTES de
 * o hook ler o estado inicial (caso `?novo=1` venha na URL).
 */
export function clearCadastroRefinadoStorage(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k) continue;
      if (CADASTRO_STORAGE_PREFIXES.some((p) => k.startsWith(p))) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[CadastroRefinado] hard reset executado", { keys: toRemove });
    }
  } catch {
    /* ignore */
  }
}

export type ModoCliente = "indefinido" | "novo" | "existente" | "verificando" | "autenticado";

export interface DocumentoArsenal {
  id: string;
  tipo_documento: string;
  arquivo_nome?: string | null;
  data_validade?: string | null;
  status: string;
  validado_admin?: boolean;
}

export interface ServicoAnterior {
  id: string | number;
  servico_slug?: string | null;
  servico_nome?: string | null;
  status?: string | null;
  data?: string | null;
}

export interface CadastroRefinadoState {
  servicoSlug: string | null;
  /** Lista completa de slugs de serviços selecionados (bundle).
   *  Quando o fluxo é single-service, contém apenas 1 elemento.
   *  `servicoSlug` é mantido como o primeiro deste array (compat). */
  servicosSlugs: string[];
  origem: string | null;
  perfilV2: string | null;
  documentos: Record<string, { storagePath?: string; fileName?: string; status: "pendente" | "enviado" | "erro"; errorMsg?: string }>;
  dadosPessoais: {
    nome_completo: string;
    cpf: string;
    email: string;
    telefone: string;
    data_nascimento: string;
    endereco_cep: string;
    endereco_logradouro: string;
    endereco_numero: string;
    endereco_complemento: string;
    endereco_bairro: string;
    endereco_cidade: string;
    endereco_estado: string;
  };
  formaPagamento: "pix" | "cartao" | "boleto";
  aceiteContrato: boolean;
  clienteExistente: boolean;
  /** Resultado do fluxo "já tenho conta no Arsenal". */
  modo_cliente: ModoCliente;
  cliente_existente_id: string | null;
  dados_carregados_do_arsenal: boolean;
  documentos_reaproveitados: DocumentoArsenal[];
  documentos_vencidos: DocumentoArsenal[];
  documentos_pendentes_revisao: DocumentoArsenal[];
  servicos_anteriores: ServicoAnterior[];
  processos_ativos: Array<Record<string, unknown>>;
  contratos_existentes: Array<Record<string, unknown>>;
  arsenal_resumo: { cr?: string | null; craf?: string | null; armas?: number; laudos?: unknown[] } | null;
  /** Marca que o usuário, NESTA sessão, já passou pela tela
   *  "Você já tem conta no Arsenal Inteligente?". Sem isso, qualquer
   *  abertura nova de /cadastro ou /cadastro-mira deve reabrir a
   *  identificação — mesmo que exista state antigo no sessionStorage. */
  identificacao_confirmada: boolean;
  /** ID da linha em qa_cadastro_publico criada pelo snapshot operacional
   *  do /cadastro Mira (origem_cadastro='cadastro_mira'). Persiste entre
   *  etapas para garantir UPDATE idempotente, sem duplicar snapshot. */
  cadastro_mira_snapshot_id: string | null;
  resultado: {
    cliente_id?: string;
    venda_id?: string;
    solicitacao_id?: string;
    numero_processo?: string;
    numero_protocolo?: string;
    pagamento_url?: string;
    /** Assinatura canônica dos serviços que originaram este checkout.
     *  Usada para impedir reaproveitamento indevido de cobrança quando o
     *  usuário troca de serviço no mesmo sessionStorage. */
    servico_slugs?: string[];
    servico_slug_key?: string;
    /* Campos de checkout 2C — persistidos pela Etapa04 para a Etapa05 derivar status real. */
    checkout_token?: string;
    asaas_invoice_url?: string;
    asaas_payment_id?: string;
    asaas_pix_payload?: string;
    asaas_bank_slip_url?: string;
    parcelas?: number;
    valor_cobrado?: number;
    billing_type?: "PIX" | "BOLETO" | "CREDIT_CARD";
    /* Status real derivado de qa-checkout-status (webhook Asaas).
     * - "aguardando_pagamento": cobrança criada, sem confirmação do webhook
     * - "pagamento_confirmado": webhook Asaas confirmou
     * - "contrato_gerado" | "acesso_enviado" | "servico_aguardando_contrato" | "servico_liberado"
     *   são atualizados conforme jobs pós-pagamento informam.
     * NUNCA gravar "pagamento_confirmado" sem retorno real de qa-checkout-status. */
    pagamento_status?:
      | "aguardando_pagamento"
      | "pagamento_confirmado"
      | "contrato_gerado"
      | "acesso_enviado"
      | "servico_aguardando_contrato"
      | "servico_liberado";
  } | null;
}

const initial: CadastroRefinadoState = {
  servicoSlug: null,
  servicosSlugs: [],
  origem: null,
  perfilV2: null,
  documentos: {},
  dadosPessoais: {
    nome_completo: "",
    cpf: "",
    email: "",
    telefone: "",
    data_nascimento: "",
    endereco_cep: "",
    endereco_logradouro: "",
    endereco_numero: "",
    endereco_complemento: "",
    endereco_bairro: "",
    endereco_cidade: "",
    endereco_estado: "",
  },
  formaPagamento: "pix",
  aceiteContrato: false,
  clienteExistente: false,
  modo_cliente: "indefinido",
  cliente_existente_id: null,
  dados_carregados_do_arsenal: false,
  documentos_reaproveitados: [],
  documentos_vencidos: [],
  documentos_pendentes_revisao: [],
  servicos_anteriores: [],
  processos_ativos: [],
  contratos_existentes: [],
  arsenal_resumo: null,
  identificacao_confirmada: false,
  cadastro_mira_snapshot_id: null,
  resultado: null,
};

export function useCadastroRefinadoState() {
  const [state, setState] = useState<CadastroRefinadoState>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return initial;
      return { ...initial, ...JSON.parse(raw) };
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }, [state]);

  const update = useCallback(
    (patch: Partial<CadastroRefinadoState>) =>
      setState((s) => {
        const merged = { ...s, ...patch };
        // Sincroniza servicoSlug ↔ servicosSlugs para evitar drift entre
        // chamadas legadas (servicoSlug) e novas (servicosSlugs).
        if ("servicosSlugs" in patch) {
          const arr = (patch.servicosSlugs ?? []).filter(Boolean) as string[];
          merged.servicosSlugs = arr;
          merged.servicoSlug = arr[0] ?? null;
        } else if ("servicoSlug" in patch) {
          const slug = patch.servicoSlug ?? null;
          merged.servicoSlug = slug;
          merged.servicosSlugs = slug ? [slug] : [];
        }
        return merged;
      }),
    []
  );

  const updateDados = useCallback(
    (patch: Partial<CadastroRefinadoState["dadosPessoais"]>) =>
      setState((s) => ({ ...s, dadosPessoais: { ...s.dadosPessoais, ...patch } })),
    []
  );

  const reset = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setState(initial);
  }, []);

  /**
   * Reset forte: limpa TODAS as chaves sessionStorage do fluxo de cadastro
   * refinado + checkout guiado e restaura o estado para o initial. Use ao
   * acionar "Reiniciar processo" ou ao receber `?novo=1` na URL.
   */
  const hardReset = useCallback(() => {
    clearCadastroRefinadoStorage();
    setState(initial);
  }, []);

  return { state, update, updateDados, reset, hardReset, setState };
}
