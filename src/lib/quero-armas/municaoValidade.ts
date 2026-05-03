/**
 * Validade canônica de munição = data_fabricacao + 60 meses.
 * Não persiste em banco (cálculo sempre em código).
 * Se data_fabricacao for null/inválida → retorna status "cinza" + sem_data.
 */
import { getStatusValidade, type StatusUnificado } from "./statusUnificado";

export const VALIDADE_MUNICAO_MESES = 60;

export interface ValidadeMunicao {
  data_fabricacao: string | null;
  data_validade: string | null;
  status: StatusUnificado;
  sem_data: boolean;
}

export function calcularValidadeMunicao(
  data_fabricacao: string | Date | null | undefined,
  hoje: Date = new Date(),
): ValidadeMunicao {
  if (!data_fabricacao) {
    return {
      data_fabricacao: null,
      data_validade: null,
      status: {
        dimensao: "vazio",
        codigo: "sem_data_fabricacao",
        label: "SEM DATA DE FABRICAÇÃO",
        cor: "cinza",
        prioridade: 10,
      },
      sem_data: true,
    };
  }
  const fab = new Date(data_fabricacao);
  if (isNaN(fab.getTime())) {
    return {
      data_fabricacao: null,
      data_validade: null,
      status: {
        dimensao: "vazio",
        codigo: "sem_data_fabricacao",
        label: "SEM DATA DE FABRICAÇÃO",
        cor: "cinza",
        prioridade: 10,
      },
      sem_data: true,
    };
  }
  const validade = new Date(fab);
  validade.setMonth(validade.getMonth() + VALIDADE_MUNICAO_MESES);
  const status = getStatusValidade(validade, "MUNICAO", hoje);
  return {
    data_fabricacao: fab.toISOString().slice(0, 10),
    data_validade: validade.toISOString().slice(0, 10),
    status,
    sem_data: false,
  };
}

/** Atalho que devolve só o StatusUnificado. */
export function getValidadeMunicao(
  data_fabricacao: string | Date | null | undefined,
  hoje: Date = new Date(),
): StatusUnificado {
  return calcularValidadeMunicao(data_fabricacao, hoje).status;
}