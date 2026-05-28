export interface ClubeFiliacaoFormState {
  nome_clube: string;
  cnpj: string;
  numero_cr: string;
  data_cr: string;
  endereco: string;
  cidade: string;
  uf: string;
  numero_filiacao: string;
  validade_filiacao: string;
}

export const EMPTY_FORM: ClubeFiliacaoFormState = {
  nome_clube: "",
  cnpj: "",
  numero_cr: "",
  data_cr: "",
  endereco: "",
  cidade: "",
  uf: "",
  numero_filiacao: "",
  validade_filiacao: "",
};