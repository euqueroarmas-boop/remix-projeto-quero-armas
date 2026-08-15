/**
 * Rastro de tentativas — motor da regra canônica de `docs/RASTRO-DOCUMENTAL.md`.
 *
 * Toda tentativa de entrega gera histórico, inclusive a recusada. Tentativa
 * recusada NÃO vira linha no acervo (`qa_documentos_cliente`): vai só para a
 * trilha (`qa_documentos_cliente_eventos`), com `documento_id` nulo.
 *
 * Duas obrigações que a spec impõe e que estão implementadas aqui:
 *
 *  1. Gravar SEMPRE os dois vínculos de cliente quando ambos existirem. O
 *     acervo nasceu partido em dois trilhos — documento da equipe só com
 *     `qa_cliente_id`, documento do portal só com `customer_id` — e consulta
 *     que use um lado só perde metade da história.
 *  2. O motivo registrado é o MESMO texto que o usuário viu na tela. Quem ler
 *     a trilha meses depois não terá o arquivo nem a tela; divergência entre
 *     os dois textos é bug.
 */
import { supabase } from "@/integrations/supabase/client";
import { logSistema } from "@/lib/logSistema";

/** Documento anterior que já sustenta este mesmo arquivo no acervo. */
export interface ArquivoRepetido {
  documento_id: string;
  tipo_documento: string | null;
  nome_documento: string | null;
  status: string | null;
  motivo_reprovacao: string | null;
  arquivo_nome: string | null;
  aprovado_em: string | null;
  enviado_em: string | null;
}

export interface TentativaBloqueada {
  qaClienteId: number | null;
  customerId: string | null;
  /** Texto exibido ao usuário — vai idêntico para a trilha. */
  motivo: string;
  /** Código curto do bloqueio, para agrupar na auditoria. */
  codigo:
    | "arquivo_repetido"
    | "duplicidade_tipo"
    | "certidao_incorreta"
    | "titular_divergente"
    | "grupo_bloqueado";
  tipoPretendido?: string | null;
  tipoLido?: string | null;
  exigenciaAlvo?: string | null;
  arquivoNome?: string | null;
  arquivoMime?: string | null;
  arquivoTamanho?: number | null;
  documentoAnteriorId?: string | null;
  atorTipo?: "cliente" | "admin";
}

const dataBr = (iso?: string | null) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return null;
  }
};

const rotulo = (dup: ArquivoRepetido) =>
  dup.nome_documento?.trim() ||
  String(dup.tipo_documento || "documento").replace(/_/g, " ").toUpperCase();

/**
 * Mensagem do arquivo repetido, escolhida pelo ESTADO do documento anterior.
 *
 * O caso mais valioso é o do reprovado: hoje o cliente reenvia o arquivo
 * idêntico, ninguém diz que é o mesmo, e o ciclo se repete até alguém do
 * atendimento perceber.
 */
export function mensagemArquivoRepetido(
  dup: ArquivoRepetido,
  exigenciaEsperada?: string | null,
): string {
  const nome = rotulo(dup);
  const status = String(dup.status || "").toLowerCase();

  if (status === "reprovado") {
    const quando = dataBr(dup.enviado_em);
    const motivo = dup.motivo_reprovacao?.trim();
    return (
      `Você anexou o mesmo arquivo que já havia enviado${quando ? ` em ${quando}` : ""} como ${nome} — ` +
      `e ele foi recusado${motivo ? `: ${motivo}` : "."} ` +
      `Reenviar o arquivo idêntico não resolve: emita um documento novo.`
    );
  }

  if (status === "pendente_aprovacao" || status === "em_analise") {
    return (
      `Já recebemos este mesmo arquivo como ${nome} e ele está em análise. ` +
      `Não é preciso enviar de novo — se quiser trocá-lo, anexe um arquivo diferente.`
    );
  }

  const quando = dataBr(dup.aprovado_em) || dataBr(dup.enviado_em);
  return (
    `Este arquivo já está no seu Hub como ${nome}${quando ? `, aprovado em ${quando}` : ""}. ` +
    (exigenciaEsperada
      ? `O que falta aqui é outro documento: ${exigenciaEsperada}.`
      : `Anexe o documento que esta exigência pede.`)
  );
}

/**
 * Consulta se o arquivo recém-enviado já existe no acervo deste cliente.
 * A comparação é feita no banco, pelo eTag que o Storage já guarda — o front
 * não calcula hash nenhum, e por isso não há como front e backfill divergirem.
 */
export async function checarArquivoRepetido(
  storagePath: string,
  qaClienteId: number | null,
  customerId: string | null,
): Promise<ArquivoRepetido | null> {
  try {
    const { data, error } = await supabase.rpc("qa_documento_duplicado_por_arquivo" as any, {
      p_storage_path: storagePath,
      p_qa_cliente_id: qaClienteId,
      p_customer_id: customerId,
    });
    if (error) throw error;
    const linha = Array.isArray(data) ? data[0] : data;
    return (linha as ArquivoRepetido) ?? null;
  } catch (e) {
    // Falha na checagem não pode travar a entrega: o trigger do banco é a rede
    // de segurança. Mas fica registrado, senão a trava some sem ninguém notar.
    void logSistema({
      tipo: "admin",
      status: "warning",
      mensagem: "Falha ao checar arquivo repetido no Hub",
      payload: { storage_path: storagePath, erro: String((e as Error)?.message || e) },
    });
    return null;
  }
}

/**
 * Remove do bucket o arquivo que acabou de subir e foi recusado.
 *
 * Decisão do usuário (15/08/2026): arquivo recusado é apagado na hora. A prova
 * de que era o mesmo arquivo fica na trilha — nome, tamanho e o documento
 * anterior que ele repetia.
 */
export async function apagarArquivoRecusado(storagePath: string): Promise<void> {
  try {
    await supabase.storage.from("qa-documentos").remove([storagePath]);
  } catch (e) {
    void logSistema({
      tipo: "admin",
      status: "warning",
      mensagem: "Falha ao apagar arquivo recusado do bucket",
      payload: { storage_path: storagePath, erro: String((e as Error)?.message || e) },
    });
  }
}

/**
 * Grava a tentativa recusada na trilha.
 *
 * Nunca bloqueia o fluxo: a recusa já foi decidida e mostrada ao usuário. Mas
 * falha na gravação é logada — trilha que some em silêncio é pior do que não
 * ter trilha, porque cria confiança falsa.
 */
export async function registrarTentativaBloqueada(t: TentativaBloqueada): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("qa_documentos_cliente_eventos" as any)
      .insert({
        documento_id: null,
        qa_cliente_id: t.qaClienteId,
        customer_id: t.customerId,
        acao: "tentativa_bloqueada",
        ator_tipo: t.atorTipo ?? "cliente",
        ator_user_id: user?.id ?? null,
        ator_email: user?.email ?? null,
        detalhes: {
          codigo: t.codigo,
          motivo: t.motivo,
          tipo_pretendido: t.tipoPretendido ?? null,
          tipo_lido: t.tipoLido ?? null,
          exigencia_alvo: t.exigenciaAlvo ?? null,
          arquivo_nome: t.arquivoNome ?? null,
          arquivo_mime: t.arquivoMime ?? null,
          arquivo_tamanho: t.arquivoTamanho ?? null,
          documento_anterior_id: t.documentoAnteriorId ?? null,
          arquivo_apagado: true,
        },
      });
    if (error) throw error;
  } catch (e) {
    void logSistema({
      tipo: "admin",
      status: "error",
      mensagem: "Falha ao registrar tentativa bloqueada na trilha",
      payload: {
        codigo: t.codigo,
        qa_cliente_id: t.qaClienteId,
        customer_id: t.customerId,
        erro: String((e as Error)?.message || e),
      },
    });
  }
}
