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
  rotuloGrupo: string;
  ordem: number;
  obrigatorio: boolean;
  estado: EstadoItem;
  motivo?: string;
  chave?: string;
  opcoes?: OpcaoPergunta[];
  dependeDe?: { chave: string; valor: string };
  linha: LinhaCatalogo;
};

export type GrupoSimulado = {
  grupo: string;
  rotulo: string;
  itens: ItemSimulado[];
  pendentes: number;
  cumpridos: number;
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

export const CONDICOES: OpcaoPergunta[] = [
  { label: "CLT — CARTEIRA ASSINADA", valor: "clt" },
  { label: "AUTÔNOMO / MEI", valor: "autonomo" },
  { label: "EMPRESÁRIO / SÓCIO", valor: "empresario" },
  { label: "APOSENTADO", valor: "aposentado" },
  { label: "SERVIDOR PÚBLICO", valor: "funcionario_publico" },
  { label: "INDEFINIDO", valor: "indefinido" },
];

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
export function grupoCanonico(tipoDocumento: string): PendenciaGrupoId {
  return grupoDaPendencia(tipoDocumento).id;
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

function ehPergunta(rv: any): boolean {
  return !!rv && typeof rv === "object" && rv.tipo === "pergunta";
}

/** Extrai a dependência do item nos dois formatos legados aceitos no banco. */
function extrairDependencia(rv: any): { chave: string; valor: string } | null {
  if (!rv || typeof rv !== "object") return null;
  if (rv.depende_de && typeof rv.depende_de === "object" && rv.depende_de.chave) {
    return { chave: String(rv.depende_de.chave), valor: String(rv.depende_de.valor ?? "") };
  }
  if (rv.exige_quando && typeof rv.exige_quando === "object") {
    const chaves = Object.keys(rv.exige_quando);
    if (chaves.length === 1) {
      return { chave: chaves[0], valor: String(rv.exige_quando[chaves[0]] ?? "") };
    }
  }
  if (rv.condicional && typeof rv.condicional === "object" && rv.condicional.depende_de) {
    return { chave: String(rv.condicional.depende_de), valor: String(rv.condicional.valor ?? "") };
  }
  return null;
}

/** Deduplicação idêntica à do SQL: sem condição primeiro, depois ordem, depois id. */
function dedupPorTipo(linhas: LinhaCatalogo[]): { manter: LinhaCatalogo[]; descartadas: LinhaCatalogo[] } {
  const porTipo = new Map<string, LinhaCatalogo[]>();
  for (const l of linhas) {
    const arr = porTipo.get(l.tipo_documento) ?? [];
    arr.push(l);
    porTipo.set(l.tipo_documento, arr);
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

  const filtradas = ativas.filter((l) => {
    const cpOk = l.condicao_profissional == null || l.condicao_profissional === condicao;
    const mods = Array.isArray(l.condicao_modalidade) ? l.condicao_modalidade : null;
    const modOk = !mods || mods.length === 0 || !modalidade || mods.includes(modalidade);
    return cpOk && modOk;
  });

  const { manter, descartadas } = dedupPorTipo(filtradas);

  const paraItem = (l: LinhaCatalogo, estado: EstadoItem, motivo?: string): ItemSimulado => {
    const rv = l.regra_validacao;
    const grupo = grupoCanonico(l.tipo_documento);
    return {
      id: l.id,
      tipo: ehPergunta(rv) ? "pergunta" : "documento",
      tipo_documento: l.tipo_documento,
      nome_documento: l.nome_documento,
      etapa: l.etapa,
      grupo,
      rotuloGrupo: rotuloGrupo(grupo),
      ordem: l.ordem ?? 999,
      obrigatorio: !!l.obrigatorio,
      estado,
      motivo,
      chave: ehPergunta(rv) ? String(rv.chave ?? "") : undefined,
      opcoes: ehPergunta(rv) && Array.isArray(rv.opcoes) ? (rv.opcoes as OpcaoPergunta[]) : undefined,
      dependeDe: extrairDependencia(rv) ?? undefined,
      linha: l,
    };
  };

  const itens: ItemSimulado[] = manter
    .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999))
    .map((l) => {
      const rv = l.regra_validacao;
      const dep = extrairDependencia(rv);
      const pergunta = ehPergunta(rv);
      const chave = pergunta ? String(rv?.chave ?? "") : "";

      // Item condicional: depende de resposta anterior.
      if (dep) {
        const resposta = respostas[dep.chave];
        if (resposta == null) {
          return paraItem(l, "aguardando", `AGUARDA A RESPOSTA DE "${dep.chave.toUpperCase()}"`);
        }
        if (resposta !== dep.valor) {
          return paraItem(
            l,
            "dispensado",
            `NÃO EXIGIDO PORQUE "${dep.chave.toUpperCase()}" = ${String(resposta).toUpperCase()}`,
          );
        }
      }

      if (pergunta) {
        const respondida = chave && respostas[chave] != null;
        return paraItem(
          l,
          respondida ? "cumprido" : "pendente",
          respondida ? `RESPONDIDO: ${String(respostas[chave]).toUpperCase()}` : undefined,
        );
      }

      return paraItem(l, entregues[l.tipo_documento] ? "cumprido" : "pendente");
    });

  // Agrupamento na ordem em que o cliente vê (primeiro grupo com pendência primeiro).
  const ordemGrupos: string[] = [];
  for (const it of itens) if (!ordemGrupos.includes(it.grupo)) ordemGrupos.push(it.grupo);

  const grupos: GrupoSimulado[] = ordemGrupos.map((g) => {
    const doGrupo = itens.filter((i) => i.grupo === g);
    return {
      grupo: g,
      rotulo: rotuloGrupo(g),
      itens: doGrupo,
      pendentes: doGrupo.filter((i) => i.estado === "pendente").length,
      cumpridos: doGrupo.filter((i) => i.estado === "cumprido").length,
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
  const chavesPerguntas = new Set(
    itens.filter((i) => i.tipo === "pergunta" && i.chave).map((i) => i.chave as string),
  );

  for (const i of itens) {
    if (i.dependeDe && !chavesPerguntas.has(i.dependeDe.chave)) {
      alertas.push({
        nivel: "erro",
        texto: `"${i.nome_documento}" depende da resposta "${i.dependeDe.chave}", mas esse serviço não tem nenhuma pergunta que grave essa chave — o item nunca vai aparecer para o cliente.`,
      });
    }
  }

  const temPerguntaCondicao = chavesPerguntas.has("condicao_profissional");
  const temDocsCondicao = ativas.some((l) => l.condicao_profissional === condicao);
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