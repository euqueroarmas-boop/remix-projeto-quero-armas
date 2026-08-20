// ============================================================================
// SEGUNDO ENDEREÇO — quem pode ter, e quais campos são dele
// ----------------------------------------------------------------------------
// O titular de CR pode declarar dois endereços: a residência e um segundo
// endereço onde parte do acervo fica guardada (IN DG/PF 311). Defesa pessoal
// (IN DG/PF 201) NÃO tem essa previsão — e é justamente por isso que a regra
// mora aqui, em um lugar só.
//
// Três telas perguntam o segundo endereço (formulário público, portal do
// cliente e cadastro interno) e uma edge function decide se aceita gravar.
// Se cada uma tivesse sua própria condição, bastaria uma esquecer a trava
// para o campo vazar para defesa pessoal. Todas consultam este arquivo; o
// servidor consulta o equivalente em SQL
// (`public.qa_cliente_admite_segundo_endereco`), alimentado pela mesma coluna
// de catálogo `admite_segundo_endereco`.
//
// PARA LIBERAR UM SERVIÇO NOVO: ligue `admite_segundo_endereco` no
// `qa_servicos_catalogo` daquele serviço. Só caia no `SERVICOS_*` abaixo se o
// catálogo ainda não estiver carregado na tela.
// ============================================================================

/** Fundamentos CAC — os únicos que a IN 311 alcança. */
export const MODALIDADES_CAC = ["atirador", "cacador", "colecionador"] as const;

/** Fundamento que NUNCA admite segundo endereço, venha o que vier. */
export const MODALIDADE_SEM_SEGUNDO_ENDERECO = "defesa_pessoal";

/**
 * Serviços que admitem segundo endereço, por id.
 *
 * Espelha o seed de `qa_servicos_catalogo.admite_segundo_endereco` da
 * migration 20260820200000. É o caminho de reserva para as telas que
 * conhecem o serviço mas ainda não carregaram o catálogo — quando o catálogo
 * está em mãos, a coluna manda.
 *
 *   44 — Concessão de CR
 *   50 — Autorização de Compra (Atirador Esportivo)
 *   51 — Autorização de Compra (Caçador)
 */
export const SERVICOS_COM_SEGUNDO_ENDERECO: readonly number[] = [44, 50, 51];

/** Colunas de `qa_clientes` que formam o segundo endereço. */
export const CAMPOS_SEGUNDO_ENDERECO: readonly string[] = [
  "endereco2",
  "numero2",
  "complemento2",
  "bairro2",
  "cep2",
  "cidade2",
  "estado2",
  "pais2",
  "geolocalizacao2",
  "end2_tipo",
  "end2_observacao",
  "tem_segundo_endereco",
];

const CAMPOS = new Set(CAMPOS_SEGUNDO_ENDERECO);

/** `true` se a coluna pertence ao bloco do 2º endereço. */
export function ehCampoSegundoEndereco(campo: string): boolean {
  return CAMPOS.has(campo);
}

export type ContextoSegundoEndereco = {
  /** `qa_processos.servico_id` (ou o serviço escolhido no formulário público). */
  servicoId?: number | null;
  /** `qa_processos.modalidade` — o fundamento do pedido. */
  modalidade?: string | null;
  /** `qa_servicos_catalogo.admite_segundo_endereco`, quando a tela já o tem. */
  admiteNoCatalogo?: boolean | null;
};

/**
 * O portão. `true` só para Concessão de CR e Autorização de Compra CAC.
 *
 * A ordem importa: defesa pessoal é recusada ANTES de qualquer outra regra,
 * de modo que nem um catálogo mal configurado nem um id novo na lista possam
 * abrir o segundo endereço para ela.
 */
export function admiteSegundoEndereco(ctx: ContextoSegundoEndereco): boolean {
  const modalidade = String(ctx.modalidade ?? "").trim().toLowerCase();
  if (modalidade === MODALIDADE_SEM_SEGUNDO_ENDERECO) return false;

  if (ctx.admiteNoCatalogo === true) return true;
  if (ctx.admiteNoCatalogo === false) return false;

  const servicoId = Number(ctx.servicoId ?? NaN);
  return Number.isFinite(servicoId) && SERVICOS_COM_SEGUNDO_ENDERECO.includes(servicoId);
}

/**
 * O portão a partir dos processos do cliente: basta UM processo que admita.
 *
 * Espelha `public.qa_cliente_admite_segundo_endereco`. Um cliente que tem CR
 * e também um processo de defesa pessoal continua podendo declarar os dois
 * endereços — o que o CR admite não é desfeito pelo outro processo.
 */
export function clienteAdmiteSegundoEndereco(
  processos: ReadonlyArray<ContextoSegundoEndereco> | null | undefined,
): boolean {
  return (processos || []).some((p) => admiteSegundoEndereco(p));
}

/** `true` se algum campo de endereço do 2º bloco está preenchido de fato. */
export function segundoEnderecoPreenchido(cliente: Record<string, unknown> | null | undefined): boolean {
  if (!cliente) return false;
  return ["endereco2", "cep2", "cidade2", "end2_tipo"].some((k) => {
    const v = cliente[k];
    return typeof v === "string" ? v.trim().length > 0 : v != null;
  });
}
