import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { valorAusente, normalizarAptidao } from "@/lib/quero-armas/valorAusente";
import {
  apagarArquivoRecusado,
  checarArquivoRepetido,
  descricaoDoArquivo,
  mensagemArquivoRepetido,
  registrarTentativaBloqueada,
  type ArquivoRepetido,
  type TentativaBloqueada,
} from "@/lib/quero-armas/rastroTentativas";
import { useCredenciadosPsico, type CredenciadoPsico } from "./AgendarExame/useCredenciadosPsico";
import { toast } from "sonner";
import {
  Calendar,
  Camera,
  CheckCircle2,
  Crosshair,
  FileDown,
  FileText,
  Hash,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  Pencil,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { isCurrentUserStaff } from "./docsAprovacao";
import HubDocPreviewSlot from "./HubDocPreviewSlot";
import DocResultadoCarimbo from "./DocResultadoCarimbo";
import ResidenciaTerceiroModal, { type ResidenciaTerceiroPayload } from "./ResidenciaTerceiroModal";
import DeclaracaoResponsavelImovelModal from "./DeclaracaoResponsavelImovelModal";
import ConfrontoCpfComprovanteModal from "./ConfrontoCpfComprovanteModal";
import { extrairItensPdfPorPagina, extrairTextoPdf } from "@/lib/quero-armas/extracaoLocalPdf";
import { detectarEscopoCertidao, mensagemCertidaoCivel } from "@/lib/quero-armas/escopoCertidao";
import { lerQrCodeDoPdf } from "@/lib/quero-armas/qrCodePdf";
import {
  isTipoIdentidadeComQr,
  avaliarPdfIdentidade,
  avaliarQrVisualIdentidade,
  MSG_IDENTIDADE_SOMENTE_PDF,
} from "@/lib/quero-armas/identidadePdfQrCode";
import {
  tipoAceitaImagem,
  acceptPorTipo,
  instrucaoAnexoPorTipo,
  mensagemSomentePdf,
  // Segue em uso no caminho do Arsenal (auto-insert), que não converte XML.
  MSG_SOMENTE_PDF_ORIGINAL,
  MSG_FOTO_SOMENTE_IMAGEM,
} from "@/lib/quero-armas/somentePdfOriginal";
import { ehCcmei, parseCcmei } from "@/lib/quero-armas/parserCcmei";
import { assinaturaDoArquivo } from "@/lib/quero-armas/assinaturaArquivo";
import {
  ehArquivoXml,
  importarNotaFiscalXml,
  type NotaFiscalImportada,
} from "@/lib/quero-armas/notaFiscalXmlImport";
import {
  hojeISOBRT,
  isDocumentoConstitutivoPerpetuo,
  isDocumentoEmpresa30Dias,
  isDocumentoVencido,
  isIdentidadeFuncionalPerpetua,
  isNotaFiscalSemVencimento,
  isTipoSemVencimento,
  textoIndicaValidadeIndeterminada,
} from "@/lib/quero-armas/validadeDocumento";
import {
  isConsultaReceita,
  sanearEmissaoConsultaReceita,
} from "@/lib/quero-armas/emissaoConsultaReceita";
import {
  anoDoSlotEndereco,
  avaliarDuplicidadeHub,
  mensagemRenovacao,
} from "@/lib/quero-armas/duplicidadeHub";
import { carregarCatalogoValidade } from "@/lib/quero-armas/catalogoValidade";
import { parseCertidao } from "@/lib/quero-armas/parsersCertidoes";
import { salvarNotaFiscalGoldenRecord } from "@/lib/quero-armas/notaFiscalGoldenRecord";
import { conferirCertidao, naturalidadeConfere } from "@/lib/quero-armas/conferenciaCertidao";
import { regraValidadeCertidao } from "@/lib/quero-armas/validadeCertidoes";
import {
  isCartaoCnpj,
  isConstitutivoEmpresa,
  isNotaFiscalOcupacao,
  isQsa,
  exigeDatasOcupacao,
  situacaoCadastralAprovada,
  qsaContemCliente,
  qsaMesmaEmissaoDoCartao,
  emitenteConfere,
} from "@/lib/quero-armas/ocupacaoLicitaConferencia";
import { trackTelemetria } from "@/shared/quero-armas/telemetria";
import {
  conferirLaudo,
  type ResultadoLaudo,
  type TipoLaudo,
} from "@/lib/quero-armas/conferenciaLaudo";
import {
  parseComprovanteEndereco,
  type ResultadoEndereco,
} from "@/lib/quero-armas/parserComprovanteEndereco";
import { parseDanf3e } from "@/lib/quero-armas/parserComprovanteResidencia";
import {
  lerCamposRequerimentoPorGeometria,
  parseRequerimentoSinarm,
  rotuloIndicaRequerimentoSinarm,
  textoIndicaRequerimentoSinarm,
} from "@/lib/quero-armas/parserRequerimentoSinarm";
import {
  conferirRequerimentoContraCadastro,
  type CadastroParaRequerimento,
} from "@/lib/quero-armas/conferenciaRequerimento";
import {
  validadeComprovanteConsumo,
  mensagemComprovanteVencido,
  type DatasComprovanteConsumo,
} from "@/lib/quero-armas/cicloComprovanteConsumo";
import {
  avaliarTitularidadeComprovante,
  confrontarCpfParcial,
  lerCpfDocumento,
  type AvaliacaoTitularidade,
} from "@/lib/quero-armas/titularComprovante";
import { getLinkEmissaoCertidao } from "@/lib/quero-armas/certidoesAbrangencia";
import { toHubTipoCompartilhado } from "@/lib/quero-armas/hubTipoMap";
import { mesmaExigenciaIdentidade, ehDocumentoIdentidade } from "@/lib/quero-armas/identidadeUnica";
import { grupoDaPendencia } from "@/lib/quero-armas/pendenciasGrupos";
import {
  HUB_CATEGORIAS,
  getHubCategoriaMeta,
  getNomeDocumentoDisplay,
  getTipoDocumentoMeta,
  tipoDoCatalogoPorRotulo,
  inferEscopoDocumental,
  inferHubCategoriaFromTipo,
  isCategoriaArmaAcervo,
  isTipoDocumentoMonitoravelNoHub,
  listTiposByCategoria,
  normalizeTipoDocumentoParaBanco,
  type EscopoDocumental,
  type HubCategoria,
} from "@/lib/quero-armas/documentosHubCatalogo";
async function notificarDocumentoHubAprovado(documentoId?: string | null) {
  if (!documentoId) return;
  try {
    const { error } = await supabase.functions.invoke("qa-documento-cliente-notificar", {
      body: { documento_id: documentoId, status: "aprovado" },
    });
    if (error) console.warn("Falha ao notificar aprovação do documento do Hub:", error);
  } catch (error) {
    // O documento já foi salvo. Uma indisponibilidade do canal de e-mail não
    // pode transformar uma aprovação válida em aparente falha de salvamento.
    console.warn("Falha ao notificar aprovação do documento do Hub:", error);
  }
}

/**
 * Cardinalidade documental: o mesmo documento válido do Hub atende exigências
 * de vários processos. Quando o motor de reaproveitamento preenche essas
 * exigências, elas ficam com status `dispensado_por_reaproveitamento` — que é
 * cumprimento, e não passa por `aprovado`. Nenhum notificador antigo disparava
 * nesse caminho, então o cliente via o processo andar sem receber nada.
 *
 * Esta chamada varre o que foi reaproveitado e ainda não foi comunicado e
 * manda UM e-mail-resumo por processo (idempotente no backend).
 */
async function notificarReaproveitamentosPendentes(clienteId?: number | null) {
  if (!clienteId) return;
  try {
    const { error } = await supabase.functions.invoke("qa-reaproveitamento-notificar", {
      body: { cliente_id: clienteId },
    });
    if (error) console.warn("Falha ao notificar reaproveitamentos:", error);
  } catch (error) {
    console.warn("Falha ao notificar reaproveitamentos:", error);
  }
}

/**
 * Avisa a EQUIPE — nunca o cliente — quando a conferência do laudo levantou
 * algo que só nós podemos resolver (hoje: credenciado não localizado no
 * cadastro da PF).
 *
 * Regra do usuário (01/08/2026): o cliente avança sem ser alarmado; a equipe
 * valida e, se for o caso, a equipe avisa.
 */
function alertarEquipeSobreLaudo(
  documentoId: string | null | undefined,
  alerta: string | null | undefined,
  clienteNome?: string | null,
) {
  if (!documentoId || !alerta) return;
  void supabase.functions
    .invoke("qa-documento-cliente-notificar", {
      body: { documento_id: documentoId, alerta_equipe: alerta, cliente_nome: clienteNome ?? null },
    })
    .then(({ error }) => {
      if (error) console.warn("Falha ao alertar a equipe sobre o laudo:", error);
    })
    .catch((e) => console.warn("Falha ao alertar a equipe sobre o laudo:", e));
}

// Mapeia o `tipoDetectado` retornado pela edge `qa-classificar-documento-arma`
// para o `tipo_documento` salvo em `qa_documentos_cliente`.
const IA_TO_TIPO: Record<string, string> = {
  // Armas / acervo
  CR: "cr",
  CRAF: "craf",
  SINARM: "sinarm",
  GT: "gt",
  GTE: "gte",
  GUIA_TRANSITO: "gt",
  AUTORIZACAO_COMPRA: "autorizacao_compra",
  NOTA_FISCAL_ARMA: "nota_fiscal_arma",
  // Identificação
  RG_COM_CPF: "rg_com_cpf",
  CIN: "cin",
  CNH: "cnh",
  CPF: "cpf",
  // Endereço
  COMPROVANTE_RESIDENCIA: "comprovante_residencia",
  DECLARACAO_RESPONSAVEL_IMOVEL: "declaracao_responsavel_imovel",
  // Renda
  CTPS: "ctps",
  HOLERITE: "renda_holerite_mes_atual",
  IDENTIDADE_FUNCIONAL: "renda_carteira_funcional",
  CARTAO_CNPJ: "renda_cartao_cnpj",
  CONTRATO_SOCIAL: "renda_contrato_social",
  QSA: "renda_qsa",
  CCMEI: "renda_ccmei",
  NOTA_FISCAL_AUTONOMO: "renda_nf_empresa",
  COMPROVANTE_BENEFICIO: "renda_comprovante_beneficio",
  EXTRATO_INSS: "renda_extrato_inss",
  // Antecedentes
  ANTECEDENTES_CRIMINAIS: "antecedentes_criminais",
  ANTECEDENTES_FEDERAL: "antecedentes_federal",
  ANTECEDENTES_FEDERAL_TRF3_REGIONAL: "antecedentes_federal_trf3_regional",
  ANTECEDENTES_FEDERAL_SJSP_JEF: "antecedentes_federal_sjsp_jef",
  ANTECEDENTES_ESTADUAL: "antecedentes_estadual",
  ANTECEDENTES_ESTADUAL_DISTRIBUICAO: "antecedentes_estadual_distribuicao",
  ANTECEDENTES_ESTADUAL_EXECUCOES: "antecedentes_estadual_execucoes",
  ANTECEDENTES_MILITAR: "antecedentes_militar",
  ANTECEDENTES_MILITAR_ESTADUAL: "antecedentes_militar_estadual",
  ANTECEDENTES_ELEITORAL: "antecedentes_eleitoral",
  // Declarações
  DECLARACAO_NAO_INQUERITO: "declaracao_sem_inquerito_processo_criminal",
  DECLARACAO_GUARDA_RESPONSAVEL: "declaracao_guarda_responsavel",
  DECLARACAO_CORRELATA: "declaracao_correlata",
  DECLARACAO_GUARDA_ACERVO: "declaracao_guarda_acervo_1endereco",
  // Laudos
  LAUDO_PSICOLOGICO: "laudo_psicologico",
  LAUDO_CAPACIDADE_TECNICA: "laudo_capacidade_tecnica",
  // Efetiva necessidade
  COMPROVANTE_EFETIVA_NECESSIDADE: "comprovante_efetiva_necessidade",
  DOCUMENTO_COMPLEMENTAR: "documento_complementar_caso",
  // CAC
  COMPROVANTE_HABITUALIDADE: "comprovante_habitualidade",
  COMPROVANTE_CLUBE: "comprovante_filiacao_entidade_tiro",
  COMPROVANTE_COMPETICAO: "comprovante_competicao",
  // Processuais
  // O formulário do SINARM se chama "REQUERIMENTO DE AQUISIÇÃO DE ARMA DE FOGO"
  // no papel e "Requerimento de Posse de Arma de Fogo" no catálogo do Hub. As
  // duas grafias entram aqui: a leitura pode devolver qualquer uma das duas.
  REQUERIMENTO_DE_POSSE_DE_ARMA_DE_FOGO: "requerimento_de_posse_de_arma_de_fogo",
  REQUERIMENTO_DE_AQUISICAO_DE_ARMA_DE_FOGO: "requerimento_de_posse_de_arma_de_fogo",
  REQUERIMENTO_SINARM: "requerimento_de_posse_de_arma_de_fogo",
  PROTOCOLO_PROCESSO: "protocolo_processo",
  OFICIO: "oficio",
  DESPACHO: "despacho",
  EXIGENCIA: "exigencia",
  INDEFERIMENTO: "indeferimento",
  // Jurídico
  PROCURACAO: "procuracao",
  RECURSO_ADMINISTRATIVO: "recurso_administrativo_doc",
  MANDADO_SEGURANCA: "mandado_seguranca_doc",
  PROCURACAO_ASSINADA: "procuracao_assinada",
  // Foto do requerente (imagem de rosto, sem texto)
  FOTO_3X4: "foto_3x4",
  FOTO: "foto_3x4",
  RETRATO: "foto_3x4",
  // Fallback
  DESCONHECIDO: "outro",
};

type IAClass = {
  tipoDetectado: string;
  confianca: number;
  justificativa?: string;
  camposExtraidos?: Record<string, string | undefined> | null;
  recomendacao?: "aceitar" | "confirmar" | "revisao_obrigatoria";
  revisao_obrigatoria?: boolean;
};

type ConformidadeStatus = "conforme" | "divergente" | "sem_referencia" | "verificando";
type ConformidadeItem = {
  campo: string;
  label: string;
  valorCertidao: string;
  valorReferencia: string | null;
  fonteReferencia: string | null;
  status: ConformidadeStatus;
};

/**
 * Texto em linguagem clara explicando, campo a campo, por que a conformidade
 * reprovou o documento. Nada de "fale com a equipe": o cliente vê o motivo.
 */
function explicarDivergencia(item: ConformidadeItem): string {
  const lido = item.valorCertidao || "não localizado";
  const esperado = item.valorReferencia || "não informado no cadastro";
  // Requerimento: o valor não foi "lido de um documento", foi DIGITADO pelo
  // cliente no site da PF. A frase precisa dizer isso, senão ele procura erro
  // no arquivo em vez de corrigir o que ele mesmo preencheu.
  if (item.fonteReferencia === "Cadastro do cliente") {
    return `no requerimento foi digitado "${lido}"; no cadastro consta "${esperado}". A PF confere campo a campo e indefere na diferença — veja qual dos dois está certo e corrija antes de enviar.`;
  }
  switch (item.campo) {
    case "nome_completo":
      return `o documento está em nome de "${lido}", mas o interessado do processo é "${esperado}". Documento de outra pessoa não é aceito.`;
    case "cpf":
      return `o CPF do documento (${lido}) é diferente do CPF do interessado (${esperado}).`;
    case "tomador_nome":
      return `a nota foi emitida para "${lido}", que tem o mesmo sobrenome de família do prestador "${esperado}". Nota emitida para parente não comprova ocupação lícita.`;
    case "tomador_endereco":
      return `o endereço do tomador (${lido}) é o mesmo endereço do prestador (${esperado}) — indício de operação entre familiares no mesmo domicílio.`;
    case "cnpj":
    case "cnpj_prestador":
      return `o CNPJ do documento (${lido}) não é o mesmo CNPJ da empresa já comprovada (${esperado}).`;
    case "razao_social":
    case "razao_social_prestador":
      return `a razão social do documento ("${lido}") não confere com a empresa já comprovada ("${esperado}").`;
    case "data_nascimento":
      return `a data de nascimento do documento (${formatDateBrDisplay(lido)}) não confere com a do cadastro (${formatDateBrDisplay(esperado)}).`;
    case "nome_mae":
      return `o nome da mãe no documento ("${lido}") não confere com o cadastro ("${esperado}").`;
    default:
      return `o valor lido no documento ("${lido}") não confere com a referência já aprovada ("${esperado}").`;
  }
}

const TIPOS_CERTIDAO = new Set([
  "antecedentes_criminais",
  "antecedentes_federal",
  "antecedentes_federal_trf3_regional",
  "antecedentes_federal_sjsp_jef",
  "antecedentes_estadual",
  "antecedentes_estadual_distribuicao",
  "antecedentes_estadual_execucoes",
  "antecedentes_militar",
  "antecedentes_eleitoral",
]);

function normalizeStr(s: string): string {
  return s.trim().toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ª/g, "A")
    .replace(/º/g, "O")
    // Normaliza separadores variados (–, —, -, /, |) para espaço
    .replace(/[–—\-\/|_.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectTextParts(value: unknown, acc: string[] = []): string[] {
  if (value == null) return acc;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const s = String(value).trim();
    if (s) acc.push(s);
    return acc;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectTextParts(item, acc));
    return acc;
  }
  if (typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => collectTextParts(item, acc));
  }
  return acc;
}

function buildDocumentoHaystack(input: {
  tipoDocumento?: string | null;
  arquivoNome?: string | null;
  nomeDocumento?: string | null;
  orgaoEmissor?: string | null;
  numeroDocumento?: string | null;
  classificacao?: IAClass | null;
  campos?: unknown;
}): string {
  const parts = collectTextParts([
    input.tipoDocumento,
    input.arquivoNome,
    input.nomeDocumento,
    input.orgaoEmissor,
    input.numeroDocumento,
    input.classificacao?.tipoDetectado,
    input.classificacao?.camposExtraidos,
    input.campos,
  ]);
  return normalizeStr(parts.join(" "));
}

/**
 * JUSTIÇA MILITAR ≠ JUSTIÇA FEDERAL COMUM.
 * A Justiça Militar da União (STM) e a Justiça Militar Estadual (TJM) são
 * ramos próprios do Judiciário. Suas certidões citam "Justiça Federal"?
 * Não — mas citam "União", "Militar" e "Tribunal", o que fazia a heurística
 * federal capturá-las por engano. Este detector roda ANTES da federal e tem
 * precedência absoluta.
 */
function detectaCertidaoMilitar(hay: string): "antecedentes_militar" | "antecedentes_militar_estadual" | null {
  const ehMilitar =
    /JUSTICA MILITAR|TRIBUNAL MILITAR|AUDITORIA MILITAR|ACOES PENAIS MILITARES|CRIMES MILITARES|\bSTM\b|\bTJM\b/.test(hay);
  if (!ehMilitar) return null;
  const ehUniao =
    /JUSTICA MILITAR DA UNIAO|SUPERIOR TRIBUNAL MILITAR|\bSTM\b/.test(hay);
  const ehEstadual =
    /JUSTICA MILITAR ESTADUAL|JUSTICA MILITAR DO ESTADO|TRIBUNAL DE JUSTICA MILITAR|\bTJM\b/.test(hay);
  if (ehUniao && !ehEstadual) return "antecedentes_militar";
  if (ehEstadual && !ehUniao) return "antecedentes_militar_estadual";
  // Ambos os sinais (ou nenhum discriminante): a União prevalece só quando o
  // texto nomeia o STM explicitamente; caso contrário deixa como está para o
  // operador decidir, em vez de chutar o slot errado.
  if (ehUniao && /SUPERIOR TRIBUNAL MILITAR|JUSTICA MILITAR DA UNIAO/.test(hay)) return "antecedentes_militar";
  return null;
}

function detectaSubtipoCertidaoFederal(hay: string): "antecedentes_federal_trf3_regional" | "antecedentes_federal_sjsp_jef" | "antecedentes_federal" | null {
  // Certidão militar nunca é certidão da Justiça Federal comum.
  if (detectaCertidaoMilitar(hay)) return null;
  const isCertidaoFederal =
    /\bTRF\b|\bTRF3\b|TRIBUNAL REGIONAL FEDERAL|JUSTICA FEDERAL|SECAO JUDICIARIA|JEF/.test(hay);
  if (!isCertidaoFederal) return null;
  // Sinal de MAIOR PESO: o campo "Abrangência" impresso na própria certidão.
  // "Abrangência - Regional"            → certidão Regional do TRF3
  // "Abrangência - Seção Judiciária..." → certidão SJSP/JEF
  // Menções a Seção Judiciária/JEF em rodapé, endereço ou instruções NÃO
  // podem reclassificar o documento (causa do falso "duplicidade").
  const abrangencia = hay.match(/ABRANGENCIA\s*[-:]?\s*([^\n]{0,80})/)?.[1] ?? "";
  if (abrangencia) {
    if (/REGIONAL/.test(abrangencia)) return "antecedentes_federal_trf3_regional";
    if (/SECAO JUDICIARIA|JUIZADO ESPECIAL|\bJEF\b|LOCAL/.test(abrangencia)) {
      return "antecedentes_federal_sjsp_jef";
    }
  }
  if (/JUDICIARIA SP|SJSP|JEF|871659|SECAO JUDICIARIA|SECAO JUDICIARIA DE SAO PAULO/.test(hay)) {
    return "antecedentes_federal_sjsp_jef";
  }
  if (
    /TRF3/.test(hay) ||
    /TRF\s*3/.test(hay) ||
    /TRIBUNAL REGIONAL FEDERAL(?:\s+DA)?\s+3(?:A|O)?\s+REGIAO/.test(hay) ||
    /3(?:A|O)?\s+REGIAO/.test(hay) ||
    /TERCEIRA\s+REGIAO/.test(hay)
  ) {
    return "antecedentes_federal_trf3_regional";
  }
  return "antecedentes_federal";
}

/**
 * Tipos em que a leitura "desiste" e devolve um rótulo genérico. Só eles podem
 * ser reclassificados pelo título impresso do requerimento — reclassificar um
 * tipo já específico seria atropelar uma leitura que acertou.
 */
const TIPOS_GENERICOS_RECLASSIFICAVEIS = new Set([
  "outro",
  "protocolo_processo",
  "documento_complementar_caso",
  "comprovante_efetiva_necessidade",
  "sinarm",
  "autorizacao_compra",
]);

/**
 * Rótulo da IA que o mapa fixo não conhece.
 *
 * `IA_TO_TIPO` é uma tabela de chaves exatas: rótulo novo do classificador cai
 * em "outro documento" — e o slot, que pedia outra coisa, reprova o documento
 * certo. Aqui só o requerimento é resgatado, porque é o único cujo rótulo tem
 * variação conhecida ("de posse", "de aquisição", "SINARM").
 */
function tipoHubDoRotuloIA(rotulo: unknown): string | null {
  const bruto = String(rotulo ?? "").trim();
  if (!bruto) return null;
  return (
    tipoDoCatalogoPorRotulo(bruto) ??
    (rotuloIndicaRequerimentoSinarm(bruto) ? "requerimento_de_posse_de_arma_de_fogo" : null)
  );
}

/**
 * O documento é o requerimento da PF, mesmo que a classificação não tenha dito
 * isso?
 *
 * `buildDocumentoHaystack` NÃO carrega o texto do PDF nem a justificativa da
 * IA — de propósito, porque a justificativa realimentava as heurísticas de
 * certidão (um STM cita "Justiça Federal" para NEGAR a equivalência, e isso o
 * classificava como TRF3). Só que, sem essas duas fontes, o requerimento
 * enviado como PDF DIGITALIZADO não tinha como ser reconhecido: o nome do
 * arquivo sozinho não prova nada, e a única frase que diz o que o documento é
 * está justamente na justificativa.
 *
 * Por isso o sinal do requerimento é calculado à parte, com texto e
 * justificativa, e exige DOIS marcadores simultâneos (título impresso +
 * Polícia Federal/SINARM/Lei 10.826). É estreito o bastante para não capturar
 * documento nenhum que apenas mencione arma de fogo.
 */
function ehRequerimentoPeloConjuntoDeSinais(input: {
  textoPdf?: string | null;
  classificacao?: IAClass | null;
  arquivoNome?: string | null;
  campos?: unknown;
}): boolean {
  const partes = collectTextParts([
    input.textoPdf,
    input.arquivoNome,
    input.classificacao?.tipoDetectado,
    input.classificacao?.justificativa,
    input.classificacao?.camposExtraidos,
    input.campos,
  ]);
  return textoIndicaRequerimentoSinarm(normalizeStr(partes.join(" ")));
}

function refinarTipoDocumentoPorTexto(tipoAtual: string, hay: string): string {
  // ── REQUERIMENTO DA PF ────────────────────────────────────────────────────
  // O formulário do SINARM traz número de protocolo, e por causa disso a IA o
  // classificava como "Protocolo do processo" com 98% de confiança — o slot
  // pedia o requerimento e o documento CERTO era carimbado REPROVADO. O título
  // impresso não deixa dúvida sobre o que o documento é.
  if (TIPOS_GENERICOS_RECLASSIFICAVEIS.has(tipoAtual) && textoIndicaRequerimentoSinarm(hay)) {
    return "requerimento_de_posse_de_arma_de_fogo";
  }

  const contaConsumoImovel =
    /DANF3E|NF3E|NOTA FISCAL DE ENERGIA ELETRICA|CONTA DE ENERGIA|FATURA DE ENERGIA|CONTA DE AGUA|FATURA DE AGUA|CONTA DE GAS|FATURA DE TELECOMUNICACOES/.test(hay) &&
    /ENDERECO DE ENTREGA|UNIDADE CONSUMIDORA|CODIGO DE INSTALACAO|NUMERO UC|\bUC\b|MEDIDOR|CLASSIFICACAO B1 RESIDENCIAL|CONSUMO KWH|HIDROMETRO/.test(hay);
  if (contaConsumoImovel) return "comprovante_residencia";

  // Militar tem precedência: STM e TJM ocupam slots próprios e não podem ser
  // absorvidos pela heurística de certidão federal.
  const subtipoMilitar = detectaCertidaoMilitar(hay);
  if (subtipoMilitar) return subtipoMilitar;

  if (tipoAtual === "antecedentes_estadual") {
    if (/EXECU|1448406/.test(hay)) return "antecedentes_estadual_execucoes";
    if (/DISTRIBUI|ACOES CRIMINAIS|A[CÇ][OÕ]ES CRIMINAIS|1448405/.test(hay)) return "antecedentes_estadual_distribuicao";
    return tipoAtual;
  }
  const subtipoFederal = detectaSubtipoCertidaoFederal(hay);
  if (
    subtipoFederal &&
    (
      tipoAtual === "antecedentes_federal" ||
      tipoAtual === "outro" ||
      tipoAtual === "documento_complementar_caso" ||
      tipoAtual === "comprovante_efetiva_necessidade" ||
      tipoAtual === "trf" ||
      /\bTRF\b|TRIBUNAL REGIONAL FEDERAL|JUSTICA FEDERAL/.test(hay)
    )
  ) {
    return subtipoFederal;
  }
  return tipoAtual;
}

function ehPaginaAutenticacaoTrfIsolada(texto: string): boolean {
  const hay = normalizeStr(texto);
  const ehTrf =
    /TRIBUNAL REGIONAL FEDERAL|TRF3|TRF\s*3|EMISSAO DE CERTIDOES/.test(hay) &&
    /CERTIDAO|CERTIDOES|CODIGO DE SEGURANCA|QR\s*CODE|AUTENTIC/.test(hay);
  if (!ehTrf) return false;
  const temCorpoCertidao =
    /CRIMINAIS CONTRA|NADA CONSTA|CPF\s*N|CPF\s*NO|DATA DE NASCIMENTO|NOME DA MAE/.test(hay);
  return !temCorpoCertidao;
}

function normCpf(s: string): string {
  return s.replace(/\D/g, "");
}

function cpfComDigitosVerificadores(s: string | null | undefined): string {
  const digitos = normCpf(String(s || ""));
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return digitos;
  const base = digitos.slice(0, 9);
  const calcular = (parcial: string, pesoInicial: number) => {
    const soma = parcial.split("").reduce((acc, n, i) => acc + Number(n) * (pesoInicial - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = calcular(base, 10);
  return `${base}${d1}${calcular(`${base}${d1}`, 11)}`;
}

function normCnpj(s: string): string {
  return String(s || "").replace(/\D/g, "");
}

/**
 * Documentos EMPRESARIAIS: a conformidade se faz pela pessoa jurídica
 * (razão social + CNPJ do PRESTADOR), nunca pelo nome pessoal — a NF-e, por
 * exemplo, traz o TOMADOR, que legitimamente é outra pessoa.
 */
const TIPOS_EMPRESARIAIS = new Set([
  "renda_nf_empresa",
  "renda_cartao_cnpj",
  "renda_cnpj_autonomo",
  "cartao_cnpj",
  "cartao_cnpj_mei",
  "renda_qsa",
  "renda_ccmei",
  "renda_contrato_social",
  "renda_ficha_cadastral_jucesp",
]);

const PARTICULAS_NOME = new Set(["DE", "DA", "DO", "DAS", "DOS", "E"]);

const PREFIXOS_LOGRADOURO = /\b(RUA|R|AVENIDA|AV|TRAVESSA|TV|ALAMEDA|AL|PRACA|ESTRADA|ROD|RODOVIA|VIELA|VILA)\b/g;

/**
 * Normaliza endereço para comparação estrutural: remove acento, prefixo de
 * logradouro, pontuação e complemento textual. "RUA ANTONIO MIGLIORI, 117,
 * JARDIM SAO JOAO" e "ANTONIO MIGLIORI, 117, JARDIM SAO JOAO" viram a mesma
 * chave — é o caso real da NFS-e em que prestador e tomador moram juntos.
 */
function normEndereco(s?: string | null): string {
  if (!s) return "";
  return normalizeStr(s)
    .replace(PREFIXOS_LOGRADOURO, " ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Dois endereços são o mesmo quando batem normalizados ou pelo CEP + número. */
function mesmoEnderecoDoc(
  endA?: string | null,
  cepA?: string | null,
  endB?: string | null,
  cepB?: string | null,
): boolean {
  const a = normEndereco(endA);
  const b = normEndereco(endB);
  if (a && b && a === b) return true;
  const ca = String(cepA || "").replace(/\D/g, "");
  const cb = String(cepB || "").replace(/\D/g, "");
  if (ca.length === 8 && ca === cb) {
    const numA = a.match(/\b\d{1,6}\b/)?.[0];
    const numB = b.match(/\b\d{1,6}\b/)?.[0];
    // Mesmo CEP já é forte; mesmo CEP + mesmo número é conclusivo.
    if (!numA || !numB || numA === numB) return true;
  }
  return false;
}

/**
 * Parentesco: nomes diferentes que compartilham sobrenome de família
 * (ex.: GILSON DO NASCIMENTO × RYAN DIAS DO NASCIMENTO).
 */
function mesmaFamilia(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const toks = (s: string) =>
    normalizeStr(s).split(" ").filter((t) => t.length >= 3 && !PARTICULAS_NOME.has(t));
  const ta = toks(a);
  const tb = toks(b);
  if (ta.length < 2 || tb.length < 2) return false;
  if (ta.join(" ") === tb.join(" ")) return false; // mesma pessoa
  // Sobrenome final (ou os dois últimos) em comum caracteriza parentesco.
  const finalA = ta.slice(-2);
  const finalB = tb.slice(-2);
  return finalA.some((t) => finalB.includes(t));
}

// Mapeia nome completo do estado → sigla (já sem acento, uppercase)
const ESTADO_PARA_UF: Record<string, string> = {
  "ACRE": "AC", "ALAGOAS": "AL", "AMAPA": "AP", "AMAZONAS": "AM",
  "BAHIA": "BA", "CEARA": "CE", "DISTRITO FEDERAL": "DF",
  "ESPIRITO SANTO": "ES", "GOIAS": "GO", "MARANHAO": "MA",
  "MATO GROSSO DO SUL": "MS", "MATO GROSSO": "MT", "MINAS GERAIS": "MG",
  "PARA": "PA", "PARAIBA": "PB", "PARANA": "PR", "PERNAMBUCO": "PE",
  "PIAUI": "PI", "RIO DE JANEIRO": "RJ", "RIO GRANDE DO NORTE": "RN",
  "RIO GRANDE DO SUL": "RS", "RONDONIA": "RO", "RORAIMA": "RR",
  "SANTA CATARINA": "SC", "SAO PAULO": "SP", "SERGIPE": "SE",
  "TOCANTINS": "TO",
};

// Normaliza naturalidade para comparação: remove formatação, expande/contrai UF
function normNaturalidade(s: string): string {
  let v = normalizeStr(s); // já: uppercase, sem acento, separadores → espaço
  // Substitui nome completo do estado pela sigla (do maior para menor para evitar substring clash)
  const sorted = Object.keys(ESTADO_PARA_UF).sort((a, b) => b.length - a.length);
  for (const nome of sorted) {
    if (v.includes(nome)) {
      v = v.replace(nome, ESTADO_PARA_UF[nome]);
      break;
    }
  }
  return v.replace(/\s+/g, " ").trim();
}

function normDate(s: string): string {
  // Accepts DD/MM/YYYY or YYYY-MM-DD
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return s.trim();
}

// Formata ISO (YYYY-MM-DD) ou DD/MM/YYYY para exibição no padrão brasileiro
function formatDateBrDisplay(s: string): string {
  if (!s) return s;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return s;
}

// Expande abreviação de sexo para exibição legível
function expandSexo(s: string): string {
  const v = s.trim().toUpperCase();
  if (v === "M" || v === "MASC" || v === "MASCULINO") return "Masculino";
  if (v === "F" || v === "FEM" || v === "FEMININO") return "Feminino";
  return s;
}

// Detecta se o valor extraído é uma idade ("34 anos", "34", "34 anos e 5 meses")
// e NÃO uma data de nascimento — nesses casos não há como comparar com a data do cadastro
function isIdadeStr(s: string): boolean {
  const trimmed = s.trim().toLowerCase();
  if (/^(\d{1,3})\s*(anos?|years?)/.test(trimmed)) return true;
  // Número puro sem formatação de data (sem barras nem hífens) com 1-3 dígitos
  if (/^\d{1,3}$/.test(trimmed) && parseInt(trimmed, 10) < 130) return true;
  return false;
}

// ── Similaridade fuzzy para nomes ────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const prev = Array.from({ length: n + 1 }, (_, i) => i);
  const curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    prev.splice(0, n + 1, ...curr);
  }
  return prev[n];
}

function levenshteinSim(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

// Jaccard por palavras — lida com reordenação: "Carlos José" vs "José Carlos"
function jaccardSim(a: string, b: string): number {
  const words = (s: string) => new Set(s.split(" ").filter(w => w.length > 2));
  const wa = words(a), wb = words(b);
  const inter = [...wa].filter(w => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union === 0 ? 1 : inter / union;
}

// Score combinado: o melhor dos dois algoritmos
function nameSim(a: string, b: string): number {
  const na = normalizeStr(a), nb = normalizeStr(b);
  return Math.max(levenshteinSim(na, nb), jaccardSim(na, nb));
}

// Limites de decisão (sem IA / zona cinzenta / divergente)
const SIM_HIGH = 0.88; // acima → conforme sem IA (typo/partícula omitida)
const SIM_LOW  = 0.55; // abaixo → divergente sem IA (claramente diferente)

// Hierarquia de confiança dos documentos como fonte de referência.
// Nível 1 = maior confiança (governo primário); 3 = menor (empresa mercantil).
const DOC_TRUST_TIER: Record<string, number> = {
  // Nível 1 — Governo, documentos primários de identidade
  cin: 1,
  rg_com_cpf: 1,
  cnh: 1,
  // Nível 2 — Órgãos governamentais / instituições centralizadas e descentralizadas
  cr: 2,
  craf: 2,
  gte: 2,
  sinarm: 2,
  gt: 2,
  antecedentes_criminais: 2,
  antecedentes_federal: 2,
  antecedentes_federal_trf3_regional: 2,
  antecedentes_federal_sjsp_jef: 2,
  antecedentes_estadual: 2,
  antecedentes_estadual_distribuicao: 2,
  antecedentes_estadual_execucoes: 2,
  antecedentes_militar: 2,
  antecedentes_eleitoral: 2,
  laudo_psicologico: 2,
  laudo_capacidade_tecnica: 2,
  renda_comprovante_beneficio: 2,
  renda_extrato_inss: 2,
  comprovante_habitualidade: 2,
  comprovante_filiacao_entidade_tiro: 2,
  // Nível 3 — Empresas mercantis / empregadores / concessionárias
  comprovante_residencia: 3,
  renda_holerite_mes_atual: 3,
  renda_nf_empresa: 3,
  renda_cartao_cnpj: 3,
  renda_contrato_social: 3,
  renda_ccmei: 3,
  ctps: 3,
};

function docTrustTier(tipo: string): number {
  return DOC_TRUST_TIER[tipo] ?? 3;
}

/** Rótulo do órgão emissor, para preencher o campo do formulário. */
const ORGAO_LABEL: Record<string, string> = {
  stm: "Superior Tribunal Militar (STM)",
  tse: "Tribunal Superior Eleitoral (TSE)",
  iirgd: "SSP/SP — IIRGD",
  tjsp_distribuicao: "Tribunal de Justiça de São Paulo",
  tjsp_execucoes: "Tribunal de Justiça de São Paulo",
  trf_regional: "Tribunal Regional Federal da 3ª Região",
  tjm_sp: "Tribunal de Justiça Militar de São Paulo",
  ccmei: "Receita Federal — Portal do Empreendedor",
  cartao_cnpj: "Receita Federal do Brasil",
  qsa: "Receita Federal do Brasil",
  nota_fiscal: "Prefeitura / SEFAZ",
};

/** Soma dias a uma data ISO, em UTC, sem depender do fuso da máquina. */
function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function calcularConformidade(
  campos: Record<string, string | undefined>,
  clienteNome: string | null | undefined,
  clienteCpf: string | null | undefined,
  clienteDataNascimento: string | null | undefined,
  clienteNomeMae: string | null | undefined,
  docsAprovados: any[],
  dataAvaliacaoDoc?: string | null,
  tipoDocumentoAtual?: string | null,
  clienteNaturalidade?: string | null,
  empresaCadastro?: { cnpj?: string | null; razao_social?: string | null } | null,
): ConformidadeItem[] {
  type Ref = { valor: string; fonte: string; tier: number };
  const ref: Record<string, Ref> = {};

  // Ordena docs aprovados: equipe-validado primeiro, depois por tier crescente (1 = mais confiável)
  // Contrato de Adesão e Procuração NUNCA servem como fonte de verdade para dados pessoais —
  // são documentos derivados do próprio cadastro (Central de Adesão) e replicariam o dado.
  // A verdade vem de documentos primários (RG/CIN/CNH), órgãos governamentais ou, na ausência
  // desses, do cadastro do cliente (populado pela Central de Adesão).
  // documento_identificacao_terceiro é o RG/CNH do DONO DO IMÓVEL quando o
  // comprovante de residência está em nome de outra pessoa. Usá-lo como fonte
  // de verdade faria o cruzamento comparar o cliente com um terceiro e acusar
  // divergência de nome e CPF em todo documento seguinte.
  const NAO_SERVEM_COMO_REFERENCIA = new Set([
    "contrato_assinado",
    "procuracao_assinada",
    "documento_identificacao_terceiro",
  ]);
  // Documentos primários de identidade — SEMPRE são a referência principal, mesmo
  // que ainda estejam pendentes de aprovação (foram enviados pela Central de Adesão
  // e servem de "verdade" inicial). Comprovantes e demais docs só entram como
  // fallback quando o dado não existe no documento de identificação.
  const IDENTIDADE_PRIMARIA = new Set(["cin", "rg_com_cpf", "cnh"]);
  // Naturalidade = LOCAL DE NASCIMENTO. Quase nenhum documento traz esse dado:
  // a CNH traz o local/UF de EMISSÃO, as certidões (TSE, TJSP, TRF, STM/TJM)
  // trazem o DOMICÍLIO ELEITORAL ou a comarca/seção judiciária. Usar qualquer um
  // deles como referência produz divergência falsa (ex.: certidão do TSE fixando
  // "JACAREI / SP" contra a naturalidade real "FAXINAL / PR").
  // Por isso a regra é uma LISTA BRANCA: só documentos que efetivamente declaram
  // o local de nascimento servem de referência para esse campo.
  const COM_NATURALIDADE_CONFIAVEL = new Set([
    "cin",
    "rg_com_cpf",
    "certidao_nascimento",
    "certidao_casamento",
    "passaporte",
    "certidao_alteracao_nome",
  ]);
  const sorted = [...docsAprovados]
    .filter(d => {
      if (NAO_SERVEM_COMO_REFERENCIA.has(d.tipo_documento)) return false;
      const st = String(d.status || "").toLowerCase();
      if (st === "reprovado" || st === "substituido" || st === "excluido") return false;
      // Aprovado sempre entra. Pendente entra somente para identidade primária
      // (Central de Adesão) — evita usar comprovante ainda em análise.
      if (st === "aprovado") return true;
      return IDENTIDADE_PRIMARIA.has(d.tipo_documento);
    })
    .sort((a, b) => {
      const tierA = docTrustTier(a.tipo_documento);
      const tierB = docTrustTier(b.tipo_documento);
      if (tierA !== tierB) return tierA - tierB;
      return (b.validado_admin ? 1 : 0) - (a.validado_admin ? 1 : 0);
    });

  for (const doc of sorted) {
    const c = (doc.ia_dados_extraidos?.camposExtraidos || {}) as Record<string, string>;
    const tier = docTrustTier(doc.tipo_documento);
    const nomeDoc = getNomeDocumentoDisplay(doc, doc.tipo_documento);
    const fonte = doc.validado_admin ? `${nomeDoc} (equipe)` : nomeDoc;

    const trySet = (key: string, val: string | undefined) => {
      if (!val) return;
      if (!ref[key] || tier < ref[key].tier) ref[key] = { valor: val, fonte, tier };
    };
    trySet("nome_completo", c.nome_completo);
    trySet("cpf", c.cpf);
    trySet("data_nascimento", c.data_nascimento);
    trySet("filiacao_mae", c.filiacao_mae);
    trySet("filiacao_pai", c.filiacao_pai);
    if (COM_NATURALIDADE_CONFIAVEL.has(doc.tipo_documento)) {
      trySet("naturalidade", c.naturalidade);
    }
    trySet("sexo", c.sexo);
  }

  // O cadastro é populado pela Central de Adesão a partir do próprio documento de
  // identificação civil (CIN/RG/CNH). Por isso ele tem confiança equivalente à
  // identidade primária (tier 1.5) — vem ANTES de comprovantes e demais docs
  // mercantis. Só é sobrescrito por um documento primário de identidade real.
  const setFromCadastro = (key: string, val: string | null | undefined) => {
    if (!val) return;
    const cur = ref[key];
    if (!cur || cur.tier > 1.5) {
      ref[key] = { valor: val, fonte: "Documento de identificação (Central de Adesão)", tier: 1.5 };
    }
  };
  setFromCadastro("nome_completo", clienteNome);
  setFromCadastro("cpf", clienteCpf);
  setFromCadastro("data_nascimento", clienteDataNascimento);
  setFromCadastro("filiacao_mae", clienteNomeMae);
  // Naturalidade do cadastro (Central de Adesão, lida do documento de identidade)
  // é a referência válida quando nenhum documento primário declara o nascimento.
  setFromCadastro("naturalidade", clienteNaturalidade);

  const items: ConformidadeItem[] = [];

  // compare retorna: true = conforme | false = divergente | "gray" = acionar IA
  function pushItem(
    campo: string, label: string, valorDoc: string | undefined,
    compare: (a: string, b: string) => boolean | "gray",
  ) {
    // Campo que o documento NÃO declara nunca vira divergência. A IA às vezes
    // devolve "(não consta)", "não informado", "—" no lugar de string vazia, e
    // tratar isso como valor lido reprovava laudo por dado que o documento
    // simplesmente não traz. Sem dado no documento, não há o que comparar.
    if (!valorDoc || valorAusente(valorDoc)) return;
    const r = ref[campo];
    // Sem o dado declarado no cadastro/documentos aprovados também não há
    // exigência: exibimos "sem referência" e seguimos.
    if (r && valorAusente(r.valor)) {
      items.push({ campo, label, valorCertidao: valorDoc, valorReferencia: null, fonteReferencia: null, status: "sem_referencia" });
      return;
    }
    let status: ConformidadeStatus;
    if (!r) {
      status = "sem_referencia";
    } else {
      const res = compare(valorDoc, r.valor);
      status = res === true ? "conforme" : res === "gray" ? "verificando" : "divergente";
    }
    items.push({ campo, label, valorCertidao: valorDoc, valorReferencia: r?.valor ?? null, fonteReferencia: r?.fonte ?? null, status });
  }

  // Comparador fuzzy para nomes: exato → conforme; alta sim → conforme; zona cinzenta → IA; baixa → divergente
  const fuzzyName = (a: string, b: string): boolean | "gray" => {
    if (normalizeStr(a) === normalizeStr(b)) return true;
    // Subconjunto de tokens: documento pode trazer nome abreviado (ex.: sem sobrenome paterno final).
    // Se TODOS os tokens significativos (>=3 chars, excluindo partículas) do nome menor estiverem
    // presentes na mesma ordem no nome maior, considera-se conforme.
    const STOP = new Set(["DE","DA","DO","DAS","DOS","E"]);
    const ta = normalizeStr(a).split(" ").filter(t => t.length >= 3 && !STOP.has(t));
    const tb = normalizeStr(b).split(" ").filter(t => t.length >= 3 && !STOP.has(t));
    if (ta.length && tb.length) {
      const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
      let i = 0;
      for (const tok of longer) { if (tok === shorter[i]) i++; if (i === shorter.length) break; }
      if (i === shorter.length) return true;
    }
    const sim = nameSim(a, b);
    if (sim >= SIM_HIGH) return true;
    if (sim >= SIM_LOW) return "gray";
    return false;
  };

  // Naturalidade: comparador ÚNICO e canônico (`naturalidadeConfere`), o mesmo
  // usado por `conferirCertidao`. Separa município de UF nos dois lados —
  // "Faxinal ( PR )" e "FAXINAL/PR" são o mesmo lugar.
  const fuzzyNat = (a: string, b: string): boolean | "gray" => {
    if (naturalidadeConfere(a, b)) return true;
    const sim = nameSim(normNaturalidade(a), normNaturalidade(b));
    if (sim >= SIM_HIGH) return true;
    if (sim >= SIM_LOW) return "gray";
    return false;
  };

  // Endereço NUNCA entra na conformidade: o cliente pode ter vários endereços
  // e o documento pode trazer qualquer um deles — diferença não é divergência.
  // ── GOLDEN RECORD DA EMPRESA (prestador) ────────────────────────────────
  if (TIPOS_EMPRESARIAIS.has(String(tipoDocumentoAtual || ""))) {
    const empresaRefs: {
      cnpj?: { valor: string; fonte: string };
      razao?: { valor: string; fonte: string };
    } = {};
    // Cadastro do cliente é a referência-base da empresa (Central de Adesão).
    if (empresaCadastro?.cnpj) empresaRefs.cnpj = { valor: empresaCadastro.cnpj, fonte: "Cadastro do cliente" };
    if (empresaCadastro?.razao_social) empresaRefs.razao = { valor: empresaCadastro.razao_social, fonte: "Cadastro do cliente" };
    let emissaoCartaoCnpj: string | null = null;
    for (const doc of sorted) {
      if (!TIPOS_EMPRESARIAIS.has(String(doc.tipo_documento || ""))) continue;
      const c = (doc.ia_dados_extraidos?.camposExtraidos || {}) as Record<string, string>;
      const nomeDoc = getNomeDocumentoDisplay(doc, doc.tipo_documento);
      if (c.cnpj && !empresaRefs.cnpj) empresaRefs.cnpj = { valor: c.cnpj, fonte: nomeDoc };
      if (c.razao_social && !empresaRefs.razao) empresaRefs.razao = { valor: c.razao_social, fonte: nomeDoc };
      if (isCartaoCnpj(doc.tipo_documento) && !emissaoCartaoCnpj) {
        emissaoCartaoCnpj = String(doc.data_emissao || c.data_emissao || "").slice(0, 10) || null;
      }
    }

    const tipoAtual = String(tipoDocumentoAtual || "");

    // ── SITUAÇÃO CADASTRAL: qualquer coisa diferente de ATIVA reprova ──────
    if (campos.situacao_cadastral) {
      const ok = situacaoCadastralAprovada(campos.situacao_cadastral);
      items.push({
        campo: "situacao_cadastral",
        label: "Situação cadastral",
        valorCertidao: campos.situacao_cadastral,
        valorReferencia: "ATIVA",
        fonteReferencia: "Receita Federal — exigência da PF",
        status: ok === true ? "conforme" : ok === false ? "divergente" : "sem_referencia",
      });
    }

    // ── CONSTITUTIVOS (CCMEI, contrato social, requerimento): nome + CPF ───
    if (isConstitutivoEmpresa(tipoAtual)) {
      const nomeDoc = campos.nome_completo || campos.nome_titular || campos.nome_civil;
      if (nomeDoc) pushItem("nome_completo", "Nome do titular", nomeDoc, fuzzyName);
      if (campos.cpf) {
        pushItem("cpf", "CPF do titular", campos.cpf, (a, b) =>
          normCpf(a) === normCpf(b) || cpfComDigitosVerificadores(a) === cpfComDigitosVerificadores(b));
      }
    }

    // ── QSA: precisa conter, no mínimo, o nome do cliente ─────────────────
    if (isQsa(tipoAtual)) {
      const listaSocios =
        campos.socios || campos.quadro_socios || campos.qsa || campos.nome_completo || campos.nome_titular || "";
      const contem = qsaContemCliente(listaSocios, clienteNome);
      if (contem !== null) {
        items.push({
          campo: "qsa_socio",
          label: "Cliente no quadro de sócios",
          valorCertidao: String(listaSocios).slice(0, 240),
          valorReferencia: clienteNome ?? null,
          fonteReferencia: "Cadastro do cliente",
          status: contem ? "conforme" : "divergente",
        });
      }
      const mesmaConsulta = qsaMesmaEmissaoDoCartao(dataIsoFromBr(campos.data_emissao), emissaoCartaoCnpj);
      if (mesmaConsulta !== null) {
        items.push({
          campo: "qsa_emissao",
          label: "Emissão do QSA (mesma consulta do Cartão CNPJ)",
          valorCertidao: dataIsoFromBr(campos.data_emissao),
          valorReferencia: emissaoCartaoCnpj,
          fonteReferencia: "Cartão CNPJ aprovado",
          status: mesmaConsulta ? "conforme" : "divergente",
        });
      }
    }
    const cnpjDoc = campos.cnpj;
    const razaoDoc = campos.razao_social || campos.nome_empresarial;
    const ehNotaFiscalAtual = isNotaFiscalOcupacao(tipoAtual);
    const emitenteOk = ehNotaFiscalAtual
      ? emitenteConfere(
          { cnpj: cnpjDoc, razao_social: razaoDoc },
          { cnpj: empresaRefs.cnpj?.valor, razao_social: empresaRefs.razao?.valor },
        )
      : null;
    if (cnpjDoc) {
      const r = empresaRefs.cnpj;
      items.push({
        campo: "cnpj",
        label: "CNPJ (prestador)",
        valorCertidao: cnpjDoc,
        valorReferencia: r?.valor ?? null,
        fonteReferencia: r?.fonte ?? null,
        status: ehNotaFiscalAtual && emitenteOk === true
          ? "conforme"
          : !r
            ? "sem_referencia"
            : normCnpj(cnpjDoc) === normCnpj(r.valor)
              ? "conforme"
              : "divergente",
      });
    }
    if (razaoDoc) {
      const r = empresaRefs.razao;
      const res = r ? fuzzyName(razaoDoc, r.valor) : null;
      items.push({
        campo: "razao_social",
        label: "Razão social (prestador)",
        valorCertidao: razaoDoc,
        valorReferencia: r?.valor ?? null,
        fonteReferencia: r?.fonte ?? null,
        status: ehNotaFiscalAtual && emitenteOk === true
          ? "conforme"
          : !r
            ? "sem_referencia"
            : res === true
              ? "conforme"
              : res === "gray"
                ? "verificando"
                : "divergente",
      });
    }
    // ── TOMADOR DA NOTA FISCAL ────────────────────────────────────────────
    // O tomador (cliente da nota) legitimamente é outra pessoa — mas quando ele
    // carrega o sobrenome de família do prestador E divide o mesmo endereço, a
    // nota não comprova atividade econômica real: é emissão entre parentes da
    // mesma casa. Regra do usuário (01/08/2026): rejeitar por grau de parentesco.
    const tomadorNome = campos.tomador_nome;
    if (tomadorNome) {
      const prestadorNome = campos.razao_social || campos.nome_empresarial || clienteNome || "";
      const parentesco =
        mesmaFamilia(tomadorNome, prestadorNome) || mesmaFamilia(tomadorNome, clienteNome);
      const mesmaCasa = mesmoEnderecoDoc(
        campos.tomador_endereco,
        campos.tomador_cep,
        campos.prestador_endereco,
        campos.prestador_cep,
      );
      // Parentesco por si só já rejeita: nota emitida para parente não
      // comprova ocupação lícita, morando junto ou não. O mesmo endereço
      // apenas reforça a explicação exibida ao cliente.
      const reprovaTomador = parentesco;
      items.push({
        campo: "tomador_nome",
        label: "Tomador (destinatário)",
        valorCertidao: tomadorNome,
        valorReferencia: prestadorNome || null,
        fonteReferencia: "Prestador da própria nota",
        status: reprovaTomador ? "divergente" : "conforme",
      });
      if (campos.tomador_endereco || campos.tomador_cep) {
        items.push({
          campo: "tomador_endereco",
          label: "Endereço do tomador",
          valorCertidao: campos.tomador_endereco || `CEP ${campos.tomador_cep}`,
          valorReferencia: campos.prestador_endereco || (campos.prestador_cep ? `CEP ${campos.prestador_cep}` : null),
          fonteReferencia: "Endereço do prestador",
          status: reprovaTomador && mesmaCasa ? "divergente" : "conforme",
        });
      }
    }
    // Nome/CPF pessoal não se aplicam a documento da pessoa jurídica.
    return items;
  }

  pushItem("nome_completo",   "Nome completo",      campos.nome_completo,   fuzzyName);
  // Comparação de CPF tolerante a erro de leitura dos dígitos verificadores:
  // a base de 9 dígitos é o que identifica a pessoa; DV é reconstruído.
  // CPF-01: CPF mascarado ou ilegível NÃO é divergência — é ausência de
  // leitura. Divergir aqui fazia falha de OCR virar "documento de terceiro".
  {
    const cpfLidoDoc = lerCpfDocumento(campos.cpf);
    if (cpfLidoDoc.estado === "valido") {
      pushItem("cpf", "CPF", campos.cpf, (a, b) =>
        normCpf(a) === normCpf(b) || cpfComDigitosVerificadores(a) === cpfComDigitosVerificadores(b));
    } else if (campos.cpf) {
      items.push({
        campo: "cpf",
        label: cpfLidoDoc.estado === "mascarado" ? "CPF (mascarado no documento)" : "CPF (ilegível no documento)",
        valorCertidao: String(campos.cpf),
        valorReferencia: ref["cpf"]?.valor ?? null,
        fonteReferencia: ref["cpf"]?.fonte ?? null,
        status: "sem_referencia",
      });
    }
  }
  // Pula data_nascimento quando: é string de idade ("34 anos") OU
  // quando dia/mês coincidem com a data de avaliação — sinal de que a IA
  // calculou a data subtraindo a idade da data de avaliação (resultado impreciso).
  const dataNasc = campos.data_nascimento || "";
  const dataNascNorm = normDate(dataNasc);
  const avaliacaoNorm = dataAvaliacaoDoc ? normDate(dataAvaliacaoDoc) : null;
  const nascCalculadoDaAvaliacao = !!(avaliacaoNorm && dataNascNorm &&
    avaliacaoNorm.slice(5) === dataNascNorm.slice(5)); // mesmo MM-DD
  if (!isIdadeStr(dataNasc) && !nascCalculadoDaAvaliacao) {
    pushItem("data_nascimento", "Data de nascimento", campos.data_nascimento, (a, b) => normDate(a) === normDate(b));
  }
  pushItem("filiacao_mae",    "Filiação materna",   campos.filiacao_mae,    fuzzyName);
  pushItem("filiacao_pai",    "Filiação paterna",   campos.filiacao_pai,    fuzzyName);
  pushItem("naturalidade",    "Naturalidade",       campos.naturalidade,    fuzzyNat);
  pushItem("sexo",            "Sexo",               campos.sexo,            (a, b) => a.trim().toUpperCase()[0] === b.trim().toUpperCase()[0]);
  // Campos de endereço omitidos intencionalmente: endereco, logradouro, cep, cidade, bairro, uf, estado.

  return items;
}

type AutoResult =
  | { safe: true; documento_id: string | null; tipo_documento: string }
  | {
      safe: false;
      motivo:
        | "documento_nao_identificado"
        | "confianca_insuficiente"
        | "campos_ilegiveis"
        | "duplicado"
        | "erro_insercao"
        | "erro_upload"
        | "revisao_humana_obrigatoria";
      campos_faltando?: string[];
      confianca?: number;
      mensagem?: string;
    };

const MOTIVOS: Record<string, string> = {
  documento_nao_identificado:
    "Não conseguimos identificar este documento com segurança. Envie uma foto/PDF mais nítido.",
  confianca_insuficiente:
    "A leitura do documento não está nítida o suficiente. Reenvie em melhor qualidade.",
  campos_ilegiveis:
    "Alguns campos obrigatórios ficaram ilegíveis. Reenvie a foto/PDF com melhor nitidez.",
  duplicado: "Este documento já está cadastrado no seu Arsenal.",
  erro_insercao: "Não foi possível cadastrar automaticamente. Tente novamente.",
  erro_upload: "Falha ao enviar o arquivo. Verifique sua conexão e tente novamente.",
  revisao_humana_obrigatoria:
    "A IA leu o documento e sugeriu os campos abaixo. Confira CAMPO A CAMPO e corrija o que estiver errado antes de salvar — nada é cadastrado automaticamente.",
};

function dataIsoFromBr(v?: string | null): string {
  if (!v) return "";
  const raw = String(v).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function addDaysIso(iso?: string | null, days = 0): string {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addCalendarMonthsIso(iso?: string | null, months = 1): string {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(day)) return "";
  const targetFirst = new Date(Date.UTC(y, mo - 1 + months, 1));
  const lastDay = new Date(Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth() + 1, 0)).getUTCDate();
  const venc = new Date(Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth(), Math.min(day, lastDay)));
  return venc.toISOString().slice(0, 10);
}

function calcularValidadeHubPorTipo(tipo: string, dataEmissao?: string | null): string {
  // Tipos sem vencimento POR NATUREZA (CCMEI, contrato social, requerimento de
  // empresário, nota fiscal, carteira funcional, certidão civil) precedem
  // qualquer regra de prazo: nunca inferir validade a partir da emissão.
  if (isTipoSemVencimento(tipo)) return "";
  const emissao = dataIsoFromBr(dataEmissao) || String(dataEmissao || "").slice(0, 10);
  if (!emissao) return "";
  // Certidões de antecedentes: a tabela única vive em `validadeCertidoes.ts`.
  // Isto aqui é FALLBACK — quando o parser consegue ler o prazo impresso no
  // PDF, aquele valor tem precedência e nem chega nesta função.
  //
  // `antecedentes_federal_sjsp_jef` entrou no grupo dos 90 em 19/08/2026: é a
  // mesma certidão do mesmo tribunal que a `trf3_regional`, sai do mesmo
  // parser, e estava caindo no grupo de um mês. No acervo isso produziu cinco
  // arquivos com 90 dias (parser leu) e dois com 31 (parser falhou) — mesma
  // certidão, validade decidida por o PDF ter saído legível ou não.
  const regraCertidao = regraValidadeCertidao(tipo);
  if (regraCertidao === "90_dias") return addDaysIso(emissao, 90);
  if (regraCertidao === "um_mes") return addCalendarMonthsIso(emissao, 1);
  // Procuração (assinada ou não): 12 meses a partir da emissão — regra oficial.
  if (tipo === "procuracao" || tipo === "procuracao_assinada") {
    return addCalendarMonthsIso(emissao, 12);
  }
  // Documentos de identificação civil: validade = emissão + 10 anos.
  if (
    [
      "rg",
      "rg_com_cpf",
      "cin",
      "cnh",
      "passaporte",
      "documento_identidade",
      "documento_identificacao",
      "identidade",
    ].includes(tipo)
  ) {
    return addCalendarMonthsIso(emissao, 120);
  }
  // Comprovante de residência: um mês da emissão. As certidões que ficavam
  // nesta mesma lista saíram daqui e vivem em `validadeCertidoes.ts`, tratadas
  // no topo desta função — havia duas listas concorrentes decidindo o mesmo.
  if (tipo === "comprovante_residencia") {
    return addCalendarMonthsIso(emissao, 1);
  }
  // OCUPAÇÃO LÍCITA E RENDA: 30 dias da emissão. Nota fiscal é perpétua.
  if (isNotaFiscalSemVencimento(tipo)) return "";
  if (isDocumentoEmpresa30Dias(tipo)) return addDaysIso(emissao, 30);
  return "";
}

/** Máscara 00.000.000/0000-00 para CNPJ com 14 dígitos. */
function formatCnpj(v?: string | null): string {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length !== 14) return String(v || "").trim();
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/**
 * Nº do documento para o grupo OCUPAÇÃO LÍCITA E RENDA: o identificador
 * oficial é o CNPJ (cartão CNPJ, CCMEI, QSA) ou o número da nota fiscal.
 */
function numeroDocumentoRenda(tipo: string, campos: Record<string, any>): string {
  if (!isDocumentoEmpresa30Dias(tipo) && !isNotaFiscalSemVencimento(tipo)) return "";
  if (isNotaFiscalSemVencimento(tipo)) {
    return String(campos.numero_nf || campos.numero_documento || "").trim();
  }
  return formatCnpj(campos.cnpj) || String(campos.numero_documento || "").trim();
}

function addOneYearIso(iso?: string | null): string {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return "";
  const venc = new Date(Date.UTC(y + 1, mo - 1, d));
  return venc.toISOString().slice(0, 10);
}

function isoToBr(v?: string | null): string {
  if (!v) return "";
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function applyDateMask(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

type FormState = {
  tipo_documento: string;
  /** Título oficial literal lido pela IA do PDF (ex.: "CERTIDÃO ESTADUAL DE DISTRIBUIÇÕES CRIMINAIS"). */
  nome_documento: string;
  numero_documento: string;
  orgao_emissor: string;
  data_emissao: string;
  data_validade: string;
  observacoes: string;
  arma_marca: string;
  arma_modelo: string;
  arma_calibre: string;
  arma_numero_serie: string;
  arma_especie: string;
  /** "Nº Cad. SINARM" — só quando regime SINARM. Ex.: 2022/905178870-50. */
  numero_cad_sinarm: string;
  /** Número de registro SIGMA — só quando regime SIGMA explícito. */
  numero_registro_sigma: string;
  /** Regime canônico inferido pela IA: SINARM | SIGMA | REVISAR. */
  sistema_registro: "" | "SINARM" | "SIGMA" | "REVISAR";
  /** Validade da filiação anual (comprovante_filiacao_entidade_tiro): data_filiacao + 1 ano. */
  validade_filiacao: string;
};

const EMPTY: FormState = {
  tipo_documento: "cr",
  nome_documento: "",
  numero_documento: "",
  orgao_emissor: "",
  data_emissao: "",
  data_validade: "",
  observacoes: "",
  arma_marca: "",
  arma_modelo: "",
  arma_calibre: "",
  arma_numero_serie: "",
  arma_especie: "",
  numero_cad_sinarm: "",
  numero_registro_sigma: "",
  sistema_registro: "",
  validade_filiacao: "",
};

/**
 * Campos sensíveis que a IA pode sugerir, mas que EXIGEM confirmação
 * humana antes do save. Usados para travar o botão "Salvar" e exibir
 * o badge "Confirmar" / "Corrigir" campo a campo.
 */
const SENSITIVE_KEYS = [
  "numero_documento",
  "numero_cad_sinarm",
  "numero_registro_sigma",
  "arma_numero_serie",
  "arma_marca",
  "arma_modelo",
  "arma_calibre",
  "data_validade",
  "sistema_registro",
] as const;
type SensitiveKey = typeof SENSITIVE_KEYS[number];

const GENERIC_WEAPON_MODEL_VALUES = new Set([
  "PISTOLA",
  "REVOLVER",
  "REVÓLVER",
  "CARABINA",
  "ESPINGARDA",
  "FUZIL",
  "ARMA",
  "ARMAMENTO",
]);

function safeExtractedModel(raw: unknown): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  return GENERIC_WEAPON_MODEL_VALUES.has(value.toUpperCase()) ? "" : value;
}

/** Auditoria por campo: valor extraído pela IA × valor confirmado pelo humano. */
type FieldAudit = {
  valor_extraido_ia: string | null;
  valor_confirmado: string | null;
  corrigido_pelo_usuario: boolean;
  confianca: number;
  legivel: boolean;
  fonte: "vision" | "ocr" | "manual";
  confirmado_em: string | null;
};

const modalTheme = {
  // Stack Cockpit Z6 Light — papel #F2F2F2, tinta #0A0A0A, grafite #2F3337, brass #D6A64B
  "--background": "0 0% 100%",
  "--foreground": "0 0% 4%",
  "--card": "0 0% 100%",
  "--card-foreground": "0 0% 4%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "0 0% 4%",
  "--primary": "352 60% 30%",
  "--primary-foreground": "0 0% 100%",
  "--secondary": "0 0% 95%",
  "--secondary-foreground": "0 0% 4%",
  "--muted": "0 0% 95%",
  "--muted-foreground": "0 0% 35%",
  "--accent": "42 60% 50%",
  "--accent-foreground": "0 0% 4%",
  "--border": "0 0% 90%",
  "--input": "0 0% 90%",
  "--ring": "352 60% 30%",
} as React.CSSProperties;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="font-heading text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
  className,
  action,
}: {
  label: string;
  icon?: typeof Hash;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="font-heading flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A7A7A]">
        <span className="flex items-center gap-1.5">
          {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
          {label}
        </span>
        {action}
      </span>
      {children}
    </label>
  );
}

const inputClassName =
  "h-9 rounded-sm border border-[#E5E5E5] bg-white text-[12px] text-[#0A0A0A] shadow-none transition-all placeholder:text-[#9A9A9A] hover:border-[#0A0A0A]/20 focus-visible:border-[#2F3337] focus-visible:ring-1 focus-visible:ring-[#2F3337]/30 focus-visible:ring-offset-0";

/**
 * Input de data em formato BR (DD/MM/AAAA) com máscara, que mantém o
 * valor pai em ISO (YYYY-MM-DD). Substitui o `<input type="date">`
 * nativo — que renderiza em altura inconsistente no iOS Safari — e
 * cumpre a regra de projeto (mem://style/admin-form-architecture).
 */
function DateInputBR({
  value,
  onChange,
  className,
  placeholder = "DD/MM/AAAA",
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [local, setLocal] = useState<string>(isoToBr(value));
  useEffect(() => {
    setLocal(isoToBr(value));
  }, [value]);
  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={local}
      placeholder={placeholder}
      maxLength={10}
      className={className}
      onChange={(e) => {
        const masked = applyDateMask(e.target.value);
        setLocal(masked);
        if (masked.length === 0) {
          onChange("");
          return;
        }
        if (masked.length === 10) {
          const iso = dataIsoFromBr(masked);
          if (iso) onChange(iso);
        }
      }}
    />
  );
}

/** Badge inline de confirmação humana de um campo sensível extraído pela IA. */
function ConfirmBadge({
  extraido,
  confirmado,
  onConfirm,
}: {
  extraido: string | undefined | null;
  confirmado: boolean | undefined;
  onConfirm: () => void;
}) {
  if (!extraido) return null;
  if (confirmado) {
    return (
      <span className="font-heading inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
        <CheckCircle2 className="h-3 w-3" /> Confirmado
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onConfirm}
      className="font-heading inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 hover:bg-amber-300"
      title={`Valor extraído pela IA: ${extraido}`}
    >
      <AlertTriangle className="h-3 w-3" /> Confirmar
    </button>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  customerId: string | null;
  qaClienteId?: number | null;
  onSaved: () => void;
  /** Tipo de documento pré-selecionado ao abrir (ex.: "craf"). Default: "cr". */
  defaultTipo?: string;
  mode?: "portal" | "arsenal";
  /** CPF do cliente cadastrado (somente dígitos). */
  clienteCpf?: string | null;
  /** Nome completo do cliente conforme cadastro. */
  clienteNome?: string | null;
  /** Data de nascimento ISO (YYYY-MM-DD) ou DD/MM/YYYY. */
  clienteDataNascimento?: string | null;
  /** Nome da mãe conforme cadastro. */
  clienteNomeMae?: string | null;
  /** Documentos já aprovados no hub — usados como referência de conformidade. */
  docsAprovados?: any[];
  /** Tipos ainda pendentes no checklist do processo atual (vocabulário do Hub).
   *  Quando o cliente anexa um documento cuja IA classificou em tipo diferente
   *  do exigido mas que cobre outra pendência, o Hub reclassifica sozinho e
   *  aceita salvar nesse outro tipo. */
  pendingHubTipos?: string[];
  /** TRAVA DE ORDEM POR GRUPO (portal do cliente, 12/08/2026).
   *  Grupos do checklist que ainda estão bloqueados porque um grupo anterior
   *  não foi concluído. O Hub recusa salvar documento classificado num desses
   *  grupos — a trava não pode viver só na navegação do pop-up guiado. */
  gruposBloqueados?: string[];
  /** Label do grupo corrente, usado na mensagem de bloqueio. */
  grupoCorrenteLabel?: string | null;
  /** Se preenchido, o documento salvo substitui este documento existente:
   *  grava `substitui_documento_id` no novo registro e marca o antigo como
   *  `substituido` (soft delete com trilha de auditoria). Usado pelo botão
   *  "Renovar" do Hub Documental. */
  substituirDocumentoId?: string | null;
  /** Ano de competência exigido pelo slot que abriu o envio
   *  (`comprovante_endereco_ano_2025` → 2025). Sem ele, o alvo é o ano
   *  corrente — que é o que o comprovante de residência ATUAL pede. */
  anoCompetenciaAlvo?: number | null;
}

function getDefaultTipo(mode: "portal" | "arsenal", defaultTipo?: string) {
  if (defaultTipo) return defaultTipo;
  return mode === "arsenal" ? "cr" : "rg_com_cpf";
}

export function ClienteDocsHubModal({
  open,
  onClose,
  customerId,
  qaClienteId,
  onSaved,
  defaultTipo,
  mode = customerId ? "portal" : "arsenal",
  clienteCpf,
  clienteNome,
  clienteDataNascimento,
  clienteNomeMae,
  docsAprovados = [],
  pendingHubTipos = [],
  gruposBloqueados = [],
  grupoCorrenteLabel = null,
  substituirDocumentoId = null,
  anoCompetenciaAlvo = null,
}: Props) {
  const defaultTipoEfetivo = getDefaultTipo(mode, defaultTipo);
  // BLOCO 4 — fonte única de validade: catálogo do banco antes de qualquer cálculo.
  useEffect(() => {
    carregarCatalogoValidade();
  }, []);
  const [form, setForm] = useState<FormState>({ ...EMPTY, tipo_documento: defaultTipoEfetivo });
  const [categoriaHub, setCategoriaHub] = useState<HubCategoria>(inferHubCategoriaFromTipo(defaultTipoEfetivo));
  const [file, setFile] = useState<File | null>(null);
  // Único caso de dados de terceiro no sistema: comprovante de endereço em
  // nome do responsável pelo imóvel onde o cliente reside.
  const [terceiroDados, setTerceiroDados] = useState<ResidenciaTerceiroPayload | null>(null);
  /** Pop-up guiado da Declaração do Responsável pelo Imóvel (assinatura GOV.BR). */
  const [declaracaoAberta, setDeclaracaoAberta] = useState(false);
  /** ID do comprovante de residência salvo — vincula a declaração ao documento. */
  const [comprovanteDocId, setComprovanteDocId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  // Quem está operando o Hub: usado só para carimbar a trilha (admin/cliente).
  const [atorEhStaff, setAtorEhStaff] = useState(false);
  useEffect(() => {
    let cancelado = false;
    isCurrentUserStaff()
      .then((v) => { if (!cancelado) setAtorEhStaff(Boolean(v)); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, []);
  /**
   * Arquivo idêntico já existente no acervo deste cliente, detectado pelo eTag
   * do Storage depois do upload. Quando preenchido, o documento NÃO é gravado:
   * o arquivo recém-subido é apagado e a tentativa vai para a trilha.
   */
  const [arquivoRepetido, setArquivoRepetido] = useState<ArquivoRepetido | null>(null);
  /** true enquanto dispara o e-mail de recusa do botão "Enviar novamente". */
  const [enviandoNovamente, setEnviandoNovamente] = useState(false);
  /** Último motivo de rejeição já carimbado na tela (evita repetir o carimbo). */
  const motivoCarimbadoRef = useRef<string | null>(null);
  // Trava anti falso-positivo: fica true do instante do salvamento bem-sucedido
  // até o cliente anexar um novo arquivo.
  const docSalvoRef = useRef(false);
  /**
   * Texto cru do PDF lido localmente (pdf.js). A IA devolve apenas os campos do
   * seu schema — que não inclui prestador/tomador da NFS-e. Guardamos o texto
   * para reaproveitar o parser determinístico e completar a conformidade.
   */
  const textoLocalRef = useRef<string>("");
  /**
   * A extração do PDF TERMINOU sem erro? Serve para separar dois casos que
   * chegam iguais em `textoLocalRef` vazio:
   *  - `true`  → o PDF foi lido e realmente não tem texto (salvo como imagem);
   *  - `false` → o pdf.js falhou (worker, memória) e o documento não é culpado.
   * Sem essa distinção, uma falha técnica nossa viraria acusação ao cliente.
   */
  const extracaoPdfOkRef = useRef(false);
  /**
   * Nota fiscal lida do XML anexado pelo cliente.
   *
   * Quando está preenchido, o arquivo que segue no fluxo é o DANFE que NÓS
   * geramos a partir do XML autorizado — e a leitura já está pronta, campo a
   * campo, vinda do layout oficial. Nada é reextraído do PDF e a IA não é
   * consultada: reler o que já sabemos exato só criaria chance de errar.
   */
  const notaXmlRef = useRef<NotaFiscalImportada | null>(null);
  const [resultadoCarimbo, setResultadoCarimbo] = useState<
    { tipo: "aprovado" | "analise" | "reprovado"; percentual?: number | null; mensagem?: string | null; titulo?: string | null } | null
  >(null);
  const [dragOver, setDragOver] = useState(false);
  const [classificacao, setClassificacao] = useState<IAClass | null>(null);
  const [showTipoOverride, setShowTipoOverride] = useState(false);
  const [autoResult, setAutoResult] = useState<AutoResult | null>(null);
  /** Valor original extraído pela IA por campo sensível (snapshot imutável). */
  const [iaExtraido, setIaExtraido] = useState<Partial<Record<SensitiveKey, string>>>({});
  /** Campos sensíveis que o humano confirmou explicitamente. */
  const [confirmados, setConfirmados] = useState<Partial<Record<SensitiveKey, boolean>>>({});
  /** Conformidade cruzada para certidões de antecedentes. */
  const [conformidade, setConformidade] = useState<ConformidadeItem[]>([]);
  /**
   * CPF-01 — comprovante de endereço com CPF ausente ou mascarado.
   * Guarda a avaliação determinística de titularidade e a resposta do cliente
   * ao confronto dos dígitos visíveis. Enquanto não houver resposta, o
   * documento fica PENDENTE — nunca reprovado, nunca tratado como de terceiro.
   */
  const [avaliacaoTitular, setAvaliacaoTitular] = useState<AvaliacaoTitularidade | null>(null);
  // Datas do ciclo da conta de consumo (próxima leitura / vencimento / emissão).
  // Ficam guardadas para calcular validade e o mês de referência a exigir.
  const [datasConsumo, setDatasConsumo] = useState<DatasComprovanteConsumo | null>(null);
  const [cpfConfrontoAberto, setCpfConfrontoAberto] = useState(false);
  const [cpfConfrontoInput, setCpfConfrontoInput] = useState("");
  const [cpfConfrontoErro, setCpfConfrontoErro] = useState<string | null>(null);
  const [cpfConfrontado, setCpfConfrontado] = useState<string | null>(null);
  /** true quando a certidão tem resultado_certidao = "consta_apontamento". */
  const [temApontamento, setTemApontamento] = useState(false);
  /** null = não respondido; "sim" = reconhece; "nao" = não reconhece (homônimo). */
  const [reconheceApontamento, setReconheceApontamento] = useState<"sim" | "nao" | null>(null);
  /** true após o cliente assinar a declaração de homonímia nesta sessão. */
  const [homonimiaSalva, setHomonimiaSalva] = useState(false);
  /** true para expandir o preview da declaração de homonímia. */
  const [showDeclaracao, setShowDeclaracao] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  /**
   * Auto-busca de dados do cliente para alimentar o motor de conformidade
   * cruzada. Resolve cenários (ex.: Bancada/Arsenal) onde o componente
   * pai não passa explicitamente clienteCpf/clienteNome/etc.
   */
  // Resultado da leitura local. Quando existe, é ele que manda: substitui a
  // classificação por IA e é a fonte do painel de conferência.
  const [conferenciaLocal, setConferenciaLocal] = useState<{
    doc: ReturnType<typeof parseCertidao>;
    conf: ReturnType<typeof conferirCertidao>;
    /** Texto integral lido do PDF — matéria-prima da auditoria de leitura. */
    texto?: string;
  } | null>(null);

  /**
   * UF lida do comprovante de endereço pela faixa de CEP.
   *
   * NÃO substitui a IA neste tipo: o parser de endereço só resolve a UF, e o
   * comprovante ainda precisa da leitura do titular e da próxima leitura da
   * fatura. Entra como canal paralelo — a UF fica gravada, o resto segue o
   * caminho de hoje.
   */
  const [enderecoLocal, setEnderecoLocal] = useState<ResultadoEndereco | null>(null);

  /**
   * Conferência do laudo (psicológico ou tiro).
   *
   * Diferente das certidões, o laudo chega como digitalização e os campos vêm
   * da leitura por IA. Este estado guarda o veredicto para (1) bloquear o
   * salvamento quando o documento não serve e (2) mostrar à equipe o alerta
   * que NÃO vai para o cliente.
   */
  const [conferenciaLaudo, setConferenciaLaudo] = useState<ResultadoLaudo | null>(null);

  /**
   * Notas que o cliente informou porque a leitura não conseguiu extrair.
   *
   * Perguntamos AQUI, no envio, e não num checklist depois: neste momento ele
   * está com o laudo na mão. Depois teria de procurar o documento de novo.
   */
  const [notasInformadas, setNotasInformadas] = useState<Record<string, string>>({});

  const [clienteAutoFetch, setClienteAutoFetch] = useState<{
    nome: string | null;
    cpf: string | null;
    data_nascimento: string | null;
    nome_mae: string | null;
    naturalidade_municipio: string | null;
    naturalidade_uf: string | null;
    rg: string | null;
    cep: string | null;
    cidade: string | null;
    uf: string | null;
    ocupacao_licita_cnpj: string | null;
    ocupacao_licita_razao_social: string | null;
  }>({ nome: null, cpf: null, data_nascimento: null, nome_mae: null, naturalidade_municipio: null, naturalidade_uf: null, rg: null, cep: null, cidade: null, uf: null, ocupacao_licita_cnpj: null, ocupacao_licita_razao_social: null });

  /**
   * Cadastro COMPLETO do cliente, como está no banco.
   *
   * O motor genérico de conformidade confere só nome, CPF, nascimento, filiação
   * e naturalidade — é o que os documentos emitidos por órgão trazem. O
   * requerimento da PF é outra história: todo campo dele foi DIGITADO pelo
   * cliente, e a PF confere linha a linha. Para conferir na mesma régua
   * precisamos da linha inteira do cadastro, não de cinco campos.
   */
  const [cadastroCompleto, setCadastroCompleto] = useState<CadastroParaRequerimento | null>(null);

  // Docs aprovados carregados internamente quando o prop vier vazio
  const [docsAprovadosFetched, setDocsAprovadosFetched] = useState<any[]>([]);

  // Dados do profissional extraídos pela IA (psicólogo ou instrutor)
  const [profissionalExtraido, setProfissionalExtraido] = useState<{
    nome: string | null;
    registro: string | null;
    endereco?: string | null;
    cidade?: string | null;
    uf?: string | null;
    telefone?: string | null;
  }>({ nome: null, registro: null });

  // Reseta todo o estado do modal quando ele é fechado, para que ao abrir
  // novamente não persista arquivo, resultado de IA ou campos preenchidos.
  useEffect(() => {
    if (open) return;
    setFile(null);
    setTerceiroDados(null);
    setForm({ ...EMPTY, tipo_documento: defaultTipoEfetivo });
    setCategoriaHub(inferHubCategoriaFromTipo(defaultTipoEfetivo));
    setClassificacao(null);
    setNotasInformadas({});
    setAutoResult(null);
    setIaExtraido({});
    setConfirmados({});
    setConformidade([]);
    setTemApontamento(false);
    setReconheceApontamento(null);
    setHomonimiaSalva(false);
    setShowDeclaracao(false);
    setExtracting(false);
    setProfissionalExtraido({ nome: null, registro: null });
    setCadastroCompleto(null);
    setDocsAprovadosFetched([]);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Busca docs aprovados quando o prop vier vazio (ex: abertura via PendenciasGuiadasPopup)
  useEffect(() => {
    if (!open || !qaClienteId || docsAprovados.length > 0) { setDocsAprovadosFetched([]); return; }
    let cancelled = false;
    supabase
      .from("qa_documentos_cliente" as any)
      // `data_validade`/`regra_validacao`/`ano_competencia` são obrigatórios aqui:
      // sem eles a trava de duplicidade não consegue distinguir documento que
      // ainda cobre a exigência de documento vencido que precisa ser renovado.
      .select("id, tipo_documento, status, validado_admin, updated_at, created_at, ia_dados_extraidos, data_emissao, data_validade, data_validade_efetiva, regra_validacao, ano_competencia, numero_documento")
      .eq("qa_cliente_id", qaClienteId)
      .eq("status", "aprovado")
      .then(({ data }) => {
        if (!cancelled) setDocsAprovadosFetched((data as any[]) || []);
      });
    return () => { cancelled = true; };
  }, [open, qaClienteId, docsAprovados.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Docs efetivos: prop tem prioridade; fallback para os buscados internamente
  const docsEfetivos = docsAprovados.length > 0 ? docsAprovados : docsAprovadosFetched;

  // Novo arquivo anexado (ou modal limpo) → libera novamente o carimbo de
  // rejeição por duplicidade.
  useEffect(() => {
    docSalvoRef.current = false;
    setArquivoRepetido(null);
  }, [file]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!open || !qaClienteId) return;
      // Sempre busca: endereço (end1_cep/cidade/estado) nunca vem como prop
      // e é necessário para busca de psicólogos próximos.
      const skipPessoais = !!(clienteNome && clienteCpf && clienteDataNascimento && clienteNomeMae);
      try {
        const { data } = await supabase
          .from("qa_clientes" as any)
          .select("nome_completo, cpf, data_nascimento, nome_mae, nome_pai, sexo, estado_civil, naturalidade_municipio, naturalidade_uf, naturalidade_pais, rg, emissor_rg, uf_emissor_rg, expedicao_rg, titulo_eleitor, profissao, email, celular, endereco, numero, complemento, bairro, cep, cidade, estado, cep2, cidade2, estado2, responsavel_endereco_cep, responsavel_endereco_cidade, responsavel_endereco_estado, ocupacao_licita_cnpj, ocupacao_licita_razao_social")
          .eq("id", qaClienteId)
          .maybeSingle();
        if (cancelled || !data) return;
        const row = data as unknown as Record<string, string | null>;
        // Guarda a linha inteira para a conferência campo a campo do
        // requerimento. Os dados da EMPRESA ficam de fora de propósito.
        setCadastroCompleto({
          nome_completo: row.nome_completo, cpf: row.cpf, nome_mae: row.nome_mae,
          nome_pai: row.nome_pai, data_nascimento: row.data_nascimento, sexo: row.sexo,
          estado_civil: row.estado_civil, naturalidade_pais: row.naturalidade_pais,
          naturalidade_uf: row.naturalidade_uf, naturalidade_municipio: row.naturalidade_municipio,
          rg: row.rg, emissor_rg: row.emissor_rg, uf_emissor_rg: row.uf_emissor_rg,
          expedicao_rg: row.expedicao_rg, titulo_eleitor: row.titulo_eleitor,
          profissao: row.profissao, email: row.email, celular: row.celular,
          cep: row.cep, endereco: row.endereco, numero: row.numero,
          complemento: row.complemento, bairro: row.bairro, cidade: row.cidade,
          estado: row.estado,
        });
        // Endereço: tenta os campos do cadastro em cascata
        let cep = row.cep || row.cep2 || row.responsavel_endereco_cep || null;
        let cidade = row.cidade || row.cidade2 || row.responsavel_endereco_cidade || null;
        let uf = row.estado || row.estado2 || row.responsavel_endereco_estado || null;
        // Fallback: extrai endereço de comprovante de residência aprovado
        if (!cep && !cidade) {
          const comprovante = docsEfetivos
            .filter((d: any) => d.status === "aprovado" && d.tipo_documento === "comprovante_residencia")
            .sort((a: any, b: any) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""))[0];
          if (comprovante) {
            const c = (comprovante.ia_dados_extraidos?.camposExtraidos || {}) as Record<string, string>;
            cep = c.cep || null;
            cidade = c.cidade || c.municipio || null;
            uf = c.uf || c.estado || null;
          }
        }
        setClienteAutoFetch(prev => ({
          // Campos pessoais: só sobrescreve se não vieram como props
          nome: skipPessoais ? prev.nome : (row.nome_completo || null),
          cpf: skipPessoais ? prev.cpf : (row.cpf || null),
          data_nascimento: skipPessoais ? prev.data_nascimento : (row.data_nascimento || null),
          nome_mae: skipPessoais ? prev.nome_mae : (row.nome_mae || null),
          // Naturalidade entra para a conferência local de certidões: vários
          // portais deixam o próprio cliente digitá-la, e a PF confere.
          naturalidade_municipio: row.naturalidade_municipio || null,
          naturalidade_uf: row.naturalidade_uf || null,
          rg: row.rg || null,
          // Endereço: sempre atualiza — nunca vem como prop
          cep, cidade, uf,
          // Dados da empresa do cadastro: referência do grupo Ocupação Lícita.
          ocupacao_licita_cnpj: row.ocupacao_licita_cnpj || null,
          ocupacao_licita_razao_social: row.ocupacao_licita_razao_social || null,
        }));
      } catch {
        // Silencioso — conformidade apenas degrada para "sem referência".
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, qaClienteId, clienteNome, clienteCpf, clienteDataNascimento, clienteNomeMae]);

  const refClienteNome = clienteNome ?? clienteAutoFetch.nome;
  const refClienteCpf = clienteCpf ?? clienteAutoFetch.cpf;
  const refClienteDataNascimento = clienteDataNascimento ?? clienteAutoFetch.data_nascimento;
  const refClienteNomeMae = clienteNomeMae ?? clienteAutoFetch.nome_mae;
  // Documentos constitutivos da empresa (CCMEI, contrato social, requerimento
  // de empresário) e nota fiscal não têm emissão/validade a conferir.
  const semDatasOcupacao = !exigeDatasOcupacao(form.tipo_documento);

  // Sincroniza tipo padrão a cada abertura (sem quebrar edição em andamento).
  // Reset apenas quando o modal abre.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) {
      const tipoInicial = getDefaultTipo(mode, defaultTipo);
      // Reset COMPLETO ao reabrir: não vazar dados do documento anterior.
      setForm({ ...EMPTY, tipo_documento: tipoInicial });
      setCategoriaHub(inferHubCategoriaFromTipo(tipoInicial));
      setClassificacao(null);
      setShowTipoOverride(false);
      setAutoResult(null);
      setIaExtraido({});
      setConfirmados({});
      setConformidade([]);
      setTemApontamento(false);
      setReconheceApontamento(null);
      setHomonimiaSalva(false);
      setShowDeclaracao(false);
    }
  }, [open, defaultTipo, mode]);

  const tiposDisponiveis = listTiposByCategoria(categoriaHub);
  const tipoAtual = getTipoDocumentoMeta(form.tipo_documento) ?? tiposDisponiveis[0] ?? null;
  // Tipo exigido pelo Assistente de Documentação (quando o modal é aberto a partir
  // de um slot específico do checklist). Mantemos este valor "congelado" para exibir
  // sob o DOSSIÊ e comparar contra a classificação da IA.
  const expectedTipoMeta = defaultTipo ? (getTipoDocumentoMeta(defaultTipo) ?? null) : null;
  // A comparação vale para QUALQUER leitura que tenha identificado o tipo —
  // a da IA (`classificacao`) ou a local (`conferenciaLocal`). Exigir só
  // `classificacao` fazia a checagem sumir no caminho novo: o parser local
  // classificava certo, o documento era aceito, e ninguém avisava que não era
  // o que o checklist havia pedido.
  const tipoDivergenteExigencia = !!(
    expectedTipoMeta &&
    (classificacao || conferenciaLocal) &&
    form.tipo_documento &&
    form.tipo_documento !== expectedTipoMeta.value &&
    // CIN, CNH e RG são vias da MESMA exigência de identidade civil:
    // enviar a CNH num slot que pedia CIN não é documento incorreto.
    !mesmaExigenciaIdentidade(form.tipo_documento, expectedTipoMeta.value)
  );
  // Conjunto de tipos ainda pendentes no checklist (vocabulário Hub).
  const pendingSet = new Set(
    (pendingHubTipos || [])
      .map((t) => toHubTipoCompartilhado(String(t).toLowerCase()))
      .filter(Boolean),
  );
  // Cliente mandou uma certidão diferente, mas ela cobre outra pendência do
  // checklist — reaproveitar automaticamente é a decisão correta.
  const cobreOutraPendencia = !!(
    tipoDivergenteExigencia &&
    form.tipo_documento &&
    pendingSet.size > 0 &&
    pendingSet.has(form.tipo_documento)
  );
  // Cliente mandou algo que não é pedido em lugar nenhum do processo.
  // FAIL-CLOSED: se a lista de pendências não chegou (`pendingHubTipos` vazio),
  // NÃO se pode presumir que o documento cobre outra exigência. Antes esta
  // condição exigia `pendingSet.size > 0` e, como nenhum call site passava a
  // prop, a trava ficava permanentemente desligada — o aviso "documento
  // divergente" aparecia na tela e o SALVAR continuava habilitado.
  const certidaoIncorreta = !!(
    tipoDivergenteExigencia &&
    form.tipo_documento &&
    !cobreOutraPendencia
  );
  // ── TRAVA DE ORDEM POR GRUPO ────────────────────────────────────────────
  // O documento pertence a um grupo que ainda não foi liberado (ex.: cliente
  // manda certidões de Idoneidade com a Ocupação lícita em aberto). Só vale
  // no portal do cliente e só depois de a leitura identificar o tipo.
  const grupoDoDocumento =
    form.tipo_documento && (classificacao || conferenciaLocal)
      ? grupoDaPendencia(form.tipo_documento, form.tipo_documento).id
      : null;
  const grupoBloqueadoTrava = !!(
    mode === "portal" &&
    grupoDoDocumento &&
    (gruposBloqueados || []).includes(grupoDoDocumento)
  );
  const mensagemGrupoBloqueado = grupoCorrenteLabel
    ? `Este documento é de uma etapa mais adiante do seu checklist. Conclua ${grupoCorrenteLabel} para liberar esta entrega.`
    : "Este documento é de uma etapa mais adiante do seu checklist. Conclua a etapa atual para liberar esta entrega.";
  // DUPLICIDADE: o tipo lido pela IA já consta aprovado no Hub Documental E
  // aquele documento AINDA COBRE a exigência. Não existe "mandar para análise"
  // nesse caso — o documento é rejeitado na hora, com carimbo vermelho, e o
  // cliente precisa excluir o anterior ou anexar o documento realmente exigido.
  //
  // Documento aprovado porém VENCIDO (ou de outro ano de competência) não é
  // duplicidade: é RENOVAÇÃO. O banco nunca aceitou documento vencido para
  // fechar o slot — `qa_processo_rever_exigencias` e o gatilho
  // `qa_doc_hub_satisfaz_exigencias_processo` exigem `data_validade >= hoje` e
  // o ano certo. Enquanto a tela achava que bastava tipo + status, o cliente
  // caía numa armadilha fechada: o checklist pedia o comprovante e o Hub
  // recusava o comprovante novo por causa do vencido (caso Gilson, 17/08/2026).
  const avaliacaoDuplicidade = useMemo(
    () =>
      avaliarDuplicidadeHub({
        docs: docsEfetivos as any[],
        tipo: form.tipo_documento,
        anoAlvo: anoCompetenciaAlvo ?? anoDoSlotEndereco(defaultTipo),
      }),
    [docsEfetivos, form.tipo_documento, anoCompetenciaAlvo, defaultTipo],
  );
  const leituraConcluida = !!(classificacao || conferenciaLocal);
  const docDuplicado = !!(
    form.tipo_documento && leituraConcluida && avaliacaoDuplicidade.duplicata
  );
  /** Documento do acervo que este envio vem substituir (vencido / outro ano). */
  const renovacaoAlvo = form.tipo_documento ? avaliacaoDuplicidade.renovar : null;
  const avisoRenovacao = renovacaoAlvo
    ? mensagemRenovacao(avaliacaoDuplicidade.motivo)
    : null;
  // Bloqueio duro da prévia: divergente do slot E já entregue antes.
  const rejeitadoDuplicidade = docDuplicado;

  // ── TITULAR DIVERGENTE ──────────────────────────────────────────────────
  // O documento é de OUTRA pessoa: nome completo e/ou CPF lidos no documento
  // não batem com o interessado. Rejeição imediata (não é duplicidade).
  const titularDivergenteBruto = conformidade.some(
    (i) =>
      (i.campo === "nome_completo" || i.campo === "cpf") &&
      i.status === "divergente" &&
      !!i.valorReferencia,
  );
  // CPF-01: no comprovante de endereço quem decide titularidade é a avaliação
  // determinística (parser + DV do CPF), nunca a soma de divergências de
  // string. Mascarado/ausente = "indeterminada" → pergunta, não acusa.
  const ehComprovanteResidencia = form.tipo_documento === "comprovante_residencia";
  const titularDivergente =
    ehComprovanteResidencia && avaliacaoTitular
      ? avaliacaoTitular.resultado === "terceiro"
      : titularDivergenteBruto;
  /** Confronto pendente: comprovante com CPF ilegível e cliente ainda sem responder. */
  const precisaConfrontoCpf =
    ehComprovanteResidencia &&
    !!avaliacaoTitular &&
    avaliacaoTitular.resultado === "indeterminada" &&
    !cpfConfrontado;
  // ── PARENTESCO ──────────────────────────────────────────────────────────
  // O titular do documento é outra pessoa, MAS carrega o sobrenome da família
  // do interessado (pai, filho, cônjuge, irmão). Rejeição específica.
  const parentescoDetectado =
    titularDivergente &&
    conformidade.some(
      (i) =>
        i.campo === "nome_completo" &&
        i.status === "divergente" &&
        mesmaFamilia(i.valorCertidao, i.valorReferencia),
    );
  // ── DOCUMENTO INCORRETO (mesmo titular, tipo errado) ────────────────────
  const documentoIncorretoTipo = !titularDivergente && certidaoIncorreta;
  // ── NOTA FISCAL · TOMADOR PARENTE NO MESMO ENDEREÇO ─────────────────────
  // Rejeição dura: a nota foi emitida para um familiar que mora no mesmo
  // endereço do prestador — não comprova ocupação lícita perante a PF.
  const notaTomadorParentesco = conformidade.some(
    (i) => i.campo === "tomador_nome" && i.status === "divergente",
  );
  const tomadorInfo = conformidade.find((i) => i.campo === "tomador_nome");
  const tomadorEnderecoInfo = conformidade.find((i) => i.campo === "tomador_endereco");
  // ── RESIDÊNCIA EM NOME DE TERCEIRO ──────────────────────────────────────
  // Comprovante de endereço no nome de outra pessoa NÃO reprova: o cliente
  // pode morar no imóvel de um terceiro. Abrimos o fluxo de declaração
  // (estado civil, profissão, desde quando mora + documento do responsável).
  const casoResidenciaTerceiro =
    form.tipo_documento === "comprovante_residencia" && titularDivergente && !notaTomadorParentesco;

  /**
   * Retomada da Declaração do Responsável pelo Imóvel: se o cliente fechou a
   * tela com a declaração já gerada no servidor, ao reabrir o comprovante de
   * residência o pop-up guiado volta exatamente naquele passo.
   */
  useEffect(() => {
    if (!open || !qaClienteId) return;
    if (form.tipo_documento !== "comprovante_residencia") return;
    if (declaracaoAberta || terceiroDados) return;
    let vivo = true;
    (async () => {
      const { data } = await supabase.functions.invoke("qa-declaracao-residencia", {
        body: { acao: "atual", qa_cliente_id: qaClienteId },
      });
      const decl = (data as any)?.declaracao;
      if (!vivo || !decl) return;
      setComprovanteDocId(decl.documento_comprovante_id ?? null);
      setDeclaracaoAberta(true);
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, qaClienteId, form.tipo_documento]);
  const titularComprovanteLido =
    conformidade.find((i) => i.campo === "nome_completo" && i.status === "divergente")?.valorCertidao ||
    classificacao?.camposExtraidos?.nome_completo ||
    null;
  // Depois que o dono do imóvel é declarado e o documento dele é enviado, a
  // conformidade do comprovante passa a ser CONTRA O DONO DO IMÓVEL — o
  // interessado não entra nesse cruzamento.
  const conformidadeExibida = (casoResidenciaTerceiro && terceiroDados)
    ? conformidade.map((item) => {
        if (item.campo === "nome_completo") {
          const refNome = terceiroDados.responsavel_nome || null;
          return {
            ...item,
            valorReferencia: refNome,
            fonteReferencia: "Documento de identidade do responsável pelo imóvel",
            status: !refNome
              ? ("sem_referencia" as const)
              : normalizeStr(item.valorCertidao) === normalizeStr(refNome) ||
                nameSim(item.valorCertidao, refNome) >= SIM_HIGH
                ? ("conforme" as const)
                : ("divergente" as const),
          };
        }
        if (item.campo === "cpf") {
          const refCpf = terceiroDados.responsavel_documento
            ? cpfComDigitosVerificadores(terceiroDados.responsavel_documento)
            : null;
          return {
            ...item,
            valorReferencia: refCpf,
            fonteReferencia: "Documento de identidade do responsável pelo imóvel",
            status: !refCpf
              ? ("sem_referencia" as const)
              : cpfComDigitosVerificadores(item.valorCertidao) === refCpf
                ? ("conforme" as const)
                : ("divergente" as const),
          };
        }
        return item;
      })
    : conformidade;
  /**
   * O painel está mostrando a conferência do requerimento (campos digitados
   * pelo cliente no site da PF) e não a conformidade entre documentos. Muda o
   * título e os cabeçalhos: "na certidão" não faz sentido num formulário.
   */
  const conferenciaContraCadastro =
    form.tipo_documento === "requerimento_de_posse_de_arma_de_fogo" &&
    conformidadeExibida.some((i) => i.fonteReferencia === "Cadastro do cliente");
  // Prioridade do carimbo: outro titular / parentesco > duplicidade > tipo errado.
  const motivoRejeicao: "titular" | "parentesco" | "duplicidade" | "tipo" | null = casoResidenciaTerceiro
    ? null
    : notaTomadorParentesco
    ? "parentesco"
    : titularDivergente
      ? (parentescoDetectado ? "parentesco" : "titular")
      : rejeitadoDuplicidade
        ? "duplicidade"
        : documentoIncorretoTipo
          ? "tipo"
          : null;

  // O carimbo de rejeição não fica mais colado no documento: ele aparece por
  // 3 segundos no centro da tela, como o carimbo de aprovação.
  const duplicidadeLabelCurto = (() => {
    if (!docDuplicado || !form.tipo_documento) return null;
    const meta = getTipoDocumentoMeta(form.tipo_documento);
    const nome = meta?.short || getNomeDocumentoDisplay({ tipo_documento: form.tipo_documento }, "Documento");
    // Remove prefixos genéricos para caber no carimbo (≤22 chars no rótulo)
    const curto = nome
      .replace(/^Certidão\s+(Federal\s+[-–]?\s*|de\s+Distribuição\s+|Criminal\s+[-–]?\s*)/i, "")
      .replace(/^Documento\s+/i, "")
      .trim()
      .slice(0, 22);
    return curto || null;
  })();
  const MOTIVO_CARIMBO: Record<string, string> = {
    titular: "Documento de outro titular",
    parentesco: "Grau de parentesco · mesmo endereço",
    duplicidade: duplicidadeLabelCurto ? `Já aprovado: ${duplicidadeLabelCurto}` : "Documento em duplicidade",
    tipo: "Documento incorreto",
  };
  const motivoRejeicaoDetalhado = motivoRejeicao === "tipo"
    ? `O documento foi identificado como ${getNomeDocumentoDisplay(
        { tipo_documento: form.tipo_documento },
        "documento",
      )}, mas o envio aberto exigia ${expectedTipoMeta?.label || "outro documento"}.`
    : MOTIVO_CARIMBO[motivoRejeicao || ""] || "Documento rejeitado na conferência.";
  useEffect(() => {
    if (!motivoRejeicao) {
      motivoCarimbadoRef.current = null;
      return;
    }
    // Documento recém-salvo: a lista do Hub volta com ele já aprovado e o
    // cálculo de duplicidade passa a apontar o PRÓPRIO envio. Nunca carimbar
    // rejeição em cima do carimbo de aprovação que acabou de sair.
    if (docSalvoRef.current) return;
    if (motivoCarimbadoRef.current === motivoRejeicao) return;
    motivoCarimbadoRef.current = motivoRejeicao;

    // ── TRILHA ────────────────────────────────────────────────────────────
    // Regra canônica (docs/RASTRO-DOCUMENTAL.md): toda tentativa recusada gera
    // histórico, mesmo quando nada chega a ser gravado no acervo. Sem isto, o
    // cliente afirma que enviou, a equipe não acha registro, e falso positivo
    // do sistema não deixa sintoma para ninguém corrigir.
    //
    // O arquivo não subiu nestes casos: a recusa é decidida durante a leitura,
    // antes do upload. Por isso `arquivoApagado: false`.
    const CODIGO_TRILHA: Record<string, TentativaBloqueada["codigo"]> = {
      titular: "titular_divergente",
      parentesco: "titular_divergente",
      duplicidade: "duplicidade_tipo",
      tipo: "certidao_incorreta",
    };
    void registrarTentativaBloqueada({
      qaClienteId: qaClienteId ?? null,
      customerId: customerId ?? null,
      codigo: CODIGO_TRILHA[motivoRejeicao] ?? "certidao_incorreta",
      // Mesmo texto que apareceu na tela — a spec proíbe divergência entre o
      // que o usuário leu e o que a trilha registra.
      motivo: motivoRejeicao === "duplicidade"
        ? `${duplicidadeLabelCurto || "Documento"} já aprovado no Hub · exigência atendida`
        : motivoRejeicaoDetalhado,
      tipoPretendido: form.tipo_documento || null,
      tipoLido: classificacao?.tipoDetectado ?? null,
      exigenciaAlvo: expectedTipoMeta?.value ?? null,
      arquivoNome: file?.name ?? null,
      arquivoMime: file?.type ?? null,
      arquivoTamanho: file?.size ?? null,
      atorTipo: atorEhStaff ? "admin" : "cliente",
      arquivoApagado: false,
    });

    // Duplicidade: Hub já tem este documento aprovado. Em vez de REPROVADO,
    // dispensamos a exigência do processo e mostramos sucesso — o cliente
    // não precisa fazer nada, o documento já está válido no Hub.
    if (motivoRejeicao === "duplicidade" && qaClienteId) {
      const label = duplicidadeLabelCurto || "Documento";
      // O carimbo verde só pode aparecer se a exigência REALMENTE fechou. O
      // motor devolve quantos slots foram fechados; quando devolve zero, o
      // documento do acervo não serviu para o slot (região, ano, validade) e
      // dizer "exigência atendida" seria mentir para o cliente — que era
      // exatamente o que ele via na tela enquanto o checklist seguia pedindo o
      // mesmo documento.
      void (async () => {
        let fechou = 0;
        try {
          const { data } = await supabase.rpc(
            "qa_processo_rever_exigencias" as any,
            { p_cliente_id: qaClienteId },
          );
          fechou = Number(data ?? 0) || 0;
        } catch {
          fechou = 0;
        }
        setResultadoCarimbo(
          fechou > 0
            ? { tipo: "aprovado", mensagem: `${label} já aprovado no Hub · exigência atendida` }
            : {
                tipo: "reprovado",
                mensagem: `${label} já consta no Hub, mas não atende a este item do checklist. Fale com a equipe.`,
              },
        );
      })();
      return;
    }

    setResultadoCarimbo({ tipo: "reprovado", mensagem: motivoRejeicaoDetalhado });
    // A recusa acontece ANTES de qualquer gravação, então nenhum gatilho de
    // banco dispara: avisamos a Central de Notificação do admin na hora.
    if (qaClienteId) {
      supabase.functions.invoke("qa-notify-event", {
        body: {
          evento: "documento_rejeitado",
          somente_admin: true,
          cliente_id: qaClienteId,
          motivo_rejeicao: motivoRejeicaoDetalhado,
          motivo_codigo: motivoRejeicao,
          documento:
            expectedTipoMeta?.label ||
            getNomeDocumentoDisplay({ tipo_documento: form.tipo_documento }, "Documento"),
          arquivo: file?.name || "",
          referencia_id: `${form.tipo_documento || "doc"}-${Date.now()}`,
        },
      }).catch(() => {});
    }
  }, [motivoRejeicao]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Grupo do checklist ainda bloqueado — quinta recusa da regra canônica.
   *
   * Fica num efeito próprio porque não passa por `motivoRejeicao`: é uma trava
   * de ORDEM (o cliente tentou adiantar uma etapa), não um problema com o
   * documento. Dedupe por arquivo + grupo, para trocar o anexo gerar registro
   * novo e re-render não gerar nenhum.
   */
  const grupoBloqueadoRegistradoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!grupoBloqueadoTrava) {
      grupoBloqueadoRegistradoRef.current = null;
      return;
    }
    const chave = `${file?.name || "sem-arquivo"}::${grupoDoDocumento || "?"}`;
    if (grupoBloqueadoRegistradoRef.current === chave) return;
    grupoBloqueadoRegistradoRef.current = chave;
    void registrarTentativaBloqueada({
      qaClienteId: qaClienteId ?? null,
      customerId: customerId ?? null,
      codigo: "grupo_bloqueado",
      motivo: mensagemGrupoBloqueado,
      tipoPretendido: form.tipo_documento || null,
      tipoLido: classificacao?.tipoDetectado ?? null,
      exigenciaAlvo: expectedTipoMeta?.value ?? null,
      arquivoNome: file?.name ?? null,
      arquivoMime: file?.type ?? null,
      arquivoTamanho: file?.size ?? null,
      atorTipo: atorEhStaff ? "admin" : "cliente",
      arquivoApagado: false,
    });
  }, [grupoBloqueadoTrava, file, grupoDoDocumento]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GOLDEN RECORD · QSA herda a emissão do Cartão CNPJ ──────────────────
  // O Quadro de Sócios e Administradores não imprime data de emissão. Regra
  // canônica: a emissão do QSA é a MESMA do Cartão CNPJ aprovado no Hub
  // (ambos saem da mesma consulta da Receita). Validade = emissão + 30 dias.
  useEffect(() => {
    if (!open || !qaClienteId) return;
    const tipo = String(form.tipo_documento || "");
    const isQsa = tipo === "renda_qsa" || tipo.includes("qsa");
    if (!isQsa || form.data_emissao) return;
    let cancelled = false;
    (async () => {
      // 1) tenta a lista já carregada
      const localCnpj = docsEfetivos
        .filter(
          (d: any) =>
            String(d.status || "") === "aprovado" &&
            ["renda_cartao_cnpj", "cartao_cnpj_mei", "cartao_cnpj"].includes(String(d.tipo_documento || "")),
        )
        .sort((a: any, b: any) =>
          String(b.data_emissao || b.updated_at || "").localeCompare(String(a.data_emissao || a.updated_at || "")),
        )[0];
      let emissao: string | null = localCnpj?.data_emissao ? String(localCnpj.data_emissao).slice(0, 10) : null;
      // 2) fallback: busca direta (a lista pode vir por prop, sem data_emissao)
      if (!emissao) {
        const { data } = await supabase
          .from("qa_documentos_cliente" as any)
          .select("data_emissao, tipo_documento, updated_at")
          .eq("qa_cliente_id", qaClienteId)
          .eq("status", "aprovado")
          .in("tipo_documento", ["renda_cartao_cnpj", "cartao_cnpj_mei", "cartao_cnpj"])
          .order("data_emissao", { ascending: false })
          .limit(1);
        const row = (data as any[])?.[0];
        emissao = row?.data_emissao ? String(row.data_emissao).slice(0, 10) : null;
      }
      if (cancelled || !emissao) return;
      // Herança envenenada NÃO entra: se a validade herdada (emissão + 30) já
      // nasce vencida, o cartão aprovado está com a emissão errada no banco
      // (caso clássico: IA gravou a DATA DE ABERTURA da empresa, ex.: 2008)
      // ou está simplesmente velho. Autopreencher aqui só fabricaria um QSA
      // reprovado na hora — melhor deixar o campo para o parser/humano.
      const validadeHerdada = addDaysIso(emissao, 30);
      if (!validadeHerdada || validadeHerdada < hojeISOBRT()) return;
      setForm((prev) => {
        if (prev.data_emissao) return prev;
        return {
          ...prev,
          data_emissao: emissao as string,
          data_validade: prev.data_validade || validadeHerdada || prev.data_validade,
          orgao_emissor: prev.orgao_emissor || "Receita Federal do Brasil",
        };
      });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, qaClienteId, form.tipo_documento, form.data_emissao, docsEfetivos.length]);

  const categoriaAtualMeta = getHubCategoriaMeta(categoriaHub);
  const showArmaFields = isCategoriaArmaAcervo(categoriaHub);
  // CR e Autorização de Compra PRECEDEM a arma — não exigir dados da arma.
  const isDocPreArma = form.tipo_documento === "cr" || form.tipo_documento === "autorizacao_compra";
  const showArmaVinculada = showArmaFields && !isDocPreArma;
  const escopoAtual: EscopoDocumental = inferEscopoDocumental({
    tipo_documento: form.tipo_documento,
    categoria_hub: categoriaHub,
  });
  // Mostra campos SINARM quando: regime detectado SINARM, ou tipo = sinarm,
  // ou já existe um Nº Cad. SINARM preenchido (manual).
  const showSinarmFields =
    showArmaFields &&
    (form.sistema_registro === "SINARM" ||
      form.tipo_documento === "sinarm" ||
      !!form.numero_cad_sinarm);
  const showSigmaFields =
    showArmaFields &&
    (form.sistema_registro === "SIGMA" ||
      (form.tipo_documento === "craf" && !form.numero_cad_sinarm));

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(prev.tipo_documento === "cr" && key === "numero_registro_sigma"
        ? { numero_documento: String(value || "") }
        : {}),
    }));
    // Edição manual implica confirmação (corrigido pelo usuário).
    if ((SENSITIVE_KEYS as readonly string[]).includes(key as string)) {
      setConfirmados((prev) => ({ ...prev, [key as SensitiveKey]: true }));
    }
  }

  function setCategoria(categoria: HubCategoria) {
    setCategoriaHub(categoria);
    const tipos = listTiposByCategoria(categoria);
    const tipoAtualMeta = getTipoDocumentoMeta(form.tipo_documento);
    if (!tipos.length) return;
    if (!tipoAtualMeta || tipoAtualMeta.categoria !== categoria) {
      setForm((prev) => ({
        ...prev,
        tipo_documento: tipos[0].value,
        numero_cad_sinarm: categoria === "arma_acervo" ? prev.numero_cad_sinarm : "",
        numero_registro_sigma: categoria === "arma_acervo" ? prev.numero_registro_sigma : "",
        sistema_registro: categoria === "arma_acervo" ? prev.sistema_registro : "",
      }));
    }
  }

  /** Marca um campo sensível como confirmado pelo humano (botão Confirmar). */
  function confirmField(key: SensitiveKey) {
    setConfirmados((prev) => ({
      ...prev,
      [key]: true,
      // No CR, o número operacional do documento é o próprio registro SIGMA.
      // A tela exibe apenas “Nº de Registro SIGMA”, então confirmar esse campo
      // também deve satisfazer a trava histórica de `numero_documento`.
      ...(form.tipo_documento === "cr" && key === "numero_registro_sigma" ? { numero_documento: true } : {}),
    }));
  }

  /** Quais campos sensíveis são exigidos para o tipo atual. */
  function requiredSensitiveKeys(): SensitiveKey[] {
    const t = form.tipo_documento;
    if (!showArmaFields) {
      const base: SensitiveKey[] = [];
      if (iaExtraido.numero_documento) base.push("numero_documento");
      // Tipo sem vencimento nunca exibe o campo Validade — não pode exigir a
      // confirmação de uma data que a tela não mostra (travava o Salvar).
      if (iaExtraido.data_validade && !isTipoSemVencimento(t)) base.push("data_validade");
      return base;
    }
    if (t === "cr" || t === "autorizacao_compra") {
      return t === "cr" ? ["numero_registro_sigma", "data_validade"] : ["numero_documento", "data_validade"];
    }
    if (t === "craf") {
      const base: SensitiveKey[] = [
        "sistema_registro",
        "arma_numero_serie",
        "arma_marca",
        "arma_modelo",
        "arma_calibre",
        "data_validade",
      ];
      if (form.sistema_registro === "SINARM") {
        return [...base, "numero_cad_sinarm", "numero_documento"];
      }
      if (form.sistema_registro === "SIGMA") {
        return [...base, "numero_registro_sigma"];
      }
      return [...base, "numero_documento"];
    }
    if (t === "sinarm") {
      return ["numero_cad_sinarm", "numero_documento", "data_validade"];
    }
    if (t === "gte" || t === "gt") {
      return ["numero_documento", "arma_numero_serie", "data_validade"];
    }
    return ["numero_documento"];
  }

  function pendingSensitiveKeys(): SensitiveKey[] {
    return requiredSensitiveKeys().filter((k) => !confirmados[k]);
  }

  /**
   * Trava de extração: sem arquivo anexado ou sem leitura automática concluída,
   * o salvamento fica bloqueado. Só libera após a IA/parser extrair os dados
   * e o cliente confirmar os campos pedidos.
   */
  function bloqueioExtracao(): string | null {
    if (!file) return "Anexe o arquivo (PDF ou foto) para a leitura automática conferir com o seu cadastro.";
    if (extracting) return "Aguarde a leitura automática terminar.";
    // O parser determinístico local (certidões, notas fiscais) é leitura válida.
    // Exigir só a IA travava documentos perfeitamente lidos quando a chamada de
    // visão falhava/estourava tempo — foi o caso da certidão do TSE.
    if (!classificacao && !conferenciaLocal?.doc) {
      return "A leitura automática não conseguiu extrair os dados deste arquivo. Envie o PDF original emitido pelo órgão.";
    }
    return null;
  }

  // Documento expirado: compara data_validade (ISO) com o "hoje" de Brasília.
  const hoje = hojeISOBRT();
  // Validade INDETERMINADA declarada no próprio documento (ex.: identidade
  // funcional "VALIDADE: INDETERM."): não conta prazo, nunca reprova por
  // vencimento e entra no Hub sem data de vencimento.
  const campos: any = (classificacao as any)?.camposExtraidos || {};
  const validadeIndeterminada =
    campos?.validade_indeterminada === true ||
    campos?.validade_indeterminada === "true" ||
    textoIndicaValidadeIndeterminada(
      campos?.data_validade,
      campos?.validade,
      campos?.observacoes,
      form.observacoes,
    );
  // Tipos que NÃO têm vencimento por natureza (CCMEI, contrato social,
  // requerimento/ficha da Junta, nota fiscal, carteira funcional, certidão
  // civil). A trava de vencimento não pode olhar apenas para `form.data_validade`:
  // uma data residual de um arquivo trocado dentro do mesmo modal carimbava
  // "REPROVADO — VENCIDO" num CCMEI, que não tem validade nenhuma.
  const tipoSemVencimento = isTipoSemVencimento(form.tipo_documento);
  // Constitutivos da empresa: também não têm data de emissão a conferir.
  const constitutivoSemDatas = isDocumentoConstitutivoPerpetuo(form.tipo_documento);
  // Fonte única da trava: `isDocumentoVencido` já recusa reprovar tipo que não
  // exige validade, mesmo com data residual no estado ou no banco.
  const docExpirado = isDocumentoVencido(form.tipo_documento, form.data_validade, {
    validadeIndeterminada,
    hoje,
  });

  // Documento sem prazo: limpa qualquer validade inferida por regra de tipo.
  useEffect(() => {
    if (!validadeIndeterminada) return;
    setForm((prev) => (prev.data_validade ? { ...prev, data_validade: "" } : prev));
  }, [validadeIndeterminada]);

  // Tipo sem vencimento: zera qualquer data residual que tenha sobrado de uma
  // leitura anterior (troca de arquivo no mesmo modal) ou de dado legado.
  useEffect(() => {
    if (!tipoSemVencimento) return;
    setForm((prev) => {
      const limparEmissao = constitutivoSemDatas && !!prev.data_emissao;
      if (!prev.data_validade && !limparEmissao) return prev;
      return {
        ...prev,
        data_validade: "",
        ...(limparEmissao ? { data_emissao: "" } : {}),
      };
    });
  }, [tipoSemVencimento, constitutivoSemDatas]);
  const isLaudoExameTipo = /laudo|exame|capacidade_tecnica|psicotecnico/i.test(form.tipo_documento);

  // Busca psicólogos próximos APENAS quando laudo está vencido e temos CEP do cliente.
  // A busca é feita por React via edge function — nenhuma IA processa estes dados.
  const buscaPsicoParams = useMemo(() => {
    if (!docExpirado || !isLaudoExameTipo || !classificacao) return null;
    const tipoBusca = /capacidade_tecnica/i.test(form.tipo_documento) ? "instrutor_tiro" as const : "psicologo" as const;
    if (clienteAutoFetch.cep) {
      return { tipo: tipoBusca, cep: clienteAutoFetch.cep, raio_km: 25, limit: 5 };
    }
    if (clienteAutoFetch.uf && clienteAutoFetch.cidade) {
      return { tipo: tipoBusca, uf: clienteAutoFetch.uf, cidade: clienteAutoFetch.cidade, raio_km: 25, limit: 5 };
    }
    return null;
  }, [docExpirado, isLaudoExameTipo, classificacao, clienteAutoFetch.cep, clienteAutoFetch.uf, clienteAutoFetch.cidade, form.tipo_documento]);

  const { loading: psicoLoading, results: psicoResults } = useCredenciadosPsico(buscaPsicoParams);

  // Busca de verificação de credenciamento (independente de expiração, pelo nome/registro extraído)
  // Usa busca textual pelo nome do profissional — UF do cliente como filtro de estado
  const buscaVerifParams = useMemo(() => {
    if (!isLaudoExameTipo || !classificacao) return null;
    if (!profissionalExtraido.nome && !profissionalExtraido.registro) return null;
    const tipoBusca = /capacidade_tecnica/i.test(form.tipo_documento) ? "instrutor_tiro" as const : "psicologo" as const;
    return {
      tipo: tipoBusca,
      busca: profissionalExtraido.nome || profissionalExtraido.registro || "",
      uf: clienteAutoFetch.uf || undefined,
      incluir_vencidos: true,
      limit: 10,
    };
  }, [isLaudoExameTipo, classificacao, profissionalExtraido, clienteAutoFetch.uf, form.tipo_documento]);

  const { loading: verifLoading, results: verifResults } = useCredenciadosPsico(buscaVerifParams);

  // Verificação de credenciamento — comparação React pura, sem IA.
  // Normaliza registro removendo caracteres não alfanuméricos para comparar CRP/IAT.
  const normReg = (s: string) => s.replace(/\D/g, "");
  const normNome = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s]/g, "").trim();
  const credenciadoVerificado = useMemo<CredenciadoPsico | null>(() => {
    if (!profissionalExtraido.registro && !profissionalExtraido.nome) return null;
    if (verifResults.length === 0) return null;
    // Primeiro tenta bater por registro (mais confiável)
    if (profissionalExtraido.registro) {
      const regNorm = normReg(profissionalExtraido.registro);
      const byReg = verifResults.find(p => p.registro && normReg(p.registro) === regNorm);
      if (byReg) return byReg;
    }
    // Fallback: nome fuzzy (todas as palavras do nome extraído presentes no nome da base)
    if (profissionalExtraido.nome) {
      const palavras = normNome(profissionalExtraido.nome).split(/\s+/).filter(w => w.length > 2);
      const byNome = verifResults.find(p =>
        p.nome && palavras.every(w => normNome(p.nome).includes(w))
      );
      if (byNome) return byNome;
    }
    return null;
  }, [profissionalExtraido, verifResults]);

  // Log de auditoria: profissional citado no laudo que NÃO existe na base de
  // credenciados da Polícia Federal. Vira linha no card do dashboard admin.
  const naoLocalizadoLogado = useRef<string | null>(null);
  useEffect(() => {
    if (!isLaudoExameTipo || !classificacao) return;
    if (verifLoading) return;
    if (credenciadoVerificado) return;
    const nome = (profissionalExtraido.nome || "").trim();
    if (!nome) return;
    const chave = `${nome}|${profissionalExtraido.registro || ""}`;
    if (naoLocalizadoLogado.current === chave) return;
    naoLocalizadoLogado.current = chave;
    const tipoProf = /capacidade_tecnica/i.test(form.tipo_documento) ? "instrutor_tiro" : "psicologo";
    void (async () => {
      try {
        // Dedupe: nome sem acento/pontuação + registro só com dígitos. Antes a
        // comparação era sensível a acento ("THAIS" x "THAÍS") e ao formato do
        // CRP, então a mesma profissional entrava duas vezes na lista.
        const chaveNome = normNome(nome);
        const chaveReg = normReg(profissionalExtraido.registro || "");
        const enderecoDoc = profissionalExtraido.endereco || null;
        const cidadeDoc = profissionalExtraido.cidade || null;
        const ufDoc = profissionalExtraido.uf || null;
        const { data: existentes } = await supabase
          .from("qa_psico_nao_localizados" as any)
          .select("id, nome, registro, ocorrencias, endereco, cidade, uf, telefone, cliente_nome, qa_cliente_id")
          .eq("tipo", tipoProf)
          .limit(500);
        const achado = ((existentes as any[]) || []).find((p) => {
          const regP = normReg(p.registro || "");
          if (chaveReg && regP && chaveReg === regP) return true;
          return !!p.nome && normNome(p.nome) === chaveNome;
        });
        const dadosClinica = {
          // Endereço/cidade da CLÍNICA lidos no laudo têm prioridade; o endereço
          // do cliente só entra como último recurso.
          endereco: enderecoDoc,
          cidade: cidadeDoc || clienteAutoFetch.cidade || null,
          uf: ufDoc || clienteAutoFetch.uf || null,
          telefone: profissionalExtraido.telefone || null,
          qa_cliente_id: qaClienteId ? Number(qaClienteId) : null,
          cliente_nome: (clienteAutoFetch as any)?.nome_completo || null,
        };
        if (achado) {
          const patch: Record<string, any> = {
            ocorrencias: Number(achado.ocorrencias || 1) + 1,
          };
          // Só completa lacunas — nunca apaga dado bom já gravado.
          for (const [k, v] of Object.entries(dadosClinica)) {
            if (v && !achado[k]) patch[k] = v;
          }
          if (!achado.registro && profissionalExtraido.registro) patch.registro = profissionalExtraido.registro;
          await supabase
            .from("qa_psico_nao_localizados" as any)
            .update(patch as any)
            .eq("id", achado.id);
          return;
        }
        await supabase.from("qa_psico_nao_localizados" as any).insert({
          tipo: tipoProf,
          nome: nome.toUpperCase(),
          registro: profissionalExtraido.registro || null,
          ...dadosClinica,
          situacao: "pendente",
          observacoes: `Documento: ${form.tipo_documento || "laudo"} — credenciamento PF não confirmado na verificação automática.`,
        } as any);
      } catch (e) {
        console.warn("[credenciamento] falha ao registrar não localizado:", e);
      }
    })();
  }, [isLaudoExameTipo, classificacao, verifLoading, credenciadoVerificado, profissionalExtraido, form.tipo_documento, clienteAutoFetch, qaClienteId]);

  function buildFieldAudit(key: SensitiveKey, valorFinal: string | null): FieldAudit {
    const extraido = (iaExtraido[key] ?? "") || null;
    const final = (valorFinal ?? "") || null;
    const corrigido = !!extraido && !!final && extraido.trim().toUpperCase() !== final.trim().toUpperCase();
    return {
      valor_extraido_ia: extraido,
      valor_confirmado: final,
      corrigido_pelo_usuario: corrigido || (!extraido && !!final),
      confianca: extraido ? Number(classificacao?.confianca || 0) : 0,
      legivel: !!extraido,
      fonte: extraido ? "vision" : "manual",
      confirmado_em: confirmados[key] ? new Date().toISOString() : null,
    };
  }

  async function classifyAndExtract(target: File | null) {
    // A invoke do Supabase não tem timeout: se a edge function estourar o
    // limite de CPU/wall clock (PDF grande + visão), a promessa nunca resolve
    // e a tela fica em "Lendo o documento…" para sempre. Corrida com relógio.
    const invokeComTimeout = async (
      fn: string,
      body: Record<string, unknown>,
      ms = 60000,
    ): Promise<{ data: any; error: any }> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return (await Promise.race([
          supabase.functions.invoke(fn, { body }),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error(`A leitura automática demorou demais (${fn}).`)),
              ms,
            );
          }),
        ])) as { data: any; error: any };
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    if (!target) {
      toast.error("Selecione um arquivo primeiro.");
      return;
    }
    const isImage = target.type.startsWith("image/");
    const isPdf = target.type === "application/pdf";
    // Segunda barreira da mesma regra: só a foto 3x4 pode ser imagem.
    if (!isPdf && !(isImage && tipoAceitaImagem(form.tipo_documento))) {
      toast.error(MSG_SOMENTE_PDF_ORIGINAL);
      return;
    }

    setExtracting(true);
    setAutoResult(null);
    try {
      // ── REGRA FIXA: PDF COM TEXTO É DO PARSER, NÃO DA IA ───────────────────
      // A IA existe só para imagem e PDF digitalizado (sem camada de texto).
      // Se o PDF traz texto nativo, ele é lido byte a byte e o parser
      // determinístico resolve — a IA nem é chamada.
      if (isPdf) {
        let textoNativo = String(textoLocalRef.current || "");
        if (!textoNativo) {
          try {
            textoNativo = await extrairTextoPdf(target);
            textoLocalRef.current = textoNativo;
          } catch (e) {
            console.warn("[parse-first] pdf.js falhou, IA assume:", e);
          }
        }
        const limpo = textoNativo
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        // ── TRAVA DE ESCOPO · certidão CÍVEL (regra global) ────────────────
        // Antes de qualquer leitura ou classificação: certidão cível não
        // instrui processo de arma de fogo. Não é salva, não vai para a IA e
        // não ocupa slot nenhum do Hub.
        if (limpo.length >= 80 && detectarEscopoCertidao(textoNativo) === "civel") {
          const msg = mensagemCertidaoCivel(textoNativo);
          setResultadoCarimbo({ tipo: "reprovado", mensagem: msg });
          setExtracting(false);
          if (qaClienteId) {
            supabase.functions.invoke("qa-notify-event", {
              body: {
                evento: "documento_rejeitado",
                somente_admin: true,
                cliente_id: qaClienteId,
                motivo_rejeicao: msg,
                motivo_codigo: "escopo_civel",
                documento: expectedTipoMeta?.label || "Certidão",
                arquivo: target.name || "",
                referencia_id: `escopo-civel-${Date.now()}`,
              },
            }).catch(() => {});
          }
          return;
        }
        if (limpo.length >= 80) {
          try {
            // O CCMEI oficial pode trazer o Cartão CNPJ como segunda página.
            // Se o slot pede CCMEI e há sinais oficiais no texto completo, o
            // parser local sempre prevalece sobre a classificação genérica.
            if (expectedTipoMeta?.value === "renda_ccmei" && ehCcmei(textoNativo)) {
              const resolvido = await tentarLeituraLocal(target);
              if (resolvido) return;
            }
            // O requerimento do SINARM é formulário estruturado: quem lê é o
            // parser. Precede a certidão porque não é certidão nenhuma e, sem
            // esta porta, ia direto para a IA — que o chamava de protocolo.
            if (parseRequerimentoSinarm(textoNativo)) {
              const resolvido = await tentarLeituraLocal(target);
              if (resolvido) return;
            }
            const docLocal = parseCertidao(textoNativo);
            // PARSE-01: o gate deixava passar só certidão. Comprovante de
            // endereço (DANF3E / fatura de concessionária) é igualmente
            // parseável — e por isso ia parar na IA sem necessidade.
            const danfeLocal = parseDanf3e(textoNativo);
            if (docLocal || danfeLocal.detectado) {
              const resolvido = await tentarLeituraLocal(target);
              if (resolvido) return;
            }
          } catch (e) {
            console.warn("[parse-first] parser não resolveu, IA assume:", e);
          }
        }
      }

      const dataUrl = await fileToDataUrl(target);

      // 1) Classifica automaticamente (sem depender da seleção manual).
      const { data: cls, error: clsErr } = await invokeComTimeout(
        "qa-classificar-documento-arma",
        { imageDataUrl: dataUrl },
        60000,
      );
      if (clsErr) throw clsErr;

      const iaBruta = (cls || {}) as IAClass;
      const ccmeiContextual =
        expectedTipoMeta?.value === "renda_ccmei" &&
        ehCcmei(String(textoLocalRef.current || ""));
      const ia: IAClass = ccmeiContextual
        ? {
            ...iaBruta,
            tipoDetectado: "CCMEI",
            confianca: Math.max(Number(iaBruta.confianca || 0), 0.99),
            recomendacao: "aceitar" as const,
            justificativa: "Classificação determinística: certificado oficial CCMEI; o Cartão CNPJ anexo não altera o tipo principal.",
          }
        : iaBruta;
      // A invoke só devolve `error` quando o HTTP falha. Se a função responder
      // 200 com corpo vazio ou sem confiança — chave da IA ausente, quota
      // estourada, resposta que não passou no schema — chegava aqui um objeto
      // vazio, o carimbo ficava em "AGUARDANDO LEITURA" para sempre e nada
      // avisava. A falha tem que aparecer, não ser mascarada.
      if (typeof ia?.confianca !== "number" || !ia?.tipoDetectado) {
        console.error("[classify] resposta sem classificação utilizável:", cls);
        toast.error(
          "A IA não conseguiu ler este documento agora. Classifique o tipo manualmente e preencha os campos, ou tente de novo em instantes.",
        );
      }
      setClassificacao(ia);

      // ── Conferência do laudo ───────────────────────────────────────────
      // Só para os dois laudos. As certidões já têm a sua, determinística.
      void (async () => {
        const tipoIaBruto = String(ia?.tipoDetectado || "").toLowerCase();
        const tipoLaudo: TipoLaudo | null =
          tipoIaBruto.includes("psicolog") ? "psicologico"
          : (tipoIaBruto.includes("capacidade") || tipoIaBruto.includes("tiro")) ? "tiro"
          : null;
        if (!tipoLaudo) { setConferenciaLaudo(null); return; }

        const c = (ia.camposExtraidos || {}) as Record<string, string>;
        const credencial = tipoLaudo === "psicologico" ? c.psicologo_crp : c.instrutor_portaria;
        const credNome = tipoLaudo === "psicologico" ? c.psicologo_nome : c.instrutor_nome;

        // Credenciado: procura no cadastro da PF que já sincronizamos.
        // Busca por índice, comparando só os dígitos da credencial. Os dois
        // lados escrevem diferente — a tabela guarda 'CRP 10/03363' e o laudo
        // traz '06/60.138' —, e a normalização por dígitos alinha os dois.
        //
        // Credencial com menos de 5 dígitos não identifica ninguém: fica
        // "nao_consultado" e NÃO vira alerta. Alarmar a equipe porque a leitura
        // saiu ruim seria ruído, não sinal.
        let credenciado: "encontrado" | "nao_encontrado" | "nao_consultado" = "nao_consultado";
        const digitosCred = String(credencial || "").replace(/\D/g, "");
        if (digitosCred.length >= 5) {
          try {
            const { data: achado, error: errCred } = await supabase.rpc(
              "qa_credenciado_por_credencial" as any,
              { p_tipo: tipoLaudo === "psicologico" ? "psico" : "iat", p_credencial: credencial },
            );
            if (errCred) throw errCred;
            credenciado = Array.isArray(achado) && achado.length > 0 ? "encontrado" : "nao_encontrado";
          } catch (e) {
            // Falha de consulta não é ausência de credenciado. Silenciar evita
            // acusar profissional legítimo por causa de rede instável.
            console.warn("[laudo] consulta de credenciado falhou:", e);
            credenciado = "nao_consultado";
          }
        }

        // O outro laudo já entregue, para conferir a ordem psicológico → tiro.
        let outroLaudoRealizacao: string | null = null;
        try {
          const outroTipo = tipoLaudo === "psicologico" ? "laudo_capacidade_tecnica" : "laudo_psicologico";
          const { data: outro } = await supabase
            .from("qa_documentos_cliente" as any)
            .select("ia_dados_extraidos")
            .eq("qa_cliente_id", qaClienteId)
            .eq("tipo_documento", outroTipo)
            .eq("status", "aprovado")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const ce = (outro as any)?.ia_dados_extraidos?.camposExtraidos || {};
          // O extrator do Hub devolve `data_avaliacao`; o extrator antigo usava
          // `laudo_data_avaliacao`. Aceitar os dois evita "data não identificada"
          // em laudo cuja data foi lida corretamente.
          outroLaudoRealizacao =
            ce.data_avaliacao || ce.laudo_data_avaliacao || ce.tiro_data_realizacao || ce.data_realizacao || null;
        } catch { /* sem o outro laudo, a ordem simplesmente não é avaliada */ }

        const resultado = conferirLaudo(
          {
            tipo: tipoLaudo,
            data_realizacao:
              tipoLaudo === "psicologico"
                ? (c.data_avaliacao || c.laudo_data_avaliacao || c.data_emissao)
                : (c.tiro_data_realizacao || c.data_realizacao || c.data_avaliacao || c.data_emissao),
            data_emissao: tipoLaudo === "psicologico" ? c.data_emissao : c.tiro_data_emissao,
            nome_avaliado: c.nome_titular,
            cpf_avaliado: c.cpf,
            // O classificador atual devolve `resultado_laudo`; versões antigas
            // usavam `laudo_aptidao` / `tiro_conclusao`. Aceitar todos evita
            // laudo salvo sem registrar APTO/INAPTO.
            resultado:
              normalizarAptidao(
                (c as any).resultado_laudo || (c as any).laudo_aptidao ||
                (c as any).tiro_conclusao || (c as any).resultado,
              ) || undefined,
            credencial,
            credenciado_nome: credNome,
          },
          { nome_completo: refClienteNome, cpf: refClienteCpf },
          { outroLaudoRealizacao, credenciado },
        );
        setConferenciaLaudo(resultado);

        // Vencimento calculado da REALIZAÇÃO — preenche o campo do formulário
        // para a equipe não ter que contar um ano na mão.
        if (resultado.vence_em) {
          setForm((prev) => ({ ...prev, data_validade: prev.data_validade || resultado.vence_em! }));
        }
      })();

      let tipoIA = IA_TO_TIPO[ia.tipoDetectado] || tipoHubDoRotuloIA(ia.tipoDetectado) || "outro";
      // Refinamento de subtipo para certidões TJSP e Federal: cada uma tem seu
      // slot próprio. A IA pode retornar o pai genérico ou até "outro" numa
      // página de QR/autenticação; por isso usamos também nome do arquivo,
      // título oficial e justificativa como sinais determinísticos.
      tipoIA = refinarTipoDocumentoPorTexto(
        tipoIA,
        buildDocumentoHaystack({
          tipoDocumento: tipoIA,
          arquivoNome: target.name,
          classificacao: ia,
          campos: ia.camposExtraidos,
        }),
      );
      // REQUERIMENTO DA PF · última rede. Chega aqui o requerimento que veio
      // digitalizado (sem camada de texto, então o parser determinístico não
      // rodou) ou cuja classificação caiu num rótulo genérico. Sem isto o
      // documento certo era carimbado "outro documento" contra o slot que
      // pedia justamente ele.
      if (
        TIPOS_GENERICOS_RECLASSIFICAVEIS.has(tipoIA) &&
        ehRequerimentoPeloConjuntoDeSinais({
          textoPdf: textoLocalRef.current,
          classificacao: ia,
          arquivoNome: target.name,
        })
      ) {
        tipoIA = "requerimento_de_posse_de_arma_de_fogo";
      }
      const categoriaIA = inferHubCategoriaFromTipo(tipoIA);
      // ── Foto 3x4 do requerente ───────────────────────────────────────────
      // Retrato não tem texto: a IA sempre cai em "outro documento" e o slot
      // acusava divergência indevida. Imagem de rosto num slot de foto 3x4 (ou
      // classificada como retrato) é foto 3x4, ponto. Sem divergência.
      const iaFalaDeFoto = /foto|retrato|rosto|3\s*[x×]\s*4/i.test(
        `${ia.tipoDetectado || ""} ${ia.justificativa || ""} ${target.name}`,
      );
      const ehFoto3x4 =
        isImage &&
        (defaultTipoEfetivo === "foto_3x4" || tipoIA === "foto_3x4" ||
          (tipoIA === "outro" && iaFalaDeFoto));
      if (ehFoto3x4) {
        tipoIA = "foto_3x4";
        setClassificacao({
          ...ia,
          tipoDetectado: "FOTO_3X4",
          confianca: Math.max(ia.confianca || 0, 0.95),
          recomendacao: "aceitar",
          revisao_obrigatoria: false,
          justificativa:
            "Imagem enviada no campo Foto 3x4 do requerente — classificação determinística pelo slot e pelo formato do arquivo.",
          camposExtraidos: {},
        });
      }
      const categoriaIA2 = ehFoto3x4 ? "identificacao" : categoriaIA;
      setCategoriaHub(categoriaIA2 as typeof categoriaIA);
      const camposIA = ia.camposExtraidos || {};
      // A IA devolve só os campos do schema dela — prestador e tomador da NFS-e
      // ficavam de fora, e por isso a conformidade não mostrava o tomador nem o
      // endereço dele. Reaproveitamos o parser determinístico sobre o texto já
      // extraído localmente e completamos (sem sobrescrever o que a IA leu).
      const campos: Record<string, any> = { ...camposIA };
      if (textoLocalRef.current) {
        try {
          const docLocal = parseCertidao(textoLocalRef.current) as Record<string, any> | null;
          if (docLocal) {
            for (const k of Object.keys(docLocal)) {
              if (!/^(prestador_|tomador_|razao_social|nome_empresarial|cnpj|chave_acesso)/.test(k)) continue;
              const v = docLocal[k];
              if (v != null && String(v).trim() && !String(campos[k] ?? "").trim()) campos[k] = v;
            }
          }
        } catch (e) {
          console.warn("[conformidade] parser local não complementou:", e);
        }
      }

      // Regime canônico (espelha lógica do backend qa-arsenal-doc-autoinsert).
      const cadSinarmRaw = String((campos as any).numero_cad_sinarm || "").trim();
      const sigmaExplicitoRaw = String((campos as any).numero_registro_sigma || "").trim();
      const sistemaIARaw = String((campos as any).sistema_registro || "").toUpperCase().trim();
      const sistemaFinal: "SINARM" | "SIGMA" | "REVISAR" =
        cadSinarmRaw ? "SINARM" :
        (sistemaIARaw === "SIGMA" && sigmaExplicitoRaw) ? "SIGMA" :
        sistemaIARaw === "SINARM" ? "SINARM" :
        sistemaIARaw === "SIGMA" ? "SIGMA" :
        "REVISAR";

      const modeloExtraidoSeguro = safeExtractedModel(campos.arma_modelo);

      // Foto 3x4: documento gerado pelo próprio sistema. Sem número oficial,
      // sem órgão emissor externo — emitida hoje, válida por 5 anos.
      if (ehFoto3x4) {
        const hoje = new Date();
        const iso = (d: Date) => d.toISOString().slice(0, 10);
        const val = new Date(hoje);
        val.setFullYear(val.getFullYear() + 5);
        const serie = `AI-3X4-${(refClienteCpf || "").replace(/\D/g, "").slice(-4) || "0000"}-${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, "0")}${String(hoje.getDate()).padStart(2, "0")}`;
        setForm((prev) => ({
          ...prev,
          tipo_documento: "foto_3x4",
          numero_documento: prev.numero_documento || serie,
          orgao_emissor: prev.orgao_emissor || "ARSENAL INTELIGENTE",
          data_emissao: prev.data_emissao || iso(hoje),
          data_validade: prev.data_validade || iso(val),
        }));
        setIaExtraido({
          numero_documento: "",
          numero_cad_sinarm: "",
          numero_registro_sigma: "",
          arma_numero_serie: "",
          arma_marca: "",
          arma_modelo: "",
          arma_calibre: "",
          data_validade: "",
          sistema_registro: "REVISAR",
        });
        setConfirmados({});
        setConformidade([]);
        setTemApontamento(false);
        setProfissionalExtraido({ nome: null, registro: null });
        setConferenciaLaudo(null);
        setExtracting(false);
        return;
      }

      // ── Blindagem da DATA DE EMISSÃO ───────────────────────────────────────
      // A IA às vezes confunde a data de nascimento citada no corpo da certidão
      // ("...e data de nascimento 09/01/1975...") com a data de emissão, e aí a
      // validade (emissão + 90 dias) nascia em 1975 e o documento aparecia
      // "vencido" logo após ser emitido. O texto nativo do PDF manda: se houver
      // "emitida/emitido em DD/MM/AAAA", essa é a emissão.
      try {
        const textoLocal = String(textoLocalRef.current || "");
        const semAcento = textoLocal.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const emitidaEm = semAcento.match(/emitid[ao][^\n]{0,40}?em:?\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1];
        const nasc = String((campos as any).data_nascimento || "").trim();
        const emissaoIA = String(campos.data_emissao || "").trim();
        if (emitidaEm) {
          campos.data_emissao = emitidaEm;
        } else if (emissaoIA && nasc && emissaoIA === nasc) {
          // Emissão idêntica à data de nascimento é sempre leitura errada.
          campos.data_emissao = "";
        } else if (emissaoIA) {
          const ano = Number(emissaoIA.slice(-4));
          const anoAtual = new Date().getFullYear();
          // Certidões/laudos/comprovantes não são emitidos há mais de 15 anos.
          const tipoPerecivel = /certidao|antecedentes|comprovante|laudo|exame|declaracao/i.test(tipoIA);
          if (tipoPerecivel && ano && ano < anoAtual - 15) campos.data_emissao = "";
        }
      } catch { /* sem texto nativo, segue com o que a IA leu */ }

      // ── O TEXTO NATIVO MANDA SOBRE A IA ────────────────────────────────────
      // Mesmo quando o layout não é um dos parsers completos, tudo que o parser
      // conseguir ler do texto real do PDF (nome, CPF, nascimento, nº, emissão)
      // sobrescreve a leitura probabilística da IA. A IA só preenche o que o
      // texto não trouxer.
      try {
        if (textoLocalRef.current) {
          const docLocal = parseCertidao(textoLocalRef.current) as Record<string, any> | null;
          if (docLocal) {
            const brDe = (isoStr?: string) => {
              const m = String(isoStr || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
              return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
            };
            if (docLocal.nome_titular) (campos as any).nome_titular = docLocal.nome_titular;
            if (docLocal.cpf) (campos as any).cpf = docLocal.cpf;
            if (docLocal.nome_mae) (campos as any).nome_mae = docLocal.nome_mae;
            if (docLocal.data_nascimento) (campos as any).data_nascimento = brDe(docLocal.data_nascimento);
            if (docLocal.numero_documento) campos.numero_documento = docLocal.numero_documento;
            if (docLocal.data_emissao) campos.data_emissao = brDe(docLocal.data_emissao);
          }
        }
      } catch (e) {
        console.warn("[parse-first] override determinístico falhou:", e);
      }

      // Consulta da Receita (cartão CNPJ/QSA): quando o parser local não rodou,
      // a IA já devolveu a DATA DE ABERTURA da empresa como emissão — e com
      // "+30 dias" o documento nascia vencido há anos ("SERÁ REJEITADO" com
      // validade de 2008). Emissão implausível é descartada AQUI, antes de
      // contaminar formulário, validade calculada e snapshot de auditoria.
      if (
        isConsultaReceita(tipoIA) &&
        !sanearEmissaoConsultaReceita(tipoIA, campos.data_emissao, campos as Record<string, unknown>)
      ) {
        delete (campos as Record<string, unknown>).data_emissao;
      }

      setForm((prev) => ({
        ...prev,
        // tipo definido pela IA; cliente pode sobrescrever depois
        tipo_documento: tipoIA,
        // Comprovante de residência: identificador é o CÓDIGO DE INSTALAÇÃO / UC / matrícula
        // da concessionária — NUNCA o CPF do titular.
        numero_documento: tipoIA === "comprovante_residencia"
          ? (
              (campos as any).codigo_instalacao ||
              (campos as any).numero_uc ||
              (campos as any).uc ||
              (campos as any).numero_instalacao ||
              (campos as any).matricula ||
              ""
            )
          : (campos.numero_documento ||
             numeroDocumentoRenda(tipoIA, campos as any) ||
             prev.numero_documento),
        orgao_emissor: campos.orgao_emissor || prev.orgao_emissor,
        // Para laudos/exames, o campo "Avaliação" usa data_avaliacao.
        // A regra legal (Lei 10.826/03) vincula validade à DATA DA AVALIAÇÃO,
        // não à data de emissão impressa.
        data_emissao: (() => {
          // Constitutivos (CCMEI, contrato social, requerimento/ficha da Junta):
          // sem emissão a conferir em QUALQUER caminho de leitura, inclusive IA.
          if (isDocumentoConstitutivoPerpetuo(tipoIA)) return "";
          const isLaudoExame = /laudo|exame|capacidade_tecnica|psicotecnico/i.test(tipoIA);
          if (isLaudoExame) {
            return (
              dataIsoFromBr((campos as any).data_avaliacao) ||
              dataIsoFromBr(campos.data_emissao) ||
              prev.data_emissao
            );
          }
          return dataIsoFromBr(campos.data_emissao) || prev.data_emissao;
        })(),
        data_validade: (() => {
          // Tipo sem vencimento por natureza: nunca aceitar validade da IA nem
          // herdar a data que sobrou da leitura anterior.
          if (isTipoSemVencimento(tipoIA)) return "";
          const isLaudoExame = /laudo|exame|capacidade_tecnica|psicotecnico/i.test(tipoIA);
          // Regra legal (Lei 10.826/03): para laudos/exames a validade é SEMPRE
          // data_avaliacao + 1 ano, ignorando a data de validade impressa no documento
          // (que costuma ser inconsistente ou inexistente).
          if (isLaudoExame) {
            const avaliacao = dataIsoFromBr((campos as any).data_avaliacao) || dataIsoFromBr(campos.data_emissao);
            const venc = addOneYearIso(avaliacao);
            if (venc) return venc;
            return prev.data_validade;
          }
          const emissao = dataIsoFromBr(campos.data_emissao);
          const validadeRegra = calcularValidadeHubPorTipo(tipoIA, emissao);
          if (validadeRegra) return validadeRegra;
          const valExplicita = dataIsoFromBr(campos.data_validade);
          if (valExplicita) return valExplicita;
          if (!emissao) return prev.data_validade;
          // Comprovante de clube: declaração válida por 90 dias da data de emissão
          if (normalizeTipoDocumentoParaBanco(tipoIA) === "comprovante_filiacao_entidade_tiro") {
            return addDaysIso(emissao, 90);
          }
          return prev.data_validade;
        })(),
        validade_filiacao: (() => {
          if (normalizeTipoDocumentoParaBanco(tipoIA) !== "comprovante_filiacao_entidade_tiro") return prev.validade_filiacao;
          // Prioridade: data_filiacao extraída do corpo do documento, senão data_emissao
          const base =
            dataIsoFromBr((campos as any).data_filiacao) ||
            dataIsoFromBr(campos.data_emissao);
          if (!base) return prev.validade_filiacao;
          const d = new Date(base);
          d.setFullYear(d.getFullYear() + 1);
          return d.toISOString().slice(0, 10);
        })(),
        arma_marca: campos.arma_marca || prev.arma_marca,
        arma_modelo: modeloExtraidoSeguro || prev.arma_modelo,
        arma_calibre: campos.arma_calibre || prev.arma_calibre,
        arma_numero_serie: campos.arma_numero_serie || prev.arma_numero_serie,
        numero_cad_sinarm: cadSinarmRaw || prev.numero_cad_sinarm,
        numero_registro_sigma:
          sistemaFinal === "SIGMA"
            ? (sigmaExplicitoRaw
                // CR é registrado no SIGMA: o nº do CR (numero_documento) É o nº de registro SIGMA.
                || (tipoIA === "cr" ? (campos.numero_documento || "") : "")
                || prev.numero_registro_sigma)
            : "", // SINARM/REVISAR nunca preenche SIGMA
        sistema_registro: tipoIA === "cr" ? "SIGMA" : sistemaFinal,
      }));

      // Captura profissional do laudo (psicólogo/instrutor) — exibido no painel de credenciamento
      const isLaudoExameIA = /laudo|exame|capacidade_tecnica|psicotecnico/i.test(tipoIA);
      if (isLaudoExameIA) {
        setProfissionalExtraido({
          nome: String((campos as any).nome_profissional || "").trim() || null,
          registro: String((campos as any).registro_profissional || "").trim() || null,
          endereco: String((campos as any).clinica_endereco || (campos as any).endereco_completo || "").trim() || null,
          cidade: String((campos as any).clinica_cidade || "").trim() || null,
          uf: String((campos as any).clinica_uf || "").trim().toUpperCase() || null,
          telefone: String((campos as any).telefone_profissional || "").trim() || null,
        });
      } else {
        setProfissionalExtraido({ nome: null, registro: null });
      }

      // Snapshot IMUTÁVEL do que a IA extraiu, para auditoria e
      // bloqueio do salvar até confirmação humana campo a campo.
      setIaExtraido({
        numero_documento:
          campos.numero_documento || numeroDocumentoRenda(tipoIA, campos as any) || "",
        numero_cad_sinarm: cadSinarmRaw,
        numero_registro_sigma:
          sigmaExplicitoRaw || (tipoIA === "cr" ? (campos.numero_documento || "") : ""),
        arma_numero_serie: campos.arma_numero_serie || "",
        arma_marca: campos.arma_marca || "",
        arma_modelo: modeloExtraidoSeguro,
        arma_calibre: campos.arma_calibre || "",
        data_validade: (() => {
          // Sem vencimento por natureza: não registra validade extraída, senão
          // a trava de campos sensíveis passaria a exigir a confirmação de uma
          // data que a tela nem exibe.
          if (isTipoSemVencimento(tipoIA)) return "";
          const isLaudoExame = /laudo|exame|capacidade_tecnica|psicotecnico/i.test(tipoIA);
          if (isLaudoExame) {
            const avaliacao = dataIsoFromBr((campos as any).data_avaliacao) || dataIsoFromBr(campos.data_emissao);
            return addOneYearIso(avaliacao) || "";
          }
          const validadeRegra = calcularValidadeHubPorTipo(tipoIA, dataIsoFromBr(campos.data_emissao));
          if (validadeRegra) return validadeRegra;
          return dataIsoFromBr(campos.data_validade) || "";
        })(),
        sistema_registro: sistemaFinal,
      });
      // Tudo começa como NÃO confirmado — exige clique do humano.
      setConfirmados({});

      // Motor de conformidade: todos os documentos que extraem dados pessoais.
      const items = calcularConformidade(
        campos as Record<string, string | undefined>,
        refClienteNome,
        refClienteCpf,
        refClienteDataNascimento,
        refClienteNomeMae,
        docsEfetivos,
        (campos as any).data_avaliacao || campos.data_emissao || null,
        tipoIA,
        [clienteAutoFetch.naturalidade_municipio, clienteAutoFetch.naturalidade_uf].filter(Boolean).join(" ") || null,
        {
          cnpj: clienteAutoFetch.ocupacao_licita_cnpj,
          razao_social: clienteAutoFetch.ocupacao_licita_razao_social,
        },
      );
      setConformidade(items);

      // ── CPF-01 · titularidade no caminho da IA ─────────────────────────────
      // O comprovante de endereço lido pela IA passa pela MESMA avaliação
      // determinística de titularidade do caminho do parser (DANF3E). Sem isto,
      // o mesmo arquivo ora era barrado (parser leu), ora entrava sem conferir
      // titular nenhum (parser falhou → IA) — e insistir no reenvio premiava
      // quem caísse no caminho sem conferência.
      if (tipoIA === "comprovante_residencia") {
        const camposTitular = campos as Record<string, string | undefined>;
        const avaliacao = avaliarTitularidadeComprovante({
          nomeDoc: camposTitular.nome_titular || camposTitular.nome_completo || null,
          cpfDoc: camposTitular.cpf || null,
          nomeRef: refClienteNome,
          cpfRef: refClienteCpf,
        });
        setAvaliacaoTitular(avaliacao);
        setCpfConfrontado(null);
        setCpfConfrontoErro(null);
        const nomeTitularIA = String(camposTitular.nome_titular || camposTitular.nome_completo || "").trim();
        if (nomeTitularIA && !items.some((i) => i.campo === "nome_completo")) {
          items.push({
            campo: "nome_completo",
            label: "Titular da conta",
            valorCertidao: nomeTitularIA,
            valorReferencia: refClienteNome ?? null,
            fonteReferencia: refClienteNome ? "Cadastro (Central de Adesão)" : null,
            status:
              avaliacao.resultado === "propria"
                ? "conforme"
                : avaliacao.resultado === "terceiro"
                  ? "divergente"
                  : "sem_referencia",
          });
          setConformidade([...items]);
        }
        if (avaliacao.resultado === "indeterminada") {
          setCpfConfrontoAberto(true);
        }
      }

      // Para itens em zona cinzenta, aciona verificação semântica via IA em paralelo
      const grayItems = items.filter(i => i.status === "verificando");
      if (grayItems.length > 0) {
        grayItems.forEach(async (item) => {
          if (!item.valorReferencia) return;
          try {
            const { data, error } = await supabase.functions.invoke("qa-conformidade-semantica", {
              body: { campo: item.label, valorA: item.valorCertidao, valorB: item.valorReferencia },
            });
            // Divergente só quando a IA RESPONDEU que não é equivalente. Falha
            // de infraestrutura (edge fora, timeout, rede móvel) não é veredito:
            // marcava "divergente por conservadorismo" e o documento CERTO era
            // rejeitado como "de terceiro" — e o mesmo arquivo passava no
            // reenvio seguinte, quando a chamada dava certo. Sem resposta, o
            // campo fica "sem referência": a equipe confere na aprovação.
            if (error) throw error;
            const equivalente = data?.equivalente === true;
            setConformidade(prev =>
              prev.map(i => i.campo === item.campo
                ? { ...i, status: equivalente ? "conforme" : "divergente" }
                : i
              )
            );
          } catch (e) {
            console.warn("[conformidade-semantica] sem veredito (erro de infra):", e);
            setConformidade(prev =>
              prev.map(i => i.campo === item.campo ? { ...i, status: "sem_referencia" } : i)
            );
          }
        });
      }

      // Apontamento criminal: apenas certidões de antecedentes.
      if (TIPOS_CERTIDAO.has(tipoIA)) {
        const res = String(campos.resultado_certidao || "").toLowerCase();
        setTemApontamento(res === "consta_apontamento");
      } else {
        setTemApontamento(false);
      }
      setReconheceApontamento(null);
      setHomonimiaSalva(false);
      setShowDeclaracao(false);

      // 2) Tenta enriquecer campos via extractor já existente, usando o tipo da IA.
      try {
        const { data: extra } = await invokeComTimeout(
          "qa-extract-cliente-doc",
          { tipo_documento: tipoIA, imageDataUrl: dataUrl },
          45000,
        );
        const sugestao = (extra as any)?.sugestao || {};
        setForm((prev) => {
          // Fallback de IA também respeita os tipos sem datas: constitutivos não
          // ganham emissão nem validade por enriquecimento do extractor.
          const semEmissao = isDocumentoConstitutivoPerpetuo(tipoIA);
          const semValidade = isTipoSemVencimento(tipoIA);
          const isLaudoExame = /laudo|exame|capacidade_tecnica|psicotecnico/i.test(tipoIA);
          // Para laudos/exames, a DATA DA AVALIAÇÃO do extractor SEMPRE prevalece
          // sobre qualquer data_emissao previamente capturada pelo classify (que
          // costuma trazer a data de emissão impressa do laudo, não a da avaliação).
          // Regra legal (Lei 10.826/03): validade = data_avaliacao + 1 ano.
          const dataAvaliacaoExtractor = isLaudoExame ? (sugestao.data_avaliacao || "") : "";
          const validadeLaudoExame = isLaudoExame
            ? addOneYearIso(dataAvaliacaoExtractor || sugestao.data_emissao || prev.data_emissao)
            : "";
          const dataEmissaoFinal =
            dataAvaliacaoExtractor ||
            prev.data_emissao ||
            (isLaudoExame
              ? sugestao.data_avaliacao || sugestao.data_emissao
              : sugestao.data_emissao) ||
            "";
          const validadeRegra = calcularValidadeHubPorTipo(tipoIA, dataEmissaoFinal);
          return ({
            ...prev,
            nome_documento: prev.nome_documento || sugestao.titulo_oficial || "",
            numero_documento: prev.numero_documento || sugestao.numero_documento || "",
            orgao_emissor: prev.orgao_emissor || sugestao.orgao_emissor || "",
            data_emissao: semEmissao ? "" : dataEmissaoFinal,
          // Para comprovante de residência, nunca usar data_validade da sugestão:
          // a IA pode extrair vencimento/fatura; a validade operacional é calculada pela regra canônica.
            data_validade: semValidade
              ? ""
              // Para laudos/exames, recalcula localmente pela data da avaliação/emissão
              // e nunca aceita a validade bruta inferida pela IA (ex.: 2028 em vez de 2026).
              : (isLaudoExame && validadeLaudoExame)
                ? validadeLaudoExame
                : (validadeRegra || prev.data_validade || (tipoIA === "comprovante_residencia" ? "" : dataIsoFromBr(sugestao.data_validade) || sugestao.data_validade) || ""),
          observacoes: prev.observacoes || sugestao.observacoes || "",
          arma_marca: prev.arma_marca || sugestao.arma_marca || "",
          arma_modelo: prev.arma_modelo || safeExtractedModel(sugestao.arma_modelo) || "",
          arma_calibre: prev.arma_calibre || sugestao.arma_calibre || "",
          arma_numero_serie: prev.arma_numero_serie || sugestao.arma_numero_serie || "",
          arma_especie: prev.arma_especie || sugestao.arma_especie || "",
          });
        });
      } catch (eExt) {
        console.warn("[extract complementar] ignorado:", eExt);
      }

      // 3) Se a IA estiver segura (>=0.85, identificou tipo e campos legíveis),
      //    o backend faz upload + auto-cadastro. Caso contrário devolve motivo.
      if (inferHubCategoriaFromTipo(tipoIA) === "arma_acervo") {
        await tryAutoInsert(target, ia);
      } else {
        setAutoResult(null);
      }
    } catch (e: any) {
      console.error("[classify+extract] error:", e);
      toast.error(e?.message || "Falha ao processar o documento.");
    } finally {
      setExtracting(false);
    }
  }

  async function tryAutoInsert(target: File, ia: IAClass) {
    // Pré-checagem rápida client-side (evita upload desnecessário)
    if (
      !ia ||
      ia.tipoDetectado === "DESCONHECIDO" ||
      (ia.confianca || 0) < 0.85 ||
      ia.revisao_obrigatoria
    ) {
      const motivo: AutoResult = {
        safe: false,
        motivo: ia?.tipoDetectado === "DESCONHECIDO" ? "documento_nao_identificado" : "confianca_insuficiente",
        confianca: ia?.confianca,
      };
      setAutoResult(motivo);
      return;
    }

    try {
      // Upload para storage (sob a pasta do tipo identificado)
      const tipoDb = IA_TO_TIPO[ia.tipoDetectado] || "outro";
      const safe = sanitize(target.name);
      const ownerKey = customerId ?? `qa-${qaClienteId}`;
      const path = `cliente-docs/${ownerKey}/${tipoDb}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from("qa-documentos")
        .upload(path, target, { upsert: false, contentType: target.type });
      if (upErr) {
        console.error("[auto upload] error:", upErr);
        setAutoResult({ safe: false, motivo: "erro_upload" });
        return;
      }

      const { data, error } = await supabase.functions.invoke("qa-arsenal-doc-autoinsert", {
        body: {
          customer_id: customerId ?? null,
          qa_cliente_id: qaClienteId ?? null,
          arquivo_storage_path: path,
          arquivo_nome: target.name,
          arquivo_mime: target.type || null,
          classificacao: ia,
        },
      });

      if (error) {
        console.error("[autoinsert] edge error:", error);
        setAutoResult({ safe: false, motivo: "erro_insercao", mensagem: error.message });
        return;
      }

      const r = (data || {}) as any;
      if (r?.safe) {
        setAutoResult({ safe: true, documento_id: r.documento_id, tipo_documento: r.tipo_documento });
        toast.success("Documento cadastrado automaticamente no seu Arsenal.");
        onSaved();
        // pequeno delay para o cliente ver o resultado antes de fechar
        setTimeout(() => onClose(), 900);
      } else {
        setAutoResult({
          safe: false,
          motivo: r?.motivo || "campos_ilegiveis",
          campos_faltando: r?.campos_faltando,
          confianca: r?.confianca,
        });
      }
    } catch (e: any) {
      console.error("[autoinsert] error:", e);
      setAutoResult({ safe: false, motivo: "erro_insercao", mensagem: e?.message });
    }
  }

  /**
   * Leitura LOCAL da certidão, antes de qualquer chamada de IA.
   *
   * Regra do usuário (30/07/2026): não usamos mais IA para ler e comparar
   * documentos de processo. Certidão de órgão público é PDF gerado, com camada
   * de texto exata — o pdf.js lê e o parser extrai sem margem de erro. Modelo
   * probabilístico que acerta 99% dos nomes erra 1 processo em 100, e a PF
   * indefere por uma letra.
   *
   * Devolve `true` quando resolveu o documento (aprovando ou rejeitando). Só
   * quando devolve `false` — layout não reconhecido — é que o fluxo antigo
   * segue.
   */
  /**
   * Avisa o cliente por e-mail que a certidão foi recusada, com o motivo e o
   * passo a passo para reemitir. Best-effort: falha de e-mail não pode travar
   * a tela nem esconder o motivo, que já está no painel.
   */
  async function notificarCertidaoRejeitada(
    doc: NonNullable<ReturnType<typeof parseCertidao>>,
    conf: ReturnType<typeof conferirCertidao>,
  ) {
    if (!qaClienteId) return;
    try {
      await supabase.functions.invoke("qa-notify-event", {
        body: {
          evento: "certidao_rejeitada",
          cliente_id: qaClienteId,
          certidao: getNomeDocumentoDisplay({ tipo_documento: doc.tipoDocumento }, "Certidão"),
          orgao: ORGAO_LABEL[doc.orgao] ?? "",
          link_emissao: getLinkEmissaoCertidao(doc.tipoDocumento) ?? "",
          referencia_id: doc.numero_documento ?? null,
          problemas: conf.achados
            .filter((a) => a.problema !== "ausente_no_cadastro")
            .map((a) => ({
              label: a.label,
              noDocumento: a.noDocumento,
              noCadastro: a.noCadastro,
              mensagem: a.mensagem,
            })),
        },
      });
    } catch (e) {
      console.error("[certidao rejeitada] aviso falhou:", e);
    }
  }

  /**
   * NOTA FISCAL A PARTIR DO XML — leitura sem PDF, sem OCR e sem IA.
   *
   * Tudo o que entra aqui veio etiquetado pelo layout oficial da nota assinada
   * e autorizada pela SEFAZ. A função só distribui esses valores pelos mesmos
   * canais que qualquer outro documento usa (conferência, conformidade,
   * formulário), para o restante do Hub — Golden Record, trava de emissão
   * entre parentes, carimbo — continuar funcionando sem saber que a origem foi
   * um XML.
   */
  function aplicarNotaFiscalDoXml(importada: NotaFiscalImportada) {
    const { nota, campos, camposPlanos, tipoDocumento, papelDoCliente, texto } = importada;

    const conf = conferirCertidao(
      campos,
      {
        nome_completo: refClienteNome,
        cpf: refClienteCpf,
        data_nascimento: refClienteDataNascimento,
        nome_mae: refClienteNomeMae,
        naturalidade_municipio: clienteAutoFetch.naturalidade_municipio,
        naturalidade_uf: clienteAutoFetch.naturalidade_uf,
        rg: clienteAutoFetch.rg,
      },
      texto,
    );
    setConferenciaLocal({ doc: campos, conf, texto });

    setConformidade(
      calcularConformidade(
        camposPlanos,
        refClienteNome,
        refClienteCpf,
        refClienteDataNascimento,
        refClienteNomeMae,
        docsEfetivos,
        null,
        tipoDocumento,
        [clienteAutoFetch.naturalidade_municipio, clienteAutoFetch.naturalidade_uf]
          .filter(Boolean)
          .join(" ") || null,
        {
          cnpj: clienteAutoFetch.ocupacao_licita_cnpj,
          razao_social: clienteAutoFetch.ocupacao_licita_razao_social,
        },
      ),
    );

    setClassificacao({
      tipoDetectado: "NOTA_FISCAL",
      confianca: 1,
      justificativa: `Leitura determinística do XML autorizado pela SEFAZ${
        nota.protocolo ? ` (protocolo ${nota.protocolo})` : ""
      } — sem IA.`,
      camposExtraidos: camposPlanos,
      recomendacao: "aceitar",
    });

    setForm((prev) => ({
      ...prev,
      tipo_documento: tipoDocumento,
      nome_documento:
        [`${nota.rotulo}${nota.numero ? ` nº ${nota.numero}` : ""}`, nota.emitente.nome]
          .filter(Boolean)
          .join(" — ") || prev.nome_documento,
      numero_documento: nota.numero ?? prev.numero_documento,
      orgao_emissor: ORGAO_LABEL.nota_fiscal,
      data_emissao: nota.dataEmissao ?? prev.data_emissao,
      // Nota fiscal NÃO vence (`exigeDatasOcupacao`). Fixar vazio impede que a
      // validade de um arquivo anexado antes sobreviva ao `...prev` e vire
      // carimbo de "documento vencido" numa nota que não tem prazo nenhum.
      data_validade: "",
      observacoes:
        [
          `Chave de acesso: ${nota.chave}`,
          nota.protocolo ? `Protocolo de autorização: ${nota.protocolo}` : "",
          nota.emitente.documento ? `Emitente: ${nota.emitente.documento}` : "",
          nota.destinatario.nome ? `Destinatário: ${nota.destinatario.nome}` : "",
          nota.valorTotal != null ? `Valor total: R$ ${nota.valorTotal.toFixed(2)}` : "",
          "DANFE gerado pelo Hub a partir do XML autorizado pela SEFAZ.",
        ]
          .filter(Boolean)
          .join("\n") || prev.observacoes,
    }));
    setCategoriaHub(inferHubCategoriaFromTipo(tipoDocumento));

    if (papelDoCliente === "nenhum") {
      // Não é rejeição: pode ser cadastro de empresa ainda vazio. O painel de
      // conformidade mostra o confronto e a equipe decide.
      toast.warning(
        "Nota lida do XML, mas nem o emitente nem o destinatário têm o seu CPF/CNPJ. Confira os dados antes de salvar.",
      );
    } else if (conf.veredicto === "rejeitado") {
      toast.error("Nota fiscal recusada na conferência. Veja o motivo no painel.");
    } else if (papelDoCliente === "emitente") {
      toast.success(
        `Nota fiscal lida direto do XML autorizado pela SEFAZ${
          nota.protocolo ? ` (protocolo ${nota.protocolo})` : ""
        }. Geramos o DANFE em PDF para você.`,
      );
    } else {
      toast.success(
        "Nota fiscal de compra lida direto do XML autorizado pela SEFAZ. Geramos o DANFE em PDF para você.",
      );
    }
  }

  async function tentarLeituraLocal(f: File): Promise<boolean> {
    if (f.type !== "application/pdf") return false;
    let texto = "";
    textoLocalRef.current = "";
    extracaoPdfOkRef.current = false;
    try {
      texto = await extrairTextoPdf(f);
      textoLocalRef.current = texto;
      extracaoPdfOkRef.current = true;
    } catch (e) {
      console.warn("[leitura local] pdf.js falhou:", e);
      return false;
    }

    // ── NOTA FISCAL VINDA DO XML ──────────────────────────────────────────
    // Precede TODOS os parsers: os campos já foram lidos do XML assinado, com
    // rótulo do layout oficial. Reler o PDF que nós mesmos acabamos de gerar
    // seria trocar dado exato por adivinhação de regex.
    if (notaXmlRef.current) {
      aplicarNotaFiscalDoXml(notaXmlRef.current);
      return true;
    }

    // Canal paralelo: a UF do comprovante decide qual TRF e qual tribunal
    // estadual cobrem o cliente. Roda antes de qualquer `return` para não
    // depender de o documento ser uma certidão — e NÃO encerra o fluxo: o
    // comprovante continua indo para a IA ler titular e próxima leitura.
    //
    // Guarda a leitura CRUA. O uso é filtrado no salvar, por tipo de
    // documento: toda certidão traz o CEP do tribunal no rodapé, e aproveitar
    // isso como "UF do cliente" mandaria o processo para a região errada.
    setEnderecoLocal(parseComprovanteEndereco(texto));

    // ── REQUERIMENTO SINARM — formulário oficial da Polícia Federal ─────────
    // Precede tudo: é o documento que ABRE o processo e o único cujo título
    // impresso ("REQUERIMENTO DE AQUISIÇÃO DE ARMA DE FOGO") não bate com o
    // nome do slot ("Requerimento de Posse de Arma de Fogo"). Ler aqui, byte a
    // byte, é o que impede a IA de chamá-lo de "Protocolo do processo" e
    // reprovar o documento certo.
    const requerimento = parseRequerimentoSinarm(texto);
    if (requerimento) {
      setConferenciaLocal(null);
      // ── TODO CAMPO DIGITADO É CONFERIDO ────────────────────────────────
      // O bloco IDENTIFICAÇÃO do requerimento é o único lugar do processo em
      // que o cliente DIGITA os próprios dados — nome, filiação, RG, título de
      // eleitor, endereço. A PF confere cada um contra os documentos anexados e
      // indefere na divergência. Por isso a leitura é campo a campo, por
      // posição na página, e o confronto é contra a linha inteira do cadastro.
      //
      // Fora da conferência, por decisão do produto: os dados da EMPRESA em que
      // o cliente trabalha. Vínculo muda sem o cadastro acompanhar.
      let camposDigitados = lerCamposRequerimentoPorGeometria([]);
      try {
        camposDigitados = lerCamposRequerimentoPorGeometria(await extrairItensPdfPorPagina(f));
      } catch (e) {
        console.warn("[requerimento] leitura por geometria falhou:", e);
      }
      // A frase-modelo do requerimento é a segunda fonte do titular: se o bloco
      // de identificação não puder ser pareado, nome, CPF e RG ainda saem dali.
      camposDigitados.nome_completo ||= requerimento.nome_completo ?? "";
      camposDigitados.cpf ||= requerimento.cpf ?? "";
      camposDigitados.rg ||= requerimento.rg ?? "";
      camposDigitados.data_nascimento ||= requerimento.data_nascimento ?? "";
      camposDigitados.especie_arma ||= requerimento.especie_arma ?? "";
      camposDigitados.calibre ||= requerimento.calibre ?? "";

      // O cadastro pode ainda não ter chegado (modal aberto e arquivo escolhido
      // no mesmo instante). Buscar aqui evita conferir contra o vazio e exibir
      // "sem referência" em tudo.
      let cadastro = cadastroCompleto;
      if (!cadastro && qaClienteId) {
        try {
          const { data } = await supabase
            .from("qa_clientes" as any)
            .select("nome_completo, cpf, nome_mae, nome_pai, data_nascimento, sexo, estado_civil, naturalidade_pais, naturalidade_uf, naturalidade_municipio, rg, emissor_rg, uf_emissor_rg, expedicao_rg, titulo_eleitor, profissao, email, celular, cep, endereco, numero, complemento, bairro, cidade, estado")
            .eq("id", qaClienteId)
            .maybeSingle();
          if (data) {
            cadastro = data as unknown as CadastroParaRequerimento;
            setCadastroCompleto(cadastro);
          }
        } catch { /* sem cadastro a conferência degrada para "sem referência" */ }
      }
      // Props têm prioridade sobre a linha só quando a linha não trouxe o dado.
      const cadastroReq: CadastroParaRequerimento = {
        ...(cadastro ?? {}),
        nome_completo: cadastro?.nome_completo || refClienteNome || null,
        cpf: cadastro?.cpf || refClienteCpf || null,
        data_nascimento: cadastro?.data_nascimento || refClienteDataNascimento || null,
        nome_mae: cadastro?.nome_mae || refClienteNomeMae || null,
      };

      const conformidadeReq = conferirRequerimentoContraCadastro(camposDigitados, cadastroReq);
      const divergentes = conformidadeReq.filter((i) => i.status === "divergente");
      const titularConfere = !divergentes.some(
        (item) => item.campo === "nome_completo" || item.campo === "cpf",
      );
      const camposReq: Record<string, string | undefined> = {
        ...Object.fromEntries(
          Object.entries(camposDigitados).filter(([, v]) => !!v),
        ),
        numero_documento: requerimento.numero_requerimento,
        numero_requerimento: requerimento.numero_requerimento,
        orgao_emissor: "Polícia Federal — SINARM",
        data_emissao: requerimento.data_emissao ?? undefined,
        data_validade: requerimento.data_vencimento ?? undefined,
      };
      setClassificacao({
        tipoDetectado: "REQUERIMENTO_DE_POSSE_DE_ARMA_DE_FOGO",
        confianca: 0.99,
        camposExtraidos: camposReq,
        recomendacao: divergentes.length === 0 ? "aceitar" : "revisao_obrigatoria",
        revisao_obrigatoria: divergentes.length > 0,
        justificativa: divergentes.length === 0
          ? "Leitura determinística: formulário oficial do SINARM (Polícia Federal), número do requerimento com 18 dígitos conferido. O título impresso é \"Requerimento de Aquisição de Arma de Fogo\" — é o mesmo documento que o checklist pede como Requerimento de Posse. Todos os campos digitados conferem com o cadastro."
          : `Formulário oficial do SINARM identificado, mas ${divergentes.length} campo(s) digitado(s) não conferem com o cadastro: ${divergentes.map((d) => d.label).join(", ")}.`,
      });
      setConformidade(conformidadeReq);
      setForm((prev) => ({
        ...prev,
        tipo_documento: "requerimento_de_posse_de_arma_de_fogo",
        nome_documento: "Requerimento de Posse de Arma de Fogo (Polícia Federal)",
        numero_documento: requerimento.numero_requerimento,
        orgao_emissor: "Polícia Federal — SINARM",
        data_emissao: requerimento.data_emissao || prev.data_emissao,
        // Validade impressa pela própria PF. Nunca herdar `prev`: data residual
        // de um arquivo anexado antes viraria carimbo de vencido no requerimento.
        data_validade: requerimento.data_vencimento || "",
        observacoes: [
          `Nº do requerimento: ${requerimento.numero_requerimento}`,
          requerimento.especie_arma ? `Espécie: ${requerimento.especie_arma}` : "",
          requerimento.calibre ? `Calibre: ${requerimento.calibre}` : "",
        ].filter(Boolean).join("\n") || prev.observacoes,
      }));
      setCategoriaHub("documentos_processo");
      if (!camposDigitados.nome_completo || !camposDigitados.cpf) {
        toast.error("Requerimento da PF identificado, mas não foi possível ler nome e CPF no PDF original. Confira os campos antes de salvar.");
      } else if (!titularConfere) {
        toast.error("Requerimento da PF identificado, mas o nome ou CPF não confere com o cadastro do cliente.");
      } else if (divergentes.length > 0) {
        toast.error(
          `Requerimento lido: ${divergentes.length} campo(s) digitado(s) na PF não conferem com o cadastro — ${divergentes.map((d) => d.label).join(", ")}. Corrija no site da Polícia Federal e reenvie.`,
        );
      } else {
        const conferidos = conformidadeReq.filter((i) => i.status === "conforme").length;
        toast.success(`Requerimento de Posse lido e conferido — ${conferidos} campos digitados batem com o cadastro.`);
      }
      return true;
    }

    // ── CCMEI — modelo oficial do Portal do Empreendedor. Parse local decide o
    //    tipo (renda_ccmei) e preenche CNPJ/abertura sem depender da IA.
    const ccmei = parseCcmei(texto);
    if (ccmei) {
      setConferenciaLocal(null);
      const camposCcmei: Record<string, string | undefined> = {
        nome_completo: ccmei.nome_civil,
        nome_civil: ccmei.nome_civil,
        cpf: ccmei.cpf,
        cnpj: ccmei.cnpj,
        razao_social: ccmei.nome_empresarial,
        nome_empresarial: ccmei.nome_empresarial,
        situacao_cadastral: ccmei.situacao_cadastral,
        cnae_principal: ccmei.cnae_principal,
        atividade_principal: ccmei.cnae_principal,
        ocupacao_principal: ccmei.ocupacao_principal,
      };
      const conformidadeCcmei = calcularConformidade(
        camposCcmei,
        refClienteNome,
        refClienteCpf,
        refClienteDataNascimento,
        refClienteNomeMae,
        docsEfetivos,
        null,
        "renda_ccmei",
        [clienteAutoFetch.naturalidade_municipio, clienteAutoFetch.naturalidade_uf].filter(Boolean).join(" ") || null,
        {
          cnpj: clienteAutoFetch.ocupacao_licita_cnpj,
          razao_social: clienteAutoFetch.ocupacao_licita_razao_social,
        },
      );
      const camposObrigatoriosPresentes = !!(
        ccmei.nome_civil &&
        ccmei.cpf &&
        ccmei.situacao_cadastral
      );
      const situacaoAtiva = situacaoCadastralAprovada(ccmei.situacao_cadastral) === true;
      const titularConfere = !conformidadeCcmei.some(
        (item) =>
          (item.campo === "nome_completo" || item.campo === "cpf") &&
          item.status === "divergente",
      );
      const ccmeiAceitavel = camposObrigatoriosPresentes && situacaoAtiva && titularConfere;
      const classificacaoCcmei: IAClass = {
        tipoDetectado: "CCMEI",
        confianca: 0.99,
        camposExtraidos: camposCcmei,
        recomendacao: ccmeiAceitavel ? "aceitar" : "revisao_obrigatoria",
        revisao_obrigatoria: !ccmeiAceitavel,
        justificativa: ccmeiAceitavel
          ? "Certificado oficial CCMEI: nome, CPF e situação cadastral ATIVA conferidos."
          : "Certificado oficial CCMEI identificado, mas nome, CPF ou situação cadastral exigem correção.",
      };
      setClassificacao(classificacaoCcmei);
      setConformidade(conformidadeCcmei);
      setForm((prev) => ({
        ...prev,
        tipo_documento: "renda_ccmei",
        nome_documento: "CCMEI — Certificado da Condição de Microempreendedor Individual",
        numero_documento: ccmei.cnpj ?? prev.numero_documento,
        orgao_emissor: "Receita Federal do Brasil",
        // BLINDAGEM: o CCMEI é documento CONSTITUTIVO — não tem emissão nem
        // validade a conferir. Nunca herdar `prev` aqui: qualquer data residual
        // de um arquivo anexado antes viraria carimbo de "vencido".
        data_emissao: "",
        data_validade: "",
        observacoes: [
          ccmei.nome_civil ? `Nome Civil: ${ccmei.nome_civil}` : "",
          ccmei.cnpj ? `CNPJ: ${ccmei.cnpj}` : "",
          ccmei.nome_empresarial ? `Nome empresarial: ${ccmei.nome_empresarial}` : "",
          ccmei.situacao_cadastral ? `Situação cadastral: ${ccmei.situacao_cadastral}` : "",
          ccmei.ocupacao_principal ? `Ocupação principal: ${ccmei.ocupacao_principal}` : "",
        ].filter(Boolean).join("\n") || prev.observacoes,
      }));
      setCategoriaHub("renda_ocupacao");
      if (!camposObrigatoriosPresentes) {
        toast.error("CCMEI identificado, mas não foi possível ler nome, CPF e situação cadastral no PDF original.");
      } else if (!situacaoAtiva) {
        toast.error(`CCMEI com situação cadastral ${ccmei.situacao_cadastral}. A PF só aceita MEI ATIVO.`);
      } else if (!titularConfere) {
        toast.error("CCMEI identificado, mas o nome ou CPF não confere com o cadastro do cliente.");
      } else {
        toast.success("CCMEI lido e aprovado — nome, CPF e situação ATIVA conferidos.");
      }
      return true;
    }

    if (ehPaginaAutenticacaoTrfIsolada(`${f.name}\n${texto}`)) {
      toast.error("Este arquivo parece ser apenas a página de autenticação/QR da certidão TRF. Envie o PDF completo, com todas as páginas, para a certidão ficar inteira e classificada corretamente.");
      setConferenciaLocal(null);
      setForm((prev) => ({
        ...prev,
        tipo_documento: "antecedentes_federal_trf3_regional",
        nome_documento: "Certidão de Distribuição Criminal — Tribunal Regional Federal da 3ª Região",
        orgao_emissor: "Tribunal Regional Federal da 3ª Região",
      }));
      setCategoriaHub("antecedentes_regularidade");
      return true;
    }
    // ── PARSE-01 · COMPROVANTE DE ENDEREÇO ────────────────────────────────
    // Fatura de concessionária é documento estruturado: quem lê é o parser,
    // não a IA. Titular, CPF, UC e datas saem daqui, de forma determinística.
    const danfe = parseDanf3e(texto);
    if (danfe.detectado) {
      setConferenciaLocal(null);
      const emissao =
        danfe.data_emissao ||
        (danfe.mes_referencia ? `${danfe.mes_referencia}-01` : "") ||
        danfe.data_vencimento ||
        "";
      // Validade do comprovante sai do CICLO, não da emissão da NF-e:
      // próxima leitura → vencimento → emissão + 30 dias.
      const datasCiclo: DatasComprovanteConsumo = {
        data_proxima_leitura: danfe.data_proxima_leitura,
        data_vencimento: danfe.data_vencimento,
        data_emissao: emissao,
      };
      setDatasConsumo(datasCiclo);
      const validadeCiclo = validadeComprovanteConsumo(datasCiclo);
      setForm((prev) => ({
        ...prev,
        tipo_documento: "comprovante_residencia",
        nome_documento:
          prev.nome_documento ||
          "Comprovante de endereço — conta de consumo do imóvel",
        numero_documento: danfe.uc || danfe.numero_nota || prev.numero_documento,
        orgao_emissor: danfe.empresa_emissora || prev.orgao_emissor,
        data_emissao: emissao || prev.data_emissao,
        data_validade:
          validadeCiclo ||
          calcularValidadeHubPorTipo("comprovante_residencia", emissao) ||
          prev.data_validade,
      }));
      setCategoriaHub(inferHubCategoriaFromTipo("comprovante_residencia"));

      // Classificação registrada como leitura de PARSER (confiança 1) — a IA
      // não foi consultada e não pode aparecer como autora da leitura.
      const camposParser: Record<string, string | undefined> = {
        nome_completo: danfe.nome_titular || undefined,
        cpf: danfe.cpf_titular || undefined,
      };
      setClassificacao({
        tipoDetectado: "comprovante_residencia",
        confianca: 1,
        justificativa: "Leitura determinística (parser DANF3E) — sem IA.",
        camposExtraidos: camposParser,
        recomendacao: "aceitar",
      });

      // ── CPF-01 · titularidade ───────────────────────────────────────────
      const avaliacao = avaliarTitularidadeComprovante({
        nomeDoc: danfe.nome_titular,
        cpfDoc: danfe.cpf_titular,
        nomeRef: refClienteNome,
        cpfRef: refClienteCpf,
      });
      setAvaliacaoTitular(avaliacao);
      setCpfConfrontado(null);
      setCpfConfrontoInput("");
      setCpfConfrontoErro(null);

      const itens: ConformidadeItem[] = [];
      if (danfe.nome_titular) {
        itens.push({
          campo: "nome_completo",
          label: "Titular da conta",
          valorCertidao: danfe.nome_titular,
          valorReferencia: refClienteNome ?? null,
          fonteReferencia: refClienteNome ? "Cadastro (Central de Adesão)" : null,
          status:
            avaliacao.resultado === "propria"
              ? "conforme"
              : avaliacao.resultado === "terceiro"
                ? "divergente"
                : "sem_referencia",
        });
      }
      if (danfe.cpf_titular) {
        itens.push({
          campo: "cpf",
          label:
            avaliacao.cpf.estado === "mascarado"
              ? "CPF do titular (mascarado pela concessionária)"
              : "CPF do titular",
          valorCertidao: danfe.cpf_titular,
          valorReferencia: refClienteCpf ?? null,
          fonteReferencia: refClienteCpf ? "Cadastro (Central de Adesão)" : null,
          // CPF ilegível NUNCA vira divergência: é ausência de prova, não prova
          // em contrário.
          status:
            avaliacao.cpf.estado !== "valido"
              ? "sem_referencia"
              : avaliacao.resultado === "propria"
                ? "conforme"
                : "divergente",
        });
      }
      setConformidade(itens);

      if (avaliacao.resultado === "propria") {
        toast.success("Comprovante de endereço lido e conferido com o seu cadastro.");
      } else if (avaliacao.resultado === "terceiro") {
        toast.info("Este comprovante está no nome de outra pessoa. Vamos pedir a declaração do responsável pelo imóvel.");
      } else {
        setCpfConfrontoAberto(true);
      }
      return true;
    }

    const doc = parseCertidao(texto);
    if (!doc) return false;

    const conf = conferirCertidao(doc, {
      nome_completo: refClienteNome,
      cpf: refClienteCpf,
      data_nascimento: refClienteDataNascimento,
      nome_mae: refClienteNomeMae,
      naturalidade_municipio: clienteAutoFetch.naturalidade_municipio,
      naturalidade_uf: clienteAutoFetch.naturalidade_uf,
      rg: clienteAutoFetch.rg,
    }, texto);
    setConferenciaLocal({ doc, conf, texto });

    // Preenche o formulário com o que foi LIDO do documento, não inferido.
    setForm((prev) => ({
      ...prev,
      tipo_documento: doc.tipoDocumento,
      numero_documento:
        doc.numero_documento ??
        (numeroDocumentoRenda(doc.tipoDocumento, doc as any) || prev.numero_documento),
      data_emissao: doc.data_emissao ?? prev.data_emissao,
      orgao_emissor: ORGAO_LABEL[doc.orgao] ?? prev.orgao_emissor,
      data_validade:
        doc.data_emissao && doc.validade_dias
          ? somarDias(doc.data_emissao, doc.validade_dias)
          : (calcularValidadeHubPorTipo(doc.tipoDocumento, doc.data_emissao) ||
             prev.data_validade),
    }));
    setCategoriaHub(inferHubCategoriaFromTipo(doc.tipoDocumento));

    if (conf.veredicto === "rejeitado") {
      toast.error("Certidão recusada na conferência. Veja o motivo no painel.");
      void notificarCertidaoRejeitada(doc, conf);
    } else if (conf.veredicto === "revisao_humana") {
      // Falha de LEITURA não recusa o cliente: o documento é salvo e a equipe
      // confere manualmente. Nada de e-mail de rejeição aqui.
      toast.info("Documento recebido. Alguns campos deste modelo não puderam ser lidos automaticamente e a equipe vai conferir.");
    } else {
      toast.success("Certidão lida e conferida com o seu cadastro.");
    }
    return true;
  }

  /**
   * RECUSA DE ANEXO — caminho único.
   *
   * Nasceu do caso do Gilson (19/08/2026). Ele recebeu duas recusas seguidas e
   * NENHUMA das duas telas dizia qual arquivo tinha sido anexado; nenhuma das
   * duas deixou registro. Levou uma conversa inteira para descobrir que numa
   * vez ele mandou o PDF e na outra o XML — e virou palavra contra palavra.
   *
   * Daqui em diante toda recusa de anexo passa por aqui, e faz as duas coisas
   * juntas, sempre:
   *   1. mostra o NOME do arquivo dentro da própria mensagem, para a foto de
   *      tela do cliente já provar sozinha o que foi enviado;
   *   2. grava a tentativa na trilha, como a regra canônica sempre mandou
   *      (docs/RASTRO-DOCUMENTAL.md) e estas recusas não cumpriam.
   *
   * O arquivo não subiu: a recusa acontece na escolha, antes do upload — daí
   * `arquivoApagado: false`.
   */
  function recusarAnexo(
    arquivo: File,
    codigo: TentativaBloqueada["codigo"],
    mensagem: string,
    opcoes?: { carimbo?: string },
  ) {
    const identificacao = descricaoDoArquivo(arquivo);
    const textoCompleto = [mensagem, identificacao].filter(Boolean).join("\n\n");

    if (opcoes?.carimbo) {
      setResultadoCarimbo({ tipo: "reprovado", titulo: opcoes.carimbo, mensagem: textoCompleto });
    } else {
      const id = toast.error(textoCompleto, {
        duration: Infinity,
        action: { label: "ENTENDI", onClick: () => toast.dismiss(id) },
      });
      setFile(null);
    }

    void registrarTentativaBloqueada({
      qaClienteId: qaClienteId ?? null,
      customerId: customerId ?? null,
      codigo,
      // Mesmo texto que o cliente leu — a spec proíbe a trilha divergir da tela.
      motivo: textoCompleto,
      tipoPretendido: form.tipo_documento || null,
      tipoLido: null,
      exigenciaAlvo: expectedTipoMeta?.value ?? null,
      arquivoNome: arquivo.name ?? null,
      arquivoMime: arquivo.type || null,
      arquivoTamanho: arquivo.size ?? null,
      arquivoApagado: false,
    });
  }

  async function handleFileChange(f: File | null, notaXml?: NotaFiscalImportada | null) {
    // Limpa avisos fixos (duration: Infinity) de tentativas anteriores — senão
    // o cliente vê a mensagem antiga sobreposta ao resultado do novo arquivo.
    toast.dismiss();

    // ── QUEM MANDA É O CONTEÚDO, NÃO O NOME DO ARQUIVO ────────────────────
    // Caso Gilson, 20/08/2026 00h00: ele anexou o XML da nota e o Hub recusou
    // com "este arquivo não é um PDF". A linha de identificação entregou o
    // motivo — "Documento de gilson — formato desconhecido, 11 KB": o celular
    // passou o arquivo SEM extensão e SEM tipo MIME. O arquivo estava certo; a
    // nossa identificação é que dependia do nome.
    //
    // Quem escolhe o nome é o aplicativo por onde o arquivo passou, não o
    // emissor. Então, quando nome e tipo não dizem nada, a assinatura dos
    // primeiros bytes decide — e o tipo é corrigido no próprio arquivo, para
    // todo o resto do fluxo enxergar o que ele realmente é.
    //
    // O NOME É PRESERVADO de propósito: é ele que identifica a tentativa na
    // tela e na trilha. Renomear aqui apagaria a prova que acabamos de criar.
    if (f && !ehArquivoXml(f) && f.type !== "application/pdf" && !f.type.startsWith("image/")) {
      const assinatura = await assinaturaDoArquivo(f);
      if (assinatura === "xml") {
        return handleFileChange(new File([f], f.name, { type: "text/xml" }), notaXml);
      }
      if (assinatura === "pdf") {
        return handleFileChange(new File([f], f.name, { type: "application/pdf" }), notaXml);
      }
    }

    // ── XML DA NOTA FISCAL → DANFE EM PDF COM TEXTO ───────────────────────
    // O DANFE que o celular salva pelo botão "Compartilhar" chega sem camada
    // de texto: arquivo legítimo, ilegível para qualquer leitor. Em vez de
    // devolver "salve de novo" e travar o cliente, aceitamos o XML — que é o
    // documento fiscal de verdade — e geramos aqui o PDF com texto.
    //
    // Roda ANTES de qualquer trava: o que segue no fluxo é o PDF gerado, e é
    // ele que passa por todas as verificações normais do Hub.
    if (f && ehArquivoXml(f)) {
      setFile(f);
      setExtracting(true);
      let resultado: Awaited<ReturnType<typeof importarNotaFiscalXml>>;
      try {
        resultado = await importarNotaFiscalXml(f, {
          cpf: refClienteCpf,
          cnpj: clienteAutoFetch.ocupacao_licita_cnpj,
          tipoSlot: form.tipo_documento,
        });
      } catch (e) {
        console.error("[nota-fiscal-xml] falha inesperada", e);
        resultado = { ok: false, motivo: "Não conseguimos ler este XML. Anexe o arquivo de novo." };
      } finally {
        setExtracting(false);
      }
      if (resultado.ok === false) {
        recusarAnexo(f, "xml_recusado", resultado.motivo);
        return;
      }
      // Segue o fluxo normal com o PDF gerado — que não é XML e, portanto,
      // não volta para este ramo.
      return handleFileChange(resultado.importada.pdf, resultado.importada);
    }

    setFile(f);
    notaXmlRef.current = notaXml ?? null;
    setClassificacao(null);
    setConferenciaLocal(null);
    setShowTipoOverride(false);
    setAvaliacaoTitular(null);
    setCpfConfrontado(null);
    setCpfConfrontoAberto(false);
    setDatasConsumo(null);
    setCpfConfrontoErro(null);
    // ── RESET DO ESTADO RESIDUAL ──────────────────────────────────────────
    // Cada arquivo anexado é uma leitura NOVA. Sem zerar aqui, os campos do
    // documento anterior sobreviviam ao `...prev` dos blocos de leitura — foi
    // assim que a validade de um documento vencido continuou no formulário e
    // reprovou um CCMEI, que não tem vencimento nenhum. Preservamos apenas o
    // contexto do slot/checklist aberto: o tipo de documento exigido.
    setForm((prev) => ({ ...EMPTY, tipo_documento: prev.tipo_documento }));
    setIaExtraido({});
    setConfirmados({});
    setConformidade([]);
    setTemApontamento(false);
    setReconheceApontamento(null);
    setHomonimiaSalva(false);
    setShowDeclaracao(false);
    setProfissionalExtraido({ nome: null, registro: null });
    setConferenciaLaudo(null);
    setEnderecoLocal(null);
    setAutoResult(null);
    if (!f) return;

    // ── Trava global: PDF ORIGINAL em todas as fases ─────────────────────
    // Print, foto de tela e digitalização não valem. A única exceção é a
    // foto 3x4 do titular, que é imagem por natureza.
    {
      const aceitaImagem = tipoAceitaImagem(form.tipo_documento);
      const ehPdf = f.type === "application/pdf";
      const ehImagem = f.type.startsWith("image/");
      if (!aceitaImagem && !ehPdf) {
        recusarAnexo(f, "formato_recusado", mensagemSomentePdf(form.tipo_documento));
        return;
      }
      if (aceitaImagem && !ehImagem) {
        recusarAnexo(f, "formato_recusado", MSG_FOTO_SOMENTE_IMAGEM);
        return;
      }
    }

    // ── Trava: documento oficial de identidade só entra como PDF com QR Code
    //    da Carteira de Documentos do gov.br. Foto/print é recusado na hora.
    if (isTipoIdentidadeComQr(form.tipo_documento)) {
      if (f.type !== "application/pdf") {
        recusarAnexo(f, "formato_recusado", MSG_IDENTIDADE_SOMENTE_PDF);
        return;
      }
      setExtracting(true);
      let textoIdentidade = "";
      let falhaTecnicaLeitura = false;
      try {
        textoIdentidade = await extrairTextoPdf(f);
      } catch (e) {
        console.warn("[identidade] pdf.js falhou:", e);
        falhaTecnicaLeitura = true;
      } finally {
        setExtracting(false);
      }
      const veredicto = avaliarPdfIdentidade(textoIdentidade);
      let aprovadoPorQrVisual = false;
      if (!veredicto.ok) {
        // A CNH digital (CNH-e) e parte das CIN do gov.br saem como PDF de
        // imagem, sem camada de texto. Antes de recusar, procuramos o QR Code
        // de autenticidade no próprio pixel do documento. O QR da CNH-e não é
        // uma URL: é binário assinado — quem decide o aceite é o veredicto
        // canônico, não a presença de "gov.br" no conteúdo.
        setExtracting(true);
        try {
          const qr = await lerQrCodeDoPdf(f);
          aprovadoPorQrVisual = avaliarQrVisualIdentidade(qr, textoIdentidade);
        } finally {
          setExtracting(false);
        }
      }
      // Se a leitura falhou por problema técnico (worker do pdf.js, memória do
      // navegador), o documento NÃO é culpado: seguimos para a IA classificar
      // em vez de recusar um PDF oficial.
      if (!veredicto.ok && !aprovadoPorQrVisual && !falhaTecnicaLeitura) {
        recusarAnexo(f, "formato_recusado", veredicto.motivo || MSG_IDENTIDADE_SOMENTE_PDF);
        return;
      }
    }

    setExtracting(true);
    try {
      // Parse-first: a IA só entra se o layout não for reconhecido.
      const resolvido = await tentarLeituraLocal(f);
      if (resolvido) return;
    } finally {
      setExtracting(false);
    }

    // ── PDF SEM CAMADA DE TEXTO ───────────────────────────────────────────
    // O documento do cliente pode estar perfeito e ainda assim chegar ilegível:
    // ao usar "Compartilhar" em vez de "Imprimir", o celular reimprime a tela e
    // converte cada letra em traço vetorial. O arquivo fica idêntico aos olhos
    // e vazio para a máquina — nem parser, nem IA conseguem ler.
    //
    // Antes isso caía na conferência de dados e virava "não confere com os seus
    // dados de cadastro": acusávamos o cliente de mandar documento de outra
    // pessoa quando ele só salvou pela via errada.
    //
    // EXCEÇÃO — documentos que NASCEM como imagem e por isso não têm texto:
    //  - identidade civil (CNH-e, CIN): caminho próprio, lê o QR Code no pixel;
    //  - carteira/identidade funcional: é foto do documento, não há texto;
    //  - foto 3x4 e afins: imagem por definição.
    // Composto dos predicados canônicos — nada de lista literal nova aqui.
    const documentoNasceImagem =
      isTipoIdentidadeComQr(form.tipo_documento) ||
      isIdentidadeFuncionalPerpetua(form.tipo_documento) ||
      tipoAceitaImagem(form.tipo_documento);

    if (
      f.type === "application/pdf" &&
      extracaoPdfOkRef.current &&
      !String(textoLocalRef.current || "").trim() &&
      !documentoNasceImagem
    ) {
      recusarAnexo(
        f,
        "pdf_sem_texto",
        "O PDF ficou sem texto, só imagem. Use o botão IMPRIMIR da página da Receita, não o Compartilhar. " +
          "Depois: Salvar como PDF (Android) ou Salvar em Arquivos (iPhone).",
        { carimbo: "Salve de novo" },
      );
      return;
    }

    await classifyAndExtract(f);
  }

  /**
   * REJEITADO → ENVIAR NOVAMENTE.
   * Dispara o e-mail que explica, em detalhe, por que o documento foi recusado
   * (incluindo o alerta sobre a Polícia Federal) e devolve o modal ao estado
   * limpo para o cliente anexar o documento correto.
   */
  async function handleEnviarNovamente() {
    if (enviandoNovamente) return;
    setEnviandoNovamente(true);
    try {
      if (qaClienteId && motivoRejeicao) {
        const detalhes: Array<{ label: string; valor: string }> = [];
        if (tomadorInfo?.valorCertidao) {
          detalhes.push({ label: "Tomador na nota", valor: tomadorInfo.valorCertidao });
        }
        if (tomadorInfo?.valorReferencia) {
          detalhes.push({ label: "Prestador (você / sua empresa)", valor: tomadorInfo.valorReferencia });
        }
        if (tomadorEnderecoInfo?.valorCertidao) {
          detalhes.push({ label: "Endereço do tomador", valor: tomadorEnderecoInfo.valorCertidao });
        }
        if (tomadorEnderecoInfo?.valorReferencia) {
          detalhes.push({ label: "Endereço do prestador", valor: tomadorEnderecoInfo.valorReferencia });
        }
        conformidade
          .filter((i) => i.status === "divergente" && !String(i.campo).startsWith("tomador"))
          .forEach((i) =>
            detalhes.push({
              label: i.label,
              valor: `${i.valorCertidao} (no cadastro: ${i.valorReferencia || "—"})`,
            }),
          );
        await supabase.functions.invoke("qa-notify-event", {
          body: {
            evento: "documento_rejeitado",
            cliente_id: qaClienteId,
            motivo_rejeicao: motivoRejeicao,
            documento:
              expectedTipoMeta?.label ||
              getNomeDocumentoDisplay({ tipo_documento: form.tipo_documento }, "Documento"),
            arquivo: file?.name || "",
            detalhes,
            referencia_id: `${form.tipo_documento || "doc"}-${Date.now()}`,
          },
        });
      }
      toast.success("Enviamos ao seu e-mail o motivo da recusa. Anexe agora o documento correto.");
    } catch {
      toast.error("Não conseguimos enviar o e-mail agora, mas você já pode anexar outro arquivo.");
    } finally {
      setEnviandoNovamente(false);
      setFile(null);
      setClassificacao(null);
      setConferenciaLocal(null);
      setAutoResult(null);
      setConformidade([]);
      setIaExtraido({});
      setConfirmados({});
      setForm({ ...EMPTY, tipo_documento: defaultTipoEfetivo });
      setTimeout(() => fileInputRef.current?.click(), 150);
    }
  }

  async function handleSave() {
    // Certidão recusada na conferência local NÃO entra no acervo. Salvar
    // significaria dar a exigência por cumprida com um documento que a PF vai
    // recusar — o cliente descobriria só no indeferimento.
    // Documento diferente do pedido, mas que cobre outra pendência: é aceito
    // e o cliente PRECISA saber disso. Sem o aviso ele acha que resolveu a
    // exigência que estava vendo na tela, e a original fica esquecida — foi
    // como o processo do cliente 214 acumulou itens meio resolvidos.
    if (cobreOutraPendencia && qaClienteId && expectedTipoMeta) {
      void supabase.functions.invoke("qa-notify-event", {
        body: {
          evento: "documento_reaproveitado",
          cliente_id: qaClienteId,
          documento: getNomeDocumentoDisplay({ tipo_documento: form.tipo_documento }, "Documento"),
          exigencia_pedida: expectedTipoMeta.label,
          exigencia_cumprida: getNomeDocumentoDisplay({ tipo_documento: form.tipo_documento }, "Documento"),
          link_emissao: getLinkEmissaoCertidao(expectedTipoMeta.value) ?? "",
        },
      });
    }

    // Nota perguntada e não respondida trava o salvamento. Sem ela o sistema
    // registraria o laudo com um campo em branco que ninguém mais vai voltar
    // para preencher — e a nota é o que sustenta a aprovação legal.
    const notasFaltando = (conferenciaLaudo?.perguntasAoCliente ?? []).filter(
      (q) => !String(notasInformadas[q.campo] ?? "").trim(),
    );
    if (notasFaltando.length > 0) {
      toast.error(
        notasFaltando.length === 1
          ? `Informe ${notasFaltando[0].label.toLowerCase()} — não conseguimos ler no laudo.`
          : `Informe as ${notasFaltando.length} notas que não conseguimos ler no laudo.`,
      );
      return;
    }

    if (conferenciaLaudo?.veredicto === "rejeitado") {
      toast.error(conferenciaLaudo.mensagemCliente || "Este laudo não passou na conferência e não pode ser salvo.");
      return;
    }

    if (conferenciaLocal?.conf.veredicto === "rejeitado") {
      toast.error("Esta certidão foi recusada na conferência e não pode ser salva. O cliente já foi avisado por e-mail com o motivo.");
      return;
    }
    if (!form.tipo_documento) {
      toast.error("Escolha o tipo de documento.");
      return;
    }
    if (!isTipoDocumentoMonitoravelNoHub(form.tipo_documento)) {
      toast.error("Contrato assinado deve ficar no processo/contratos, não no Hub documental monitorado.");
      return;
    }
    // Trava: certidão não é o que o slot pede E também não cobre nenhuma
    // outra pendência do processo → não deixa salvar.
    if (grupoBloqueadoTrava) {
      toast.error(mensagemGrupoBloqueado);
      return;
    }
    if (certidaoIncorreta) {
      toast.error(
        `Esta certidão não é a exigida (${expectedTipoMeta?.label ?? "documento pedido"}) e não cobre nenhuma outra pendência deste processo. Anexe o documento correto.`,
      );
      return;
    }
    // Refinamento obrigatório de subtipo: certidões TJSP e Federal precisam
    // ser gravadas no seu subtipo específico. Nenhuma pode ser salva no
    // lugar de outra — a IA classifica na hora da captura, mas o cliente pode
    // ter mantido o tipo genérico "pai" via override manual.
    const haySalvar = buildDocumentoHaystack({
      tipoDocumento: form.tipo_documento,
      arquivoNome: file?.name ?? null,
      nomeDocumento: form.nome_documento,
      orgaoEmissor: form.orgao_emissor,
      numeroDocumento: form.numero_documento,
      classificacao,
      campos: classificacao?.camposExtraidos,
    });
    let tipoRefinadoTexto = refinarTipoDocumentoPorTexto(form.tipo_documento, haySalvar);
    if (
      TIPOS_GENERICOS_RECLASSIFICAVEIS.has(tipoRefinadoTexto) &&
      ehRequerimentoPeloConjuntoDeSinais({
        textoPdf: textoLocalRef.current,
        classificacao,
        arquivoNome: file?.name ?? null,
      })
    ) {
      tipoRefinadoTexto = "requerimento_de_posse_de_arma_de_fogo";
    }
    if (tipoRefinadoTexto !== form.tipo_documento) {
      form.tipo_documento = tipoRefinadoTexto;
      setCategoriaHub(inferHubCategoriaFromTipo(tipoRefinadoTexto));
    }
    if (form.tipo_documento === "antecedentes_estadual" || form.tipo_documento === "antecedentes_federal") {
      let refinado: string | null = null;
      if (form.tipo_documento === "antecedentes_estadual") {
        if (/EXECU|1448406/.test(haySalvar)) refinado = "antecedentes_estadual_execucoes";
        else if (/DISTRIBUI|A[CÇ][OÕ]ES CRIMINAIS|1448405/.test(haySalvar)) refinado = "antecedentes_estadual_distribuicao";
      } else {
        refinado = detectaSubtipoCertidaoFederal(haySalvar);
      }
      if (!refinado) {
        toast.error(
          form.tipo_documento === "antecedentes_estadual"
            ? "Escolha o subtipo correto da certidão TJSP: DISTRIBUIÇÃO DE AÇÕES CRIMINAIS ou EXECUÇÕES CRIMINAIS."
            : "Escolha o subtipo correto da certidão federal: TRF 3ª REGIÃO ou SEÇÃO JUDICIÁRIA SP/JEF.",
        );
        return;
      }
      form.tipo_documento = refinado;
      setCategoriaHub(inferHubCategoriaFromTipo(refinado));
    }
    if (!customerId && !qaClienteId) {
      toast.error("Não foi possível identificar seu cadastro. Recarregue a página.");
      return;
    }

    // Trava dura: documento de outro titular nunca é salvo nem enviado à análise.
    if (titularDivergente && !(casoResidenciaTerceiro && terceiroDados)) {
      if (casoResidenciaTerceiro) {
        toast.error("Confirme a declaração de residência e envie o documento do responsável pelo imóvel.");
        return;
      }
      toast.error("Documento rejeitado: os dados não são do titular deste processo.");
      return;
    }

    // CPF-01: comprovante com CPF ilegível fica PENDENTE de resposta — nunca
    // reprovado e nunca salvo em silêncio como se fosse do cliente.
    if (precisaConfrontoCpf) {
      setCpfConfrontoAberto(true);
      toast.info("Confirme o CPF que aparece no comprovante para concluirmos a conferência.");
      return;
    }

    // Trava dura: nota fiscal emitida para parente no mesmo endereço.
    if (notaTomadorParentesco) {
      toast.error(
        "Nota fiscal rejeitada: o tomador é parente do prestador e consta no mesmo endereço.",
      );
      return;
    }

    // Trava dura · DOCUMENTO VENCIDO (qualquer tipo, qualquer processo):
    // não é salvo, não entra no Hub Documental e não gera carimbo de aprovado.
    // Carimbo de REPROVADO explica o motivo resumidamente.
    if (docExpirado) {
      const venc = form.data_validade
        ? new Date(form.data_validade + "T00:00:00").toLocaleDateString("pt-BR")
        : "";
      const rotulo = getNomeDocumentoDisplay(
        {
          tipo_documento: form.tipo_documento,
          nome_documento: form.nome_documento,
          numero_documento: form.numero_documento,
          orgao_emissor: form.orgao_emissor,
        },
        form.tipo_documento || "documento",
      );
      const ehResidencia =
        categoriaHub === "endereco" || /residenc|endereco|endereço/i.test(form.tipo_documento || "");
      const mensagemReprovado = ehResidencia
        ? mensagemComprovanteVencido(
            datasConsumo ?? { data_emissao: form.data_emissao, data_vencimento: form.data_validade },
            form.data_validade,
          )
        : `${rotulo} vencido${venc ? ` em ${venc}` : ""}. Envie a via atualizada deste documento.`;
      setResultadoCarimbo({
        tipo: "reprovado",
        mensagem: mensagemReprovado,
      });
      return;
    }

    // Trava de segurança: nenhum campo sensível pode ser gravado sem
    // confirmação humana explícita (clique em Confirmar OU edição manual).
    const pendentes = pendingSensitiveKeys();
    if (pendentes.length) {
      toast.error(
        `Confirme os campos antes de salvar: ${pendentes.join(", ").replace(/_/g, " ")}.`,
      );
      return;
    }

    // Trava de apontamento: se há apontamento na certidão, o cliente deve
    // responder se reconhece ou não antes de salvar.
    if (temApontamento && reconheceApontamento === null) {
      toast.error("Responda se reconhece o apontamento criminal antes de salvar.");
      return;
    }
    // Se não reconhece, precisa assinar a declaração de homonímia primeiro.
    if (temApontamento && reconheceApontamento === "nao" && !homonimiaSalva) {
      toast.error("Assine a declaração de homonímia antes de salvar a certidão.");
      return;
    }

    setSaving(true);
    try {
      // Bloqueio de duplicidade
      const tipoLabel = getNomeDocumentoDisplay({ tipo_documento: form.tipo_documento, nome_documento: form.nome_documento, numero_documento: form.numero_documento, orgao_emissor: form.orgao_emissor }, form.tipo_documento || "documento").toUpperCase();
      const numeroNorm = (form.numero_documento || "").replace(/\s+/g, "").toUpperCase();

      // CR: único por cliente (não importa número)
      if (form.tipo_documento === "cr") {
        let q = supabase
          .from("qa_documentos_cliente" as any)
          .select("id")
          .eq("tipo_documento", "cr")
          .neq("status", "excluido")
          .limit(1);
        q = customerId
          ? q.eq("customer_id", customerId)
          : q.eq("qa_cliente_id", qaClienteId as number);
        const { data: existsCr, error: errCr } = await q;
        if (errCr) throw errCr;
        if ((existsCr as any[])?.length) {
          toast.error("Este cliente já possui um CR cadastrado. Edite o existente em vez de duplicar.");
          setSaving(false);
          return;
        }
      } else if (numeroNorm) {
        // Demais tipos: bloqueia se mesmo tipo + mesmo número já existir
        let q = supabase
          .from("qa_documentos_cliente" as any)
          .select("id, numero_documento, data_emissao, status")
          .eq("tipo_documento", form.tipo_documento)
          .neq("status", "excluido");
        q = customerId
          ? q.eq("customer_id", customerId)
          : q.eq("qa_cliente_id", qaClienteId as number);
        const { data: existsNum, error: errNum } = await q;
        if (errNum) throw errNum;
        // Contas de consumo (energia/água/gás/internet/telefone) usam a mesma UC
        // por vários meses. Só bloqueia se número + mês/ano de emissão baterem.
        const tiposComRecorrencia = new Set([
          "comprovante_residencia",
          "conta_luz",
          "conta_agua",
          "conta_gas",
          "conta_internet",
          "conta_telefone",
          "iptu",
        ]);
        const usaMesAno = tiposComRecorrencia.has(String(form.tipo_documento));
        // Certidões e antecedentes (TSE, criminais, federal, estadual, militar,
        // distribuidor, nada consta etc.) mantêm o mesmo número de inscrição/
        // registro a cada reemissão. Só bloqueia se a data de emissão for
        // idêntica — nova emissão é sempre permitida.
        const tipoDoc = String(form.tipo_documento || "");
        const ehCertidao =
          tipoDoc.startsWith("certidao") ||
          tipoDoc.startsWith("antecedentes") ||
          tipoDoc.startsWith("nada_consta");
        const mesAnoNovo = (form.data_emissao || "").slice(0, 7); // YYYY-MM
        const dup = (existsNum as any[] | null)?.find((d) => {
          const mesmoNumero =
            (d.numero_documento || "").replace(/\s+/g, "").toUpperCase() === numeroNorm;
          if (!mesmoNumero) return false;
          if (ehCertidao) {
            const emiNova = String(form.data_emissao || "").slice(0, 10);
            const emiExist = String(d.data_emissao || "").slice(0, 10);
            if (!emiNova || !emiExist) return true;
            return emiNova === emiExist;
          }
          if (!usaMesAno) return true;
          const mesAnoExistente = String(d.data_emissao || "").slice(0, 7);
          // Se algum lado não tem data, cai para o bloqueio antigo (evita brechas).
          if (!mesAnoNovo || !mesAnoExistente) return true;
          return mesAnoNovo === mesAnoExistente;
        });
        if (dup) {
          // O documento JÁ está no Hub. Antes isso era erro duro e travava o
          // cliente: o checklist pedia o documento, a trava impedia o reenvio,
          // e não havia saída. Agora aproveitamos o que já existe — garantimos
          // que ele esteja aprovado e mandamos revalidar as exigências, que é
          // exatamente o que o cliente queria conseguir ao reenviar.
          try {
            if (dup.status !== "aprovado") {
              await supabase
                .from("qa_documentos_cliente" as any)
                .update({ status: "aprovado", validado_admin: true, aprovado_em: new Date().toISOString() })
                .eq("id", dup.id);
              await notificarDocumentoHubAprovado(dup.id);
            }
            if (qaClienteId) {
              await supabase.rpc("qa_processo_rever_exigencias" as any, { p_cliente_id: qaClienteId });
            }
            // Exigências atendidas pelo documento já existente: avisa o cliente
            // de que o processo andou, mesmo sem novo upload.
            void notificarReaproveitamentosPendentes(qaClienteId);
            setResultadoCarimbo({
              tipo: "aprovado",
              mensagem: `${tipoLabel} — já estava no seu Hub e foi aproveitado · exigência atendida`,
            });
            // NÃO chamar onSaved() aqui: o pai recarrega/fecha o Hub e o
            // carimbo some antes de o cliente ver. O onSaved() acontece no
            // onDone do carimbo, junto com o fechamento.
          } catch (e: any) {
            // Se a revalidação falhar, o documento existe do mesmo jeito —
            // o cliente não pode ficar preso por causa disso.
            console.error("[hub-dup] falha ao reaproveitar documento existente", e);
            setResultadoCarimbo({
              tipo: "analise",
              mensagem: `${tipoLabel} — já está no seu Hub · nossa equipe foi avisada para liberar a exigência`,
            });
          }
          setSaving(false);
          return;
        }
      }

      let storagePath: string | null = null;
      let fileName: string | null = null;
      let mime: string | null = null;

      // REGRA: só documentos de EFETIVA NECESSIDADE podem entrar "em análise".
      // Todo o resto é decidido na hora — aprovado ou reprovado. Um registro
      // sem arquivo nunca pode nascer no Hub: era exatamente isso que gerava
      // certidão "EM ANÁLISE" sem nada para a leitura automática ler.
      const ehEfetivaNecessidade =
        inferHubCategoriaFromTipo(form.tipo_documento) === "efetiva_necessidade";
      if (!file && !ehEfetivaNecessidade) {
        throw new Error(
          "Nenhum arquivo foi anexado. Anexe o PDF do documento para que a leitura automática possa conferir com o seu cadastro.",
        );
      }

      if (file) {
        const safe = sanitize(file.name);
        const ownerKey = customerId ?? `qa-${qaClienteId}`;
        const categoriaFinal = inferHubCategoriaFromTipo(form.tipo_documento);
        const path = `cliente-docs/${ownerKey}/${categoriaFinal}/${form.tipo_documento}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage
          .from("qa-documentos")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        storagePath = path;
        fileName = file.name;
        mime = file.type || null;

        // ── ARQUIVO REPETIDO ────────────────────────────────────────────────
        // A trava por TIPO não pega o mesmo PDF classificado sob tipos
        // diferentes — foi assim que uma conta de consumo entrou como certidão
        // militar e como comprovante de residência no mesmo dia (03/08/2026).
        // A comparação aqui é do CONTEÚDO, pelo eTag que o Storage já guarda.
        const repetido = await checarArquivoRepetido(path, qaClienteId ?? null, customerId ?? null);
        if (repetido) {
          const texto = mensagemArquivoRepetido(repetido, expectedTipoMeta?.label ?? null);
          // Decisão do usuário: arquivo recusado é apagado na hora. A trilha
          // guarda a identificação, não o conteúdo.
          await apagarArquivoRecusado(path);
          await registrarTentativaBloqueada({
            qaClienteId: qaClienteId ?? null,
            customerId: customerId ?? null,
            codigo: "arquivo_repetido",
            motivo: texto,
            tipoPretendido: form.tipo_documento || null,
            tipoLido: repetido.tipo_documento ?? null,
            exigenciaAlvo: expectedTipoMeta?.value ?? null,
            arquivoNome: file.name,
            arquivoMime: file.type || null,
            arquivoTamanho: file.size ?? null,
            documentoAnteriorId: repetido.documento_id,
            atorTipo: atorEhStaff ? "admin" : "cliente",
            arquivoApagado: true,
          });
          setArquivoRepetido(repetido);
          setSaving(false);
          return;
        }
      }

      /**
       * O que o PARSER leu, gravado ao lado do que a IA extraiu.
       *
       * Até aqui o parser decidia aprovar ou rejeitar e o resultado morria na
       * tela: os campos lidos do próprio PDF eram jogados fora, e o único
       * registro que sobrava era o da IA. Sem isto, `trf_regiao` e
       * `uf_comprovante` não existiriam para o motor de reaproveitamento
       * consultar.
       *
       * `lido_por` deixa auditável quem leu cada documento — dá para
       * reprocessar depois só o que veio da IA.
       *
       * A UF só entra quando o documento É comprovante de residência: certidão
       * traz o CEP do tribunal no rodapé, e usá-lo como UF do cliente mandaria
       * o processo para a região errada.
       */
      const parserBloco = (() => {
        const ehComprovante = form.tipo_documento === "comprovante_residencia";
        const uf = ehComprovante && enderecoLocal?.ok ? enderecoLocal.dados : null;
        if (!conferenciaLocal?.doc && !uf) return null;
        return {
          lido_por: "parser" as const,
          parser_lido_em: new Date().toISOString(),
          ...(conferenciaLocal?.doc
            ? {
                parser: conferenciaLocal.doc as unknown as Record<string, unknown>,
                parser_veredicto: conferenciaLocal.conf.veredicto,
                /* ── Auditoria de leitura ─────────────────────────────────
                 * Guarda o que foi usado para decidir: o texto que o sistema
                 * enxergou, de onde cada campo crítico saiu, o que divergiu e
                 * a mensagem exata entregue ao cliente.
                 *
                 * Sem isso, "por que essa certidão foi recusada?" só se
                 * responde reproduzindo o upload — e o documento do cliente
                 * já não está mais na mão de ninguém. */
                auditoria_leitura: {
                  versao: 2,
                  lido_em: new Date().toISOString(),
                  motor: "parser_local_pdf",
                  orgao_identificado: conferenciaLocal.doc.orgao,
                  tipo_identificado: conferenciaLocal.doc.tipoDocumento,
                  fonte_do_nome: conferenciaLocal.doc.leitura?.nome_fonte ?? null,
                  nome_resgatado: conferenciaLocal.doc.leitura?.nome_resgatado ?? false,
                  campos_vazios: conferenciaLocal.doc.leitura?.campos_vazios ?? [],
                  /* Campos que o LAYOUT não imprime (ex.: a certidão do TSE
                   * não traz CPF). Sem essa lista, a auditoria mostrava
                   * "campos sem valor: CPF" e parecia falha de leitura. */
                  campos_nao_aplicaveis: conferenciaLocal.doc.leitura?.campos_nao_aplicaveis ?? [],
                  filiacao_lida: conferenciaLocal.doc.filiacao ?? [],
                  filiacao_fonte: conferenciaLocal.doc.leitura?.filiacao_fonte ?? null,
                  veredicto: conferenciaLocal.conf.veredicto,
                  mensagem_ao_cliente: conferenciaLocal.conf.mensagemCliente ?? null,
                  achados: (conferenciaLocal.conf.achados ?? []).map((a) => ({
                    campo: a.campo,
                    label: a.label,
                    problema: a.problema,
                    no_documento: a.noDocumento,
                    no_cadastro: a.noCadastro,
                    mensagem: a.mensagem,
                  })),
                  // Recorte generoso, mas limitado: é prova de leitura, não
                  // cópia do documento (o arquivo original fica no storage).
                  texto_lido: (conferenciaLocal.texto ?? "").slice(0, 20000),
                  texto_truncado: (conferenciaLocal.texto ?? "").length > 20000,
                },
                // Promovido para o topo: o SQL do motor lê sem descer no objeto.
                ...(conferenciaLocal.doc.trf_regiao != null
                  ? { trf_regiao: conferenciaLocal.doc.trf_regiao }
                  : {}),
              }
            : {}),
          ...(conferenciaLaudo
            ? {
                // Conferência do laudo, persistida para o painel da equipe.
                // `laudo_alerta_interno` é o que NÃO vai para o cliente: a
                // regra do usuário é que a equipe valida e a equipe avisa.
                laudo_veredicto: conferenciaLaudo.veredicto,
                laudo_vence_em: conferenciaLaudo.vence_em ?? null,
                laudo_dias_restantes: conferenciaLaudo.dias_restantes ?? null,
                laudo_mensagem_equipe: conferenciaLaudo.mensagemEquipe,
                // Notas ditas pelo cliente quando a leitura falhou. Guardadas
                // separadas das lidas, para a equipe saber a origem de cada uma.
                ...(Object.keys(notasInformadas).length
                  ? { laudo_notas_informadas_pelo_cliente: notasInformadas }
                  : {}),
                laudo_alerta_interno:
                  conferenciaLaudo.veredicto === "aprovado_com_alerta_interno"
                    ? conferenciaLaudo.achados.filter((a) => a.interno).map((a) => a.mensagem).join(" | ")
                    : null,
              }
            : {}),
          ...(uf
            ? {
                uf_comprovante: uf.uf,
                uf_comprovante_cep: uf.cep,
                uf_comprovante_confirmada: uf.uf_confirmada,
              }
            : {}),
        };
      })();

      const payload: any = {
        customer_id: customerId ?? null,
        qa_cliente_id: qaClienteId ?? null,
        categoria_hub: inferHubCategoriaFromTipo(form.tipo_documento),
        subcategoria_hub: (getTipoDocumentoMeta(form.tipo_documento)?.value ?? form.tipo_documento),
        escopo_documental: inferEscopoDocumental({
          tipo_documento: form.tipo_documento,
          categoria_hub: inferHubCategoriaFromTipo(form.tipo_documento),
        }),
        reaproveitavel_global: inferEscopoDocumental({
          tipo_documento: form.tipo_documento,
          categoria_hub: inferHubCategoriaFromTipo(form.tipo_documento),
        }) !== "processo",
        revisao_humana_obrigatoria: !!getTipoDocumentoMeta(form.tipo_documento)?.revisaoHumanaObrigatoria,
        fonte_normativa: getTipoDocumentoMeta(form.tipo_documento) ? ["Lei 10.826/2003", ...(getTipoDocumentoMeta(form.tipo_documento)?.categoria === "arma_acervo" || getTipoDocumentoMeta(form.tipo_documento)?.categoria === "cac_atividade" ? ["Decreto 11.615/2023", "Decreto 12.345/2024", "IN DG/PF 311"] : ["IN DG/PF 201"])] : ["Lei 10.826/2003"],
        tipo_documento: form.tipo_documento,
        nome_documento: form.nome_documento || null,
        numero_documento: form.tipo_documento === "cr"
          ? (form.numero_documento || form.numero_registro_sigma || null)
          : (form.numero_documento || null),
        orgao_emissor: form.orgao_emissor || null,
        // Constitutivo da empresa entra no Hub SEM datas — nem emissão, nem
        // validade. Assim nenhuma leitura posterior (card, checklist, trigger)
        // consegue recalcular vencimento em cima de uma data que não existe.
        data_emissao: constitutivoSemDatas ? null : (form.data_emissao || null),
        data_validade:
          validadeIndeterminada || tipoSemVencimento ? null : (form.data_validade || null),
        validade_filiacao: normalizeTipoDocumentoParaBanco(form.tipo_documento) === "comprovante_filiacao_entidade_tiro" ? (form.validade_filiacao || null) : null,
        observacoes: form.observacoes || null,
        arma_marca: showArmaFields ? form.arma_marca || null : null,
        arma_modelo: showArmaFields ? form.arma_modelo || null : null,
        arma_calibre: showArmaFields ? form.arma_calibre || null : null,
        arma_numero_serie: showArmaFields ? form.arma_numero_serie || null : null,
        arma_especie: showArmaFields ? form.arma_especie || null : null,
        numero_cad_sinarm: showArmaFields ? (form.numero_cad_sinarm.trim() || null) : null,
        numero_registro_sigma: showArmaFields ? (form.numero_registro_sigma.trim() || null) : null,
        sistema_registro: showArmaFields ? (form.sistema_registro || null) : null,
        arquivo_storage_path: storagePath,
        arquivo_nome: fileName,
        arquivo_mime: mime,
        ia_status: classificacao ? "confirmado_humano" : (storagePath ? "sugerido" : "nao_processado"),
        ia_dados_extraidos: classificacao
          ? {
              tipoDetectado: classificacao.tipoDetectado,
              confianca: classificacao.confianca,
              recomendacao: classificacao.recomendacao,
              camposExtraidos: classificacao.camposExtraidos || {},
              validade_indeterminada: validadeIndeterminada || undefined,
              // Rastro do motivo pelo qual o documento entrou sem data_validade.
              tipo_sem_vencimento: tipoSemVencimento || undefined,
              avaliado_em: new Date().toISOString(),
              origem_fluxo: "arsenal_hub_documental",
              auto_cadastro: false,
              ...(form.tipo_documento === "comprovante_residencia" ? (() => {
                const cpfDoc = String(classificacao.camposExtraidos?.cpf || "").replace(/\D/g, "");
                const cpfCliente = String(clienteCpf || "").replace(/\D/g, "");
                const titularNome = classificacao.camposExtraidos?.nome_completo || null;
                const leituraCpf = lerCpfDocumento(classificacao.camposExtraidos?.cpf);
                // CPF-01: quando o CPF vem mascarado, a titularidade é a que o
                // cliente confirmou pelo confronto dos dígitos visíveis.
                const emNomeDoCliente = avaliacaoTitular
                  ? avaliacaoTitular.resultado === "propria"
                  : !!(cpfDoc && cpfCliente && cpfDoc === cpfCliente);
                return {
                  comprovante_residencia_cpf_titular: cpfDoc || null,
                  comprovante_residencia_cpf_estado_leitura: leituraCpf.estado,
                  comprovante_residencia_cpf_padrao_impresso: leituraCpf.padrao,
                  comprovante_residencia_cpf_confirmado_cliente: cpfConfrontado,
                  comprovante_residencia_titularidade: avaliacaoTitular?.resultado ?? null,
                  comprovante_residencia_titularidade_motivo: avaliacaoTitular?.motivo ?? null,
                  comprovante_residencia_origem_leitura: avaliacaoTitular ? "parser" : "ia",
                  comprovante_residencia_em_nome_do_cliente: emNomeDoCliente,
                  comprovante_residencia_nome_titular: titularNome,
                  // Se não está no nome do cliente, declaracao_responsavel_imovel será exigida ao iniciar serviço
                  comprovante_residencia_exige_declaracao_responsavel:
                    !emNomeDoCliente && (avaliacaoTitular?.resultado === "terceiro" || !!cpfDoc),
                };
              })() : {}),
              revisao_humana: true,
              documento_expirado: docExpirado,
              // Conformidade cruzada para TODOS os tipos — não só certidões.
              // A trigger qa_doc_auto_aprovar_por_ia lê `tem_divergencia` para
              // decidir se pode aprovar sozinha: sem isso ela aprovaria pela
              // qualidade da leitura, sem saber se o documento é do cliente.
              conformidade_cruzada: conformidade.map(i => ({
                campo: i.campo,
                status: i.status,
                valor_certidao: i.valorCertidao,
                valor_referencia: i.valorReferencia,
                fonte_referencia: i.fonteReferencia,
              })),
              // Só nome e CPF bloqueiam a aprovação automática: são o que define
              // se o documento é DO CLIENTE. Naturalidade, filiação e sexo variam
              // legitimamente entre emissores (a certidão do TSE traz domicílio
              // eleitoral, a CNH traz o município de nascimento) — bloquear por
              // eles reprovaria documento correto e o checklist voltaria a pedir
              // algo que o cliente já entregou. As demais divergências continuam
              // gravadas em conformidade_cruzada para a equipe revisar.
              tem_divergencia: conformidade.some(
                (i) => i.status === "divergente" && (i.campo === "nome_completo" || i.campo === "cpf"),
              ),
              divergencias_secundarias: conformidade
                .filter((i) => i.status === "divergente" && i.campo !== "nome_completo" && i.campo !== "cpf")
                .map((i) => i.campo),
              // Específicos de certidão
              ...(TIPOS_CERTIDAO.has(form.tipo_documento) ? {
                resultado_certidao: classificacao.camposExtraidos?.resultado_certidao || null,
                // Certidão com apontamento criminal
                ...(temApontamento ? {
                  apontamento_criminal: true,
                  apontamento_reconhecido: reconheceApontamento,
                  declaracao_homonimia_salva: homonimiaSalva,
                } : {}),
              } : {}),
              campos_sensiveis: {
                numero_documento: buildFieldAudit("numero_documento", form.numero_documento || null),
                numero_cad_sinarm: buildFieldAudit("numero_cad_sinarm", form.numero_cad_sinarm || null),
                numero_registro_sigma: buildFieldAudit("numero_registro_sigma", form.numero_registro_sigma || null),
                arma_numero_serie: buildFieldAudit("arma_numero_serie", form.arma_numero_serie || null),
                arma_marca: buildFieldAudit("arma_marca", form.arma_marca || null),
                arma_modelo: buildFieldAudit("arma_modelo", form.arma_modelo || null),
                arma_calibre: buildFieldAudit("arma_calibre", form.arma_calibre || null),
                data_validade: buildFieldAudit("data_validade", form.data_validade || null),
                sistema_registro: buildFieldAudit("sistema_registro", form.sistema_registro || null),
              },
              ...(parserBloco ?? {}),
            }
          // Sem IA, mas com parser: grava só o do parser. Antes disto, o
          // documento lido localmente era salvo com ia_dados_extraidos = null
          // e nada do que o parser leu sobrevivia.
          : parserBloco,
      };

      // Residência em nome de terceiro: grava o titular real do imóvel e a
      // declaração do cliente. A divergência de nome deixa de ser bloqueio.
      if (terceiroDados) {
        payload.endereco_em_nome_de_terceiro = true;
        payload.titular_comprovante_nome = terceiroDados.responsavel_nome;
        payload.titular_comprovante_documento = terceiroDados.responsavel_documento;
        payload.ia_dados_extraidos = {
          ...(payload.ia_dados_extraidos ?? {}),
          residencia_terceiro: terceiroDados,
          tem_divergencia: false,
          // REGRA (qualquer processo que use o grupo de comprovação de
          // endereço): comprovante em nome de terceiro NÃO cumpre a exigência
          // sozinho. Ele fica aguardando até a Declaração do Responsável pelo
          // Imóvel ser enviada assinada no GOV.BR e validada. Só então o
          // comprovante é aprovado (feito pela função qa-declaracao-residencia).
          recomendacao: "revisar",
          aguardando_declaracao_responsavel: true,
        };
      }

      // Fluxo de aprovação:
      // - admin: aprovado direto
      // - cliente: sempre insere como pendente_aprovacao (RLS exige)
      //   a trigger qa_doc_auto_aprovar_por_ia_trigger promove para aprovado
      //   no servidor quando ia_dados_extraidos.recomendacao = 'aceitar'
      const isStaff = await isCurrentUserStaff();
      // Foto 3x4 não contém nome, CPF ou texto para cruzamento cadastral. A
      // validação correta é determinística: imagem aceita enviada no slot
      // exclusivo de Foto 3x4. A recomendação genérica que veio da leitura
      // inicial nunca pode transformar a ausência de texto em divergência.
      const ehFoto3x4Deterministica =
        form.tipo_documento === "foto_3x4" &&
        !!file &&
        file.type.toLowerCase().startsWith("image/");
      // Documentos vencidos são aceitos como histórico — a rejeição para uso em
      // processos acontece no checklist, não no upload. Só bloqueiam revisão humana
      // documentos com apontamento criminal ou divergência de dados do cliente.
      const divergenciaBloqueante = conformidade.some((item) => {
        if (item.status !== "divergente") return false;
        // CCMEI é liberado exclusivamente por nome, CPF e situação ATIVA.
        // CNPJ/razão/CNAE extraídos passam a ser a referência empresarial para
        // QSA e nota fiscal; um cadastro empresarial antigo não pode reprovar o
        // certificado oficial correto do mesmo titular.
        if (form.tipo_documento === "renda_ccmei") {
          return ["nome_completo", "cpf", "situacao_cadastral"].includes(item.campo);
        }
        return true;
      });
      const bloqueioRevisao =
        !ehFoto3x4Deterministica &&
        (temApontamento || (!terceiroDados && divergenciaBloqueante));
      const iaConfia =
        ehFoto3x4Deterministica ||
        (!bloqueioRevisao && !terceiroDados && (
          classificacao?.recomendacao === "aceitar" ||
          // Leitura local determinística aprovada vale como decisão automática.
          (!classificacao && conferenciaLocal?.conf?.veredicto === "aprovado")
        ));

      // Sem leitura automática concluída não há decisão possível: o documento
      // NÃO é salvo (evita a fila fantasma de "em análise") e o cliente recebe
      // o carimbo de reprovado com o motivo real.
      if (!ehEfetivaNecessidade && !isStaff && !terceiroDados && !classificacao && !conferenciaLocal?.doc) {
        throw new Error(
          "Não conseguimos ler este arquivo. Envie o PDF original emitido pelo órgão (não use foto nem print) para conferirmos com o seu cadastro.",
        );
      }
      // Divergência ou apontamento: reprova na hora, com o motivo, em vez de
      // mandar para conferência humana.
      if (!ehEfetivaNecessidade && !isStaff && !terceiroDados && !iaConfia) {
        const motivos = conformidade
          .filter((i) => i.status === "divergente")
          .map((i) => explicarDivergencia(i))
          .join(" ");
        // RASTRO: sem isto, um bloqueio de prévia não deixava nenhum registro e
        // só era diagnosticável por print do cliente.
        trackTelemetria({
          event_type: "divergencia_confirmada",
          payload: {
            origem: "hub_documental",
            tipo_documento: form.tipo_documento || null,
            apontamento: !!temApontamento,
            campos: conformidade
              .filter((i) => i.status === "divergente")
              .map((i) => ({
                campo: i.campo,
                no_documento: i.valorCertidao,
                na_referencia: i.valorReferencia,
                fonte: i.fonteReferencia,
              })),
          },
        });
        throw new Error(
          temApontamento
            ? `${tipoLabel} apresenta apontamento. Regularize ou registre a declaração de homonímia antes de enviar.`
            : motivos ||
              `${tipoLabel} não confere com os seus dados de cadastro. Confira o documento e envie novamente.`,
        );
      }
      if (isStaff && !terceiroDados) {
        payload.status = "aprovado";
        payload.origem = "admin";
        payload.validado_admin = true;
        payload.aprovado_em = new Date().toISOString();
      } else {
        payload.status = "pendente_aprovacao";
        payload.origem = isStaff ? "admin" : "cliente";
        payload.validado_admin = false;
      }

      // Documento do MESMO TIPO já entregue: NÃO salva. O envio é bloqueado e o
      // cliente é avisado para excluir o documento anterior antes de enviar o
      // correto. Salvar por cima gerava duas linhas aprovadas do mesmo tipo
      // (ex.: dois cartões CNPJ) — a PF exige um só.
      // Renovação: o documento aprovado do mesmo tipo já não cobre a exigência
      // (venceu ou é de outro ano de competência). O envio novo entra como
      // SUBSTITUIÇÃO do antigo — o mesmo caminho do botão "Renovar" do Hub.
      // Sem isto o cliente ficava travado entre um checklist que pedia o
      // documento e um Hub que recusava o documento por já existir o vencido.
      const alvoSubstituicao: string | null =
        substituirDocumentoId ?? (renovacaoAlvo?.id ? String(renovacaoAlvo.id) : null);
      if (!alvoSubstituicao && qaClienteId && form.tipo_documento) {
        const { data: jaEnviados } = await supabase
          .from("qa_documentos_cliente" as any)
          .select("id, status")
          .eq("qa_cliente_id", qaClienteId)
          .eq("tipo_documento", form.tipo_documento)
          .in("status", ["aprovado", "pendente_aprovacao"])
          .limit(5);
        const linhas = ((jaEnviados as any[]) || []);
        const jaAprovado = linhas.some((l) => String(l.status) === "aprovado");
        if (jaAprovado) {
          throw new Error(
            "Este documento já foi enviado e consta no seu Hub Documental. Exclua o documento anterior e envie o correto no lugar.",
          );
        }
        // Ainda não aprovado (pendente de análise): o novo envio SUBSTITUI a
        // tentativa anterior — não faz sentido travar o cliente por um
        // documento que ninguém aprovou.
        for (const l of linhas) {
          await supabase
            .from("qa_documentos_cliente" as any)
            .delete()
            .eq("id", l.id);
        }
      }
      if (alvoSubstituicao) {
        payload.substitui_documento_id = alvoSubstituicao;
      }
      // Último ponto antes do banco: slug aposentado vira o slug vivo. Sem isto
      // o CHECK devolve erro cru de constraint para o cliente (14/08/2026, NF).
      payload.tipo_documento = normalizeTipoDocumentoParaBanco(payload.tipo_documento);
      const { data: inserted, error: insertError } = await supabase
        .from("qa_documentos_cliente" as any)
        .insert(payload)
        .select("id")
        .single();
      if (insertError) throw insertError;
      const novoDocId = (inserted as any)?.id as string | undefined;
      if (terceiroDados) setComprovanteDocId(novoDocId ?? null);
      // Golden Record da nota fiscal (grupo de ocupação lícita): tabela própria
      // com cabeçalho da DANFSe + descrição do serviço já parseada.
      if (conferenciaLocal?.doc?.orgao === "nota_fiscal") {
        // Quando a nota entrou pelo XML sabemos o modelo com certeza; quando
        // veio de PDF, o Golden Record deduz pela chave. NF-e e NFS-e dividem
        // a tabela e não podem ficar indistinguíveis.
        const notaDoXml = notaXmlRef.current?.nota;
        void salvarNotaFiscalGoldenRecord({
          campos: conferenciaLocal.doc,
          clienteId: qaClienteId ?? null,
          documentoId: novoDocId ?? null,
          // Texto integral do que foi lido. Quando a nota entrou pelo XML, é
          // ele que fica guardado — o registro de origem da leitura.
          textoBruto: conferenciaLocal.texto ?? null,
          modelo: notaDoXml?.modelo ?? null,
          naturezaOperacao: notaDoXml?.naturezaOperacao ?? null,
          protocoloAutorizacao: notaDoXml?.protocolo ?? null,
          serie: notaDoXml?.serie ?? null,
          valorProdutos: notaDoXml?.valorProdutos ?? null,
        });
      }
      if (isStaff && novoDocId) {
        await notificarDocumentoHubAprovado(novoDocId);
        if (conferenciaLaudo?.veredicto === "aprovado_com_alerta_interno") {
          alertarEquipeSobreLaudo(
            novoDocId,
            conferenciaLaudo.achados.filter((a) => a.interno).map((a) => a.mensagem).join(" "),
            refClienteNome,
          );
        }
      }

      // Vale para envio do cliente E da equipe: o gatilho do Hub reaproveita o
      // documento nas exigências dos processos abertos, e é esse lote que
      // precisa virar aviso — sem ele o cliente acha que nada aconteceu.
      void notificarReaproveitamentosPendentes(qaClienteId);

      // Substituição: marca o documento antigo como 'substituido' e vincula
      // o novo. Assim o antigo sai das listagens e o histórico fica
      // preservado (soft delete com trilha).
      if (alvoSubstituicao && novoDocId) {
        const { error: subErr } = await supabase
          .from("qa_documentos_cliente" as any)
          .update({
            status: "substituido",
            substituido_em: new Date().toISOString(),
            substituido_por_documento_id: novoDocId,
          })
          .eq("id", alvoSubstituicao);
        if (subErr) console.warn("[hub] falha ao marcar documento anterior como substituído:", subErr);
      }

      // Promoção para o Arsenal operacional (qa_crafs) quando o documento for
      // CRAF/SINARM com identificador físico da arma. Sem isso, a arma fica
      // presa no Hub Documental e o card "ARSENAL · 5 Frentes" não a exibe
      // (a frente lê de qa_crafs, não de qa_documentos_cliente).
      try {
        const tipoArma = form.tipo_documento;
        const ehArmaRegistro = tipoArma === "craf" || tipoArma === "sinarm";
        const serie = (form.arma_numero_serie || "").trim().toUpperCase();
        const numSigma = (form.numero_registro_sigma || "").trim().toUpperCase();
        const numCadSinarm = (form.numero_cad_sinarm || "").trim().toUpperCase();
        if (qaClienteId && ehArmaRegistro && (serie || numSigma)) {
          const sistema = (form.sistema_registro || (tipoArma === "craf" ? "SIGMA" : "SINARM")).toUpperCase();
          const nomeArma = [form.arma_marca, form.arma_modelo, form.arma_calibre]
            .map((v) => (v || "").trim()).filter(Boolean).join(" ").toUpperCase() || "ARMA";
          const buscaTecnica = [form.arma_marca, form.arma_modelo, form.arma_calibre]
            .map((v) => (v || "").trim()).filter(Boolean).join(" ").toUpperCase().replace(/[^A-Z0-9]+/g, "");
          const tecnica = buscaTecnica.includes("TAURUS") && buscaTecnica.includes("TX22")
            ? { funcionamento: "Blowback", gatilho: "SAO (ação simples apenas)" }
            : { funcionamento: null, gatilho: null };
          const { data: existentes } = await supabase
            .from("qa_crafs")
            .select("id, numero_arma, numero_sigma")
            .eq("cliente_id", qaClienteId);
          const dup = (existentes || []).find((e: any) => {
            const s = String(e.numero_arma || "").trim().toUpperCase();
            const g = String(e.numero_sigma || "").trim().toUpperCase();
            return (serie && s === serie) || (numSigma && g === numSigma);
          });
          if (dup) {
            const patch: Record<string, unknown> = {
              sistema_registro: sistema,
              ...(form.data_validade ? { data_validade: form.data_validade } : {}),
              ...(nomeArma ? { nome_arma: nomeArma } : {}),
              ...(serie ? { numero_arma: serie } : {}),
              ...(numSigma ? { numero_sigma: numSigma, numero_registro_sigma: numSigma } : {}),
              ...(numCadSinarm ? { numero_cad_sinarm: numCadSinarm } : {}),
              ...(form.arma_especie ? { arma_especie: form.arma_especie.toUpperCase() } : {}),
              ...(tecnica.funcionamento ? { funcionamento: tecnica.funcionamento } : {}),
              ...(tecnica.gatilho ? { gatilho: tecnica.gatilho } : {}),
            };
            await supabase.from("qa_crafs").update(patch).eq("id", (dup as any).id);
          } else {
            await supabase.from("qa_crafs").insert({
              cliente_id: qaClienteId,
              nome_arma: nomeArma,
              nome_craf: (form.numero_documento || "").toUpperCase() || null,
              numero_arma: serie || null,
              numero_sigma: numSigma || null,
              numero_cad_sinarm: numCadSinarm || null,
              numero_registro_sigma: sistema === "SIGMA" ? numSigma || null : null,
              sistema_registro: sistema,
              funcionamento: tecnica.funcionamento,
              gatilho: tecnica.gatilho,
              arma_especie: form.arma_especie ? form.arma_especie.toUpperCase() : null,
              data_validade: form.data_validade || null,
              arquivo_storage_path: storagePath,
              arquivo_nome: fileName,
              arquivo_mime: mime,
            });
          }
        }
      } catch (promErr) {
        console.warn("[arsenal promote] falha não-crítica:", promErr);
      }

      // Auto-sincroniza com qa_exames_cliente quando o documento for um
      // laudo psicológico ou atestado de capacidade técnica (exame de tiro).
      // O card EXAMES do Resumo lê dessa tabela — sem este upsert ele fica em 0.
      // Regra Lei 10.826/03: vencimento = data_avaliacao + 1 ano.
      try {
        const t = form.tipo_documento.toLowerCase();
        const isLaudoExameTipo = /laudo|exame|capacidade_tecnica|psicotecnico|psicologico/i.test(t);
        if (qaClienteId && isLaudoExameTipo) {
          const tipoExame: "psicologico" | "tiro" | null = /psico|laudo_psi|psicotec/.test(t)
            ? "psicologico"
            : /capacidade_tecnica|exame_tiro|tiro/.test(t)
              ? "tiro"
              : null;
          const dataRealizacao =
            (classificacao?.camposExtraidos as any)?.data_avaliacao ||
            form.data_emissao ||
            null;
          const dataIso = (() => {
            if (!dataRealizacao) return null;
            // aceita 'YYYY-MM-DD' direto ou 'DD/MM/AAAA'
            if (/^\d{4}-\d{2}-\d{2}$/.test(dataRealizacao)) return dataRealizacao;
            const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataRealizacao);
            return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
          })();
          if (tipoExame && dataIso) {
            const [y, mo, d] = dataIso.split("-").map(Number);
            const venc = new Date(Date.UTC(y + 1, mo - 1, d)).toISOString().slice(0, 10);
            // Substitui o exame vigente do mesmo tipo (mantém um por tipo).
            await supabase
              .from("qa_exames_cliente" as any)
              .delete()
              .eq("cliente_id", qaClienteId)
              .eq("tipo", tipoExame);
            await supabase.from("qa_exames_cliente" as any).insert({
              cliente_id: qaClienteId,
              tipo: tipoExame,
              data_realizacao: dataIso,
              data_vencimento: venc,
              observacoes: `Sincronizado automaticamente do Hub Documental (${form.tipo_documento}).`,
            });
          }
        }
      } catch (syncErr) {
        console.warn("[exames sync] falha não-crítica:", syncErr);
      }

      // Recálculo, eventos (documento_recebido / todos_documentos_recebidos),
      // cópia de campos para qa_clientes (titulo_eleitor, etc.) e e-mail são
      // disparados por triggers SECURITY DEFINER no banco.

      docSalvoRef.current = true;
      // IDENTIDADE ÚNICA: o slot pedia CIN e veio CNH (ou vice-versa). O
      // documento é gravado com o tipo REAL lido; mandamos revalidar as
      // exigências para o checklist não continuar cobrando a outra via.
      if (
        qaClienteId &&
        expectedTipoMeta &&
        form.tipo_documento !== expectedTipoMeta.value &&
        mesmaExigenciaIdentidade(form.tipo_documento, expectedTipoMeta.value)
      ) {
        try {
          await supabase.rpc("qa_processo_rever_exigencias" as any, { p_cliente_id: qaClienteId });
        } catch (e) {
          console.warn("[identidade-unica] falha ao revalidar exigências", e);
        }
      }
      setResultadoCarimbo(
        terceiroDados
          ? {
              tipo: "analise",
              mensagem:
                "Conta recebida. A exigência de comprovante de endereço SÓ será concluída após você enviar a Declaração do Responsável pelo Imóvel assinada no GOV.BR.",
            }
          : isStaff || iaConfia
          ? {
              tipo: "aprovado",
              mensagem: `${tipoLabel} conferido com o seu cadastro · exigência atendida`,
              percentual:
                classificacao?.confianca != null ? Math.round((classificacao.confianca || 0) * 100) : null,
            }
          : {
              tipo: "analise",
              mensagem: ehEfetivaNecessidade
                ? `${tipoLabel} recebido · a equipe vai analisar a efetiva necessidade e você será avisado`
                : `${tipoLabel} recebido · aguardando conferência`,
            }
      );

      // Residência de terceiro: o comprovante fica AGUARDANDO e o pop-up guiado
      // da Declaração do Responsável pelo Imóvel abre em seguida. A exigência do
      // grupo de endereço permanece aberta até a declaração assinada ser validada.
      if (terceiroDados) setDeclaracaoAberta(true);
    } catch (e: any) {
      console.error("[save doc] error:", e);
      setResultadoCarimbo({
        tipo: "reprovado",
        mensagem: e?.message
          ? `Não foi possível salvar: ${e.message}`
          : "Falha ao salvar o documento · tente enviar novamente",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleAssinarHomonimia() {
    if (!customerId && !qaClienteId) return;
    const hoje = new Date().toLocaleDateString("pt-BR");
    const nomeCliente = clienteNome || "Requerente";
    const cpfCliente = clienteCpf ? clienteCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "não informado";
    const nascimento = clienteDataNascimento
      ? (() => {
          const d = new Date(clienteDataNascimento + "T00:00:00");
          return d.toLocaleDateString("pt-BR");
        })()
      : "não informado";
    const tipoCertidaoLabel = getNomeDocumentoDisplay({ tipo_documento: form.tipo_documento, nome_documento: form.nome_documento, numero_documento: form.numero_documento, orgao_emissor: form.orgao_emissor }, form.tipo_documento);

    const texto = [
      "DECLARAÇÃO DE HOMONÍMIA",
      "",
      `Eu, ${nomeCliente}, portador(a) do CPF ${cpfCliente}, nascido(a) em ${nascimento}, venho por meio desta declaração afirmar que NÃO possuo qualquer vínculo com o apontamento constante na ${tipoCertidaoLabel}.`,
      "",
      "Declaro que as informações do referido apontamento não me pertencem, tratando-se de homonímia com outra pessoa de nome semelhante, e que não pratiquei qualquer ato que possa fundamentar tal registro.",
      "",
      "Declaro ainda estar ciente das penalidades legais decorrentes de declaração falsa, nos termos do Art. 299 do Código Penal Brasileiro.",
      "",
      `${hoje}`,
      "",
      `Assinante: ${nomeCliente}`,
      `CPF: ${cpfCliente}`,
    ].join("\n");

    try {
      const payload: any = {
        customer_id: customerId ?? null,
        qa_cliente_id: qaClienteId ?? null,
        tipo_documento: "declaracao_homonimia",
        categoria_hub: "declaracoes",
        numero_documento: null,
        orgao_emissor: "Declaração própria",
        data_emissao: new Date().toISOString().slice(0, 10),
        data_validade: null,
        observacoes: texto,
        status: "pendente_aprovacao",
        origem: "cliente",
        validado_admin: false,
        ia_status: "nao_processado",
        ia_dados_extraidos: {
          origem_fluxo: "declaracao_homonimia_automatica",
          certidao_origem: form.tipo_documento,
          gerado_em: new Date().toISOString(),
        },
      };
      const { error } = await supabase.from("qa_documentos_cliente" as any).insert(payload);
      if (error) throw error;
      setHomonimiaSalva(true);
      toast.success("Declaração de homonímia registrada no seu Hub. A equipe irá analisar.");
      onSaved();
    } catch (e: any) {
      toast.error("Erro ao salvar declaração: " + (e?.message || "tente novamente."));
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) void handleFileChange(droppedFile);
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        style={modalTheme}
        // z-[130]: o Dialog do shadcn nasce em z-50, mas o portal do cliente
        // tem a barra lateral em z-50 e outros modais em z-[125]. Empatando,
        // quem vem depois no DOM ganha — era por isso que o avatar do cliente
        // e o botão de fechar apareciam POR CIMA do modal.
        className="z-[130] w-[calc(100vw-1rem)] max-w-xl md:max-w-[960px] lg:max-w-[1320px] xl:max-w-[1400px] rounded-2xl border border-[#E5E5E5] bg-white p-0 text-[#0A0A0A] shadow-2xl max-h-[92dvh] overflow-hidden gap-0 flex flex-col [&>button.absolute]:hidden font-sans"
      >
        <div className="shrink-0 border-b-2 border-[#2F3337] bg-white px-4 py-2.5 sm:px-6 sm:py-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[#2F3337]/10 text-[#2F3337]">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.4} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-0.5 font-heading text-[10px] font-semibold uppercase tracking-[0.32em] text-[#2F3337]">
                Hub documental
              </div>
              <h2 className="font-heading text-[22px] font-bold uppercase leading-none tracking-[0.06em] text-[#0A0A0A]">
                Adicionar Documento
              </h2>
              <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-[#4A4A4A]">
                {instrucaoAnexoPorTipo(form.tipo_documento)}
              </p>
            </div>

            {grupoBloqueadoTrava ? (
              <div
                className="hidden sm:flex shrink-0 -rotate-6 items-center gap-1.5 border-2 border-[#2F3337] bg-[#F7F7F8] px-3 py-1.5 text-[#2F3337]"
                style={{ boxShadow: "0 0 0 2px rgba(47,51,55,0.15)" }}
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="font-heading text-[11px] font-bold uppercase tracking-[0.14em]">
                  Etapa ainda bloqueada
                </span>
              </div>
            ) : certidaoIncorreta ? (
              <div
                className="hidden sm:flex shrink-0 -rotate-6 items-center gap-1.5 border-2 border-red-600 bg-red-50 px-3 py-1.5 text-red-700"
                style={{ boxShadow: "0 0 0 2px rgba(220,38,38,0.15)" }}
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="font-heading text-[11px] font-bold uppercase tracking-[0.14em]">
                  Certidão incorreta
                </span>
              </div>
            ) : cobreOutraPendencia ? (
              <div className="hidden sm:flex shrink-0 items-center gap-1.5 border-2 border-sky-600 bg-sky-50 px-3 py-1.5 text-sky-800">
                <Sparkles className="h-4 w-4" />
                <span className="font-heading text-[11px] font-bold uppercase tracking-[0.14em]">
                  Reclassificado
                </span>
              </div>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#2F3337] bg-[#2F3337] text-white transition-colors hover:bg-[#222528] hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white px-4 py-3 sm:px-6 sm:py-4 [-webkit-overflow-scrolling:touch]">
          {/* R43 — Ficha catalográfica: DOSSIÊ · PREVIEW · DADOS */}
          {/* Em mobile: flex-col para poder reordenar upload zone e observações via CSS order.
              Quando não há arquivo: upload zone sobe (order-2) e observações desce (order-3).
              Quando há arquivo: mantém a ordem natural (observações-order-2, preview-order-3).
              Em desktop (md+): grid de 3 colunas, order não é usado. */}
          <div className="flex flex-col gap-5 pb-4 md:grid md:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(0,360px)] md:gap-4 md:items-stretch lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,420px)] lg:gap-5 [&>*]:md:[order:0]">
          {/* ───────── COL 1 · DOSSIÊ ───────── */}
          <div className="space-y-3 md:flex md:flex-col md:border-r md:border-[#EFEFEF] md:pr-4 lg:pr-5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="font-heading text-[10px] font-bold uppercase tracking-[0.28em] text-[#7A7A7A]">
                Dossiê
              </div>
              {classificacao && tipoAtual ? (
                <span className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-[#2F3337]">
                  {tipoAtual.short}
                </span>
              ) : null}
            </div>
            <div className="font-heading text-[13px] font-bold uppercase leading-tight tracking-[0.06em] text-[#0A0A0A]">
              {(classificacao ? tipoAtual?.label : null) ||
                expectedTipoMeta?.label ||
                tipoAtual?.label ||
                "Aguardando classificação"}
            </div>
            {expectedTipoMeta ? (
              <div className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-[#2F3337]">
                Exigência:{" "}
                {ehDocumentoIdentidade(expectedTipoMeta.value, expectedTipoMeta.label)
                  ? "Documento oficial de identidade (CIN, CNH ou RG com CPF)"
                  : expectedTipoMeta.label}
              </div>
            ) : null}
            {notaTomadorParentesco ? (
              <div className="mt-1 flex items-start gap-1.5 border-2 border-red-600 bg-red-50 p-2 text-[10px] leading-snug text-red-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <div className="font-bold uppercase tracking-[0.08em]">
                    Rejeitado · grau de parentesco no mesmo endereço
                  </div>
                  <div>
                    A nota foi emitida para <b>{tomadorInfo?.valorCertidao}</b>, que tem o mesmo
                    sobrenome de família do prestador (<b>{tomadorInfo?.valorReferencia}</b>) e
                    consta no <b>mesmo endereço</b>
                    {tomadorEnderecoInfo?.valorCertidao ? <> (<b>{tomadorEnderecoInfo.valorCertidao}</b>)</> : null}.
                    Nota entre parentes da mesma casa <b>não comprova ocupação lícita</b> e não será
                    salva. Envie uma nota emitida para um cliente sem vínculo familiar e com
                    endereço diferente do seu.
                  </div>
                </div>
              </div>
            ) : casoResidenciaTerceiro ? (
              <div className="mt-1 flex items-start gap-1.5 border-2 border-amber-500 bg-amber-50 p-2 text-[10px] leading-snug text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <div className="font-bold uppercase tracking-[0.08em]">
                    Conta em nome de outro titular · não reprovado
                  </div>
                  <div>
                    A conta está em nome de <b>{titularComprovanteLido || "outra pessoa"}</b>. Isso
                    <b> não reprova</b> o comprovante — a Polícia Federal só precisa saber onde você
                    tem <b>residência fixa</b>. Confirme que mora neste endereço e envie o documento
                    de identidade do responsável pelo imóvel: o cruzamento final é feito nesse
                    último envio.
                  </div>
                </div>
              </div>
            ) : titularDivergente ? (
              <div className="mt-1 flex items-start gap-1.5 border-2 border-red-600 bg-red-50 p-2 text-[10px] leading-snug text-red-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <div className="font-bold uppercase tracking-[0.08em]">
                    {parentescoDetectado
                      ? "Rejeitado · documento de familiar (parentesco)"
                      : "Rejeitado · documento de outro titular"}
                  </div>
                  <div>
                    {parentescoDetectado ? (
                      <>O documento está em nome de um <b>familiar</b> (mesmo sobrenome de família),
                      não do interessado. Documento de parente não é aceito.{" "}</>
                    ) : null}
                    Os dados lidos no documento <b>não são do interessado</b> deste processo
                    (nome e/ou CPF divergem do cadastro). O documento não será salvo nem
                    enviado para análise. Anexe o documento em nome do próprio titular
                    {expectedTipoMeta ? <> (<b>{expectedTipoMeta.label}</b>)</> : null}.
                  </div>
                </div>
              </div>
            ) : grupoBloqueadoTrava ? (
              <div className="mt-1 flex items-start gap-1.5 border-2 border-[#2F3337] bg-[#F7F7F8] p-2 text-[10px] leading-snug text-[#222528]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <div className="font-bold uppercase tracking-[0.08em]">Etapa ainda bloqueada</div>
                  <div>{mensagemGrupoBloqueado}</div>
                </div>
              </div>
            ) : arquivoRepetido ? (
              <div className="mt-1 flex items-start gap-1.5 border-2 border-red-600 bg-red-50 p-2 text-[10px] leading-snug text-red-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <div className="font-bold uppercase tracking-[0.08em]">
                    Rejeitado · arquivo já enviado antes
                  </div>
                  <div>{mensagemArquivoRepetido(arquivoRepetido, expectedTipoMeta?.label ?? null)}</div>
                </div>
              </div>
            ) : rejeitadoDuplicidade ? (
              <div className="mt-1 flex items-start gap-1.5 border-2 border-red-600 bg-red-50 p-2 text-[10px] leading-snug text-red-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <div className="font-bold uppercase tracking-[0.08em]">Rejeitado · documento em duplicidade</div>
                  <div>
                    A IA identificou <b>{tipoAtual?.label || form.tipo_documento}</b> e esse
                    documento <b>já consta aprovado</b> no seu Hub Documental. Não será salvo
                    nem enviado para análise. Exclua o anterior se quiser substituí-lo, ou
                    anexe o documento realmente exigido
                    {expectedTipoMeta ? <> (<b>{expectedTipoMeta.label}</b>)</> : null}.
                  </div>
                </div>
              </div>
            ) : avisoRenovacao && leituraConcluida ? (
              <div className="mt-1 flex items-start gap-1.5 border border-emerald-300 bg-emerald-50 p-2 text-[10px] leading-snug text-emerald-900">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <div className="font-bold uppercase tracking-[0.08em]">Renovação do documento</div>
                  <div>
                    {avisoRenovacao} O anterior fica guardado no histórico — você
                    não precisa excluir nada.
                  </div>
                </div>
              </div>
            ) : cobreOutraPendencia ? (
              <div className="mt-1 flex items-start gap-1.5 border border-sky-300 bg-sky-50 p-2 text-[10px] leading-snug text-sky-900">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <div className="font-bold uppercase tracking-[0.08em]">Reclassificado automaticamente</div>
                  <div>
                    O slot pedia <b>{expectedTipoMeta?.label}</b>, mas o documento anexado é
                    <b> {tipoAtual?.label || form.tipo_documento}</b> — e essa certidão também
                    está pendente no seu processo. Vamos salvá-la nesse tipo correto e
                    seguir cobrando a outra separadamente.
                  </div>
                </div>
              </div>
            ) : certidaoIncorreta ? (
              <div className="mt-1 flex items-start gap-1.5 border-2 border-red-500 bg-red-50 p-2 text-[10px] leading-snug text-red-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <div className="font-bold uppercase tracking-[0.08em]">Certidão incorreta</div>
                  <div>
                    O documento anexado é <b>{tipoAtual?.label || form.tipo_documento}</b>,
                    mas o slot pedia <b>{expectedTipoMeta?.label}</b> — e a certidão enviada
                    não é exigida em nenhuma outra pendência deste processo. Anexe o
                    documento correto.
                  </div>
                </div>
              </div>
            ) : tipoDivergenteExigencia ? (
              <div className="mt-1 flex items-start gap-1.5 border border-amber-300 bg-amber-50 p-2 text-[10px] leading-snug text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <div className="font-bold uppercase tracking-[0.08em]">Documento divergente</div>
                  <div>
                    A IA identificou <b>{tipoAtual?.label || form.tipo_documento}</b>, mas o
                    slot exige <b>{expectedTipoMeta?.label}</b>. Anexe o documento correto ou
                    corrija o Tipo do Documento antes de salvar.
                  </div>
                </div>
              </div>
            ) : null}

            {/* Card de arquivo compacto (apenas quando há arquivo) */}
            {file ? (
              <div className="flex items-center gap-2.5 border border-[#E5E5E5] bg-white p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#F7F7F7] text-[#2F3337]">
                  {file.type.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-heading text-[11px] font-bold uppercase tracking-[0.04em] text-[#0A0A0A]">
                    {file.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[#7A7A7A]">
                    <CheckCircle2 className="h-3 w-3 text-[#2F8F4A]" />
                    {(file.size / 1024).toFixed(0)} KB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center border border-[#E5E5E5] bg-white text-[#7A7A7A] transition-colors hover:border-[#2F3337] hover:text-[#2F3337]"
                  aria-label="Remover arquivo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="border border-dashed border-[#E5E5E5] bg-[#FAFAFA] p-3 text-[11px] leading-relaxed text-[#7A7A7A]">
                Anexe um arquivo no painel ao lado — a IA identifica o tipo e preenche os campos automaticamente.
              </div>
            )}

              <input
                ref={fileInputRef}
                type="file"
                accept={acceptPorTipo(form.tipo_documento)}
                onChange={(event) => void handleFileChange(event.target.files?.[0] || null)}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => void handleFileChange(event.target.files?.[0] || null)}
                className="hidden"
              />

              {!extracting && classificacao && (
                <div
                  className={cn(
                    "rounded-md border p-3",
                    autoResult?.safe === false
                      ? "border-amber-300 bg-amber-50"
                      : autoResult?.safe
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-emerald-300 bg-emerald-50",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {autoResult?.safe === false ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
                    ) : (
                      autoResult?.safe ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" />
                      ) : (
                        <ScanLine className="mt-0.5 h-4 w-4 text-emerald-700" />
                      )
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-[#7A7A7A]">
                        {autoResult?.safe ? "Cadastrado automaticamente no Arsenal" : "Tipo identificado pela IA"}
                      </div>
                      <div className="mt-0.5 font-heading text-[13px] font-bold uppercase tracking-[0.04em] text-[#0A0A0A]">
                        {tipoAtual?.label || form.tipo_documento.toUpperCase()}{" "}
                        <span className="text-xs font-medium text-muted-foreground">
                          · {Math.round((classificacao.confianca || 0) * 100)}% confiança
                        </span>
                      </div>
                      {classificacao.justificativa && (
                        <p className="mt-1 text-xs leading-snug text-muted-foreground">
                          {classificacao.justificativa}
                        </p>
                      )}
                      {autoResult?.safe === false && (
                        <div className="mt-2 rounded-lg bg-amber-100/70 p-2">
                          <p className="text-xs font-semibold text-amber-900">
                            {MOTIVOS[autoResult.motivo] || "Não foi possível cadastrar automaticamente."}
                          </p>
                          {autoResult.campos_faltando?.length ? (
                            <p className="mt-1 text-[11px] text-amber-900">
                              Campos ilegíveis: {autoResult.campos_faltando.join(", ")}
                            </p>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setFile(null);
                              setClassificacao(null);
                              setAutoResult(null);
                              fileInputRef.current?.click();
                            }}
                            className="mt-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-amber-700 px-3 text-xs font-semibold uppercase tracking-wide text-white hover:bg-amber-800"
                          >
                            <Upload className="h-3.5 w-3.5" /> Enviar novamente
                          </button>
                        </div>
                      )}
                      {autoResult?.safe && (
                        <p className="mt-1 text-xs font-semibold text-emerald-800">
                          Tudo certo! O documento já está vinculado ao seu Arsenal.
                        </p>
                      )}
                      {!autoResult?.safe && (
                        <button
                        type="button"
                        onClick={() => setShowTipoOverride((v) => !v)}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-foreground underline-offset-2 hover:underline"
                      >
                        <Pencil className="h-3 w-3" />
                        {showTipoOverride ? "Manter tipo identificado" : "Não é esse tipo? Alterar manualmente"}
                        </button>
                      )}
                      {showTipoOverride && !autoResult?.safe && (
                        <div className="mt-3 space-y-2">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                Categoria
                              </div>
                              <Select value={categoriaHub} onValueChange={(value) => setCategoria(value as HubCategoria)}>
                                <SelectTrigger className={cn(inputClassName, "h-10 rounded-xl text-left text-sm font-medium")}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-border bg-popover text-popover-foreground">
                                  {HUB_CATEGORIAS.map((categoria) => (
                                    <SelectItem
                                      key={categoria.value}
                                      value={categoria.value}
                                      className="focus:bg-muted focus:text-foreground"
                                    >
                                      {categoria.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                Tipo
                              </div>
                              <Select value={form.tipo_documento} onValueChange={(value) => update("tipo_documento", value)}>
                                <SelectTrigger className={cn(inputClassName, "h-10 rounded-xl text-left text-sm font-medium")}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-border bg-popover text-popover-foreground">
                                  {tiposDisponiveis.map((tipo) => (
                                    <SelectItem
                                      key={tipo.value}
                                      value={tipo.value}
                                      className="focus:bg-muted focus:text-foreground"
                                    >
                                      {tipo.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="rounded-xl border border-border bg-background/70 px-3 py-2 text-[11px] text-muted-foreground">
                            {categoriaAtualMeta?.description}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            {/* ── Credenciamento PF do profissional ── */}
            {isLaudoExameTipo && classificacao && (profissionalExtraido.nome || profissionalExtraido.registro) && (
              <div className={cn(
                "rounded-2xl border p-3 text-xs",
                verifLoading
                  ? "border-gray-200 bg-gray-50 text-gray-600"
                  : credenciadoVerificado
                    ? "border-green-300 bg-green-50 text-green-900"
                    : "border-amber-300 bg-amber-50 text-amber-900"
              )}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  {verifLoading ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-gray-400" />
                  ) : credenciadoVerificado ? (
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  )}
                  <span className="font-bold uppercase tracking-wide text-[10px]">
                    {verifLoading
                      ? "Verificando credenciamento PF…"
                      : credenciadoVerificado
                        ? "Profissional credenciado PF ✓"
                        : "Credenciamento PF não confirmado"}
                  </span>
                </div>
                {!verifLoading && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] opacity-80">
                      <span className="font-medium">Laudo:</span>{" "}
                      {profissionalExtraido.nome || "—"}{profissionalExtraido.registro ? ` · ${profissionalExtraido.registro}` : ""}
                    </p>
                    {credenciadoVerificado ? (
                      <p className="text-[10px] opacity-80">
                        <span className="font-medium">Base PF:</span>{" "}
                        {credenciadoVerificado.nome}{credenciadoVerificado.registro ? ` · ${credenciadoVerificado.registro}` : ""}
                        {credenciadoVerificado.cidade
                          ? ` — ${credenciadoVerificado.cidade.replace(/\b\w/g, l => l.toUpperCase()).replace(/\s+\b(\w)/g, (_, l) => ` ${l.toUpperCase()}`)}/${credenciadoVerificado.uf}`
                          : ""}
                      </p>
                    ) : (
                      <p className="text-[10px] opacity-70">
                        Não localizado na base de credenciados da Polícia Federal para este estado. Verifique o registro manualmente.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Psicólogos/instrutores próximos quando laudo vencido ── */}
            {docExpirado && isLaudoExameTipo && classificacao && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                <div className="flex items-center gap-1.5 mb-2">
                  <Crosshair className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                  <span className="font-bold uppercase tracking-wide text-[10px]">
                    {/capacidade_tecnica/i.test(form.tipo_documento) ? "Instrutores de tiro" : "Psicólogos"} próximos (25 km)
                  </span>
                  {psicoLoading && <Loader2 className="h-3 w-3 animate-spin ml-auto text-blue-400" />}
                </div>
                {!psicoLoading && psicoResults.length === 0 && (
                  <p className="text-[10px] opacity-70">
                    {clienteAutoFetch.cep || clienteAutoFetch.cidade
                      ? "Nenhum credenciado encontrado no raio de 25 km. Amplie a busca por estado."
                      : "Endereço do cliente não cadastrado. Não foi possível calcular proximidade."}
                  </p>
                )}
                {!psicoLoading && psicoResults.length > 0 && (
                  <div className="space-y-2 mt-1">
                    {psicoResults.map((p) => {
                      const cidadeFormatada = p.cidade
                        ? p.cidade.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") + (p.uf ? `/${p.uf}` : "")
                        : p.uf || "";
                      const waTel = (p.telefones || []).find(t => /\d{10,11}/.test(t.replace(/\D/g, "")));
                      const waLink = waTel ? `https://wa.me/55${waTel.replace(/\D/g, "")}` : null;
                      return (
                        <div key={p.id} className="flex items-start justify-between gap-2 border-b border-blue-100 pb-1.5 last:border-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="font-semibold text-[11px] truncate">{p.nome}</p>
                            <p className="text-[10px] opacity-70">
                              {p.registro ? `${p.registro} · ` : ""}{cidadeFormatada}
                              {p.distancia_km != null ? <span className="ml-1 text-[10px] bg-blue-100 px-1 py-0.5 rounded">{p.distancia_km.toFixed(1)} km</span> : ""}
                            </p>
                            {p.endereco && <p className="text-[10px] opacity-50 truncate">{p.endereco}</p>}
                          </div>
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg transition-colors"
                            >
                              WhatsApp
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Observações — desktop only (mobile fica abaixo do upload zone) */}
            <div className="hidden md:flex md:flex-1 md:flex-col md:min-h-0 md:space-y-1.5 md:pt-1">
              <div className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-[#7A7A7A]">
                Observações
              </div>
              <Textarea
                value={form.observacoes}
                onChange={(event) => update("observacoes", event.target.value)}
                rows={5}
                placeholder="Se necessário, adicione detalhes complementares."
                className="min-h-[148px] md:flex-1 md:h-full rounded-sm border border-[#E5E5E5] bg-white text-[12px] text-[#0A0A0A] shadow-none placeholder:text-[#9A9A9A] focus-visible:border-[#2F3337] focus-visible:ring-1 focus-visible:ring-[#2F3337]/30 focus-visible:ring-offset-0 resize-none"
              />
            </div>
          </div>

          {/* ───────── COL 2 · PREVIEW (R43) ───────── */}
          {/* Em mobile sem arquivo: sobe (order-2) para ficar antes de Observações.
              Em mobile com arquivo: desce (order-3) para manter layout atual. */}
          <div className={cn(
            "flex flex-col md:h-full md:min-h-0 md:overflow-y-auto",
            file ? "order-3 min-h-[360px]" : "order-2 min-h-[160px] md:min-h-[360px]",
          )}>
            <HubDocPreviewSlot
              file={file}
              confianca={classificacao?.confianca ?? null}
              fileNameDisplay={file?.name}
              onPickFile={() => fileInputRef.current?.click()}
              onPickCamera={() => cameraInputRef.current?.click()}
              permiteCamera={tipoAceitaImagem(form.tipo_documento)}
              onRemove={() => setFile(null)}
              onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              dragOver={dragOver}
              extracting={extracting}
              incorreta={certidaoIncorreta}
              duplicado={rejeitadoDuplicidade}
              motivoRejeicao={motivoRejeicao}
            />
          </div>

          {/* Observações — mobile only, exibida entre upload zone e dados.
              Sem arquivo: desce (order-3) para ficar abaixo do upload zone.
              Com arquivo: sobe (order-2) para manter layout atual (obs antes do preview). */}
          <div className={cn(
            "md:hidden space-y-1.5",
            file ? "order-2" : "order-3",
          )}>
            <div className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-[#7A7A7A]">
              Observações
            </div>
            <Textarea
              value={form.observacoes}
              onChange={(event) => update("observacoes", event.target.value)}
              rows={4}
              placeholder="Se necessário, adicione detalhes complementares."
              className="min-h-[100px] rounded-sm border border-[#E5E5E5] bg-white text-[12px] text-[#0A0A0A] shadow-none placeholder:text-[#9A9A9A] focus-visible:border-[#2F3337] focus-visible:ring-1 focus-visible:ring-[#2F3337]/30 focus-visible:ring-offset-0 resize-none w-full"
            />
          </div>

          {/* ───────── COL 3 · DADOS ───────── */}
          <div className="order-4 space-y-4 md:border-l md:border-[#EFEFEF] md:pl-4 lg:pl-5">
          <div className="space-y-4">
            <SectionTitle title="Dados do documento" />

            {classificacao && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs leading-snug text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-wide">
                      Revise CAMPO A CAMPO antes de salvar
                    </div>
                    <p className="mt-1">
                      A IA leu o documento e sugeriu os valores abaixo. Nenhum dado é cadastrado
                      automaticamente. Clique em <b>Confirmar</b> em cada campo OU corrija manualmente.
                      Pendentes:{" "}
                      <b>{pendingSensitiveKeys().length === 0 ? "—" : pendingSensitiveKeys().join(", ").replace(/_/g, " ")}</b>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Alerta de documento expirado ── */}
            {validadeIndeterminada && (
              <div className="rounded-2xl border border-[#2F3337]/25 bg-[#FAF6F1] p-3 text-xs text-[#3A3A3A]">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#2F3337]">
                  Validade indeterminada
                </div>
                <p className="mt-1 text-[10px]">
                  Este documento declara validade <b>indeterminada</b> — não tem prazo de
                  vencimento. Ele é registrado no Hub Documental <b>sem data de vencimento</b> e
                  não é reprovado por validade.
                </p>
              </div>
            )}
            {docExpirado && (
              (() => {
                return (
                  <div className="rounded-2xl border border-red-400 bg-red-50 p-3 text-xs text-red-900">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                      <span className="font-bold uppercase tracking-wide text-[10px]">
                        Documento vencido — será rejeitado
                      </span>
                      <span className="ml-auto rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-tactical">
                        {new Date(form.data_validade + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px]">
                      A validade deste documento expirou. Documentos vencidos <b>não são aceitos</b> e
                      não entram no Hub Documental. Envie a via atualizada para prosseguir.
                    </p>
                  </div>
                );
              })()
            )}

            {/* ── Painel de conformidade cruzada (todos os documentos) ── */}
            {/* Conferência LOCAL — leitura do PDF sem IA. Quando existe, é ela
                que vale; o painel de conformidade da IA fica para os tipos que
                ainda não têm parser. */}
            {conferenciaLaudo && conferenciaLaudo.perguntasAoCliente.length > 0 && (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
                <div className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-amber-900">
                  Confirme {conferenciaLaudo.perguntasAoCliente.length === 1 ? "esta nota" : "estas notas"}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-amber-900">
                  Você está com o laudo em mãos, então é rápido — e assim a gente registra a
                  sua nota certa, e não um chute nosso.
                </p>
                {/* O cliente não tem por que se importar com um campo do nosso
                    banco. Tem, sim, por que se importar com a própria evolução
                    no tiro — e é isso que a nota vira aqui dentro. */}
                <p className="mt-1.5 text-[11px] leading-snug text-amber-900/90">
                  Suas notas ficam no seu histórico de atirador. A cada novo exame você vê
                  como evoluiu — prova teórica, alvo de 5 e de 7 metros, um ao lado do outro.
                  Depois de um curso ou de um tempo praticando, a diferença aparece em números.
                </p>
                <div className="mt-2 space-y-2">
                  {conferenciaLaudo.perguntasAoCliente.map((q) => (
                    <div key={q.campo}>
                      <label className="block text-[11px] leading-snug text-amber-900">{q.pergunta}</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        value={notasInformadas[q.campo] ?? ""}
                        onChange={(e) =>
                          setNotasInformadas((prev) => ({ ...prev, [q.campo]: e.target.value }))
                        }
                        placeholder={q.valorLido != null ? `lemos ${q.valorLido}` : "digite a nota"}
                        className="mt-1 h-9 w-40 rounded-sm border border-amber-400 bg-white px-2 text-[13px] text-[#0A0A0A]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {conferenciaLocal && (
              <div
                className={
                  conferenciaLocal.conf.veredicto === "rejeitado"
                    ? "rounded-md border border-[#2F3337]/30 bg-[#2F3337]/[0.04] p-3"
                    : conferenciaLocal.conf.veredicto !== "aprovado"
                      ? "rounded-md border border-amber-300 bg-amber-50 p-3"
                      : "rounded-md border border-emerald-300 bg-emerald-50 p-3"
                }
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A7A7A]">
                  Conferência com o cadastro · leitura local
                </p>
                <p
                  className={
                    "mt-1 text-[13px] font-semibold " +
                    (conferenciaLocal.conf.veredicto === "rejeitado"
                      ? "text-[#2F3337]"
                      : conferenciaLocal.conf.veredicto !== "aprovado"
                        ? "text-amber-800"
                        : "text-emerald-800")
                  }
                >
                  {conferenciaLocal.conf.veredicto === "rejeitado"
                    ? "Certidão recusada — não pode ser salva"
                    : conferenciaLocal.conf.veredicto === "cadastro_pendente"
                      ? "Certidão correta — falta dado no cadastro"
                      : conferenciaLocal.conf.veredicto === "revisao_humana"
                        ? "Documento em conferência — leitura automática incompleta"
                        : "Certidão conferida — todos os dados batem"}
                </p>
                {conferenciaLocal.conf.achados.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {conferenciaLocal.conf.achados.map((a, i) => (
                      <li key={i} className="text-[12px] leading-relaxed text-[#3a3a3a]">
                        <span className="font-semibold">{a.label}: </span>
                        {a.noDocumento ? (
                          <>
                            na certidão <strong>{a.noDocumento}</strong>
                            {a.noCadastro ? (
                              <> · no cadastro <strong>{a.noCadastro}</strong></>
                            ) : null}
                            {". "}
                          </>
                        ) : null}
                        {a.mensagem}
                      </li>
                    ))}
                  </ul>
                )}
                {conferenciaLocal.conf.veredicto === "rejeitado" && (
                  <p className="mt-2 text-[11px] text-[#7A7A7A]">
                    O cliente foi avisado por e-mail com o motivo e o passo a passo para emitir novamente.
                  </p>
                )}
              </div>
            )}

            {!conferenciaLocal && conformidadeExibida.length > 0 && (
              <div className={cn(
                "rounded-2xl border p-3 text-xs",
                conformidadeExibida.some(i => i.status === "divergente")
                  ? "border-red-300 bg-red-50 text-red-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
              )}>
                <div className="flex items-center gap-1.5 mb-2">
                  {conformidadeExibida.some(i => i.status === "divergente")
                    ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                    : <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                  <span className="font-bold uppercase tracking-wide text-[10px]">
                    {conferenciaContraCadastro
                      ? "Conferência do que foi digitado na Polícia Federal"
                      : "Conformidade com documentos aprovados"}
                    {conformidadeExibida.some(i => i.fonteReferencia?.includes("equipe")) ? " (dupla verificação)" : ""}
                  </span>
                </div>
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider opacity-60">
                      <th className="text-left pb-1 pr-2 font-semibold">Campo</th>
                      <th className="text-left pb-1 pr-2 font-semibold">
                        {conferenciaContraCadastro ? "Digitado na PF" : "Na certidão"}
                      </th>
                      <th className="text-left pb-1 pr-2 font-semibold">
                        {conferenciaContraCadastro ? "No cadastro" : "Referência"}
                      </th>
                      <th className="text-left pb-1 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                     {conformidadeExibida.map((item) => (
                       <Fragment key={item.campo}>
                       <tr className="align-top">
                        <td className="py-1 pr-2 font-medium text-current opacity-70 whitespace-nowrap">{item.label}</td>
                        <td className="py-1 pr-2 font-tactical">
                          {item.campo === "data_nascimento" ? formatDateBrDisplay(item.valorCertidao) : item.campo === "sexo" ? expandSexo(item.valorCertidao) : item.valorCertidao}
                        </td>
                        <td className="py-1 pr-2 opacity-70">
                          {item.valorReferencia
                            ? <span>
                                {item.campo === "data_nascimento" ? formatDateBrDisplay(item.valorReferencia) : item.campo === "sexo" ? expandSexo(item.valorReferencia) : item.valorReferencia}
                                <br/><span className="opacity-50 text-[10px]">{item.fonteReferencia}</span>
                              </span>
                            : <span className="opacity-40">sem referência</span>}
                        </td>
                        <td className="py-1 whitespace-nowrap">
                          {item.status === "conforme" && <span className="text-emerald-700 font-bold">✓ Conforme</span>}
                          {item.status === "divergente" && <span className="text-red-700 font-bold">⚠ Divergência</span>}
                          {item.status === "sem_referencia" && <span className="opacity-40">—</span>}
                          {item.status === "verificando" && (
                            <span className="text-blue-600 font-bold animate-pulse">⟳ IA verificando…</span>
                          )}
                        </td>
                       </tr>
                       {item.status === "divergente" && (
                         <tr>
                           <td colSpan={4} className="pb-1.5">
                             {casoResidenciaTerceiro ? (
                               <div className="rounded-md border border-amber-300 bg-amber-100/70 px-2 py-1 text-[9.5px] font-semibold leading-snug text-amber-900">
                                 {terceiroDados ? (
                                   <>
                                     PONTO A CONFIRMAR — o valor lido no comprovante ("{item.valorCertidao}")
                                     não confere com o documento de identidade do responsável pelo imóvel
                                     ("{item.valorReferencia || "não informado"}"). Não reprova.
                                   </>
                                 ) : (
                                   <>
                                     PONTO A CONFIRMAR — {explicarDivergencia(item)} Não reprova: será
                                     cruzado com o documento do responsável pelo imóvel.
                                   </>
                                 )}
                               </div>
                             ) : (
                               <div className="rounded-md border border-red-300 bg-red-100/70 px-2 py-1 text-[9.5px] font-semibold leading-snug text-red-800">
                                 MOTIVO DA REJEIÇÃO — {explicarDivergencia(item)}
                               </div>
                             )}
                           </td>
                         </tr>
                       )}
                       </Fragment>
                     ))}
                  </tbody>
                </table>
                {conformidadeExibida.some(i => i.status === "divergente") && !casoResidenciaTerceiro && (
                  <div className="mt-2 rounded-lg border border-red-400 bg-red-100 p-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">
                      Por que este documento foi rejeitado
                    </div>
                    <p className="mt-1 text-[10px] font-semibold leading-snug text-red-800">
                      {conformidade
                        .filter((i) => i.status === "divergente")
                        .map((i) => `${i.label}: ${explicarDivergencia(i)}`)
                        .join(" ")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Resultado da certidão / apontamento criminal ── */}
            {classificacao && TIPOS_CERTIDAO.has(form.tipo_documento) && (
              <div className={cn(
                "rounded-2xl border p-3 text-xs",
                temApontamento
                  ? "border-red-400 bg-red-50 text-red-900"
                  : classificacao.camposExtraidos?.resultado_certidao === "nada_consta"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-border bg-card"
              )}>
                <div className="flex items-center gap-1.5 mb-1">
                  {temApontamento
                    ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                    : <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                  <span className="font-bold uppercase tracking-wide text-[10px]">Resultado da certidão</span>
                  <span className={cn(
                    "ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded",
                    temApontamento ? "bg-red-200 text-red-800" : "bg-emerald-100 text-emerald-800"
                  )}>
                    {temApontamento ? "CONSTA APONTAMENTO" : "NADA CONSTA"}
                  </span>
                </div>

                {temApontamento && (
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] text-red-800">
                      Esta certidão indica a existência de apontamento criminal ou pendência.
                      Antes de salvar, informe se você reconhece este apontamento:
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setReconheceApontamento("sim")}
                        className={cn(
                          "flex-1 rounded-xl px-3 py-2 text-[11px] font-bold border transition-colors",
                          reconheceApontamento === "sim"
                            ? "bg-red-600 text-white border-red-600"
                            : "bg-white text-red-700 border-red-300 hover:bg-red-50"
                        )}
                      >
                        Sim, reconheço
                      </button>
                      <button
                        type="button"
                        onClick={() => { setReconheceApontamento("nao"); setHomonimiaSalva(false); }}
                        className={cn(
                          "flex-1 rounded-xl px-3 py-2 text-[11px] font-bold border transition-colors",
                          reconheceApontamento === "nao"
                            ? "bg-slate-700 text-white border-slate-700"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        Não é meu
                      </button>
                    </div>

                    {reconheceApontamento === "sim" && (
                      <p className="text-[10px] text-red-700 bg-red-100 rounded-lg p-2">
                        O apontamento será registrado e a certidão encaminhada para análise da equipe.
                      </p>
                    )}

                    {reconheceApontamento === "nao" && !homonimiaSalva && (
                      <div className="rounded-xl border border-slate-300 bg-white p-3 space-y-2">
                        <p className="text-[11px] text-slate-700 font-medium">
                          Para prosseguir, você deverá assinar uma Declaração de Homonímia informando
                          que o apontamento não lhe pertence.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowDeclaracao(v => !v)}
                          className="text-[10px] text-slate-500 underline"
                        >
                          {showDeclaracao ? "Ocultar declaração" : "Ver declaração"}
                        </button>
                        {showDeclaracao && (
                          <pre className="text-[10px] text-slate-600 bg-slate-50 rounded-lg p-2 whitespace-pre-wrap font-sans border border-slate-200 max-h-40 overflow-y-auto">
                            {[
                              "DECLARAÇÃO DE HOMONÍMIA",
                              "",
                              `Eu, ${clienteNome || "Requerente"}, portador(a) do CPF ${clienteCpf ? clienteCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "---"}, declaro que NÃO possuo qualquer vínculo com o apontamento constante na ${getNomeDocumentoDisplay({ tipo_documento: form.tipo_documento, nome_documento: form.nome_documento, numero_documento: form.numero_documento, orgao_emissor: form.orgao_emissor }, form.tipo_documento)}.`,
                              "",
                              "Trata-se de homonímia com outra pessoa de nome semelhante.",
                              "Declaro estar ciente das penalidades do Art. 299 do Código Penal.",
                              "",
                              new Date().toLocaleDateString("pt-BR"),
                            ].join("\n")}
                          </pre>
                        )}
                        <button
                          type="button"
                          onClick={handleAssinarHomonimia}
                          className="w-full rounded-xl bg-slate-800 text-white text-[11px] font-bold py-2 hover:bg-slate-900 transition-colors"
                        >
                          Assinar eletronicamente e registrar declaração
                        </button>
                      </div>
                    )}

                    {reconheceApontamento === "nao" && homonimiaSalva && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-800 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 shrink-0" />
                        Declaração de homonímia registrada. Agora você pode salvar a certidão.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            <div className="grid gap-2.5 rounded-sm border border-[#E5E5E5] bg-white p-3 shadow-none">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field label="Categoria do documento">
                  <Select value={categoriaHub} onValueChange={(value) => setCategoria(value as HubCategoria)}>
                    <SelectTrigger className={cn(inputClassName, "text-left font-medium")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-popover text-popover-foreground">
                      {HUB_CATEGORIAS.map((categoria) => (
                        <SelectItem
                          key={categoria.value}
                          value={categoria.value}
                          className="focus:bg-muted focus:text-foreground"
                        >
                          {categoria.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Tipo do documento">
                  <div
                    className={cn(
                      inputClassName,
                      "flex items-center gap-2 text-left font-medium bg-[#F5F5F5] text-[#0A0A0A] cursor-default select-none",
                    )}
                  >
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#2F3337]" />
                    <span className="truncate">{tipoAtual?.label ?? "Aguardando leitura do documento"}</span>
                  </div>
                </Field>

              </div>

              <div className="rounded-sm border border-[#EFEFEF] bg-[#FAFAFA] px-3 py-2">
                <div className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-[#7A7A7A]">
                  Escopo e reaproveitamento
                </div>
                <div className="mt-0.5 text-[12px] font-semibold text-[#0A0A0A]">
                  {categoriaAtualMeta?.label} · escopo {escopoAtual}
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-[#5A5A5A] line-clamp-2">
                  {categoriaAtualMeta?.description}
                  {escopoAtual === "processo"
                    ? " Este documento tende a ficar vinculado ao processo atual."
                    : " Este documento pode ser reaproveitado em outras jornadas quando continuar válido e compatível."}
                </p>
              </div>

              {showArmaFields ? (
                <>
                  <Field
                    label="Sistema do registro"
                    icon={Hash}
                    action={
                      <ConfirmBadge
                        extraido={iaExtraido.sistema_registro}
                        confirmado={confirmados.sistema_registro}
                        onConfirm={() => confirmField("sistema_registro")}
                      />
                    }
                  >
                    <Select
                      value={form.sistema_registro || "REVISAR"}
                      onValueChange={(v) => {
                        update("sistema_registro", v as FormState["sistema_registro"]);
                        if (v === "SINARM") update("numero_registro_sigma", "");
                        if (v === "SIGMA") update("numero_cad_sinarm", "");
                      }}
                    >
                    <SelectTrigger className={cn(inputClassName, "text-left font-medium")}>
                        <SelectValue placeholder="Selecione o regime" />
                      </SelectTrigger>
                      <SelectContent className="border-border bg-popover text-popover-foreground">
                        <SelectItem value="SINARM">SINARM (Polícia Federal)</SelectItem>
                        <SelectItem value="SIGMA">SIGMA (Exército / CAC)</SelectItem>
                        <SelectItem value="REVISAR">A revisar</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  {(!form.sistema_registro || form.sistema_registro === "REVISAR") ? (
                    <p className="text-xs text-amber-700">
                      Regime não identificado com segurança — confirme manualmente.
                    </p>
                  ) : null}
                  {showSinarmFields ? (
                    <>
                      <Field
                        label="Nº Cad. SINARM"
                        icon={Hash}
                        action={
                          <ConfirmBadge
                            extraido={iaExtraido.numero_cad_sinarm}
                            confirmado={confirmados.numero_cad_sinarm}
                            onConfirm={() => confirmField("numero_cad_sinarm")}
                          />
                        }
                      >
                        <Input
                          value={form.numero_cad_sinarm}
                          onChange={(event) => update("numero_cad_sinarm", event.target.value)}
                          placeholder="Ex.: 2022/905178870-50"
                          className={inputClassName}
                        />
                      </Field>
                      <Field
                        label="Nº do Registro"
                        icon={Hash}
                        action={
                          <ConfirmBadge
                            extraido={iaExtraido.numero_documento}
                            confirmado={confirmados.numero_documento}
                            onConfirm={() => confirmField("numero_documento")}
                          />
                        }
                      >
                        <Input
                          value={form.numero_documento}
                          onChange={(event) => update("numero_documento", event.target.value)}
                          placeholder="Ex.: 906786939"
                          className={inputClassName}
                        />
                      </Field>
                    </>
                  ) : showSigmaFields ? (
                    <Field
                      label="Nº de Registro SIGMA"
                      icon={Hash}
                      action={
                        <ConfirmBadge
                          extraido={iaExtraido.numero_registro_sigma}
                          confirmado={confirmados.numero_registro_sigma}
                          onConfirm={() => confirmField("numero_registro_sigma")}
                        />
                      }
                    >
                      <Input
                        value={form.numero_registro_sigma}
                        onChange={(event) => update("numero_registro_sigma", event.target.value)}
                        placeholder="Número SIGMA / Exército"
                        className={inputClassName}
                      />
                    </Field>
                  ) : (
                    <Field
                      label="Número do documento"
                      icon={Hash}
                      action={
                        <ConfirmBadge
                          extraido={iaExtraido.numero_documento}
                          confirmado={confirmados.numero_documento}
                          onConfirm={() => confirmField("numero_documento")}
                        />
                      }
                    >
                      <Input
                        value={form.numero_documento}
                        onChange={(event) => update("numero_documento", event.target.value)}
                        placeholder="Ex.: 1234567"
                        className={inputClassName}
                      />
                    </Field>
                  )}
                </>
              ) : (
                <Field
                  label="Número do documento"
                  icon={Hash}
                  action={
                    <ConfirmBadge
                      extraido={iaExtraido.numero_documento}
                      confirmado={confirmados.numero_documento}
                      onConfirm={() => confirmField("numero_documento")}
                    />
                  }
                >
                  <Input
                    value={form.numero_documento}
                    onChange={(event) => update("numero_documento", event.target.value)}
                    placeholder="Ex.: 1234567"
                    className={inputClassName}
                  />
                </Field>
              )}

              <div className={semDatasOcupacao ? "grid grid-cols-1 gap-2.5" : "grid grid-cols-2 gap-2.5"}>
                <Field label="Órgão emissor">
                  <Input
                    value={form.orgao_emissor}
                    onChange={(event) => update("orgao_emissor", event.target.value)}
                    placeholder="PF, EB..."
                    className={inputClassName}
                  />
                </Field>

                {!semDatasOcupacao && (
                <Field
                  label={
                    /laudo|exame|capacidade_tecnica|psicotecnico/i.test(form.tipo_documento)
                      ? "Avaliação"
                      : "Emissão"
                  }
                  icon={Calendar}
                >
                  <DateInputBR
                    value={form.data_emissao}
                    onChange={(iso) => update("data_emissao", iso)}
                    className={inputClassName}
                  />
                </Field>
                )}
              </div>

              {semDatasOcupacao ? (
                // Dois grupos caem aqui por motivos DIFERENTES: os constitutivos
                // (que não têm emissão nem vencimento) e a nota fiscal (que tem
                // emissão impressa e é conferida pelo emitente, mas não vence).
                // Um texto só descrevia errado o documento que o cliente anexou.
                <div className="rounded-xl border border-[#2F3337]/20 bg-[#2F3337]/5 px-3 py-2 text-[11px] leading-snug text-[#2F3337]">
                  {isNotaFiscalOcupacao(form.tipo_documento) ? (
                    <>
                      Nota fiscal — <strong>não vence</strong>. A conferência é do emitente
                      (prestador) contra o seu cadastro.
                    </>
                  ) : (
                    <>
                      Documento constitutivo da empresa — <strong>sem data de emissão e sem vencimento</strong>.
                      A atualidade da ocupação lícita é conferida pelo Cartão CNPJ e pelo QSA (30 dias).
                    </>
                  )}
                </div>
              ) : (
              <Field
                label="Validade"
                icon={Calendar}
                action={
                  <ConfirmBadge
                    extraido={iaExtraido.data_validade}
                    confirmado={confirmados.data_validade}
                    onConfirm={() => confirmField("data_validade")}
                  />
                }
              >
                <DateInputBR
                  value={form.data_validade}
                  onChange={(iso) => update("data_validade", iso)}
                  className={inputClassName}
                />
              </Field>
              )}
            </div>

            {normalizeTipoDocumentoParaBanco(form.tipo_documento) === "comprovante_filiacao_entidade_tiro" && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-700" />
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">Controle de prazos — filiação</div>
                    <div className="text-xs text-amber-900">A declaração vale 90 dias (campo Validade acima). A filiação anual tem prazo próprio.</div>
                  </div>
                </div>
                <Field label="Validade da filiação anual" icon={Calendar}>
                  <DateInputBR
                    value={form.validade_filiacao}
                    onChange={(iso) => setForm((prev) => ({ ...prev, validade_filiacao: iso }))}
                    className={inputClassName}
                  />
                </Field>
              </div>
            )}

            {showArmaVinculada ? (
              <div className="rounded-2xl border border-accent/30 bg-accent/8 p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background text-accent-foreground shadow-sm">
                    <Crosshair className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Arma vinculada</div>
                    <div className="text-sm font-medium text-foreground">Preencha ou ajuste os dados identificados</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Espécie">
                    <Input
                      value={form.arma_especie}
                      onChange={(event) => update("arma_especie", event.target.value)}
                      placeholder="Pistola"
                      className={inputClassName}
                    />
                  </Field>

                  <Field
                    label="Marca"
                    action={
                      <ConfirmBadge
                        extraido={iaExtraido.arma_marca}
                        confirmado={confirmados.arma_marca}
                        onConfirm={() => confirmField("arma_marca")}
                      />
                    }
                  >
                    <Input
                      value={form.arma_marca}
                      onChange={(event) => update("arma_marca", event.target.value)}
                      placeholder="Taurus"
                      className={inputClassName}
                    />
                  </Field>

                  <Field
                    label="Modelo"
                    action={
                      <ConfirmBadge
                        extraido={iaExtraido.arma_modelo}
                        confirmado={confirmados.arma_modelo}
                        onConfirm={() => confirmField("arma_modelo")}
                      />
                    }
                  >
                    <Input
                      value={form.arma_modelo}
                      onChange={(event) => update("arma_modelo", event.target.value)}
                      className={inputClassName}
                    />
                  </Field>

                  <Field
                    label="Calibre"
                    action={
                      <ConfirmBadge
                        extraido={iaExtraido.arma_calibre}
                        confirmado={confirmados.arma_calibre}
                        onConfirm={() => confirmField("arma_calibre")}
                      />
                    }
                  >
                    <Input
                      value={form.arma_calibre}
                      onChange={(event) => update("arma_calibre", event.target.value)}
                      placeholder="9mm"
                      className={inputClassName}
                    />
                  </Field>

                  <Field
                    label="Nº de série"
                    className="col-span-2"
                    action={
                      <ConfirmBadge
                        extraido={iaExtraido.arma_numero_serie}
                        confirmado={confirmados.arma_numero_serie}
                        onConfirm={() => confirmField("arma_numero_serie")}
                      />
                    }
                  >
                    <Input
                      value={form.arma_numero_serie}
                      onChange={(event) => update("arma_numero_serie", event.target.value)}
                      className={inputClassName}
                    />
                  </Field>
                </div>
              </div>
            ) : null}

          </div>
          </div>
          </div>
        </div>

        <div className="shrink-0 border-t-2 border-[#2F3337] bg-white px-4 py-2.5 sm:px-6 sm:py-3">
          {autoResult?.safe ? (
            <div className="flex">
              <Button
                onClick={onClose}
                className="h-11 flex-1 rounded-sm bg-[#0A0A0A] font-heading text-[12px] font-bold uppercase tracking-[0.22em] text-white hover:bg-[#2F3337]"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Concluído
              </Button>
            </div>
          ) : (grupoBloqueadoTrava ||
              certidaoIncorreta ||
              rejeitadoDuplicidade ||
              !!arquivoRepetido ||
              (titularDivergente && !(casoResidenciaTerceiro && terceiroDados)) ||
              notaTomadorParentesco) ? (
            <div className="flex gap-2.5">
              <Button
                variant="outline"
                onClick={onClose}
                className="h-11 flex-1 rounded-sm border-[#E5E5E5] bg-white font-heading text-[12px] font-bold uppercase tracking-[0.22em] text-[#0A0A0A] hover:bg-[#F7F7F7]"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleEnviarNovamente}
                disabled={enviandoNovamente}
                className="h-11 flex-[1.2] rounded-sm bg-[#2F3337] font-heading text-[12px] font-bold uppercase tracking-[0.22em] text-white hover:bg-[#222528]"
              >
                {enviandoNovamente ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {enviandoNovamente ? "Enviando aviso..." : "Enviar novamente"}
              </Button>
            </div>
          ) : (
            <>
            {bloqueioExtracao() ? (
              <div className="mb-2 rounded-sm border border-[#2F3337]/35 bg-[#2F3337]/[0.06] px-3 py-2">
                <p className="font-heading text-[10px] font-bold uppercase tracking-[0.2em] text-[#2F3337]">
                  Leitura automática pendente
                </p>
                <p className="mt-1 text-[12px] leading-snug text-[#3A3A3A]">{bloqueioExtracao()}</p>
              </div>
            ) : pendingSensitiveKeys().length > 0 ? (
              <div className="mb-2 rounded-sm border border-[#2F3337]/35 bg-[#2F3337]/[0.06] px-3 py-2">
                <p className="font-heading text-[10px] font-bold uppercase tracking-[0.2em] text-[#2F3337]">
                  Confirmação obrigatória
                </p>
                <p className="mt-1 text-[12px] leading-snug text-[#3A3A3A]">
                  Você só pode salvar depois de conferir e confirmar:{" "}
                  <b className="uppercase">{pendingSensitiveKeys().join(", ").replace(/_/g, " ")}</b>.
                </p>
              </div>
            ) : null}
            <div className="flex gap-2.5">
              <Button
                variant="outline"
                onClick={onClose}
                className="h-11 flex-1 rounded-sm border-[#E5E5E5] bg-white font-heading text-[12px] font-bold uppercase tracking-[0.22em] text-[#0A0A0A] hover:bg-[#F7F7F7]"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                title={bloqueioExtracao() ?? (pendingSensitiveKeys().length ? "Confirme os campos destacados antes de salvar" : undefined)}
                disabled={
                  saving ||
                  extracting ||
                  !!bloqueioExtracao() ||
                  pendingSensitiveKeys().length > 0 ||
                  (temApontamento && reconheceApontamento === null) ||
                  (temApontamento && reconheceApontamento === "nao" && !homonimiaSalva)
                }
                className="h-11 flex-[1.2] rounded-sm bg-[#2F3337] font-heading text-[12px] font-bold uppercase tracking-[0.22em] text-white hover:bg-[#222528]"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : casoResidenciaTerceiro && terceiroDados ? (
                  <FileDown className="mr-2 h-4 w-4" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                {saving ? "Salvando..." : "Salvar documento"}
              </Button>
            </div>
            </>
          )}
        </div>
        <ResidenciaTerceiroModal
          open={!!casoResidenciaTerceiro && !terceiroDados}
          titularComprovante={titularComprovanteLido}
          interessadoNome={refClienteNome ?? null}
          ownerKey={String(customerId ?? `qa-${qaClienteId}`)}
          onCancelar={() => {
            // Volta à fase inicial: o cliente pode conseguir uma conta no nome dele.
            setTerceiroDados(null);
            setFile(null);
            setClassificacao(null);
            setConformidade([]);
            setConferenciaLocal(null);
            setIaExtraido({});
            setConfirmados({});
            toast.info("Envie um comprovante de consumo do imóvel em seu nome.");
          }}
          onConfirmado={(dados) => {
            setTerceiroDados(dados);
            toast.success("Residência declarada e documento do responsável validado.");
          }}
        />
        <DeclaracaoResponsavelImovelModal
          open={declaracaoAberta}
          qaClienteId={qaClienteId ?? null}
          dados={terceiroDados}
          documentoComprovanteId={comprovanteDocId}
          interessadoNome={refClienteNome ?? null}
          onFechar={() => {
            setDeclaracaoAberta(false);
            setForm(EMPTY);
            setFile(null);
            setTerceiroDados(null);
            onSaved();
            onClose();
          }}
          onValidada={() => {
            onSaved();
          }}
        />
        <ConfrontoCpfComprovanteModal
          open={cpfConfrontoAberto}
          cpfLido={avaliacaoTitular?.cpf ?? null}
          titularLido={titularComprovanteLido}
          erro={cpfConfrontoErro}
          onFechar={() => {
            // Fechar não reprova nada: o documento apenas continua pendente.
            setCpfConfrontoAberto(false);
            setCpfConfrontoErro(null);
          }}
          onConfirmar={(cpf) => {
            if (!avaliacaoTitular) return;
            const res = confrontarCpfParcial(avaliacaoTitular.cpf, cpf);
            if (!res.ok) {
              setCpfConfrontoErro(res.motivo ?? "Não foi possível confirmar o CPF.");
              return;
            }
            const refCpf = String(refClienteCpf || "").replace(/\D/g, "");
            setCpfConfrontado(cpf);
            setCpfConfrontoErro(null);
            setCpfConfrontoAberto(false);
            if (refCpf && refCpf === cpf) {
              setAvaliacaoTitular({
                ...avaliacaoTitular,
                resultado: "propria",
                pedirConfrontoCpf: false,
                motivo: "CPF confirmado pelo cliente e conferido com o cadastro.",
              });
              setConformidade((prev) =>
                prev.map((i) =>
                  i.campo === "cpf" || i.campo === "nome_completo"
                    ? { ...i, status: "conforme" as const, valorReferencia: i.valorReferencia ?? refClienteCpf ?? null }
                    : i,
                ),
              );
              toast.success("Titularidade confirmada pelos dígitos visíveis do comprovante.");
            } else {
              setAvaliacaoTitular({
                ...avaliacaoTitular,
                resultado: "terceiro",
                pedirConfrontoCpf: false,
                motivo: "O CPF informado não é o do interessado — o imóvel é de terceiro.",
              });
              toast.info("A conta é de outra pessoa. Vamos pedir a declaração do responsável pelo imóvel.");
            }
          }}
        />
      </DialogContent>
    </Dialog>
    {resultadoCarimbo && (
      <DocResultadoCarimbo
        tipo={resultadoCarimbo.tipo}
        percentual={resultadoCarimbo.percentual}
        mensagem={resultadoCarimbo.mensagem}
        titulo={resultadoCarimbo.titulo}
        onDone={() => {
          // Com a declaração do responsável pendente, o hub permanece aberto:
          // o próximo passo do cliente é assinar, e fechar aqui o perderia.
          const fechar = resultadoCarimbo.tipo !== "reprovado" && !declaracaoAberta;
          const rejeitado = resultadoCarimbo.tipo === "reprovado";
          setResultadoCarimbo(null);
          if (fechar) {
            setForm(EMPTY);
            setFile(null);
            onSaved();
            onClose();
          } else if (rejeitado) {
            // Rejeição: limpa o modal para o cliente enviar o arquivo correto
            // imediatamente, sem precisar fechar e reabrir o Hub.
            toast.dismiss();
            setFile(null);
            setTerceiroDados(null);
            setForm({ ...EMPTY, tipo_documento: defaultTipoEfetivo });
            setCategoriaHub(inferHubCategoriaFromTipo(defaultTipoEfetivo));
            setClassificacao(null);
            setShowTipoOverride(false);
            setConferenciaLocal(null);
            setNotasInformadas({});
            setAutoResult(null);
            setIaExtraido({});
            setConfirmados({});
            setConformidade([]);
            setTemApontamento(false);
            setReconheceApontamento(null);
            setHomonimiaSalva(false);
            setShowDeclaracao(false);
            setExtracting(false);
            setProfissionalExtraido({ nome: null, registro: null });
            motivoCarimbadoRef.current = null;
          }
        }}
      />
    )}
    </>
  );
}

export default ClienteDocsHubModal;
