import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "qa_cadastro_refinado_state";

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
  resultado: {
    cliente_id?: string;
    venda_id?: string;
    solicitacao_id?: string;
    numero_processo?: string;
    pagamento_url?: string;
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