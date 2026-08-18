// ============================================================================
// SEXTA AUDITORIA — o dossiê vencia e ninguém avisava antes
// ----------------------------------------------------------------------------
// Certidão de antecedentes e comprovante de residência vivem ~30 dias. Um
// processo que demora dois meses juntando laudo psicológico e exame de tiro
// chega ao protocolo com metade da papelada fora do prazo.
//
// O sistema SABIA disso — e reagia tarde demais, nos dois únicos pontos que
// olhavam validade no processo:
//
//   • `qa-montar-juntada` recusa montar o dossiê e reabre as linhas;
//   • `qa-processo-checar-conclusao-checklist` barra a promoção.
//
// Os dois disparam no clique de montar a juntada — ou seja, no momento em que
// o processo deveria estar indo para a delegacia. O cliente era mandado
// reemitir certidão exatamente ali.
//
// A rotina de alertas de vencimento existia desde sempre, mas só olhava o HUB
// (`qa_documentos_cliente`). O checklist do processo
// (`qa_processo_documentos`) não era vigiado por ninguém.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");
const ALERTAS = r("supabase/functions/qa-vencimentos-alertas/index.ts");

describe("a rotina de vencimentos passa a olhar o checklist do processo", () => {
  it("consulta qa_processo_documentos", () => {
    expect(ALERTAS).toMatch(/from\("qa_processo_documentos"\)/);
  });

  it("tem fonte própria, para não se confundir com o Hub", () => {
    expect(ALERTAS).toMatch(/type Fonte = .*"DOSSIE"/);
    expect(ALERTAS).toMatch(/fonte: "DOSSIE"/);
  });

  it("usa a validade EFETIVA quando existe", () => {
    // É o valor que o backend calculou e o que o cliente vê no Hub.
    // Recalcular aqui abriria espaço para a tela e o alerta discordarem.
    expect(ALERTAS).toMatch(/r\.data_validade_efetiva \|\| r\.data_validade/);
  });
});

describe("o que NÃO deve gerar alerta", () => {
  it("processo já protocolado sai da conta", () => {
    // Depois do protocolo o dossiê foi entregue; cobrar validade de documento
    // protocolado é cobrar o que não se usa mais.
    expect(ALERTAS).toMatch(/const POS_PROTOCOLO = new Set\(\[/);
    for (const st of ["protocolado", "deferido", "concluido", "cancelado"]) {
      expect(ALERTAS, `falta ${st}`).toMatch(new RegExp(`"${st}"`));
    }
  });

  it("só conta documento que de fato entra no dossiê", () => {
    // Pendente vencido não é problema de validade, é problema de envio — e já
    // aparece como pendência no guiado.
    expect(ALERTAS).toMatch(/const CONTA_NO_DOSSIE = new Set\(\[/);
    expect(ALERTAS).toMatch(/"aprovado", "entregue_pelo_hub", "dispensado_por_reaproveitamento"/);
  });

  it("o mesmo papel não avisa duas vezes", () => {
    // Quase toda linha do checklist é satisfeita por reaproveitamento do Hub.
    // Sem esta chave, o cliente receberia dois e-mails da mesma certidão.
    expect(ALERTAS).toMatch(/const jaCobertoPeloHub = new Set\(/);
    expect(ALERTAS).toMatch(/jaCobertoPeloHub\.has\(/);
  });

  it("laudo, exame e GTE continuam com as rotinas próprias", () => {
    const bloco = ALERTAS.slice(ALERTAS.indexOf("// 4.5) DOSSIÊ"), ALERTAS.indexOf("// 5) Filtrar"));
    expect(bloco).toMatch(/tipo\.includes\("gte"\) \|\| tipo\.includes\("exame"\) \|\| tipo\.includes\("laudo"\)/);
  });
});

describe("o aviso chega legível ao cliente", () => {
  it("usa o mesmo template de virada de faixa do documento comum", () => {
    // Sem isto o dossiê cairia no template genérico, cujo texto monta a frase
    // com o nome da FONTE.
    expect(ALERTAS).toMatch(
      /\(c\.fonte === "DOCUMENTO" \|\| c\.fonte === "DOSSIE"\) && c\.faixa && c\.dias >= 0/,
    );
  });

  it("a fonte tem nome em português — 'sua DOSSIE' não é frase", () => {
    expect(ALERTAS).toMatch(/function rotuloFonte/);
    expect(ALERTAS).toMatch(/if \(f === "DOSSIE"\) return "documentação do processo"/);
    expect(ALERTAS).not.toMatch(/sua \$\{c\.fonte\}/);
  });

  it("diz onde emitir a via nova", () => {
    const bloco = ALERTAS.slice(ALERTAS.indexOf("// 4.5) DOSSIÊ"), ALERTAS.indexOf("// 5) Filtrar"));
    expect(bloco).toMatch(/comoResolver: comoResolverDocumento/);
  });
});

describe("as travas reativas continuam de pé — o aviso não substitui a trava", () => {
  it("a juntada segue recusando documento vencido", () => {
    const juntada = r("supabase/functions/qa-montar-juntada/index.ts");
    expect(juntada).toMatch(/estaVencido\(validade, hoje\)/);
  });

  it("a promoção do processo segue barrada com documento vencido", () => {
    const checar = r("supabase/functions/qa-processo-checar-conclusao-checklist/index.ts");
    expect(checar).toMatch(/VIGÊNCIA/);
  });
});
