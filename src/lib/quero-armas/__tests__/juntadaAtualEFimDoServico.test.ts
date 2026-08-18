// ============================================================================
// TERCEIRA AUDITORIA — furos 3 e 4, os dois do fim do fluxo
// ----------------------------------------------------------------------------
// FURO 3 — o protocolo aceitava dossiê velho. A trava exigia que a juntada
// EXISTISSE, não que fosse a atual. Documento reenviado e reaprovado depois da
// montagem, ou petição aprovada depois, não invalidava o PDF já montado: ia
// para a delegacia a versão anterior, sem um aviso. E dossiê velho é pior que
// dossiê nenhum, porque ninguém desconfia dele — a tela mostra "V1 · 42
// páginas" com ar de coisa pronta.
//
// FURO 4 — nada encerrava o serviço. `concluido` existia no vocabulário, o
// gatilho de espelho já sabia traduzi-lo para `finalizado` na solicitação, e
// nenhum código levava o processo até lá. Todo processo entregue ficava
// eternamente em "DEFERIDO": o cliente confirmava o recebimento e a tela dele
// continuava igual.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { estadoDaJuntada } from "../juntadaAtual";
import { TRANSICOES_PROCESSO } from "@/components/quero-armas/processos/processoConstants";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");
const DRAWER = r("src/components/quero-armas/processos/ProcessoDetalheDrawer.tsx");
const DEFERIR = r("supabase/functions/qa-processo-deferir/index.ts");

const MONTADA = "2026-08-10T12:00:00.000Z";
const ANTES = "2026-08-09T12:00:00.000Z";
const DEPOIS = "2026-08-11T12:00:00.000Z";

describe("furo 3 — a juntada representa o processo de agora?", () => {
  it("nada mudou depois da montagem: está atual", () => {
    const e = estadoDaJuntada({
      montadaEm: MONTADA,
      documentos: [
        { tipo_documento: "rg", status: "aprovado", data_validacao: ANTES },
        { tipo_documento: "cnh", status: "aprovado", data_validacao: MONTADA },
      ],
    });
    expect(e.atual).toBe(true);
    expect(e.mudancas).toEqual([]);
  });

  it("documento aprovado DEPOIS derruba a atualidade", () => {
    const e = estadoDaJuntada({
      montadaEm: MONTADA,
      documentos: [
        { tipo_documento: "rg", status: "aprovado", data_validacao: ANTES },
        {
          tipo_documento: "antecedentes_criminais",
          nome_documento: "Certidão de antecedentes",
          status: "aprovado",
          data_validacao: DEPOIS,
        },
      ],
    });
    expect(e.atual).toBe(false);
    expect(e.mudancas).toHaveLength(1);
    expect(e.mudancas[0].rotulo).toBe("Certidão de antecedentes");
  });

  it("petição aprovada depois também conta", () => {
    // É o caso mais caro: o cliente corrigiu a peça e ela não entra no PDF.
    const e = estadoDaJuntada({
      montadaEm: MONTADA,
      documentos: [],
      pecas: [{ status_cliente: "aprovada", aprovada_cliente_em: DEPOIS, titulo_geracao: "Defesa" }],
    });
    expect(e.atual).toBe(false);
    expect(e.mudancas[0].rotulo).toContain("Petição aprovada pelo cliente");
  });

  it("documento PENDENTE aprovado depois não conta — ele nem entraria", () => {
    const e = estadoDaJuntada({
      montadaEm: MONTADA,
      documentos: [{ tipo_documento: "ctps", status: "pendente", updated_at: DEPOIS }],
    });
    expect(e.atual).toBe(true);
  });

  it("petição ainda esperando o cliente não conta", () => {
    const e = estadoDaJuntada({
      montadaEm: MONTADA,
      documentos: [],
      pecas: [{ status_cliente: "aguardando_cliente", aprovada_cliente_em: null }],
    });
    expect(e.atual).toBe(true);
  });

  it("os três status que entram no dossiê são considerados", () => {
    for (const st of ["aprovado", "entregue_pelo_hub", "dispensado_por_reaproveitamento"]) {
      const e = estadoDaJuntada({
        montadaEm: MONTADA,
        documentos: [{ tipo_documento: "x", status: st, data_validacao: DEPOIS }],
      });
      expect(e.atual, `${st} deveria contar`).toBe(false);
    }
  });

  it("sem juntada, não diz que está atual", () => {
    // Quem chama trata "não existe dossiê" antes; misturar os dois casos
    // esconderia um do outro na tela.
    expect(estadoDaJuntada({ montadaEm: null, documentos: [] }).atual).toBe(false);
  });

  it("data inválida não vira 'atual' por acidente", () => {
    expect(estadoDaJuntada({ montadaEm: "não é data", documentos: [] }).atual).toBe(false);
  });

  it("usa updated_at quando não há data de validação", () => {
    const e = estadoDaJuntada({
      montadaEm: MONTADA,
      documentos: [{ tipo_documento: "rg", status: "aprovado", updated_at: DEPOIS }],
    });
    expect(e.atual).toBe(false);
  });

  it("lista a mudança mais recente primeiro", () => {
    const e = estadoDaJuntada({
      montadaEm: MONTADA,
      documentos: [
        { tipo_documento: "a", nome_documento: "A", status: "aprovado", data_validacao: DEPOIS },
        { tipo_documento: "b", nome_documento: "B", status: "aprovado", data_validacao: "2026-08-12T12:00:00.000Z" },
      ],
    });
    expect(e.mudancas.map((m) => m.rotulo)).toEqual(["B", "A"]);
  });
});

describe("furo 3 — a tela usa a trava", () => {
  it("o protocolo é barrado quando a juntada está velha", () => {
    expect(DRAWER).toMatch(/if \(juntadaDesatualizada && !protocoloSemJuntada\)/);
    expect(DRAWER).toMatch(/A juntada está desatualizada/);
  });

  it("o mesmo escape do dossiê por fora continua valendo", () => {
    // Protocolo feito fora do sistema é caso real; a trava não pode virar
    // parede. O escape fica escrito na auditoria, como já era.
    const trecho = DRAWER.slice(
      DRAWER.indexOf("const confirmarMarcarProtocolado"),
      DRAWER.indexOf("setSalvandoProtocolo(true)"),
    );
    expect(trecho).toContain("protocoloSemJuntada");
  });

  it("o card avisa e diz o que mudou", () => {
    expect(DRAWER).toMatch(/DESATUALIZADA — \{juntadaEstado\.mudancas\.length\}/);
    expect(DRAWER).toMatch(/REMONTE ANTES DE PROTOCOLAR/);
  });
});

describe("furo 4 — o serviço acaba quando o cliente confirma", () => {
  it("confirmar o recebimento leva o processo a concluido", () => {
    expect(DEFERIR).toMatch(/status: "concluido"/);
    expect(DEFERIR).toMatch(/if \(statusProcesso === "deferido"\)/);
  });

  it("só sai de deferido, e com guarda contra corrida", () => {
    // Processo que voltou a andar por outro motivo não pode ser arrastado
    // para o fim porque o cliente clicou numa fila antiga.
    expect(DEFERIR).toMatch(/\.eq\("status", "deferido"\)/);
  });

  it("a confirmação do cliente é gravada mesmo se o status não colaborar", () => {
    expect(DEFERIR).toMatch(/if \(!concluido\) \{[\s\S]{0,300}deferimento_visto_cliente_em: agora/);
  });

  it("o histórico distingue os dois desfechos", () => {
    expect(DEFERIR).toMatch(/tipo_evento: concluido \? "processo_concluido"/);
    expect(DEFERIR).toMatch(/SERVIÇO CONCLUÍDO/);
  });

  it("deferido → concluido é uma transição legítima da máquina de estados", () => {
    expect(TRANSICOES_PROCESSO.deferido).toContain("concluido");
  });

  it("concluido é terminal — não se sai dele", () => {
    expect(TRANSICOES_PROCESSO.concluido).toEqual([]);
  });

  it("o gatilho de espelho traduz concluido para finalizado na solicitação", () => {
    // Sem isto, o processo acabaria e o cliente continuaria vendo o serviço
    // em andamento no Arsenal.
    const sql = r("supabase/migrations/20260818150000_espelha_status_processo_na_solicitacao.sql");
    expect(sql).toMatch(/WHEN 'concluido'\s+THEN 'finalizado'/);
  });
});
