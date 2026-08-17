import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  aguardandoOutroBo,
  casarProvaComTese,
  descreverCasamento,
  tesesPendentes,
} from "../efetivaTeses";
import { calcularPassosEfetiva } from "../efetivaNecessidadePassos";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

/**
 * Caso real de 17/08/2026 (cliente Mizael). Ele vive DUAS situações sem relação
 * uma com a outra: ameaça do companheiro da irmã, em casa, e o risco da própria
 * atividade, na empresa onde é coordenador de produção. O sistema gerava um
 * texto único de relato, o cliente não conseguia abrir o segundo boletim e
 * acabou subindo o mesmo documento duas vezes.
 */
const TESES = [
  {
    id: "t1",
    ordem: 1,
    titulo: "Ameaça do companheiro da minha irmã",
    resumo: "Cobrança de dinheiro furtado da minha mãe e ameaça de morte na porta de casa.",
    texto_bo:
      "Sou coordenador de produção e moro no Jardim Paraíso. O companheiro da minha irmã me ameaçou de morte depois que eu o cobrei por dinheiro furtado da minha mãe idosa, que mora ao lado.",
    confirmada_em: "2026-08-17T10:00:00.000Z",
    prova_id: null,
  },
  {
    id: "t2",
    ordem: 2,
    titulo: "Risco na empresa onde trabalho",
    resumo: "Transporte de valores e saída de madrugada da fábrica.",
    texto_bo:
      "Trabalho como coordenador de produção e saio da fábrica de madrugada levando valores da empresa. Fui abordado no estacionamento por dois homens.",
    confirmada_em: "2026-08-17T10:00:00.000Z",
    prova_id: null,
  },
];

describe("casar o boletim com a frente de risco certa", () => {
  it("o boletim da ameaça familiar cai na tese da família", () => {
    const prova = {
      id: "p1",
      numero: "MG8844-1/2026",
      naturezas: ["Código Penal - Ameaça (art. 147)"],
      relato:
        "Quero comunicar que sofri uma grave ameaça de morte feita pelo companheiro da minha irmã, " +
        "depois de cobrá-los por furtarem dinheiro e pertences da minha mãe idosa, que mora ao lado.",
      local_fato: "Jardim Paraíso",
    };
    const casamento = casarProvaComTese(prova, TESES);
    expect(casamento?.tese.id).toBe("t1");
    expect(casamento?.porConteudo).toBe(true);
    expect(descreverCasamento(prova, casamento)).toContain("Ameaça do companheiro");
  });

  it("o boletim do trabalho cai na tese do trabalho", () => {
    const prova = {
      id: "p2",
      numero: "MG9001-1/2026",
      naturezas: ["Código Penal - Roubo (art. 157)"],
      relato:
        "Fui abordado por dois homens no estacionamento da fábrica quando saía de madrugada " +
        "levando valores da empresa onde trabalho.",
    };
    expect(casarProvaComTese(prova, TESES)?.tese.id).toBe("t2");
  });

  it("documento ilegível não trava: sugere a frente em aberto e avisa que é sugestão", () => {
    const prova = { id: "p3", numero: null, naturezas: null, relato: null };
    const casamento = casarProvaComTese(prova, TESES);
    expect(casamento?.tese.id).toBe("t1");
    expect(casamento?.porConteudo).toBe(false);
    expect(descreverCasamento(prova, casamento)).toContain("não pôde ser lido");
  });

  it("frente que já tem boletim sai da fila — o mesmo documento não fecha duas", () => {
    const usadas = [{ ...TESES[0], prova_id: "p1" }, TESES[1]];
    expect(tesesPendentes(usadas).map((t) => t.id)).toEqual(["t2"]);
    expect(casarProvaComTese({ id: "p9", relato: "ameaça de morte do companheiro da irmã" }, usadas)
      ?.tese.id).toBe("t2");
  });
});

describe('o laço "quer abrir outro boletim?"', () => {
  const BASE = {
    tem_bo: true,
    tem_inquerito: false,
    tem_acao_criminal: false,
    sofre_ameaca: true,
    relato_cliente: "x".repeat(1400),
    contexto_risco: "Coordenador de produção, saída de madrugada.",
    narrativa_gerada: "Relato montado.",
    narrativa_gerada_em: "2026-08-17T09:00:00.000Z",
    bo_pendente_registro: false,
  };
  const PROVAS = [{ tipo: "boletim_ocorrencia", data_fato: "2026-08-16", created_at: "2026-08-17T10:07:48.000Z" }];

  it("disse que vai abrir outro: trava, mesmo com boletim já anexado", () => {
    const reg = { ...BASE, bo_quer_outro: true, bo_aguardando_desde: "2026-08-17T11:00:00.000Z" };
    expect(aguardandoOutroBo(reg)).toBe(true);
    const passos = calcularPassosEfetiva(reg, PROVAS as never, true, TESES);
    expect(passos.find((p) => p.id === "enviar_bo")?.concluido).toBe(false);
  });

  it("disse que não quer outro: o passo fecha e a defesa final abre", () => {
    const reg = { ...BASE, bo_quer_outro: false };
    expect(aguardandoOutroBo(reg)).toBe(false);
    const passos = calcularPassosEfetiva(reg, PROVAS as never, true, TESES);
    expect(passos.find((p) => p.id === "enviar_bo")?.concluido).toBe(true);
  });

  it("a destrava da equipe libera a espera atual — e só ela", () => {
    const travado = {
      ...BASE,
      bo_quer_outro: true,
      bo_aguardando_desde: "2026-08-17T11:00:00.000Z",
    };
    const destravado = { ...travado, bo_destravado_em: "2026-08-17T15:00:00.000Z" };
    expect(aguardandoOutroBo(destravado)).toBe(false);
    // Ele voltou a dizer que vai abrir outro DEPOIS da destrava: trava de novo.
    const travouDeNovo = { ...destravado, bo_aguardando_desde: "2026-08-18T08:00:00.000Z" };
    expect(aguardandoOutroBo(travouDeNovo)).toBe(true);
  });

  it("o servidor também recusa aprovar quem ficou de abrir outro boletim", () => {
    const src = r("supabase/functions/qa-efetiva-aprovar/index.ts");
    expect(src).toMatch(/const aguardandoOutroBo =/);
    expect(src).toMatch(/vai registrar outro boletim/);
  });

  it("só a equipe destrava — a função exige perfil e grava auditoria", () => {
    const src = r("supabase/functions/qa-efetiva-destravar-bo/index.ts");
    expect(src).toMatch(/qa_usuarios_perfis/);
    expect(src).toMatch(/"forbidden"/);
    expect(src).toMatch(/bo_adicional_destravado/);
    expect(src).toMatch(/informe o motivo/);
    // O cliente não se destrava sozinho: a tela manda ele falar com a equipe.
    const tela = r("src/components/quero-armas/portal/EfetivaNecessidadeModal.tsx");
    expect(tela).toMatch(/Fale com a nossa equipe pelo/);
  });
});

describe("confirmação das frentes de risco", () => {
  const REG = {
    narrativa_gerada: "Relato montado.",
    narrativa_gerada_em: "2026-08-17T09:00:00.000Z",
  };

  it("enquanto houver frente por confirmar, o passo fica pendente", () => {
    const semConfirmar = [{ ...TESES[0], confirmada_em: null }, TESES[1]];
    const passos = calcularPassosEfetiva(REG, [], true, semConfirmar);
    expect(passos.find((p) => p.id === "teses")?.concluido).toBe(false);
    expect(calcularPassosEfetiva(REG, [], true, TESES).find((p) => p.id === "teses")?.concluido)
      .toBe(true);
  });

  it("registro antigo, sem tese nenhuma, não vira pendência eterna", () => {
    expect(calcularPassosEfetiva(REG, [], true, []).find((p) => p.id === "teses")?.concluido)
      .toBe(true);
  });

  it("a IA recebe a regra de separar os núcleos sem correlação", () => {
    const src = r("supabase/functions/qa-efetiva-narrativa/index.ts");
    expect(src).toMatch(/===TESE===/);
    expect(src).toMatch(/núcleo de risco autônomo/);
    expect(src).toMatch(/NÃO pode citar, aludir ou depender de nada que esteja em outra tese/);
    expect(src).toMatch(/MÁXIMO 500 CARACTERES/);
    // Tese confirmada pelo cliente ou já usada num boletim não é reescrita.
    expect(src).toMatch(/const travadas = existentes\.filter\(/);
  });

  it("o mesmo boletim não sobe duas vezes", () => {
    const tela = r("src/components/quero-armas/portal/EfetivaNecessidadeModal.tsx");
    expect(tela).toMatch(/já está anexado/);
    const sql = r("supabase/migrations/20260817210000_efetiva_teses_e_multiplos_bos.sql");
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_efetiva_teses_prova/);
  });
});
