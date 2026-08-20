// ============================================================================
// Fase da PETIÇÃO no painel "PROGRESSO DOS CLIENTES"
// ----------------------------------------------------------------------------
// O card do painel contava a vida do processo só até o documento: grupo atual,
// quanto falta, quem está parado. Depois que o checklist fechava, o processo
// entrava na fase mais cara — escrever a peça, mandar para o cliente aprovar,
// receber de volta — e o card não dizia nada. Para a equipe, "chegou na PET"
// era informação que só existia abrindo o processo um a um.
//
// Estes testes travam a tradução dos quatro valores de
// `qa_geracoes_pecas.status_cliente` (mais o caso "fechou tudo e não tem peça")
// no chip que o card mostra.
// ============================================================================

import { describe, it, expect } from "vitest";
import { estadoPeticao, statusPecaDominante, pecasPorProcesso, vincularPecas, faltaDocDoCliente, grupoEfetivaFechado, ehResponsabilidadeEquipe, prazoDefesa, somarDiasUteis, diasUteisEntre, estadoDaFilaServidor, prazoDesdeInicio } from "../fasePeticao";

const emDocumentos = { status: "aguardando_documentos", total_docs: 30, entregues: 19 };
const checklistFechado = { status: "aguardando_documentos", total_docs: 30, entregues: 30 };

describe("estadoPeticao", () => {
  it("não mostra PET para quem ainda tem documento pendente", () => {
    expect(estadoPeticao(emDocumentos, [])).toBeNull();
  });

  it("checklist fechado e nenhuma peça: petição na fila da equipe", () => {
    expect(estadoPeticao(checklistFechado, [])?.id).toBe("aguardando_equipe");
  });

  it("processo validado entra na fase mesmo sem a contagem fechar", () => {
    expect(estadoPeticao({ status: "validado", total_docs: 30, entregues: 28 }, [])?.id).toBe("aguardando_equipe");
  });

  it("peça gerada e ainda não enviada aparece como redigida", () => {
    expect(estadoPeticao(checklistFechado, [{ status_cliente: "nao_enviada" }])?.id).toBe("redigida");
  });

  it("peça enviada aparece como com o cliente", () => {
    const e = estadoPeticao(emDocumentos, [{ status_cliente: "aguardando_cliente" }]);
    expect(e?.id).toBe("com_cliente");
    expect(e?.tom).toBe("ambar");
  });

  it("devolução do cliente é trabalho da equipe — chip vermelho", () => {
    const e = estadoPeticao(checklistFechado, [{ status_cliente: "devolvida" }]);
    expect(e?.id).toBe("devolvida");
    expect(e?.tom).toBe("vermelho");
  });

  it("aprovada pelo cliente vence qualquer rascunho posterior", () => {
    const e = estadoPeticao(checklistFechado, [
      { status_cliente: "nao_enviada" },
      { status_cliente: "aprovada" },
    ]);
    expect(e?.id).toBe("aprovada");
    expect(e?.tom).toBe("verde");
  });

  it("peça nova com o cliente vence a devolução já reescrita", () => {
    const e = estadoPeticao(checklistFechado, [
      { status_cliente: "devolvida" },
      { status_cliente: "aguardando_cliente" },
    ]);
    expect(e?.id).toBe("com_cliente");
  });

  it("processo bloqueado por etapa anterior não fala de petição", () => {
    expect(estadoPeticao({ ...checklistFechado, bloqueado_por_prerequisito: true }, [{ status_cliente: "aguardando_cliente" }])).toBeNull();
  });

  it("processo protocolado sai do assunto — salvo a peça aprovada, que fica registrada", () => {
    expect(estadoPeticao({ status: "protocolado", total_docs: 30, entregues: 30 }, [])).toBeNull();
    expect(estadoPeticao({ status: "aguardando_documentos", protocolo_numero: "0891", total_docs: 30, entregues: 30 }, [])).toBeNull();
    expect(estadoPeticao({ status: "protocolado", total_docs: 30, entregues: 30 }, [{ status_cliente: "aprovada" }])?.id).toBe("aprovada");
  });

  it("status desconhecido de peça não inventa fase", () => {
    expect(estadoPeticao(emDocumentos, [{ status_cliente: "seila" }])).toBeNull();
  });
});

describe("statusPecaDominante", () => {
  it("sem peça, sem status", () => {
    expect(statusPecaDominante([])).toBeNull();
  });

  it("escolhe o estágio mais avançado da conversa com o cliente", () => {
    expect(statusPecaDominante([
      { status_cliente: "nao_enviada" },
      { status_cliente: "devolvida" },
    ])).toBe("devolvida");
  });
});

describe("pecasPorProcesso", () => {
  it("agrupa por processo e descarta peça sem vínculo", () => {
    const mapa = pecasPorProcesso([
      { processo_id: "p1", status_cliente: "aprovada" },
      { processo_id: "p1", status_cliente: "nao_enviada" },
      { processo_id: null, status_cliente: "aprovada" },
    ]);
    expect(mapa.p1).toHaveLength(2);
    expect(Object.keys(mapa)).toEqual(["p1"]);
  });
});

describe("vincularPecas", () => {
  const processos = [
    { processo_id: "p1", cliente_id: 10 },
    { processo_id: "p2", cliente_id: 20 },
    { processo_id: "p3", cliente_id: 20 },
  ];

  it("respeita o processo_id quando ele existe", () => {
    const mapa = vincularPecas(processos, [{ processo_id: "p2", cliente_id: 20, status_cliente: "aguardando_cliente" }]);
    expect(mapa.p2).toHaveLength(1);
    expect(mapa.p3).toBeUndefined();
  });

  it("peça solta cai no único processo ativo do cliente", () => {
    // É o caso da minuta gerada e nunca enviada: nasce só com cliente_id.
    const mapa = vincularPecas(processos, [{ processo_id: null, cliente_id: 10, status_cliente: "nao_enviada" }]);
    expect(mapa.p1).toHaveLength(1);
    expect(estadoPeticao({ status: "aguardando_documentos", total_docs: 30, entregues: 19 }, mapa.p1)?.id).toBe("redigida");
  });

  it("cliente com dois processos: peça solta não é chutada em nenhum", () => {
    const mapa = vincularPecas(processos, [{ processo_id: null, cliente_id: 20, status_cliente: "nao_enviada" }]);
    expect(mapa.p2).toBeUndefined();
    expect(mapa.p3).toBeUndefined();
  });

  it("peça sem processo e sem cliente é descartada", () => {
    expect(vincularPecas(processos, [{ processo_id: null, cliente_id: null, status_cliente: "nao_enviada" }])).toEqual({});
  });
});

describe("etapa final não segura a fase da PET", () => {
  // O caso real dos 9 clientes de 20/08: toda a papelada entregue, e os únicos
  // itens em aberto são GRU, comprovante, gov.br e juntada — passos que só
  // existem DEPOIS da defesa. O chip precisa acender mesmo assim.
  const docsAnthony = [
    { tipo: "antecedentes_criminais", status: "entregue_pelo_hub" },
    { tipo: "laudo_psicologico", status: "entregue_pelo_hub" },
    { tipo: "requerimento_de_posse_de_arma_de_fogo", status: "entregue_pelo_hub" },
    { tipo: "credencial_gov_br", status: "pendente" },
    { tipo: "juntada_assinada", status: "pendente" },
    { tipo: "gru", status: "pendente" },
    { tipo: "gru_comprovante", status: "pendente" },
  ];

  it("só etapa final em aberto: petição na fila da equipe", () => {
    const e = estadoPeticao(
      { status: "aguardando_documentos", total_docs: 32, entregues: 28 },
      [],
      docsAnthony,
    );
    expect(e?.id).toBe("aguardando_equipe");
  });

  it("documento comum em aberto ainda segura a fase", () => {
    const e = estadoPeticao(
      { status: "aguardando_documentos", total_docs: 32, entregues: 27 },
      [],
      [...docsAnthony, { tipo: "laudo_capacidade_tecnica", status: "pendente" }],
    );
    expect(e).toBeNull();
  });

  it("sem a lista de documentos, vale a contagem bruta do painel", () => {
    expect(estadoPeticao({ status: "aguardando_documentos", total_docs: 32, entregues: 28 }, [])).toBeNull();
  });

  it("faltaDocDoCliente aceita tipo_documento ou tipo", () => {
    expect(faltaDocDoCliente([{ tipo_documento: "rg", status: "pendente" }])).toBe(true);
    expect(faltaDocDoCliente([{ tipo_documento: "gru", status: "pendente" }])).toBe(false);
  });
});

describe("fila da petição — regra da efetiva necessidade (20/08/2026)", () => {
  const proc = { status: "aguardando_documentos", total_docs: 32, entregues: 28 };
  const entregue = (tipo) => ({ tipo, status: "entregue_pelo_hub" });
  const pendente = (tipo) => ({ tipo, status: "pendente" });

  it("cenário Anthony: tudo entregue, só etapa final aberta → entra na fila", () => {
    const docs = [
      entregue("comprovante_efetiva_necessidade"),
      entregue("antecedentes_criminais"), entregue("laudo_psicologico"),
      pendente("gru"), pendente("gru_comprovante"), pendente("credencial_gov_br"), pendente("juntada_assinada"),
    ];
    expect(estadoPeticao(proc, [], docs)?.id).toBe("aguardando_equipe");
  });

  it("efetiva necessidade aberta → fora da fila, mesmo com o resto ok", () => {
    const docs = [pendente("comprovante_efetiva_necessidade"), entregue("antecedentes_criminais")];
    expect(estadoPeticao(proc, [], docs)).toBeNull();
  });

  it("efetiva fechada com laudo ainda pendente → entra na fila (a EN decide)", () => {
    const docs = [entregue("declaracao_necessidade_efetiva"), pendente("laudo_psicologico")];
    expect(estadoPeticao(proc, [], docs)?.id).toBe("aguardando_equipe");
  });

  it("processo sem itens de efetiva: vale a leitura geral do checklist", () => {
    expect(estadoPeticao(proc, [], [pendente("antecedentes_criminais")])).toBeNull();
    expect(estadoPeticao(proc, [], [entregue("antecedentes_criminais"), pendente("gru")])?.id).toBe("aguardando_equipe");
  });

  it("peça já existente não depende da efetiva: o estado dela prevalece", () => {
    const docs = [pendente("comprovante_efetiva_necessidade")];
    expect(estadoPeticao(proc, [{ status_cliente: "aguardando_cliente" }], docs)?.id).toBe("com_cliente");
  });

  it("grupoEfetivaFechado distingue fechado, aberto e inexistente", () => {
    expect(grupoEfetivaFechado([entregue("comprovante_efetiva_necessidade")])).toBe(true);
    expect(grupoEfetivaFechado([pendente("peticao_efetiva_necessidade")])).toBe(false);
    expect(grupoEfetivaFechado([entregue("antecedentes_criminais")])).toBeNull();
  });
});

describe("fila da equipe e prazo de 7 dias úteis", () => {
  const proc = { status: "aguardando_documentos", total_docs: 32, entregues: 28 };

  it("só responsabilidade da equipe entra na fila", () => {
    const chk = (pecas) => ehResponsabilidadeEquipe(estadoPeticao(proc, pecas, [{ tipo: "comprovante_efetiva_necessidade", status: "aprovado" }]));
    expect(chk([])).toBe(true);                                          // a redigir
    expect(chk([{ status_cliente: "nao_enviada" }])).toBe(true);         // redigida, falta enviar
    expect(chk([{ status_cliente: "devolvida" }])).toBe(true);           // voltou para a equipe
    expect(chk([{ status_cliente: "aguardando_cliente" }])).toBe(false); // com o cliente: fora
    expect(chk([{ status_cliente: "aprovada" }])).toBe(false);           // aprovada: fora
  });

  it("dias úteis: sexta + 7 úteis cai na segunda da semana seguinte à próxima", () => {
    // 21/08/2026 é sexta. 7 dias úteis depois: 01/09/2026 (terça).
    const limite = somarDiasUteis(new Date(2026, 7, 21), 7);
    expect([limite.getDate(), limite.getMonth()]).toEqual([1, 8]);
    expect(diasUteisEntre(new Date(2026, 7, 21), new Date(2026, 7, 24))).toBe(1); // sex→seg = 1 útil
  });

  it("prazo ancora no fechamento da efetiva e aponta estouro", () => {
    const docs = [
      { tipo: "comprovante_efetiva_necessidade", status: "aprovado", updated_at: "2026-08-10T12:00:00-03:00" },
      { tipo: "antecedentes_criminais", status: "aprovado", updated_at: "2026-08-18T12:00:00-03:00" },
    ];
    // Âncora é a EFETIVA (10/08, segunda), não a certidão de 18/08.
    const p = prazoDefesa(docs, new Date(2026, 7, 20));
    expect(p).not.toBeNull();
    expect(p!.inicio.getDate()).toBe(10);
    // 10/08 (seg) + 7 úteis = 19/08 (qua); em 20/08 já estourou por 1.
    expect(p!.limite.getDate()).toBe(19);
    expect(p!.diasUteisRestantes).toBe(-1);
  });

  it("efetiva em aberto: prazo nem começa a correr", () => {
    expect(prazoDefesa([{ tipo: "comprovante_efetiva_necessidade", status: "pendente", updated_at: "2026-08-10T12:00:00-03:00" }])).toBeNull();
  });

  it("sem data para ancorar, sem prazo — melhor nada que um relógio errado", () => {
    expect(prazoDefesa([{ tipo: "comprovante_efetiva_necessidade", status: "aprovado" }])).toBeNull();
  });
});

describe("fila calculada no banco (qa_defesas_na_fila)", () => {
  it("traduz os três estados do banco no chip — e recusa o resto", () => {
    expect(estadoDaFilaServidor("a_redigir")?.id).toBe("aguardando_equipe");
    expect(estadoDaFilaServidor("redigida")?.id).toBe("redigida");
    expect(estadoDaFilaServidor("devolvida")?.id).toBe("devolvida");
    expect(estadoDaFilaServidor("aprovada")).toBeNull();
    expect(estadoDaFilaServidor(null)).toBeNull();
  });

  it("prazoDesdeInicio: 18/08 (terça) + 7 úteis = 27/08; em 20/08 restam 5", () => {
    // Meio-dia UTC para o dia-calendário ser 18/08 em qualquer fuso do runner.
    const p = prazoDesdeInicio("2026-08-18T12:00:00Z", new Date(2026, 7, 20));
    expect(p).not.toBeNull();
    expect([p!.limite.getDate(), p!.limite.getMonth()]).toEqual([27, 7]);
    expect(p!.diasUteisRestantes).toBe(5);
  });

  it("prazoDesdeInicio sem data ou com lixo: sem relógio", () => {
    expect(prazoDesdeInicio(null)).toBeNull();
    expect(prazoDesdeInicio("nao-e-data")).toBeNull();
  });
});
