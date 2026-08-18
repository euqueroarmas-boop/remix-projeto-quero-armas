// ============================================================================
// REAUDITORIA — a segunda verdade: processo anda, solicitação fica parada
// ----------------------------------------------------------------------------
// Existem dois lugares que guardam "onde está o processo":
//
//   • `qa_processos.status`                    — o que a Equipe opera
//   • `qa_solicitacoes_servico.status_servico` — o que os KPIs, o Arsenal e a
//                                                aba Serviços mostram ao cliente
//
// Até a metade do fluxo eles conversam, porque `qa_recalcular_status_servico`
// deriva o status da solicitação a partir do progresso do checklist. Mas ela
// desiste logo na entrada quando o status já é pós-protocolo — e ninguém
// assume dali em diante. O único ponto do sistema que escreve esses status é um
// popover MANUAL.
//
// Com o processo passando a avançar sozinho (F5, F10, F11), a solicitação
// ficava marcada "PRONTO PARA PROTOCOLO" num processo deferido. É o "KPI verde
// com problema crítico" que a Regra-Mãe proíbe — e é o cliente que vê.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STATUS_SERVICO_QA } from "../statusServico";
import { STATUS_PROCESSO_CANONICOS } from "@/components/quero-armas/processos/processoConstants";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");
const SQL = r("supabase/migrations/20260818150000_espelha_status_processo_na_solicitacao.sql");

/** O mapa que o gatilho aplica, espelhado aqui para conferir os dois lados. */
const MAPA: Record<string, string> = {
  protocolado: "enviado_ao_orgao",
  em_analise_orgao: "em_analise_orgao",
  notificado: "notificado",
  recurso_administrativo: "recurso_administrativo",
  deferido: "deferido",
  indeferido: "indeferido",
  concluido: "finalizado",
};

describe("o gatilho existe e é reexecutável", () => {
  it("cria função e trigger de forma idempotente", () => {
    expect(SQL).toMatch(/CREATE OR REPLACE FUNCTION public\.qa_espelhar_status_processo_na_solicitacao/);
    expect(SQL).toMatch(/DROP TRIGGER IF EXISTS trg_qa_processos_espelha_solicitacao/);
    expect(SQL).toMatch(/AFTER UPDATE OF status ON public\.qa_processos/);
  });

  it("só reage a mudança real de status", () => {
    expect(SQL).toMatch(/IF NEW\.status IS NOT DISTINCT FROM OLD\.status THEN RETURN NEW/);
  });

  it("ignora processo sem solicitação ligada", () => {
    expect(SQL).toMatch(/IF NEW\.solicitacao_id IS NULL THEN RETURN NEW/);
  });
});

describe("o mapa cobre os dois vocabulários, sem inventar valor", () => {
  it("toda origem é um status real de qa_processos", () => {
    for (const origem of Object.keys(MAPA)) {
      expect(STATUS_PROCESSO_CANONICOS, `origem inexistente: ${origem}`).toContain(origem as never);
    }
  });

  it("todo destino é um status canônico de serviço", () => {
    for (const destino of Object.values(MAPA)) {
      expect(STATUS_SERVICO_QA, `destino inexistente: ${destino}`).toContain(destino as never);
    }
  });

  it("o SQL aplica exatamente esse mapa", () => {
    for (const [origem, destino] of Object.entries(MAPA)) {
      expect(SQL, `falta ${origem} → ${destino}`).toMatch(
        new RegExp(`WHEN '${origem}'\\s+THEN '${destino}'`),
      );
    }
  });

  it("não toca em nada antes do protocolo — quem manda lá é o recálculo", () => {
    // Sobrepor o cálculo por progresso do checklist criaria a briga que este
    // gatilho existe para evitar.
    for (const antes of [
      "aguardando_pagamento", "aguardando_assinatura", "aguardando_documentos",
      "em_validacao", "revisao_humana", "pendente_cliente", "validado",
      "pronto_para_protocolar",
    ]) {
      expect(SQL, `o gatilho não deveria mapear ${antes}`).not.toMatch(
        new RegExp(`WHEN '${antes}'\\s+THEN`),
      );
    }
  });

  it("cobre TODO status pós-protocolo do processo", () => {
    // Um status pós-protocolo fora do mapa é uma solicitação que congela de novo.
    for (const pos of [
      "protocolado", "em_analise_orgao", "notificado",
      "recurso_administrativo", "deferido", "indeferido", "concluido",
    ]) {
      expect(Object.keys(MAPA), `pós-protocolo sem espelho: ${pos}`).toContain(pos);
    }
  });
});

describe("as travas do espelho", () => {
  it("finalizado é terminal — não se volta dele", () => {
    expect(SQL).toMatch(/IF v_atual = 'finalizado' THEN RETURN NEW/);
  });

  it("usa o mesmo bypass do recálculo — a máquina do processo é a autoridade", () => {
    // O guarda de transições da solicitação recusa saltos legítimos daqui, como
    // aguardando_documentacao → enviado_ao_orgao (equipe protocola com checklist
    // incompleto por decisão dela).
    expect(SQL).toMatch(/set_config\('qa\.bypass_transicao', 'on', true\)/);
    expect(SQL).toMatch(/set_config\('qa\.bypass_transicao', 'off', true\)/);
  });

  it("espelho quebrado NÃO derruba o avanço do processo", () => {
    // Protocolo, deferimento e recurso são o dado que não pode se perder; o
    // status da solicitação é leitura derivada.
    expect(SQL).toMatch(/EXCEPTION WHEN OTHERS THEN/);
    expect(SQL).toMatch(/RAISE WARNING/);
    const posException = SQL.indexOf("EXCEPTION WHEN OTHERS");
    const posReturn = SQL.indexOf("RETURN NEW;", posException);
    expect(posReturn).toBeGreaterThan(posException);
  });

  it("faz backfill do que já divergiu", () => {
    expect(SQL).toMatch(/DO \$backfill\$/);
    expect(SQL).toMatch(/Solicitacoes realinhadas/);
  });
});

describe("resíduo de RLS: peça não aceita mais INSERT de usuário logado", () => {
  const sql = r("supabase/migrations/20260818160000_qa_geracoes_own_sem_insert.sql");

  it("derruba o FOR ALL", () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "qa_geracoes_own" ON public\.qa_geracoes_pecas/);
  });

  it("recoloca só SELECT e UPDATE do próprio operador", () => {
    expect(sql).toMatch(/CREATE POLICY "qa_geracoes_own_select"[\s\S]*FOR SELECT TO authenticated/);
    expect(sql).toMatch(/CREATE POLICY "qa_geracoes_own_update"[\s\S]*FOR UPDATE TO authenticated/);
  });

  it("nenhuma policy nova concede INSERT ou DELETE a authenticated", () => {
    // Afere só o SQL executável: o cabeçalho da migration cita `FOR ALL TO
    // authenticated` justamente para explicar o que está sendo removido, e
    // casar com o comentário reprovaria a migration correta.
    const executavel = sql
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(executavel).not.toMatch(/FOR INSERT TO authenticated/);
    expect(executavel).not.toMatch(/FOR DELETE TO authenticated/);
    expect(executavel).not.toMatch(/FOR ALL TO authenticated/);
  });

  it("continua sem INSERT de peça vindo do front — a criação é service role", () => {
    // Se algum dia o front passar a inserir direto, este teste avisa antes de a
    // policy quebrar a tela.
    const front = r("src/pages/quero-armas/QAGerarPecaPage.tsx");
    expect(front).not.toMatch(/from\("qa_geracoes_pecas"[^)]*\)[\s\S]{0,80}\.insert\(/);
  });
});
