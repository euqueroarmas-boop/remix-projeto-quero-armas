import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CICLO_CURTO_ATENCAO_DIAS,
  CICLO_CURTO_CRITICO_DIAS,
  faixaVencimento,
  isVencimentoCicloCurto,
  PRAZO_ATENCAO_DIAS,
  PRAZO_CRITICO_DIAS,
} from "../validadeDocumento";
import {
  documentoSobGestaoDeAlerta,
  instrucaoAindaExigida as instrucaoAindaExigidaFront,
  regimeAlertaDocumento,
} from "../gestaoAlertaDocumento";
// O espelho Deno não importa nada, então roda igual sob o vitest — dá para
// comparar comportamento de verdade, e não só o texto do arquivo.
import * as deno from "../../../../supabase/functions/_shared/faixaAlertaDocumento";

/**
 * O motor de e-mail roda em Deno e não consegue importar o código do front, por
 * isso existe um espelho em supabase/functions/_shared/faixaAlertaDocumento.ts.
 * Espelho que diverge é pior do que espelho nenhum: a tela diria "em dia" e o
 * e-mail diria "prazo crítico". Estes testes travam os dois lados.
 */

const raiz = resolve(__dirname, "../../../..");
const r = (p: string) => readFileSync(resolve(raiz, p), "utf8");

const espelho = r("supabase/functions/_shared/faixaAlertaDocumento.ts");

/** Reproduz a regra do espelho a partir do próprio código-fonte dele. */
function constanteDoEspelho(nome: string): number {
  const m = espelho.match(new RegExp(`export const ${nome} = (-?\\d+);`));
  if (!m) throw new Error(`constante ${nome} não encontrada no espelho Deno`);
  return Number(m[1]);
}

const TIPOS_COBERTOS = [
  "comprovante_residencia",
  "comprovante_endereco",
  "antecedentes_criminais",
  "antecedentes_estadual_distribuicao",
  "antecedentes_estadual_execucoes",
  "antecedentes_eleitoral",
  "antecedentes_militar",
  "antecedentes_militar_estadual",
  "antecedentes_federal_trf3_regional",
  "antecedentes_federal_sjsp_jef",
  "cr",
  "craf",
  "sinarm",
  "gt",
  "gte",
  "autorizacao_compra",
  "laudo_psicologico",
  "laudo_capacidade_tecnica",
  "procuracao",
  "procuracao_assinada",
  "comprovante_clube_tiro",
  "comprovante_habitualidade",
  "renda_holerite_mes_atual",
  "renda_extrato_inss",
  "boletim_ocorrencia",
  "declaracao_guarda_responsavel",
  "rg_com_cpf",
  "contrato_assinado",
];

const DIAS_COBERTOS = [90, 45, 31, 30, 25, 15, 11, 10, 9, 5, 4, 1, 0, -1, -30];

describe("paridade executada — front e espelho decidem igual", () => {
  it("mesma faixa para toda combinação de tipo × dias", () => {
    for (const tipo of TIPOS_COBERTOS) {
      for (const dias of DIAS_COBERTOS) {
        expect(deno.faixaVencimento(dias, tipo), `${tipo} @ ${dias}d`).toBe(
          faixaVencimento(dias, tipo),
        );
      }
    }
  });

  it("mesma classificação de ciclo curto", () => {
    for (const tipo of TIPOS_COBERTOS) {
      expect(deno.isVencimentoCicloCurto(tipo), tipo).toBe(isVencimentoCicloCurto(tipo));
    }
  });

  it("mesmo regime de gestão", () => {
    for (const tipo of TIPOS_COBERTOS) {
      expect(deno.regimeAlertaDocumento(tipo), tipo).toBe(regimeAlertaDocumento(tipo));
    }
    expect(deno.regimeAlertaDocumento(null)).toBe(regimeAlertaDocumento(null));
  });

  it("mesma leitura do estado dos processos", () => {
    const cenarios = [
      [],
      [{ status: "aguardando_documentos" }],
      [{ status: "protocolado" }],
      [{ status: "protocolado" }, { status: "aguardando_documentos" }],
      [{ status: "em_exigencia" }],
      [{ status: "deferido" }, { status: "indeferido" }],
      [{ status: "pronto_para_protocolar" }],
    ];
    for (const c of cenarios) {
      expect(deno.instrucaoAindaExigida(c), JSON.stringify(c)).toBe(
        instrucaoAindaExigidaFront(c),
      );
    }
  });
});

describe("paridade front ↔ espelho Deno", () => {
  it("as quatro fronteiras de faixa são idênticas", () => {
    expect(constanteDoEspelho("PRAZO_CRITICO_DIAS")).toBe(PRAZO_CRITICO_DIAS);
    expect(constanteDoEspelho("PRAZO_ATENCAO_DIAS")).toBe(PRAZO_ATENCAO_DIAS);
    expect(constanteDoEspelho("CICLO_CURTO_CRITICO_DIAS")).toBe(CICLO_CURTO_CRITICO_DIAS);
    expect(constanteDoEspelho("CICLO_CURTO_ATENCAO_DIAS")).toBe(CICLO_CURTO_ATENCAO_DIAS);
  });

  it("o espelho classifica procuração como permanente, igual ao front", () => {
    expect(regimeAlertaDocumento("procuracao")).toBe("permanente");
    expect(espelho).toMatch(/procuracao/);
    expect(espelho).toMatch(/startsWith\("procuracao_"\)\) return "permanente"/);
  });

  it("o espelho tem os mesmos status de pós-protocolo e de exigência", () => {
    for (const s of ["protocolado", "em_analise_orgao", "deferido", "indeferido", "concluido"]) {
      expect(espelho, s).toContain(`"${s}"`);
    }
    for (const s of ["em_exigencia", "cumprindo_exigencia"]) {
      expect(espelho, s).toContain(`"${s}"`);
    }
  });

  it("o espelho mantém o padrão conservador: sem processo, cobra", () => {
    expect(espelho).toMatch(/if \(!status\.length\) return true;/);
    expect(espelho).toMatch(/if \(!t\) return "permanente";/);
  });
});

describe("marcos de e-mail derivados da faixa", () => {
  /** Espelha marcosFaixaDocumento: só existem DOIS avisos por ciclo. */
  const marcos = (tipo: string) =>
    isVencimentoCicloCurto(tipo)
      ? { atencao: CICLO_CURTO_ATENCAO_DIAS, critico: CICLO_CURTO_CRITICO_DIAS }
      : { atencao: PRAZO_ATENCAO_DIAS, critico: PRAZO_CRITICO_DIAS };

  it("o marco de atenção é exatamente o primeiro dia amarelo", () => {
    for (const tipo of ["comprovante_residencia", "antecedentes_criminais", "cr", "craf"]) {
      const { atencao } = marcos(tipo);
      expect(faixaVencimento(atencao, tipo), `${tipo} @ ${atencao}d`).toBe("warn");
      expect(faixaVencimento(atencao + 1, tipo), `${tipo} @ ${atencao + 1}d`).toBe("ok");
    }
  });

  it("o marco crítico é exatamente o primeiro dia vermelho", () => {
    for (const tipo of ["comprovante_residencia", "antecedentes_criminais", "cr", "craf"]) {
      const { critico } = marcos(tipo);
      expect(faixaVencimento(critico, tipo), `${tipo} @ ${critico}d`).toBe("bad");
      expect(faixaVencimento(critico + 1, tipo), `${tipo} @ ${critico + 1}d`).toBe("warn");
    }
  });

  it("documento verde não tem marco — o alerta não nasce aceso", () => {
    const { atencao } = marcos("antecedentes_criminais");
    for (const dias of [30, 25, 20, 15, 10]) {
      expect(dias > atencao, `${dias}d deve estar acima do marco`).toBe(true);
      expect(faixaVencimento(dias, "antecedentes_criminais")).toBe("ok");
    }
  });
});

describe("o e-mail respeita o regime de gestão", () => {
  it("instrução protocolada não entra na fila de e-mail", () => {
    const protocolado = { instrucaoExigida: false };
    expect(documentoSobGestaoDeAlerta("comprovante_residencia", protocolado)).toBe(false);
    expect(documentoSobGestaoDeAlerta("antecedentes_criminais", protocolado)).toBe(false);
  });

  it("a rotina de vencimentos consulta os processos antes de disparar", () => {
    const cron = r("supabase/functions/qa-vencimentos-alertas/index.ts");
    expect(cron).toMatch(/documentoSobGestaoDeAlerta/);
    expect(cron).toMatch(/instrucaoAindaExigida/);
    expect(cron).toMatch(/from\("qa_processos"\)/);
    // Virada de faixa, e não contagem diária, para os documentos do Hub.
    expect(cron).toMatch(/pickMarcoFaixa/);
    expect(cron).toMatch(/documento-mudanca-faixa/);
  });

  it("o ciclo de validade entra na chave de idempotência (reset ao renovar)", () => {
    const cron = r("supabase/functions/qa-vencimentos-alertas/index.ts");
    // Sem a data no fim da chave, renovar o documento e cair no mesmo marco
    // seria tratado como e-mail repetido — o cliente nunca mais seria avisado.
    expect(cron).toMatch(/idempotencyKey: `qa-venc-\$\{c\.fonte\}-\$\{c\.ref_id\}-\$\{c\.marco\}-\$\{c\.data_validade\}`/);
    // A dedupe em banco já usava data_referencia; as duas camadas concordam.
    expect(cron).toMatch(/data_referencia: c\.data_validade/);
  });

  it("o template novo está registrado e usa os textos aprovados", () => {
    const registry = r("supabase/functions/_shared/transactional-email-templates/registry.ts");
    expect(registry).toMatch(/'documento-mudanca-faixa': documentoMudancaFaixa/);

    const tpl = r("supabase/functions/_shared/transactional-email-templates/documento-mudanca-faixa.tsx");
    expect(tpl).toContain("saiu de em dia e entrou em atenção");
    expect(tpl).toContain("só aceita documento dentro da validade no dia do protocolo");
    expect(tpl).toContain("está em prazo crítico");
    expect(tpl).toContain("o atraso passa a ser do prazo, não do documento");
    expect(tpl).toContain("ENVIAR DOCUMENTO ATUALIZADO");
    expect(tpl).toContain("ENVIAR AGORA");
  });
});
