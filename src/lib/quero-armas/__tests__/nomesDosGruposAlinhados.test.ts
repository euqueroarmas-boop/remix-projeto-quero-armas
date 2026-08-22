// ============================================================================
// TRAVA DOS NOMES — grupos e etapas falam a MESMA palavra, em todo lugar.
// ----------------------------------------------------------------------------
// Decisão do titular (22/08/2026): "Trave pra não mudar mais. Não quero
// corrigir isso de novo."
//
// Histórico do estrago: o mesmo grupo tinha quatro nomes (o módulo do cliente,
// dois campos do card do painel e a tabela qa_checklist_grupos), e a régua de
// etapas tinha mais sete listas próprias espalhadas por telas diferentes. Na
// mesma tela aparecia "ETAPA 3/5: ANTECEDENTES CRIMINAIS" logo acima de um
// grupo chamado "Idoneidade".
//
// Este teste é a rede. Ele quebra se:
//   1. alguém mudar o nome canônico de um grupo sem passar por aqui;
//   2. a régua de etapas deixar de herdar o nome do grupo;
//   3. o dicionário do banco (qa_grupo_nome) discordar do módulo TypeScript;
//   4. alguma tela voltar a escrever o nome do grupo na mão.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  PENDENCIA_GRUPOS,
  ETAPA_GRUPO,
  nomeDaEtapa,
  type PendenciaGrupoId,
} from "../pendenciasGrupos";

// ─── 1) Nome canônico de cada grupo — decidido em 22/08/2026 ────────────────
const NOME_CANONICO: Record<PendenciaGrupoId, string> = {
  exigencias_pf: "Exigências da Polícia Federal",
  assinaturas: "Contratos",
  perguntas: "Cadastros",
  identificacao: "Identificação civil",
  endereco: "Identificação residencial",
  ocupacao: "Ocupação lícita",
  antecedentes: "Idoneidade",
  antecedentes_anteriores: "Idoneidade — estados onde você morou antes",
  habitualidade: "Habitualidade e clube",
  arma: "Documentos da arma",
  declaracoes: "Declarações do processo",
  efetiva_necessidade: "Efetiva necessidade",
  laudos: "Laudos",
  requerimento: "Requerimento",
  outros: "Fechamento",
};

describe("nomes dos grupos — trava", () => {
  it("cada grupo mantém o nome decidido", () => {
    for (const [id, nome] of Object.entries(NOME_CANONICO)) {
      expect(
        PENDENCIA_GRUPOS[id as PendenciaGrupoId]?.label,
        `o grupo "${id}" mudou de nome. Se a mudança é proposital, decida com o titular e atualize NOME_CANONICO, o dicionário do banco (qa_grupo_nome) e a tabela qa_checklist_grupos JUNTOS.`,
      ).toBe(nome);
    }
  });

  it("não sobra grupo sem nome canônico", () => {
    const semTrava = Object.keys(PENDENCIA_GRUPOS).filter(
      (id) => !(id in NOME_CANONICO),
    );
    expect(
      semTrava,
      `grupo(s) novo(s) sem nome travado: ${semTrava.join(", ")}. Acrescente em NOME_CANONICO e no dicionário do banco.`,
    ).toEqual([]);
  });

  // ─── 2) A régua de etapas herda o nome do grupo ───────────────────────────
  it("a etapa 1..5 usa exatamente o nome do grupo correspondente", () => {
    expect(nomeDaEtapa(1)).toBe(NOME_CANONICO.endereco);
    expect(nomeDaEtapa(2)).toBe(NOME_CANONICO.ocupacao);
    expect(nomeDaEtapa(3)).toBe(NOME_CANONICO.antecedentes);
    expect(nomeDaEtapa(4)).toBe(NOME_CANONICO.declaracoes);
    expect(nomeDaEtapa(5)).toBe(NOME_CANONICO.laudos);
    for (const [n, id] of Object.entries(ETAPA_GRUPO)) {
      expect(nomeDaEtapa(Number(n))).toBe(PENDENCIA_GRUPOS[id].label);
    }
  });

  // ─── 3) O banco fala igual ao TypeScript ──────────────────────────────────
  it("o dicionário do banco (qa_grupo_nome) repete o mesmo nome", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260822090000_grupo_nome_sem_slug_usa_fechamento.sql"),
      "utf-8",
    );
    for (const [id, nome] of Object.entries(NOME_CANONICO)) {
      const linha = new RegExp(`WHEN\\s+'${id}'\\s+THEN\\s+'${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'`);
      expect(
        linha.test(sql),
        `o banco não chama "${id}" de "${nome}". Front e banco precisam mudar na mesma leva.`,
      ).toBe(true);
    }
  });

  // ─── 4) Nenhuma tela escreve o nome do grupo na mão ───────────────────────
  it("nenhuma tela reintroduz as palavras antigas", () => {
    const PROIBIDAS = [
      "ANTECEDENTES CRIMINAIS",
      "EXAMES TÉCNICOS",
      "Exames técnicos",
      "Aptidão psicológica e técnica",
      "CONDIÇÃO PROFISSIONAL / RENDA",
    ];
    // Arquivos onde a palavra pode aparecer com outro sentido: título de
    // documento (a certidão da Polícia Civil chama-se assim), comentário
    // histórico e os próprios testes.
    const LIBERADOS = [
      "pendenciasExplicacoes.ts",
      "certidoesAbrangencia.ts",
      "pendenciasGrupos.ts",
      "ProcessoDetalheDrawer.tsx", // comentário que explica o estrago antigo
      "__tests__",
    ];

    const varrer = (dir: string, achados: string[] = []): string[] => {
      for (const nome of readdirSync(dir)) {
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) {
          varrer(caminho, achados);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(nome)) continue;
        if (LIBERADOS.some((l) => caminho.includes(l))) continue;
        const conteudo = readFileSync(caminho, "utf-8");
        for (const linha of conteudo.split("\n")) {
          if (linha.trim().startsWith("//")) continue; // comentário não é tela
          if (PROIBIDAS.some((p) => linha.includes(p))) {
            achados.push(`${caminho}: ${linha.trim().slice(0, 120)}`);
          }
        }
      }
      return achados;
    };

    const achados = varrer(resolve(process.cwd(), "src"));
    expect(
      achados,
      `tela escrevendo nome de grupo/etapa na mão. Use PENDENCIA_GRUPOS / nomeDaEtapa:\n${achados.join("\n")}`,
    ).toEqual([]);
  });
});
