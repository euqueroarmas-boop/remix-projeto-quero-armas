// ─────────────────────────────────────────────────────────────────────────────
// MOTOR DE SIMULAÇÃO DO CHECKLIST
//
// Reproduz EXATAMENTE, no navegador, a mesma regra que o banco aplica em
// public.qa_explodir_checklist_processo + qa-processo-responder-pergunta:
//
//   1. só linhas ativas do serviço (qa_servicos_documentos.ativo)
//   2. condicao_profissional NULL  → sempre entra
//      condicao_profissional = X   → só entra se a condição escolhida for X
//   3. condicao_modalidade NULL    → sempre entra
//      condicao_modalidade = [..]  → só entra se a modalidade escolhida constar
//   4. deduplicação por tipo_documento (linha sem condição vence; depois ordem)
//   5. perguntas (regra_validacao.tipo = "pergunta") aparecem conforme
//      regra_validacao.depende_de {chave, valor}
//   6. documentos condicionais (regra_validacao.exige_quando / .condicional)
//      só aparecem quando a resposta bate; caso contrário ficam dispensados
//
// Qualquer alteração feita em Preços e Serviços / Montar Checklist muda o
// resultado desta simulação — e vice-versa. Não há regra duplicada aqui.
// ─────────────────────────────────────────────────────────────────────────────

export type LinhaCatalogo = {
  id: string;
  servico_id: number;
  tipo_documento: string;
  nome_documento: string;
  etapa: string;
  ordem: number;
  ativo: boolean;
  obrigatorio: boolean;
  condicao_profissional: string | null;
  condicao_modalidade: string[] | null;
  regra_validacao: any | null;
  instrucoes?: string | null;
  observacoes_cliente?: string | null;
  link_emissao?: string | null;
  validade_dias?: number | null;
};

export type OpcaoPergunta = { label: string; valor: string };

export type EstadoItem =
  | "pendente"      // aparece agora para o cliente
  | "cumprido"      // simulado como entregue/respondido
  | "dispensado"    // resposta atual não aciona esta exigência
  | "aguardando";   // depende de uma resposta que ainda não foi dada

export type ItemSimulado = {
  id: string;
  tipo: "pergunta" | "documento";
  tipo_documento: string;
  nome_documento: string;
  etapa: string;
  grupo: string;
  ordemGrupo: number;
  rotuloGrupo: string;
  ordem: number;
  obrigatorio: boolean;
  estado: EstadoItem;
  motivo?: string;
  chave?: string;
  opcoes?: OpcaoPergunta[];
  dependeDe?: { chave: string; valores: string[] };
  linha: LinhaCatalogo;
};

export type GrupoSimulado = {
  grupo: string;
  rotulo: string;
  itens: ItemSimulado[];
  pendentes: number;
  cumpridos: number;
  /** Itens que ainda dependem de uma resposta anterior nesta simulação. */
  aguardando: number;
  /** Itens que existem no grupo e não foram dispensados nesta combinação. */
  total: number;
};

export type Alerta = { nivel: "erro" | "aviso"; texto: string };

export type EntradaSimulacao = {
  linhas: LinhaCatalogo[];
  condicao: string | null;
  modalidade: string | null;
  respostas: Record<string, string>;
  entregues: Record<string, boolean>;
};

export type ResultadoSimulacao = {
  grupos: GrupoSimulado[];
  visiveis: ItemSimulado[];
  proximo: ItemSimulado | null;
  totalPendentes: number;
  totalCumpridos: number;
  progresso: number;
  alertas: Alerta[];
  ignoradosPorDuplicidade: ItemSimulado[];
};

/** Opções canônicas da condição profissional (mesmos valores do catálogo). */
export const CONDICOES_CHECKLIST: OpcaoPergunta[] = [
  { label: "CLT — CARTEIRA ASSINADA", valor: "clt" },
  { label: "SERVIDOR PÚBLICO (ÁREA GERAL)", valor: "funcionario_publico" },
  { label: "SERVIDOR DE SEGURANÇA PÚBLICA (PM, PC, PF, PRF, GUARDA, BOMBEIRO, AGENTE PENITENCIÁRIO)", valor: "seguranca_publica" },
  { label: "AUTÔNOMO / MEI", valor: "autonomo" },
  { label: "EMPRESÁRIO / SÓCIO", valor: "empresario" },
  { label: "APOSENTADO OU PENSIONISTA", valor: "aposentado" },
];

export const CONDICOES: OpcaoPergunta[] = [
  ...CONDICOES_CHECKLIST,
  { label: "INDEFINIDO", valor: "indefinido" },
];

// ─── MULTI-CONDIÇÃO ──────────────────────────────────────────────────────────
// `condicao_profissional` aceita UMA condição ("autonomo") ou VÁRIAS separadas
// por vírgula ("autonomo,empresario"). Regra única lida pelo simulador, pelo
// admin e pelo qa-processo-set-condicao.
export function parseCondicoes(valor: string | null | undefined): string[] {
  return String(valor ?? "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

export function serializarCondicoes(valores: string[]): string | null {
  const limpos = Array.from(new Set(valores.map((v) => v.trim().toLowerCase()).filter(Boolean)));
  return limpos.length ? limpos.join(",") : null;
}

/** true quando a linha vale para a condição escolhida (ou não tem condição). */
export function condicaoCasa(valor: string | null | undefined, condicao: string | null): boolean {
  const lista = parseCondicoes(valor);
  if (lista.length === 0) return true;
  if (!condicao || condicao === "indefinido") return false;
  return lista.includes(String(condicao).toLowerCase());
}

export function rotulosCondicoes(valor: string | null | undefined): string {
  return parseCondicoes(valor)
    .map((v) => CONDICOES_CHECKLIST.find((c) => c.valor === v)?.label ?? v.toUpperCase())
    .join(" OU ");
}

export const MODALIDADES: OpcaoPergunta[] = [
  { label: "DEFESA PESSOAL", valor: "defesa_pessoal" },
  { label: "ATIRADOR ESPORTIVO", valor: "atirador" },
  { label: "CAÇADOR", valor: "cacador" },
  { label: "COLECIONADOR", valor: "colecionador" },
];

/** Mesmo mapeamento de etapa_segura usado por qa_explodir_checklist_processo. */
export function etapaSegura(etapa: string): string {
  const e = String(etapa || "").trim().toLowerCase();
  if (["base", "complementar", "tecnico", "final"].includes(e)) return e;
  if (e === "antecedentes") return "base";
  if (e === "declaracoes" || e === "renda") return "complementar";
  return "base";
}

import { grupoDaPendencia, ordemGrupo, PENDENCIA_GRUPOS, type PendenciaGrupoId } from "./pendenciasGrupos";

/**
 * Grupo temático canônico do sistema (identificação, endereço, antecedentes,
 * ocupação lícita, ...). É a MESMA classificação usada pelo portal do cliente
 * (pendenciasGrupos.ts) — o simulador não inventa grupos próprios nem usa a
 * `etapa` crua do catálogo.
 */
export function grupoCanonico(tipoDocumento: string, regraValidacao?: any): PendenciaGrupoId {
  const override = String(regraValidacao?.grupo_checklist ?? "").trim().toLowerCase();
  if (override && Object.prototype.hasOwnProperty.call(PENDENCIA_GRUPOS, override)) {
    return override as PendenciaGrupoId;
  }
  return grupoDaPendencia(tipoDocumento).id;
}

export function ordemGrupoChecklist(tipoDocumento: string, regraValidacao?: any): number {
  const manual = Number(regraValidacao?.ordem_grupo_checklist);
  if (Number.isFinite(manual) && manual > 0) return manual;
  return ordemGrupo(grupoCanonico(tipoDocumento, regraValidacao));
}

export function rotuloGrupo(grupo: string): string {
  const g = String(grupo || "").trim().toLowerCase();
  const meta = (PENDENCIA_GRUPOS as any)[g];
  if (meta) return String(meta.label).toUpperCase();
  if (g === "base") return "DOCUMENTOS BASE";
  if (g === "endereco" || g === "endereço") return "COMPROVAÇÃO DE ENDEREÇO";
  if (g === "condicao_profissional" || g === "renda") return "CONDIÇÃO PROFISSIONAL / RENDA";
  if (g === "complementar") return "DOCUMENTOS COMPLEMENTARES";
  if (g === "tecnico") return "EXAMES TÉCNICOS";
  if (g === "final") return "ETAPA FINAL";
  if (g === "antecedentes") return "ANTECEDENTES CRIMINAIS";
  if (g === "declaracoes") return "DECLARAÇÕES";
  return g.replace(/_/g, " ").toUpperCase();
}

/**
 * Tipos de linha que o cliente RESPONDE (não envia arquivo). Além do "pergunta"
 * clássico, o catálogo também usa "seletor_condicao_profissional" — que é a
 * pergunta que destrava os comprovantes de ocupação lícita.
 */
function ehPergunta(rv: any): boolean {
  if (!rv || typeof rv !== "object") return false;
  return rv.tipo === "pergunta" || rv.tipo === "seletor_condicao_profissional";
}

function ehSeletorCondicao(rv: any, tipoDocumento?: string): boolean {
  if (tipoDocumento === "renda_definir_condicao") return true;
  if (!rv || typeof rv !== "object") return false;
  return rv.tipo === "seletor_condicao_profissional" || rv.chave === "condicao_profissional";
}

/** Chave gravada no processo por esta pergunta. */
function chavePergunta(rv: any, tipoDocumento?: string): string {
  const chave = String(rv?.chave ?? "").trim();
  if (chave) return chave;
  if (ehSeletorCondicao(rv, tipoDocumento)) return "condicao_profissional";
  return "";
}

/** Opções da pergunta, com fallback canônico para a condição profissional. */
function opcoesPergunta(rv: any, tipoDocumento?: string): OpcaoPergunta[] | undefined {
  if (Array.isArray(rv?.opcoes) && rv.opcoes.length > 0) return rv.opcoes as OpcaoPergunta[];
  if (ehSeletorCondicao(rv, tipoDocumento)) return CONDICOES_CHECKLIST;
  return undefined;
}

/** Normaliza um valor de condição para lista (aceita string ou array). */
function valoresCondicao(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [String(v ?? "")];
}

/** Extrai a dependência do item nos dois formatos legados aceitos no banco. */
function extrairDependencia(rv: any): { chave: string; valores: string[] } | null {
  if (!rv || typeof rv !== "object") return null;
  if (rv.depende_de && typeof rv.depende_de === "object" && rv.depende_de.chave) {
    return { chave: String(rv.depende_de.chave), valores: valoresCondicao(rv.depende_de.valor) };
  }
  if (rv.exige_quando && typeof rv.exige_quando === "object") {
    const chaves = Object.keys(rv.exige_quando);
    if (chaves.length === 1) {
      return { chave: chaves[0], valores: valoresCondicao(rv.exige_quando[chaves[0]]) };
    }
  }
  if (rv.condicional && typeof rv.condicional === "object" && rv.condicional.depende_de) {
    return { chave: String(rv.condicional.depende_de), valores: valoresCondicao(rv.condicional.valor) };
  }
  return null;
}

/** Deduplicação idêntica à do SQL: sem condição primeiro, depois ordem, depois id. */
function dedupPorTipo(
  linhas: LinhaCatalogo[],
  separarPorCondicao = false,
): { manter: LinhaCatalogo[]; descartadas: LinhaCatalogo[] } {
  const porTipo = new Map<string, LinhaCatalogo[]>();
  for (const l of linhas) {
    const chave = separarPorCondicao
      ? `${l.tipo_documento}::${l.condicao_profissional ?? ""}`
      : l.tipo_documento;
    const arr = porTipo.get(chave) ?? [];
    arr.push(l);
    porTipo.set(chave, arr);
  }
  const manter: LinhaCatalogo[] = [];
  const descartadas: LinhaCatalogo[] = [];
  for (const arr of porTipo.values()) {
    const ordenadas = [...arr].sort((a, b) => {
      const ca = a.condicao_profissional == null ? 0 : 1;
      const cb = b.condicao_profissional == null ? 0 : 1;
      if (ca !== cb) return ca - cb;
      const oa = a.ordem ?? 999;
      const ob = b.ordem ?? 999;
      if (oa !== ob) return oa - ob;
      return a.id.localeCompare(b.id);
    });
    manter.push(ordenadas[0]);
    descartadas.push(...ordenadas.slice(1));
  }
  return { manter, descartadas };
}

export function simularChecklist(entrada: EntradaSimulacao): ResultadoSimulacao {
  const { condicao, modalidade, respostas, entregues } = entrada;

  const ativas = entrada.linhas.filter((l) => l.ativo);

  // Perguntas de rota são infraestrutura do checklist, não conteúdo de IA.
  // Se um documento aplicável nesta combinação depende de uma chave, a pergunta
  // que grava essa chave precisa entrar junto, mesmo que tenha herdado uma
  // condição profissional/modalidade antiga. A aplicabilidade continua sendo
  // determinada pelos documentos ligados à rota, configurados pelo administrador.
  const chavesDeRotaNecessarias = new Set(
    ativas
      .filter((l) => {
        if (ehPergunta(l.regra_validacao)) return false;
        const cpOk =
          l.condicao_profissional == null ||
          !condicao ||
          condicao === "indefinido" ||
          condicaoCasa(l.condicao_profissional, condicao);
        const mods = Array.isArray(l.condicao_modalidade) ? l.condicao_modalidade : null;
        const modOk = !mods || mods.length === 0 || !modalidade || mods.includes(modalidade);
        return cpOk && modOk;
      })
      .map((l) => extrairDependencia(l.regra_validacao)?.chave)
      .filter(Boolean) as string[],
  );

  const filtradas = ativas.filter((l) => {
    // Sem condição definida ainda, as linhas amarradas a uma condição NÃO somem:
    // ficam visíveis como "aguardando a resposta" (igual ao grupo de endereço).
    const cpOk =
      l.condicao_profissional == null ||
      !condicao ||
      condicao === "indefinido" ||
      condicaoCasa(l.condicao_profissional, condicao);
    const mods = Array.isArray(l.condicao_modalidade) ? l.condicao_modalidade : null;
    const modOk = !mods || mods.length === 0 || !modalidade || mods.includes(modalidade);
    const chave = ehPergunta(l.regra_validacao)
      ? chavePergunta(l.regra_validacao, l.tipo_documento)
      : "";
    if (chave && chavesDeRotaNecessarias.has(chave)) return true;
    if (!cpOk || !modOk) return false;
    // BLINDAGEM: exigência de renda/ocupação cadastrada SEM condição no catálogo
    // não pode vazar para todas as condições (ex.: CTD aparecendo para servidor
    // público). Assim que o cliente define a condição, só entram as linhas
    // daquela condição — a pergunta de definição continua sempre visível.
    if (l.condicao_profissional == null && condicao && condicao !== "indefinido") {
      const g = grupoCanonico(l.tipo_documento, l.regra_validacao);
      const ehRenda = g === "ocupacao";
      const ehSeletor =
        ehPergunta(l.regra_validacao) || l.tipo_documento === "renda_definir_condicao";
      if (ehRenda && !ehSeletor) return false;
    }
    return true;
  });

  const semCondicaoDefinida = !condicao || condicao === "indefinido";
  const { manter, descartadas } = dedupPorTipo(filtradas, semCondicaoDefinida);

  const paraItem = (l: LinhaCatalogo, estado: EstadoItem, motivo?: string): ItemSimulado => {
    const rv = l.regra_validacao;
    const grupo = grupoCanonico(l.tipo_documento, l.regra_validacao);
    return {
      id: l.id,
      tipo: ehPergunta(rv) ? "pergunta" : "documento",
      tipo_documento: l.tipo_documento,
      nome_documento: l.nome_documento,
      etapa: l.etapa,
      grupo,
      ordemGrupo: ordemGrupoChecklist(l.tipo_documento, l.regra_validacao),
      rotuloGrupo: rotuloGrupo(grupo),
      ordem: l.ordem ?? 999,
      obrigatorio: !!l.obrigatorio,
      estado,
      motivo,
      chave: ehPergunta(rv) ? chavePergunta(rv, l.tipo_documento) : undefined,
      opcoes: ehPergunta(rv) ? opcoesPergunta(rv, l.tipo_documento) : undefined,
      dependeDe: extrairDependencia(rv) ?? undefined,
      linha: l,
    };
  };

  const itens: ItemSimulado[] = manter
    .sort((a, b) => {
      // Ordem canônica idêntica à do portal: primeiro o grupo temático,
      // depois a ordem interna. Sem isso um item de outro grupo com número
      // menor (ex.: ocupação 80) "furava a fila" do endereço (81).
      const ga = ordemGrupoChecklist(a.tipo_documento, a.regra_validacao);
      const gb = ordemGrupoChecklist(b.tipo_documento, b.regra_validacao);
      if (ga !== gb) return ga - gb;
      return (a.ordem ?? 999) - (b.ordem ?? 999);
    })
    .map((l) => {
      const rv = l.regra_validacao;
      const dep = extrairDependencia(rv);
      const pergunta = ehPergunta(rv);
      const chave = pergunta ? chavePergunta(rv, l.tipo_documento) : "";

      // dispensa_quando: exigência sai do checklist quando a resposta casa
      // (ex.: servidor de segurança pública usa os exames da instituição).
      const disp = (rv as any)?.dispensa_quando;
      if (disp && typeof disp === "object") {
        const entradas = Object.entries(disp as Record<string, any>);
        if (
          entradas.length > 0 &&
          entradas.every(([k, v]) => valoresCondicao(v).includes(String(respostas[k])))
        ) {
          const [k, v] = entradas[0];
          return paraItem(
            l,
            "dispensado",
            `DISPENSADO PORQUE "${k.toUpperCase()}" = ${valoresCondicao(v).join(" OU ").toUpperCase()}`,
          );
        }
      }

      // Exigência amarrada a uma condição profissional ainda não escolhida:
      // mostra como "aguardando", com relógio, igual ao grupo de endereço.
      if (l.condicao_profissional && semCondicaoDefinida) {
        const rotulo = rotulosCondicoes(l.condicao_profissional);
        return paraItem(l, "aguardando", `SÓ APARECE SE A CONDIÇÃO PROFISSIONAL FOR "${rotulo}"`);
      }

      // Item condicional: depende de resposta anterior.
      if (dep) {
        const resposta = respostas[dep.chave];
        if (resposta == null) {
          return paraItem(l, "aguardando", `AGUARDA A RESPOSTA DE "${dep.chave.toUpperCase()}"`);
        }
        if (!dep.valores.includes(String(resposta))) {
          return paraItem(
            l,
            "dispensado",
            `NÃO EXIGIDO PORQUE "${dep.chave.toUpperCase()}" = ${String(resposta).toUpperCase()}`,
          );
        }
      }

      if (pergunta) {
        const respondida = chave && respostas[chave] != null;
        // Pergunta HÍBRIDA: respondida no gatilho, ainda exige o arquivo.
        const gatilho = (rv as any)?.exige_documento_quando;
        if (respondida && gatilho != null) {
          const alvos = (Array.isArray(gatilho) ? gatilho : [gatilho]).map((v: any) =>
            String(v).trim().toLowerCase(),
          );
          const casa =
            alvos.includes("*") ||
            alvos.includes(String(respostas[chave]).trim().toLowerCase());
          if (casa) {
            const item = paraItem(
              l,
              entregues[l.tipo_documento] ? "cumprido" : "pendente",
              entregues[l.tipo_documento]
                ? undefined
                : `RESPONDIDO: ${String(respostas[chave]).toUpperCase()} — FALTA ANEXAR O DOCUMENTO`,
            );
            return { ...item, tipo: "documento" as const };
          }
        }
        return paraItem(
          l,
          respondida ? "cumprido" : "pendente",
          respondida ? `RESPONDIDO: ${String(respostas[chave]).toUpperCase()}` : undefined,
        );
      }

      return paraItem(l, entregues[l.tipo_documento] ? "cumprido" : "pendente");
    });

  // Agrupamento pelos grupos temáticos canônicos, na ordem oficial do sistema
  // (identificação → endereço → antecedentes → ocupação → ... → requerimento).
  const ordemGrupos: string[] = [];
  for (const it of itens) if (!ordemGrupos.includes(it.grupo)) ordemGrupos.push(it.grupo);
  ordemGrupos.sort((a, b) => {
    const ordemA = Math.min(...itens.filter((i) => i.grupo === a).map((i) => i.ordemGrupo));
    const ordemB = Math.min(...itens.filter((i) => i.grupo === b).map((i) => i.ordemGrupo));
    return ordemA - ordemB;
  });

  const grupos: GrupoSimulado[] = ordemGrupos.map((g) => {
    const doGrupo = itens.filter((i) => i.grupo === g);
    return {
      grupo: g,
      rotulo: rotuloGrupo(g),
      itens: doGrupo,
      pendentes: doGrupo.filter((i) => i.estado === "pendente").length,
      cumpridos: doGrupo.filter((i) => i.estado === "cumprido").length,
      aguardando: doGrupo.filter((i) => i.estado === "aguardando").length,
      total: doGrupo.filter((i) => i.estado !== "dispensado").length,
    };
  });

  const visiveis = itens.filter((i) => i.estado !== "dispensado");
  const proximo = itens.find((i) => i.estado === "pendente") ?? null;
  const totalPendentes = itens.filter((i) => i.estado === "pendente").length;
  const totalCumpridos = itens.filter((i) => i.estado === "cumprido").length;
  const baseProgresso = totalPendentes + totalCumpridos;
  const progresso = baseProgresso === 0 ? 100 : Math.round((totalCumpridos / baseProgresso) * 100);

  // ── Diagnóstico estrutural do catálogo ────────────────────────────────────
  const alertas: Alerta[] = [];
  // Perguntas EXISTENTES no catálogo do serviço (independente de estarem
  // visíveis nesta combinação). Sem isso o simulador acusava "não existe
  // pergunta" só porque a pergunta ficou escondida pela condição escolhida.
  const chavesNoCatalogo = new Set(
    ativas
      .filter((l) => ehPergunta(l.regra_validacao))
      .map((l) => chavePergunta(l.regra_validacao, l.tipo_documento))
      .filter(Boolean),
  );
  // A presença da pergunta é definida pela linha visível do catálogo, não pelo
  // tipo de ação renderizado. Uma pergunta híbrida respondida vira upload na UI,
  // mas continua sendo a origem válida da rota e não pode gerar aviso falso.
  const chavesVisiveis = new Set(
    itens
      .filter((i) => i.estado !== "dispensado" && ehPergunta(i.linha.regra_validacao) && i.chave)
      .map((i) => i.chave as string),
  );

  const jaAvisado = new Set<string>();
  for (const i of itens) {
    const dep = i.dependeDe;
    if (!dep) continue;
    if (!chavesNoCatalogo.has(dep.chave)) {
      alertas.push({
        nivel: "erro",
        texto: `"${i.nome_documento}" depende da resposta "${dep.chave}", mas esse serviço não tem nenhuma pergunta que grave essa chave — o item nunca vai aparecer para o cliente.`,
      });
    } else if (!chavesVisiveis.has(dep.chave) && !jaAvisado.has(dep.chave)) {
      jaAvisado.add(dep.chave);
      alertas.push({
        nivel: "aviso",
        texto: `A pergunta "${dep.chave}" existe no checklist, mas não aparece nesta combinação simulada (condição profissional / modalidade escolhida). Os itens ligados a ela só surgem quando a pergunta for exibida.`,
      });
    }
  }

  const temPerguntaCondicao = chavesVisiveis.has("condicao_profissional");
  const temDocsCondicao = ativas.some(
    (l) => l.condicao_profissional != null && condicaoCasa(l.condicao_profissional, condicao),
  );
  if (temPerguntaCondicao && condicao && condicao !== "indefinido" && !temDocsCondicao) {
    alertas.push({
      nivel: "aviso",
      texto: `O catálogo não tem nenhuma exigência de renda cadastrada para "${condicao.toUpperCase()}". Nesse caso o sistema aplica a lista padrão de ocupação lícita embutida no motor.`,
    });
  }

  if (descartadas.length > 0) {
    alertas.push({
      nivel: "aviso",
      texto: `${descartadas.length} linha(s) do catálogo foram ignoradas por repetirem o mesmo tipo de documento nesta combinação.`,
    });
  }

  const semObrigatorio = itens.filter((i) => i.estado !== "dispensado" && !i.obrigatorio).length;
  if (semObrigatorio > 0) {
    alertas.push({
      nivel: "aviso",
      texto: `${semObrigatorio} item(ns) estão marcados como OPCIONAIS e não travam a conclusão do checklist.`,
    });
  }

  return {
    grupos,
    visiveis,
    proximo,
    totalPendentes,
    totalCumpridos,
    progresso,
    alertas,
    ignoradosPorDuplicidade: descartadas.map((l) => paraItem(l, "dispensado", "DUPLICADO NO CATÁLOGO")),
  };
}