// ============================================================================
// TERCEIRA AUDITORIA, FURO 2 — responder a notificação desliga o alarme
// ----------------------------------------------------------------------------
// O motor tinha UM fechador: `data_recurso_administrativo`. Só que responder a
// uma notificação não é recorrer — e responder é o caminho mais comum do fluxo
// inteiro. A equipe respondia dentro do prazo e o cron seguia mandando "prazo
// VENCIDO há N dias" para o cliente e para a equipe, todo dia, para sempre.
//
// É o mesmo alarme falso do caso do Edmar (fechado na 1ª auditoria) no ramo do
// indeferimento — intacto no ramo da notificação.
//
// A parte que exige cuidado é o LIMITE do conserto: responder NÃO pode fechar
// prazo de indeferimento. De indeferimento só se sai recorrendo, e escondê-lo
// seria trocar o alarme falso por um prazo perdido de verdade — erro mais caro.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extrairPrazoDoItem, type ItemComPrazo } from "../prazosProcessuais";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");
const EDGE = r("supabase/functions/qa-manifestacao-responder/index.ts");
const SQL = r("supabase/migrations/20260818180000_resposta_a_notificacao_fecha_prazo.sql");
const DRAWER = r("src/components/quero-armas/processos/ProcessoDetalheDrawer.tsx");

/** Data de N dias atrás, para montar prazos já estourados. */
function diasAtras(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const base: ItemComPrazo = { id: 1, servico_id: 7, servico_nome: "Posse", status: "EM ANDAMENTO" };

describe("o alarme falso da notificação", () => {
  it("sem resposta, a notificação vencida continua alarmando — como deve", () => {
    const p = extrairPrazoDoItem({ ...base, data_notificacao: diasAtras(30) });
    expect(p).not.toBeNull();
    expect(p!.evento).toBe("NOTIFICAÇÃO");
    expect(p!.status).toBe("vencido");
  });

  it("com a resposta entregue, o prazo some", () => {
    const p = extrairPrazoDoItem({
      ...base,
      data_notificacao: diasAtras(30),
      data_resposta_notificacao: diasAtras(25),
    });
    expect(p).toBeNull();
  });

  it("responder no MESMO dia da notificação já cumpre", () => {
    const dia = diasAtras(20);
    expect(extrairPrazoDoItem({
      ...base, data_notificacao: dia, data_resposta_notificacao: dia,
    })).toBeNull();
  });

  it("resposta ANTERIOR à notificação não fecha nada", () => {
    // É outro ciclo: respondemos, e a PF notificou de novo depois.
    const p = extrairPrazoDoItem({
      ...base,
      data_notificacao: diasAtras(5),
      data_resposta_notificacao: diasAtras(40),
    });
    expect(p).not.toBeNull();
    expect(p!.evento).toBe("NOTIFICAÇÃO");
  });

  it("fecha também o prazo de restituição", () => {
    expect(extrairPrazoDoItem({
      ...base,
      data_restituicao: diasAtras(30),
      data_resposta_notificacao: diasAtras(28),
    })).toBeNull();
  });
});

describe("o limite do conserto: indeferimento NÃO se fecha respondendo", () => {
  it("indeferimento com resposta registrada segue alarmando", () => {
    const p = extrairPrazoDoItem({
      ...base,
      data_indeferimento: diasAtras(30),
      data_resposta_notificacao: diasAtras(25),
    });
    expect(p).not.toBeNull();
    expect(p!.evento).toBe("INDEFERIMENTO");
    expect(p!.status).toBe("vencido");
  });

  it("indeferimento só se fecha recorrendo", () => {
    expect(extrairPrazoDoItem({
      ...base,
      data_indeferimento: diasAtras(30),
      data_recurso_administrativo: diasAtras(25),
    })).toBeNull();
  });

  it("com notificação E indeferimento, vence o mais recente e cada um tem a sua saída", () => {
    // Indeferimento mais recente: responder não basta.
    const comIndefRecente = extrairPrazoDoItem({
      ...base,
      data_notificacao: diasAtras(40),
      data_indeferimento: diasAtras(20),
      data_resposta_notificacao: diasAtras(18),
    });
    expect(comIndefRecente).not.toBeNull();
    expect(comIndefRecente!.evento).toBe("INDEFERIMENTO");

    // Notificação mais recente: responder fecha.
    expect(extrairPrazoDoItem({
      ...base,
      data_indeferimento: diasAtras(40),
      data_notificacao: diasAtras(20),
      data_resposta_notificacao: diasAtras(18),
    })).toBeNull();
  });

  it("o mandado de segurança tem prioridade e ignora a resposta", () => {
    const p = extrairPrazoDoItem({
      ...base,
      data_indeferimento_recurso: diasAtras(10),
      data_resposta_notificacao: diasAtras(5),
    });
    expect(p).not.toBeNull();
    expect(p!.evento).toBe("MANDADO DE SEGURANÇA");
    expect(p!.prazoTotalDias).toBe(120);
  });
});

describe("as duas cópias do motor andam juntas", () => {
  it("a versão Deno tem a mesma regra", () => {
    const deno = r("supabase/functions/_shared/prazosProcessuais.ts");
    expect(deno).toMatch(/data_resposta_notificacao\?: string \| null;/);
    expect(deno).toMatch(/const dResposta = normalizeDateISO\(item\.data_resposta_notificacao\)/);
    expect(deno).toMatch(/ativo\.evento === "NOTIFICAÇÃO" \|\| ativo\.evento === "RESTITUIÇÃO"/);
  });
});

describe("quem escreve a data", () => {
  it("a edge grava na coluna que o motor lê", () => {
    expect(EDGE).toMatch(/coluna: "data_resposta_notificacao"/);
  });

  it("recusa registrar resposta a uma decisão final", () => {
    expect(EDGE).toMatch(/const NAO_RESPONDIVEIS = new Set\(\["decisao", "indeferimento", "deferimento"\]\)/);
    expect(EDGE).toMatch(/manifestacao_nao_e_respondivel/);
  });

  it("usa a data informada, não a de hoje", () => {
    // Registrar três dias depois não pode empurrar o marco três dias.
    expect(EDGE).toMatch(/\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(dataInformada\)/);
  });

  it("devolve o processo para a análise do órgão", () => {
    expect(EDGE).toMatch(/status: "em_analise_orgao"/);
    expect(EDGE).toMatch(/if \(statusAtual === "notificado"\)/);
  });

  it("conta as exigências ainda abertas sem travar a resposta", () => {
    // A equipe pode responder explicando por que um documento não existe —
    // mas tem que saber o que está deixando para trás.
    expect(EDGE).toMatch(/exigencias_abertas: exigenciasAbertas/);
    expect(EDGE).not.toMatch(/exigencias_abertas_bloqueia|return json\(\{ error: "exigencias_pendentes"/);
  });

  it("avisa o cliente", () => {
    expect(EDGE).toMatch(/templateName: "manifestacao-respondida"/);
    const registry = r("supabase/functions/_shared/transactional-email-templates/registry.ts");
    expect(registry).toMatch(/'manifestacao-respondida': manifestacaoRespondida/);
  });

  it("falha ao lançar o prazo não derruba o registro", () => {
    const ponte = r("supabase/functions/_shared/prazoItemVenda.ts");
    expect(ponte).toMatch(/return \{ ok: false, aviso:/);
    expect(ponte).not.toMatch(/throw new Error/);
  });

  it("a ponte usa id_legado quando existe — o bug do cliente antigo", () => {
    const ponte = r("supabase/functions/_shared/prazoItemVenda.ts");
    expect(ponte).toMatch(/typeof v\.id_legado === "number" && Number\.isFinite\(v\.id_legado\) \? v\.id_legado : v\.id/);
  });
});

describe("a tela da equipe", () => {
  it("tem o botão de registrar a resposta", () => {
    expect(DRAWER).toMatch(/qa-manifestacao-responder/);
    expect(DRAWER).toMatch(/REGISTRAR A RESPOSTA ENTREGUE/);
  });

  it("avisa quando o prazo NÃO foi fechado", () => {
    // Sem este aviso, a resposta fica registrada e o alarme continua tocando
    // sem ninguém entender por quê.
    expect(DRAWER).toMatch(/resp\.prazo_fechado === false/);
  });

  it("não oferece o botão numa decisão final", () => {
    expect(DRAWER).toMatch(/\["decisao", "indeferimento", "deferimento"\]\.includes\(/);
  });
});

describe("a migration", () => {
  it("só acrescenta coluna", () => {
    const executavel = SQL.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(executavel).not.toMatch(/DROP COLUMN|RENAME/i);
    expect(executavel).toMatch(/ADD COLUMN IF NOT EXISTS data_resposta_notificacao date/);
    expect(executavel).toMatch(/ADD COLUMN IF NOT EXISTS respondida_em\s+timestamptz/);
  });

  it("traz a consulta que mostra quem está sendo alarmado à toa", () => {
    expect(SQL).toMatch(/data_resposta_notificacao IS NULL/);
    expect(SQL).toMatch(/dias_desde_a_notificacao/);
  });
});
