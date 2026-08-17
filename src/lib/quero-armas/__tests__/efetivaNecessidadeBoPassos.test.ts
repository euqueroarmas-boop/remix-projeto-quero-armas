import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EFETIVA_PASSOS_IDS,
  calcularPassosEfetiva,
  narrativaRefeitaAposAprovacao,
  temFatoNovoForaDoTexto,
  textoBoRefeitoAposRegistro,
} from "../efetivaNecessidadePassos";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

/**
 * Regressão do caso real de 15/08/2026 (cliente Mizael, processo
 * 2288dcda-…). Ele percorreu o grupo inteiro, deu a ciência do BO e aprovou.
 * A aprovação zerou o `texto_bo`; sem esse texto o wizard passava a montar
 * uma lista de 7 passos enquanto o checklist contava 11, e os itens
 * "Registrar o boletim" / "Enviar o boletim" renderizavam a tela de Revisão,
 * cujo botão era "Concordo e aprovo". Aprovava, nada mudava, a exigência
 * reabria pelos passos pendentes e recomeçava. Círculo fechado, sem saída.
 */
const REGISTRO_SEM_BO = {
  tem_bo: false,
  tem_inquerito: false,
  tem_acao_criminal: false,
  sofre_ameaca: true,
  relato_cliente: "x".repeat(1400),
  contexto_risco: "Gestor com estoque de alto valor sob a minha responsabilidade.",
  narrativa_gerada: "Narrativa montada em 09/08.",
  narrativa_gerada_em: "2026-08-09T19:23:47.180Z",
  texto_bo: null,
  bo_pendente_registro: false,
  aprovado_cliente: true,
  aprovado_cliente_em: "2026-08-15T23:17:36.925Z",
  status: "em_revisao",
};

describe("passos da efetiva necessidade — lista única", () => {
  it("são sempre 12, na ordem canônica, independente do texto da IA", () => {
    // 17/08/2026: entrou a confirmação das frentes de risco (teses), entre a
    // geração do relato e o caminho da delegacia.
    expect(EFETIVA_PASSOS_IDS).toHaveLength(12);
    expect(EFETIVA_PASSOS_IDS.slice(7)).toEqual([
      "teses",
      "entender_bo",
      "registrar_bo",
      "enviar_bo",
      "defesa_final",
    ]);
    expect(calcularPassosEfetiva(REGISTRO_SEM_BO, [], true)).toHaveLength(12);
  });

  it("o wizard consome a lista da lib — não monta a dele a partir do texto_bo", () => {
    const src = r("src/components/quero-armas/portal/EfetivaNecessidadeModal.tsx");
    expect(src).toMatch(/EFETIVA_PASSOS_IDS/);
    // A linha que criava a segunda lista de passos não pode voltar.
    expect(src).not.toMatch(/textoBo\.trim\(\)\s*\?\s*\[\.\.\.PASSOS_BASE/);
  });

  it("sem boletim anexado, os passos do boletim ficam pendentes", () => {
    const passos = calcularPassosEfetiva(REGISTRO_SEM_BO, [], true);
    const por = (id: string) => passos.find((p) => p.id === id)?.concluido;
    expect(por("revisao")).toBe(true);
    expect(por("entender_bo")).toBe(true); // ciência já aceita
    expect(por("registrar_bo")).toBe(false);
    expect(por("enviar_bo")).toBe(false);
  });

  it('o "Já registrei o boletim" fica gravado e fecha o passo de registrar', () => {
    const comConfirmacao = {
      ...REGISTRO_SEM_BO,
      bo_registro_confirmado_em: "2026-08-16T01:00:00.000Z",
    };
    const passos = calcularPassosEfetiva(comConfirmacao, [], true);
    expect(passos.find((p) => p.id === "registrar_bo")?.concluido).toBe(true);
    // Declarar não substitui o documento: enviar continua pendente.
    expect(passos.find((p) => p.id === "enviar_bo")?.concluido).toBe(false);
  });
});

/**
 * Regra do usuário (15/08/2026): o carimbo do "Já registrei o boletim" NUNCA é
 * apagado — ele é a prova da declaração do cliente. O que reabre o passo é o
 * confronto de datas com o texto do BO. Se amanhã ele disser que não mudou
 * nada, o carimbo e o rastro na auditoria mostram que a mudança foi dele.
 */
describe("mudar o texto do BO depois de declarar o registro", () => {
  const DECLAROU = {
    ...REGISTRO_SEM_BO,
    texto_bo: "Texto para levar à delegacia.",
    bo_registro_confirmado_em: "2026-08-16T01:00:00.000Z",
    texto_bo_gerado_em: "2026-08-16T00:30:00.000Z",
  };

  it("texto antigo: a declaração continua valendo e o passo fica concluído", () => {
    expect(textoBoRefeitoAposRegistro(DECLAROU)).toBe(false);
    expect(
      calcularPassosEfetiva(DECLAROU, [], true).find((p) => p.id === "registrar_bo")?.concluido,
    ).toBe(true);
  });

  it("texto refeito depois da declaração reabre o passo do registro", () => {
    const mudou = { ...DECLAROU, texto_bo_gerado_em: "2026-08-16T03:00:00.000Z" };
    expect(textoBoRefeitoAposRegistro(mudou)).toBe(true);
    expect(
      calcularPassosEfetiva(mudou, [], true).find((p) => p.id === "registrar_bo")?.concluido,
    ).toBe(false);
    // O carimbo do cliente continua lá — reabrir não apaga a declaração dele.
    expect(mudou.bo_registro_confirmado_em).toBe("2026-08-16T01:00:00.000Z");
  });

  it("regerar sem mudar o texto não reabre o passo à toa", () => {
    // qa-efetiva-narrativa preserva `texto_bo_gerado_em` quando o texto não
    // mudou, então uma regeração inócua não vira exigência nova.
    const src = r("supabase/functions/qa-efetiva-narrativa/index.ts");
    expect(src).toMatch(/textoBoNovo \|\| !reg\.texto_bo_gerado_em \? agora : reg\.texto_bo_gerado_em/);
    expect(src).toMatch(/texto_bo_gerado_em: textoBoGeradoEm/);
  });

  it("o documento anexado encerra o passo mesmo com texto novo", () => {
    const comDoc = { ...DECLAROU, texto_bo_gerado_em: "2026-08-16T03:00:00.000Z" };
    const provas = [{ tipo: "boletim_ocorrencia", created_at: "2026-08-16T04:00:00.000Z" }];
    expect(
      calcularPassosEfetiva(comDoc, provas as never, true).find((p) => p.id === "registrar_bo")
        ?.concluido,
    ).toBe(true);
  });

  it("a tela avisa que a mudança partiu do cliente e pede aditamento", () => {
    const src = r("src/components/quero-armas/portal/EfetivaNecessidadeModal.tsx");
    expect(src).toMatch(/O texto do boletim mudou/);
    expect(src).toMatch(/você acrescentou fato novo/);
    expect(src).toMatch(/aditamento/);
    expect(src).toMatch(/nada foi apagado/);
    // Reconfirmar atualiza o carimbo; em nenhum lugar ele é zerado.
    expect(src).not.toMatch(/bo_registro_confirmado_em:\s*null/);
  });

  it("o rastro dos dois eventos vai para a auditoria que já existe", () => {
    const sql = r(
      "supabase/migrations/20260815234500_efetiva_rastro_bo_alterado_apos_registro.sql",
    );
    expect(sql).toMatch(/qa_efetiva_necessidade_auditoria/);
    expect(sql).toMatch(/'bo_registro_declarado'/);
    expect(sql).toMatch(/'bo_texto_alterado_apos_registro'/);
    expect(sql).toMatch(/AFTER UPDATE ON public\.qa_efetiva_necessidade/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.qa_efetiva_rastro_bo\(\) FROM PUBLIC/);
  });
});

describe("refazer o texto exige autorização do cliente", () => {
  it("detecta fato acrescentado depois do texto montado", () => {
    const acrescimos = [{ created_at: "2026-08-14T08:17:12.212Z" }];
    expect(temFatoNovoForaDoTexto(REGISTRO_SEM_BO, acrescimos)).toBe(true);
    expect(
      temFatoNovoForaDoTexto(
        { narrativa_gerada_em: "2026-08-15T00:00:00.000Z" },
        acrescimos,
      ),
    ).toBe(false);
    expect(temFatoNovoForaDoTexto(REGISTRO_SEM_BO, [])).toBe(false);
  });

  it("a tela pergunta antes de refazer e nunca toca no texto do cliente", () => {
    const src = r("src/components/quero-armas/portal/EfetivaNecessidadeModal.tsx");
    expect(src).toMatch(/Deseja refazer o seu texto de defesa com os novos fatos\?/);
    expect(src).toMatch(/temFatoNovoPendente/);
    // O que o cliente digitou só vai para o banco pelo que ele digitou.
    expect(src).toMatch(/if \(!valor\.trim\(\) && base\.trim\(\)\) return;/);
  });

  it("texto refeito depois da aprovação reabre a defesa final", () => {
    expect(narrativaRefeitaAposAprovacao(REGISTRO_SEM_BO)).toBe(false);
    const refeito = {
      ...REGISTRO_SEM_BO,
      narrativa_gerada_em: "2026-08-16T02:00:00.000Z",
    };
    expect(narrativaRefeitaAposAprovacao(refeito)).toBe(true);
    expect(
      calcularPassosEfetiva(refeito, [], true).find((p) => p.id === "defesa_final")?.concluido,
    ).toBe(false);
  });
});

describe("o texto do boletim nunca é apagado", () => {
  it("a geração preserva o texto anterior e não depende do sucesso da IA", () => {
    const src = r("supabase/functions/qa-efetiva-narrativa/index.ts");
    // O que vai para o banco passa pela cadeia de reserva — o que a IA acabou
    // de devolver, o que já estava gravado, e por último um texto montado sem
    // IA. Nunca o resultado cru da IA sozinho, que é como o texto sumia.
    expect(src).toMatch(/textoBoBruto\s*\|\|\s*textoBoAnterior\s*\|\|/);
    expect(src).toMatch(/textoBoDeReserva/);
    // Quem decide a pendência do BO é a regra, não a IA ter respondido.
    expect(src).toMatch(/bo_pendente_registro:\s*precisaNovoBo/);
    expect(src).not.toMatch(/bo_pendente_registro:\s*Boolean\(textoBo\)/);
  });

  it("a aprovação não sobrescreve o texto do boletim com vazio", () => {
    const src = r("supabase/functions/qa-efetiva-aprovar/index.ts");
    expect(src).toMatch(/texto_bo:\s*textoBo\s*\|\|\s*reg\.texto_bo\s*\|\|\s*null,/);
  });
});

describe("não dá para aprovar pulando o boletim", () => {
  it("o servidor recusa a aprovação sem boletim em mãos", () => {
    const src = r("supabase/functions/qa-efetiva-aprovar/index.ts");
    expect(src).toMatch(/const boEmMaos\s*=/);
    expect(src).toMatch(/conclua o passo do boletim de ocorrência/);
  });

  it("o botão da tela aplica a mesma trava", () => {
    const src = r("src/components/quero-armas/portal/EfetivaNecessidadeModal.tsx");
    expect(src).toMatch(/const boEmMaos\s*=/);
  });
});

describe("o passo a passo da delegacia não depende da IA", () => {
  it("o roteiro de registro aparece sempre no passo registrar_bo", () => {
    const src = r("src/components/quero-armas/portal/EfetivaNecessidadeModal.tsx");
    expect(src).toMatch(
      /\{passo\?\.tipo === "registrar_bo" && \(\s*\n\s*<div className="rounded-lg border border-zinc-200 bg-white p-3">/,
    );
    expect(src).toMatch(/Gerar o meu texto agora/);
  });
});
