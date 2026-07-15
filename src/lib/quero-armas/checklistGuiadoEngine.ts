// ============================================================================
// Checklist Guiado — Engine (camada NOVA, aditiva — ZERO REGRESSÃO)
// ----------------------------------------------------------------------------
// Esta camada NÃO substitui a Central de Documentos (CONGELADA) nem o
// ProcessoDetalheDrawer. Ela apenas ORQUESTRA, em modo passo-a-passo guiado,
// os MESMOS dados (qa_processos / qa_processo_documentos) e as MESMAS edge
// functions já aprovadas:
//   - qa-processo-doc-upload      (upload + dispara validação IA automática)
//   - qa-processo-doc-validar-ia  (validação rígida por IA — disparada pelo upload)
//   - qa-extract-doc-dates        (extração de datas em background)
//   - qa-processo-set-condicao    (condição profissional → recalcula renda)
//
// A lógica de etapas / perguntas / visibilidade abaixo é um ESPELHO fiel da
// lógica canônica que vive dentro de ProcessoDetalheDrawer.tsx. O drawer
// permanece a fonte da verdade; aqui só lemos/aplicamos as mesmas regras para
// apresentar um item por vez. Se a regra do drawer mudar, espelhar aqui.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import {
  STATUS_CHECKLIST_CUMPRIDO,
  STATUS_CHECKLIST_EM_ANALISE,
  STATUS_CHECKLIST_PENDENTE,
  isChecklistCumprido,
  isChecklistEmAnalise,
} from "./checklistMetrics";
import { wizardPendentePara } from "./checklistWizardGate";

export interface GuiaProcesso {
  id: string;
  cliente_id: number;
  servico_id?: number | null;
  servico_nome: string;
  status: string;
  pagamento_status: string;
  data_criacao: string;
  etapa_liberada_ate?: number | null;
  respostas_questionario_json?: Record<string, string> | null;
  condicao_profissional?: string | null;
}

// Linha de documento — superset dos campos usados na UI guiada.
// Carregamos via select("*") (igual ao drawer) para evitar divergência de colunas.
export interface GuiaDoc {
  id: string;
  nome_documento: string;
  tipo_documento: string;
  etapa: string | null;
  status: string;
  obrigatorio: boolean;
  motivo_rejeicao: string | null;
  observacoes: string | null;
  arquivo_storage_key: string | null;
  regra_validacao: any;
  formato_aceito?: string[] | string | null;
  instrucoes?: string | null;
  observacoes_cliente?: string | null;
  orgao_emissor?: string | null;
  link_emissao?: string | null;
  modelo_url?: string | null;
  exemplo_url?: string | null;
  prazo_recomendado_dias?: number | null;
  validade_dias?: number | null;
  campos_complementares_json?: any;
  divergencias_json?: any;
  validacao_ia_status?: string | null;
  validacao_ia_confianca?: number | null;
  [key: string]: any;
}

export const ETAPA_NOMES_GUIA: Record<number, string> = {
  1: "Comprovação de endereço",
  2: "Condição profissional",
  3: "Antecedentes criminais",
  4: "Declarações e compromissos",
  5: "Exames técnicos",
};

// Mesmas opções do drawer (CONDICAO_OPCOES). Mantido em sincronia.
export const CONDICAO_OPCOES_GUIA: {
  id: "clt" | "autonomo" | "empresario" | "aposentado" | "funcionario_publico";
  label: string;
  hint: string;
}[] = [
  { id: "clt", label: "CLT", hint: "Holerite + CTPS Digital + Extrato INSS" },
  { id: "autonomo", label: "Autônomo", hint: "Cartão CNPJ/MEI + NF recente" },
  { id: "empresario", label: "Empresário/Sócio", hint: "Cartão CNPJ + QSA + Contrato Social + NF" },
  { id: "aposentado", label: "Aposentado", hint: "Comprovante de benefício INSS" },
  { id: "funcionario_publico", label: "Funcionário Público", hint: "Carteira Funcional + Holerite" },
];

// ---------------------------------------------------------------------------
// ESPELHO da função etapaDoTipo do ProcessoDetalheDrawer (ordem definitiva).
// 1=endereço · 2=condição/renda · 3=antecedentes · 4=declarações · 5=exames.
// ---------------------------------------------------------------------------
export function etapaDoTipoGuia(tipo: string): number {
  const t = (tipo || "").toLowerCase();
  if (t === "renda_definir_condicao" || t.startsWith("renda_")) return 2;
  if (t.startsWith("certidao") || t.includes("antecedentes")) return 3;
  if (
    t.includes("laudo") ||
    t.includes("psicologic") ||
    t.includes("capacidade_tecnica") ||
    t.includes("tiro") ||
    t.includes("aptidao")
  )
    return 5;
  if (
    t === "pergunta_comprovante_em_nome" ||
    t === "pergunta_ainda_reside_imovel" ||
    t === "pergunta_responde_inquerito_criminal" ||
    t === "declaracao_responsavel_imovel"
  )
    return 1;
  if (t.includes("endereco") || t.includes("residenc")) return 1;
  // BUG-FIX: "declaracao_sem_inquerito_processo_criminal" e qualquer outra
  // declaração devem cair em DECLARAÇÕES, não em endereço. Mantemos depois do
  // bloco de endereço para que tipos explicitamente de endereço continuem em 1.
  if (t.startsWith("declaracao") || t.startsWith("dsa_") || t.includes("compromisso")) return 4;
  return 1;
}

/**
 * Retorna o número da etapa (1..5) preferindo o campo `etapa` salvo no banco
 * (`qa_processo_documentos.etapa` / `qa_servicos_documentos.etapa`).
 * Valores reais no banco hoje são coarse (`base`/`complementar`/`tecnico`),
 * então caímos no mapeamento por `tipo_documento` quando o DB não desambigua.
 * O label exibido vem de ETAPA_NOMES_GUIA[n].
 */
export function etapaDoDoc(d: Pick<GuiaDoc, "etapa" | "tipo_documento">): number {
  const raw = String(d?.etapa ?? "").trim().toLowerCase();
  // valores numéricos diretos
  if (/^[1-5]$/.test(raw)) return Number(raw);
  // labels semânticas (caso o catálogo evolua para etapa por nome)
  if (raw === "endereco" || raw === "endereço" || raw === "comprovacao_endereco") return 1;
  if (raw === "renda" || raw === "condicao_profissional" || raw === "condicao") return 2;
  if (raw === "antecedentes" || raw === "criminal") return 3;
  if (raw === "declaracoes" || raw === "declaracao" || raw === "compromissos") return 4;
  if (raw === "tecnico" || raw === "exames" || raw === "laudo" || raw === "psicologico") return 5;
  // base/complementar/(vazio) → fallback ao mapa por tipo_documento
  return etapaDoTipoGuia(d?.tipo_documento ?? "");
}

export function isPerguntaGuia(d: GuiaDoc): boolean {
  const r = d.regra_validacao;
  return !!(r && typeof r === "object" && r.tipo === "pergunta");
}

export function isCondicaoGuia(d: GuiaDoc): boolean {
  return d.tipo_documento === "renda_definir_condicao";
}

function matchCondicaoGuia(
  respostas: Record<string, string>,
  cond: Record<string, string> | undefined | null,
): boolean {
  if (!cond || typeof cond !== "object") return true;
  return Object.entries(cond).every(([k, v]) => respostas[k] === v);
}

// Espelho de itemVisivel: respeita depende_de e exige_quando.
export function itemVisivelGuia(d: GuiaDoc, respostas: Record<string, string>): boolean {
  const r = d.regra_validacao;
  if (!r || typeof r !== "object") return true;
  if (r.depende_de && typeof r.depende_de === "object") {
    const ok = respostas[r.depende_de.chave] === r.depende_de.valor;
    if (!ok) return false;
  }
  if (r.exige_quando && typeof r.exige_quando === "object") {
    return matchCondicaoGuia(respostas, r.exige_quando);
  }
  return true;
}

// Um item é "cumprido" para fins de progresso?
export function itemCumpridoGuia(d: GuiaDoc, respostas: Record<string, string>): boolean {
  if (isPerguntaGuia(d)) {
    const chave = (d.regra_validacao as any)?.chave as string | undefined;
    if (!chave) return false;
    return respostas[chave] !== undefined && respostas[chave] !== null && respostas[chave] !== "";
  }
  // Bloco 13: usa a mesma classificação do Admin (checklistMetrics).
  // Doc em revisão humana é "em análise", não "cumprido" — alinha o progresso
  // do assistente com o que o admin enxerga no checklist.
  return isChecklistCumprido(d.status);
}

// Item ainda exige AÇÃO do cliente (entra na fila do assistente)?
export function itemPendenteAcaoGuia(d: GuiaDoc, respostas: Record<string, string>): boolean {
  // Delegamos para isDocumentActionable para manter um único mapeamento de
  // status e garantir que documentos em análise / em revisão humana / já
  // aprovados nunca voltem a aparecer na fila do assistente.
  return isDocumentActionable(d, respostas);
}

export type TipoItemGuia = "pergunta" | "condicao" | "documento";

export function tipoItemGuia(d: GuiaDoc): TipoItemGuia {
  if (isPerguntaGuia(d)) return "pergunta";
  if (isCondicaoGuia(d)) return "condicao";
  return "documento";
}

// ---------------------------------------------------------------------------
// Mapeamento explícito de status — Bloco 13: reusa os conjuntos canônicos
// definidos em checklistMetrics.ts para garantir que Admin e Cliente sempre
// classifiquem o mesmo documento da mesma forma.
// ---------------------------------------------------------------------------
export const STATUS_DOCS_ACIONAVEIS: ReadonlySet<string> = STATUS_CHECKLIST_PENDENTE;
export const STATUS_DOCS_NAO_ACIONAVEIS: ReadonlySet<string> = new Set<string>([
  ...STATUS_CHECKLIST_CUMPRIDO,
  ...STATUS_CHECKLIST_EM_ANALISE,
]);

/**
 * Item ainda exige ação concreta do cliente AGORA?
 * - Pergunta: sem resposta gravada.
 * - Condição profissional: sempre acionável (some quando definida).
 * - Documento: status NÃO está na lista de não-acionáveis.
 */
export function isDocumentActionable(
  d: GuiaDoc,
  respostas: Record<string, string>,
): boolean {
  if (isPerguntaGuia(d)) {
    const chave = (d.regra_validacao as any)?.chave as string | undefined;
    if (!chave) return false;
    return !(respostas[chave] !== undefined && respostas[chave] !== null && respostas[chave] !== "");
  }
  if (isCondicaoGuia(d)) return true;
  const st = String(d.status ?? "").toLowerCase();
  if (STATUS_DOCS_NAO_ACIONAVEIS.has(st)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Resolve o template_key do modelo preenchível para um documento (quando
// a regra_validacao define template_key ou template_quando). Espelho da
// função pickTemplate do ProcessoDetalheDrawer — sem alterar dados nem RLS.
// ---------------------------------------------------------------------------
export function pickTemplateGuia(
  doc: Pick<GuiaDoc, "regra_validacao">,
  respostas: Record<string, string>,
): { key: string; label: string } | null {
  const rule: any = doc?.regra_validacao;
  if (!rule || typeof rule !== "object") return null;
  const match = (cond: Record<string, string> | undefined | null) => {
    if (!cond || typeof cond !== "object") return true;
    return Object.entries(cond).every(([k, v]) => respostas[k] === v);
  };
  if (Array.isArray(rule.template_quando)) {
    for (const opt of rule.template_quando) {
      if (match(opt?.se)) {
        return {
          key: String(opt.template_key),
          label: String(opt.label || "Baixar declaração preenchida"),
        };
      }
    }
    return null;
  }
  if (typeof rule.template_key === "string") {
    return { key: rule.template_key, label: "Baixar declaração preenchida" };
  }
  return null;
}

// Prioridade DENTRO da Etapa 1 (Comprovação de endereço):
// 0 = documento de identidade (CIN/RG/CNH) — sempre PRIMEIRO
// 1 = comprovante de endereço (todos os anos)
// 2 = perguntas/declarações vinculadas ao endereço (titularidade, residência atual)
//     — vêm IMEDIATAMENTE após o comprovante para destravar a análise da IA
// 3 = demais itens da etapa (ex.: pergunta/declaração de inquérito criminal,
//     que continuam mapeados na etapa 1 pelo etapaDoTipoGuia legado)
// As outras etapas (2..5) não são afetadas.
function prioridadeEtapa1(d: GuiaDoc): number {
  const t = (d.tipo_documento || "").toLowerCase();
  const nome = (d.nome_documento || "").toLowerCase();
  const ehIdentidade =
    t === "cnh" ||
    t === "rg" ||
    t === "rg_com_cpf" ||
    t === "cin" ||
    t === "documento_identidade" ||
    t.includes("identidade") ||
    t.includes("identificacao") ||
    /\b(cnh|rg|cin)\b/.test(nome) ||
    nome.includes("identidade");
  if (ehIdentidade) return 0;
  const ehEndereco = t.includes("endereco") || t.includes("residenc");
  if (ehEndereco) return 1;
  const ehPerguntaOuDeclaracaoEndereco =
    t === "pergunta_comprovante_em_nome" ||
    t === "pergunta_ainda_reside_imovel" ||
    t === "declaracao_responsavel_imovel";
  if (ehPerguntaOuDeclaracaoEndereco) return 2;
  return 3;
}

// ---------------------------------------------------------------------------
// Carga + construção da fila (um item por vez, na ordem do checklist completo).
// ---------------------------------------------------------------------------
export interface CargaProcesso {
  processo: GuiaProcesso;
  docs: GuiaDoc[];
  respostas: Record<string, string>;
  etapaLiberada: number;
  clienteNome?: string | null;
}

/**
 * Hidrata `regra_validacao.wizard_pre_documento` do catálogo
 * (qa_servicos_documentos) no doc do processo quando ele ainda não tem o
 * bloco. O catálogo é a FONTE DE VERDADE para vínculo de wizards. Quando o
 * doc do processo já trouxer um wizard_pre_documento próprio (override
 * pontual), ele tem prioridade sobre o catálogo.
 */
function mesclarWizardPreDocumentoCatalogo(
  regraDoc: unknown,
  regraCatalogo: unknown,
): Record<string, any> | null {
  const baseDoc =
    regraDoc && typeof regraDoc === "object" ? { ...(regraDoc as Record<string, any>) } : {};
  const baseCat =
    regraCatalogo && typeof regraCatalogo === "object"
      ? (regraCatalogo as Record<string, any>)
      : null;
  if (!baseCat) return Object.keys(baseDoc).length > 0 ? baseDoc : (regraDoc as any) ?? null;
  if (!baseDoc.wizard_pre_documento && baseCat.wizard_pre_documento) {
    baseDoc.wizard_pre_documento = baseCat.wizard_pre_documento;
  }
  return baseDoc;
}

export async function carregarProcessoGuia(processoId: string): Promise<CargaProcesso> {
  const { data: p, error: pErr } = await supabase
    .from("qa_processos")
    .select(
      "id, cliente_id, servico_id, servico_nome, status, pagamento_status, data_criacao, etapa_liberada_ate, respostas_questionario_json, condicao_profissional",
    )
    .eq("id", processoId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!p) throw new Error("Processo não encontrado");

  const { data: dList, error: dErr } = await supabase
    .from("qa_processo_documentos")
    .select("*")
    .eq("processo_id", processoId)
    .order("created_at");
  if (dErr) throw dErr;

  const processo = p as unknown as GuiaProcesso;
  const respostas = (processo.respostas_questionario_json ?? {}) as Record<string, string>;
  const etapaLiberada = Math.max(1, Math.min(5, processo.etapa_liberada_ate ?? 1));
  const { data: cli } = await supabase
    .from("qa_clientes")
    .select("nome_completo")
    .eq("id", processo.cliente_id)
    .maybeSingle();

  // Mapa de ordem definido no admin (qa_servicos_documentos) — usado para
  // ordenar a fila do assistente respeitando a sequência configurada por serviço.
  let ordemMap = new Map<string, number>();
  // Mapa de regra_validacao do catálogo — usado para HIDRATAR no doc do processo
  // configurações adicionadas DEPOIS da explosão do checklist (ex.: o admin
  // vinculou um Wizard de Perguntas a uma exigência). Sem isso, processos
  // antigos nunca veriam o gate até serem re-explodidos. A fonte é sempre o
  // catálogo do serviço: se o admin remover o vínculo, o gate também some.
  let catalogoRegraMap = new Map<string, any>();
  // Mapa de campos de conteúdo (instrucoes, link_emissao, etc.) — mesmo motivo:
  // o admin pode preencher DEPOIS da explosão do checklist; processos antigos
  // ficam sem os dados. Sempre usa catálogo como fallback para campos vazios.
  let catalogoConteudoMap = new Map<string, {
    link_emissao: string | null;
    instrucoes: string | null;
    observacoes_cliente: string | null;
    orgao_emissor: string | null;
    modelo_url: string | null;
    exemplo_url: string | null;
    prazo_recomendado_dias: number | null;
  }>();
  if (processo.servico_id && (dList?.length ?? 0) > 0) {
    try {
      const { data: tpl } = await supabase
        .from("qa_servicos_documentos" as any)
        .select("tipo_documento, ordem, regra_validacao, link_emissao, instrucoes, observacoes_cliente, orgao_emissor, modelo_url, exemplo_url, prazo_recomendado_dias")
        .eq("servico_id", processo.servico_id);
      if (tpl) {
        for (const t of tpl as any[]) {
          const key = String(t.tipo_documento ?? "").toLowerCase();
          ordemMap.set(key, Number(t.ordem ?? 0));
          if (t.regra_validacao && typeof t.regra_validacao === "object") {
            catalogoRegraMap.set(key, t.regra_validacao);
          }
          catalogoConteudoMap.set(key, {
            link_emissao:           t.link_emissao           ?? null,
            instrucoes:             t.instrucoes             ?? null,
            observacoes_cliente:    t.observacoes_cliente    ?? null,
            orgao_emissor:          t.orgao_emissor          ?? null,
            modelo_url:             t.modelo_url             ?? null,
            exemplo_url:            t.exemplo_url            ?? null,
            prazo_recomendado_dias: t.prazo_recomendado_dias ?? null,
          });
        }
      }
    } catch { /* fallback silencioso para ordenação alfabética */ }
  }
  const docsComOrdem = ((dList ?? []) as GuiaDoc[]).map((d) => {
    const key = String((d as any).tipo_documento ?? "").toLowerCase();
    const catalogoRegra   = catalogoRegraMap.get(key);
    const cat             = catalogoConteudoMap.get(key);
    return {
      ...d,
      // Hidrata wizard_pre_documento do catálogo quando o doc do processo não
      // o possui — permite que o admin vincule wizards a exigências sem
      // exigir re-explosão de checklist em processos já existentes.
      regra_validacao: mesclarWizardPreDocumentoCatalogo(
        (d as any).regra_validacao,
        catalogoRegra,
      ),
      // Hidrata campos de conteúdo do catálogo quando o snapshot do processo
      // está vazio — o admin preencheu instrucoes/link_emissao depois da explosão.
      link_emissao:           (d as any).link_emissao           || cat?.link_emissao           || null,
      instrucoes:             (d as any).instrucoes             || cat?.instrucoes             || null,
      observacoes_cliente:    (d as any).observacoes_cliente    || cat?.observacoes_cliente    || null,
      orgao_emissor:          (d as any).orgao_emissor          || cat?.orgao_emissor          || null,
      modelo_url:             (d as any).modelo_url             || cat?.modelo_url             || null,
      exemplo_url:            (d as any).exemplo_url            || cat?.exemplo_url            || null,
      prazo_recomendado_dias: (d as any).prazo_recomendado_dias ?? cat?.prazo_recomendado_dias ?? null,
      // Ordem efetiva: prefere override por processo (qa_processo_documentos.ordem),
      // depois o catálogo (qa_servicos_documentos.ordem).
      _template_ordem:
        (typeof (d as any).ordem === "number" ? (d as any).ordem : null) ??
        (ordemMap.get(key) ?? null),
    };
  });

  return {
    processo,
    docs: docsComOrdem as GuiaDoc[],
    respostas,
    etapaLiberada,
    clienteNome: (cli as any)?.nome_completo ?? null,
  };
}

// Conjunto obrigatório visível no checklist do processo.
// O assistente deve espelhar as exigências explodidas em qa_processo_documentos,
// sem depender de liberação manual de etapa. As regras condicionais continuam
// sendo respeitadas para não pedir documento que ainda depende de resposta.
export function itensObrigatoriosGuia(carga: CargaProcesso): GuiaDoc[] {
  const { docs, respostas } = carga;
  return docs.filter((d) => {
    if (!itemVisivelGuia(d, respostas)) return false;
    // perguntas e o seletor de condição são itens legítimos do checklist
    if (isPerguntaGuia(d) || isCondicaoGuia(d)) return true;
    return d.obrigatorio === true;
  });
}

// Fila de itens que AINDA exigem ação do cliente, na ordem das etapas do checklist.
export function construirFilaGuia(carga: CargaProcesso): GuiaDoc[] {
  const { respostas } = carga;
  // Bloco 13: a fonte e os filtros já vêm do mesmo helper canônico
  // (STATUS_DOCS_ACIONAVEIS = STATUS_CHECKLIST_PENDENTE). A ordenação aqui
  // estende a canônica (etapa → ordem → created_at) com refinamentos
  // próprios do assistente — perguntas/condição primeiro dentro da etapa e
  // prioridade dentro da Etapa 1 (identidade → endereço) — para destravar
  // itens dependentes na ordem certa.
  return itensObrigatoriosGuia(carga)
    .filter((d) => itemPendenteAcaoGuia(d, respostas))
    .sort((a, b) => {
      // Ordem do cliente: 1) etapa  2) ordem do catálogo  3) created_at.
      // Preferimos o campo `etapa` salvo no banco (espelhado de
      // qa_servicos_documentos / qa_processo_documentos) sobre a heurística
      // por tipo_documento — assim a categorização visual respeita o catálogo.
      const ea = etapaDoDoc(a);
      const eb = etapaDoDoc(b);
      if (ea !== eb) return ea - eb;
      // Dentro da Etapa 1: identidade primeiro, depois endereço, depois resto.
      if (ea === 1) {
        const pa = prioridadeEtapa1(a);
        const pb = prioridadeEtapa1(b);
        if (pa !== pb) return pa - pb;
      }
      // perguntas/condição primeiro dentro da etapa (destravam itens dependentes)
      const oa = isPerguntaGuia(a) || isCondicaoGuia(a) ? 0 : 1;
      const ob = isPerguntaGuia(b) || isCondicaoGuia(b) ? 0 : 1;
      if (oa !== ob) return oa - ob;
      // Respeita a ordem definida no admin (qa_servicos_documentos.ordem).
      const oaT = (a as any)._template_ordem;
      const obT = (b as any)._template_ordem;
      if (typeof oaT === "number" && typeof obT === "number" && oaT !== obT) return oaT - obT;
      if (typeof oaT === "number" && typeof obT !== "number") return -1;
      if (typeof obT === "number" && typeof oaT !== "number") return 1;
      // Último tiebreak: created_at (ordem natural de criação do checklist).
      const ca = String((a as any).created_at ?? "");
      const cb = String((b as any).created_at ?? "");
      if (ca && cb && ca !== cb) return ca < cb ? -1 : 1;
      return String(a.nome_documento).localeCompare(String(b.nome_documento));
    });
}

export interface ProgressoGuia {
  total: number;
  cumpridos: number;
  emRevisao: number;
}

export function progressoGuia(carga: CargaProcesso): ProgressoGuia {
  const obrig = itensObrigatoriosGuia(carga);
  const cumpridos = obrig.filter((d) => itemCumpridoGuia(d, carga.respostas)).length;
  const emRevisao = obrig.filter((d) => d.status === "em_revisao_humana").length;
  return { total: obrig.length, cumpridos, emRevisao };
}

// ---------------------------------------------------------------------------
// AÇÕES — todas reaproveitam exatamente o que o drawer já faz.
// ---------------------------------------------------------------------------
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function authHeader(): Promise<Record<string, string>> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export interface ResultadoAcao {
  ok: boolean;
  error?: string;
  documentoId?: string | null;
  redirecionado?: boolean;
}

// Espelho de handleUpload (sem alterar a edge function).
export async function enviarDocumentoGuia(
  processo: GuiaProcesso,
  doc: GuiaDoc,
  file: File,
  armaId?: string | null,
): Promise<ResultadoAcao> {
  // Validação de formato no front (UX rápida) — idêntica ao drawer.
  // Aceita tanto extensões ("pdf","jpg") quanto MIME ("application/pdf","image/jpeg").
  const normalizeFmt = (f: string): string => {
    const s = String(f).toLowerCase().trim();
    if (!s) return s;
    const sub = s.includes("/") ? (s.split("/").pop() || s) : s;
    return sub === "jpeg" ? "jpg" : sub;
  };
  const fmts: string[] = Array.isArray(doc.formato_aceito)
    ? (doc.formato_aceito as string[]).map(normalizeFmt).filter(Boolean)
    : [];
  const extRaw = (file.name.split(".").pop() || "").toLowerCase();
  const ext = extRaw === "jpeg" ? "jpg" : extRaw;
  if (fmts.length > 0 && !fmts.includes(ext)) {
    const msg =
      fmts.length === 1 && fmts[0] === "pdf"
        ? "Este documento deve ser enviado exclusivamente em PDF."
        : `Formato não aceito. Envie: ${fmts.join(", ").toUpperCase()}.`;
    return { ok: false, error: msg };
  }
  try {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const key = `${processo.cliente_id}/${processo.id}/${doc.id}-${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage
      .from("qa-processo-docs")
      .upload(key, file, { contentType: file.type || "application/octet-stream", upsert: true });
    if (upErr) throw upErr;

    const headers = await authHeader();
    const resp = await fetch(`${SUPA_URL}/functions/v1/qa-processo-doc-upload`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        processo_id: processo.id,
        documento_id: doc.id,
        storage_path: key,
        mime_type: file.type,
        tamanho_bytes: file.size,
        nome_arquivo_original: file.name,
        ...(armaId ? { arma_id: armaId } : {}),
      }),
    });
    const out = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = out?.error || out?.message || JSON.stringify(out) || "Falha ao registrar upload";
      throw new Error(msg);
    }
    const documentoIdAlvo =
      (out?.documento_id_alvo as string | null | undefined) ??
      (out?.documento?.id as string | null | undefined) ??
      doc.id;
    // Extração de datas em background (mesmo comportamento do drawer).
    fetch(`${SUPA_URL}/functions/v1/qa-extract-doc-dates`, {
      method: "POST",
      headers,
        body: JSON.stringify({ documento_id: documentoIdAlvo }),
    }).catch(() => {
      /* background — não bloqueia o fluxo */
    });
    return { ok: true, documentoId: documentoIdAlvo, redirecionado: !!out?.redirecionado };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Erro no upload" };
  }
}

const STATUS_EM_VOO = new Set(["em_analise", "enviado", "fila"]);

// Faz polling do documento até a IA concluir (status sai de em_analise/fila).
// Retorna a linha final do documento. NÃO altera nada no banco.
export async function aguardarValidacaoIAGuia(
  docId: string,
  opts?: { timeoutMs?: number; intervalMs?: number },
): Promise<GuiaDoc | null> {
  const timeout = opts?.timeoutMs ?? 70000;
  const interval = opts?.intervalMs ?? 2500;
  const start = Date.now();
  let last: GuiaDoc | null = null;
  while (Date.now() - start < timeout) {
    const { data } = await supabase
      .from("qa_processo_documentos")
      .select("*")
      .eq("id", docId)
      .maybeSingle();
    last = (data as GuiaDoc) ?? last;
    const st = (data as any)?.status as string | undefined;
    const ia = (data as any)?.validacao_ia_status as string | undefined;
    const iaTerminou = !ia || (ia !== "fila" && ia !== "processando");
    if (st && !STATUS_EM_VOO.has(st) && iaTerminou) return last;
    // status terminal explícito mesmo que ia ainda em flag
    if (st && (st === "aprovado" || st === "invalido" || st === "divergente" || st === "dispensado_grupo" || st === "em_revisao_humana"))
      return last;
    await new Promise((r) => setTimeout(r, interval));
  }
  return last;
}

// Espelho de responderPergunta (ordem dos updates respeitando o trigger SQL).
export async function responderPerguntaGuia(
  processo: GuiaProcesso,
  doc: GuiaDoc,
  valor: string,
): Promise<ResultadoAcao> {
  try {
    const chave = (doc.regra_validacao as any)?.chave as string;
    if (!chave) throw new Error("Pergunta sem chave configurada");
    // RLS bloqueia UPDATE em qa_processos pelo cliente — usamos edge function
    // service_role (camada aditiva) para gravar resposta + status + evento.
    const headers = await authHeader();
    const resp = await fetch(
      `${SUPA_URL}/functions/v1/qa-processo-responder-pergunta`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          processo_id: processo.id,
          documento_id: doc.id,
          chave,
          valor,
        }),
      },
    );
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || "Falha ao registrar resposta");
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erro ao responder" };
  }
}

// Espelho de setCondicao (chama a edge function que recalcula o checklist de renda).
export async function definirCondicaoGuia(
  processo: GuiaProcesso,
  cond: (typeof CONDICAO_OPCOES_GUIA)[number]["id"],
): Promise<ResultadoAcao> {
  try {
    const headers = await authHeader();
    const resp = await fetch(`${SUPA_URL}/functions/v1/qa-processo-set-condicao`, {
      method: "POST",
      headers,
      body: JSON.stringify({ processo_id: processo.id, condicao_profissional: cond }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || "Falha ao salvar condição");
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erro ao salvar condição" };
  }
}

// ---------------------------------------------------------------------------
// Descoberta de processos elegíveis para o assistente (documentação liberada).
// ---------------------------------------------------------------------------
export interface ProcessoElegivel {
  id: string;
  servico_nome: string;
  status: string;
  pagamento_status: string;
  /** Legado interno: soma somente ações resolvíveis agora. Não usar para texto do card. */
  pendentes: number;
  em_analise: number;
  documentos_em_analise: number;
  total: number;
  cumpridos: number;
  pct: number;
  percentual: number;
  /** Contagens granulares vindas de calcularResumoProcessoAssistente. */
  documentos_pendentes_cliente: number;
  wizards_pendentes: number;
  label_resumo: string;
}

// ---------------------------------------------------------------------------
// Resumo do processo para o Assistente — fonte única de verdade da contagem
// exibida nos cards de seleção de processos e no auto-popup.
// ---------------------------------------------------------------------------
// Regra de ouro: pendência = aquilo que o cliente pode resolver AGORA.
// - Doc em análise / em revisão humana / aprovado / dispensado → NÃO é pendência.
// - Doc bloqueado por wizard pré-documento → conta como "pergunta pendente",
//   não como documento pendente (evita inflar a contagem quando 1 wizard
//   destrava vários documentos do mesmo grupo).
// - Pergunta nativa do checklist (regra_validacao.tipo === "pergunta") e o
//   seletor de condição profissional também contam como "pergunta pendente".
// ---------------------------------------------------------------------------
export interface ResumoProcessoAssistente {
  totalDocumentos: number;
  documentosResolvidos: number;
  documentosPendentesCliente: number;
  documentosEmAnalise: number;
  wizardsPendentes: number;
  percentual: number;
  labelResumo: string;
}

export function calcularResumoProcessoAssistente(
  carga: CargaProcesso,
  cliente?: Record<string, any> | null,
): ResumoProcessoAssistente {
  const obrig = itensObrigatoriosGuia(carga);
  const totalDocumentos = obrig.length;
  const documentosResolvidos = obrig.filter((d) =>
    itemCumpridoGuia(d, carga.respostas),
  ).length;
  const documentosEmAnalise = obrig.filter((d) =>
    isChecklistEmAnalise(d.status),
  ).length;

  // Itens que ainda exigem ação concreta do cliente.
  const acionaveis = obrig.filter((d) =>
    isDocumentActionable(d, carga.respostas),
  );

  // Wizards pendentes deduplicados por wizard_key.
  // Perguntas nativas pendentes contam como pergunta também (cada uma uma).
  const wizardKeys = new Set<string>();
  let perguntasNativasPendentes = 0;
  let documentosPendentesCliente = 0;
  for (const d of acionaveis) {
    if (isPerguntaGuia(d) || isCondicaoGuia(d)) {
      perguntasNativasPendentes += 1;
      continue;
    }
    const wp = wizardPendentePara(
      d as any,
      cliente ?? null,
      carga.processo as any,
    );
    if (wp) {
      wizardKeys.add(wp.wizard_key);
      continue; // doc bloqueado por wizard NÃO é pendência documental agora
    }
    documentosPendentesCliente += 1;
  }
  const wizardsPendentes = wizardKeys.size + perguntasNativasPendentes;

  const percentual =
    totalDocumentos > 0
      ? Math.round((documentosResolvidos / totalDocumentos) * 100)
      : 0;

  const parts: string[] = [];
  if (documentosPendentesCliente > 0) {
    parts.push(
      `${documentosPendentesCliente} documento${documentosPendentesCliente === 1 ? "" : "s"} pendente${documentosPendentesCliente === 1 ? "" : "s"}`,
    );
  }
  if (wizardsPendentes > 0) {
    parts.push(
      `${wizardsPendentes} pergunta${wizardsPendentes === 1 ? "" : "s"} pendente${wizardsPendentes === 1 ? "" : "s"}`,
    );
  }
  if (parts.length === 0 && documentosEmAnalise > 0) {
    parts.push(`${documentosEmAnalise} em análise`);
  } else if (documentosEmAnalise > 0) {
    parts.push(`${documentosEmAnalise} em análise`);
  }
  if (parts.length === 0) parts.push("Tudo em dia");
  parts.push(`${percentual}% pronto`);

  return {
    totalDocumentos,
    documentosResolvidos,
    documentosPendentesCliente,
    documentosEmAnalise,
    wizardsPendentes,
    percentual,
    labelResumo: parts.join(" · "),
  };
}

export async function listarProcessosElegiveisGuia(clienteId: number): Promise<ProcessoElegivel[]> {
  const { data: procs, error } = await supabase
    .from("qa_processos")
    .select("id, servico_id, servico_nome, status, pagamento_status, data_criacao, etapa_liberada_ate, respostas_questionario_json")
    .eq("cliente_id", clienteId)
    .order("data_criacao", { ascending: false });
  if (error) throw error;

  // Carrega o cliente uma única vez — usado como fallback legado pelo
  // wizardPendentePara (fonte primária é qa_processos.respostas_questionario_json).
  const { data: clienteRow } = await supabase
    .from("qa_clientes")
    .select("*")
    .eq("id", clienteId)
    .maybeSingle();

  const elegiveis: ProcessoElegivel[] = [];
  for (const p of (procs ?? []) as any[]) {
    // só processos com documentação liberada (pagamento confirmado) e não concluídos
    if (p.pagamento_status === "aguardando") continue;
    if (p.status === "concluido" || p.status === "cancelado") continue;
    const { data: docs } = await supabase
      .from("qa_processo_documentos")
      .select("*")
      .eq("processo_id", p.id)
      .order("created_at");
    // Hidrata wizard_pre_documento do catálogo — necessário para que a
    // contagem de "perguntas pendentes" reflita vínculos adicionados depois
    // que o checklist foi explodido.
    let docsHidratados = (docs ?? []) as GuiaDoc[];
    if (p.servico_id && docsHidratados.length > 0) {
      try {
        const { data: tpl } = await supabase
          .from("qa_servicos_documentos" as any)
          .select("tipo_documento, regra_validacao")
          .eq("servico_id", p.servico_id);
        const mapCat = new Map<string, any>();
        for (const t of (tpl ?? []) as any[]) {
          if (t?.regra_validacao && typeof t.regra_validacao === "object") {
            mapCat.set(String(t.tipo_documento ?? "").toLowerCase(), t.regra_validacao);
          }
        }
        docsHidratados = docsHidratados.map((d) => ({
          ...d,
          regra_validacao: mesclarWizardPreDocumentoCatalogo(
            (d as any).regra_validacao,
            mapCat.get(String((d as any).tipo_documento ?? "").toLowerCase()),
          ),
        })) as GuiaDoc[];
      } catch { /* hidratação é melhor-esforço */ }
    }
    const respostas = (p.respostas_questionario_json ?? {}) as Record<string, string>;
    const etapaLiberada = Math.max(1, Math.min(5, p.etapa_liberada_ate ?? 1));
    const carga: CargaProcesso = { processo: p, docs: docsHidratados, respostas, etapaLiberada };
    const resumo = calcularResumoProcessoAssistente(carga, clienteRow as any);
    // `pendentes` agora reflete o que o cliente pode resolver AGORA:
    // documentos acionáveis (não bloqueados por wizard) + perguntas/wizards pendentes.
    // Mantemos o nome do campo para preservar a API usada por auto-open
    // (`contarPendentesClienteGuia`) e pela seleção do processo default.
    elegiveis.push({
      id: p.id,
      servico_nome: p.servico_nome,
      status: p.status,
      pagamento_status: p.pagamento_status,
      pendentes: resumo.documentosPendentesCliente + resumo.wizardsPendentes,
      em_analise: resumo.documentosEmAnalise,
      documentos_em_analise: resumo.documentosEmAnalise,
      total: resumo.totalDocumentos,
      cumpridos: resumo.documentosResolvidos,
      pct: resumo.percentual,
      percentual: resumo.percentual,
      documentos_pendentes_cliente: resumo.documentosPendentesCliente,
      wizards_pendentes: resumo.wizardsPendentes,
      label_resumo: resumo.labelResumo,
    });
  }
  return elegiveis;
}

export async function contarPendentesClienteGuia(clienteId: number): Promise<number> {
  try {
    const lista = await listarProcessosElegiveisGuia(clienteId);
    return lista.reduce((acc, p) => acc + p.pendentes, 0);
  } catch {
    return 0;
  }
}
