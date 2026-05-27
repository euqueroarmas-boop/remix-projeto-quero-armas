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

export interface GuiaProcesso {
  id: string;
  cliente_id: number;
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
    t === "declaracao_responsavel_imovel" ||
    t === "declaracao_sem_inquerito_processo_criminal"
  )
    return 1;
  if (t.includes("endereco") || t.includes("residenc")) return 1;
  if (t.startsWith("declaracao") || t.startsWith("dsa_") || t.includes("compromisso")) return 4;
  return 1;
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
  // em_revisao_humana = cliente já fez a parte dele (aguarda equipe) → conta como entregue
  return d.status === "aprovado" || d.status === "dispensado_grupo" || d.status === "em_revisao_humana";
}

// Item ainda exige AÇÃO do cliente (entra na fila do assistente)?
export function itemPendenteAcaoGuia(d: GuiaDoc, respostas: Record<string, string>): boolean {
  if (isPerguntaGuia(d)) {
    const chave = (d.regra_validacao as any)?.chave as string | undefined;
    if (!chave) return false;
    return !(respostas[chave] !== undefined && respostas[chave] !== null && respostas[chave] !== "");
  }
  if (isCondicaoGuia(d)) return true; // some quando a condição é definida
  // documentos: precisa (re)enviar quando pendente/invalido/divergente. em_analise = em validação.
  return d.status === "pendente" || d.status === "invalido" || d.status === "divergente" || d.status === "em_analise";
}

export type TipoItemGuia = "pergunta" | "condicao" | "documento";

export function tipoItemGuia(d: GuiaDoc): TipoItemGuia {
  if (isPerguntaGuia(d)) return "pergunta";
  if (isCondicaoGuia(d)) return "condicao";
  return "documento";
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

export async function carregarProcessoGuia(processoId: string): Promise<CargaProcesso> {
  const { data: p, error: pErr } = await supabase
    .from("qa_processos")
    .select(
      "id, cliente_id, servico_nome, status, pagamento_status, data_criacao, etapa_liberada_ate, respostas_questionario_json, condicao_profissional",
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
  return {
    processo,
    docs: (dList ?? []) as GuiaDoc[],
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
  return itensObrigatoriosGuia(carga)
    .filter((d) => itemPendenteAcaoGuia(d, respostas))
    .sort((a, b) => {
      const ea = etapaDoTipoGuia(a.tipo_documento);
      const eb = etapaDoTipoGuia(b.tipo_documento);
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
}

// Espelho de handleUpload (sem alterar a edge function).
export async function enviarDocumentoGuia(
  processo: GuiaProcesso,
  doc: GuiaDoc,
  file: File,
): Promise<ResultadoAcao> {
  // Validação de formato no front (UX rápida) — idêntica ao drawer.
  const fmts: string[] = Array.isArray(doc.formato_aceito)
    ? (doc.formato_aceito as string[]).map((f) => String(f).toLowerCase())
    : [];
  const ext = (file.name.split(".").pop() || "").toLowerCase();
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
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || "Falha ao registrar upload");
    }
    // Extração de datas em background (mesmo comportamento do drawer).
    fetch(`${SUPA_URL}/functions/v1/qa-extract-doc-dates`, {
      method: "POST",
      headers,
      body: JSON.stringify({ documento_id: doc.id }),
    }).catch(() => {
      /* background — não bloqueia o fluxo */
    });
    return { ok: true };
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
  pendentes: number;
}

export async function listarProcessosElegiveisGuia(clienteId: number): Promise<ProcessoElegivel[]> {
  const { data: procs, error } = await supabase
    .from("qa_processos")
    .select("id, servico_nome, status, pagamento_status, data_criacao, etapa_liberada_ate, respostas_questionario_json")
    .eq("cliente_id", clienteId)
    .order("data_criacao", { ascending: false });
  if (error) throw error;

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
    const respostas = (p.respostas_questionario_json ?? {}) as Record<string, string>;
    const etapaLiberada = Math.max(1, Math.min(5, p.etapa_liberada_ate ?? 1));
    const carga: CargaProcesso = { processo: p, docs: (docs ?? []) as GuiaDoc[], respostas, etapaLiberada };
    const fila = construirFilaGuia(carga);
    elegiveis.push({
      id: p.id,
      servico_nome: p.servico_nome,
      status: p.status,
      pagamento_status: p.pagamento_status,
      pendentes: fila.length,
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
