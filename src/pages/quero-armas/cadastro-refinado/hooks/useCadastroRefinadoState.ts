import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "qa_cadastro_refinado_state";

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
  resultado: {
    cliente_id?: string;
    venda_id?: string;
    solicitacao_id?: string;
    numero_processo?: string;
    pagamento_url?: string;
    /* Campos de checkout 2C — persistidos pela Etapa04 para a Etapa05 derivar status real. */
    checkout_token?: string;
    asaas_invoice_url?: string;
    asaas_payment_id?: string;
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
      setState((s) => ({ ...s, ...patch })),
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

  return { state, update, updateDados, reset, setState };
}