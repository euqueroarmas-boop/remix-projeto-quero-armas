// ============================================================================
// SEGUNDO ENDEREÇO — a trava de quem pode ter dois endereços
// ----------------------------------------------------------------------------
// O 2º endereço é previsão da IN DG/PF 311 (CAC). Defesa pessoal segue a
// IN DG/PF 201 e NÃO tem essa previsão. O risco real desta mudança não é o
// campo faltar para o atirador — é ele sobrar para defesa pessoal, calado,
// porque alguém afrouxou a condição em uma das quatro portas de entrada.
//
// Por isso os testes não checam só a função: checam também o FONTE da edge
// function e da migration. Edge (Deno) não passa pelo tsc do projeto e SQL não
// passa por lint nenhum — se a trava sair de lá, é aqui que quebra.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  admiteSegundoEndereco,
  clienteAdmiteSegundoEndereco,
  ehCampoSegundoEndereco,
  segundoEnderecoPreenchido,
  CAMPOS_SEGUNDO_ENDERECO,
  SERVICOS_COM_SEGUNDO_ENDERECO,
  admiteSegundoEnderecoNaEntradaPublica,
} from "../segundoEndereco";

const ler = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

const EDGE = "supabase/functions/qa-cliente-atualizar-cadastro/index.ts";
const MIGRATION =
  "supabase/migrations/20260820200000_segundo_endereco_cr_e_autorizacao_cac.sql";

describe("portão do 2º endereço — quem passa", () => {
  it("Concessão de CR (44) passa", () => {
    expect(admiteSegundoEndereco({ servicoId: 44, modalidade: "atirador" })).toBe(true);
  });

  it("Autorização de Compra Atirador (50) e Caçador (51) passam", () => {
    expect(admiteSegundoEndereco({ servicoId: 50, modalidade: "atirador" })).toBe(true);
    expect(admiteSegundoEndereco({ servicoId: 51, modalidade: "cacador" })).toBe(true);
  });

  it("o catálogo manda quando a tela o tem em mãos", () => {
    expect(admiteSegundoEndereco({ servicoId: 999, admiteNoCatalogo: true })).toBe(true);
    expect(admiteSegundoEndereco({ servicoId: 44, admiteNoCatalogo: false })).toBe(false);
  });

  it("um processo que admite basta, mesmo convivendo com outros que não", () => {
    expect(
      clienteAdmiteSegundoEndereco([
        { servicoId: 60, modalidade: "defesa_pessoal" },
        { servicoId: 44, modalidade: "atirador" },
      ]),
    ).toBe(true);
  });
});

describe("portão do 2º endereço — quem NÃO passa", () => {
  it("defesa pessoal é recusada", () => {
    expect(admiteSegundoEndereco({ servicoId: 60, modalidade: "defesa_pessoal" })).toBe(false);
  });

  it("defesa pessoal continua recusada mesmo com o catálogo aberto por engano", () => {
    expect(
      admiteSegundoEndereco({ servicoId: 44, modalidade: "defesa_pessoal", admiteNoCatalogo: true }),
    ).toBe(false);
  });

  it("defesa pessoal continua recusada mesmo se o id entrar na lista de serviços", () => {
    for (const id of SERVICOS_COM_SEGUNDO_ENDERECO) {
      expect(admiteSegundoEndereco({ servicoId: id, modalidade: "defesa_pessoal" })).toBe(false);
    }
  });

  it("cliente só de defesa pessoal não passa", () => {
    expect(clienteAdmiteSegundoEndereco([{ servicoId: 60, modalidade: "defesa_pessoal" }])).toBe(false);
  });

  it("sem serviço, sem modalidade e sem catálogo, o portão fica fechado", () => {
    expect(admiteSegundoEndereco({})).toBe(false);
    expect(clienteAdmiteSegundoEndereco([])).toBe(false);
    expect(clienteAdmiteSegundoEndereco(null)).toBe(false);
  });
});

describe("portão na entrada pública (formulário público, por slug)", () => {
  const cr = { categoriaServico: "sinarm_cac_cr", servicoPrincipal: "concessao_cr" };
  const compra = { categoriaServico: "sinarm_cac_cr", servicoPrincipal: "aquisicao_acervo" };

  it("Concessão de CR e Aquisição para acervo CAC passam", () => {
    expect(admiteSegundoEnderecoNaEntradaPublica(cr)).toBe(true);
    expect(admiteSegundoEnderecoNaEntradaPublica(compra)).toBe(true);
  });

  it("objetivo defesa pessoal é recusado antes de qualquer outra regra", () => {
    expect(
      admiteSegundoEnderecoNaEntradaPublica({ ...cr, objetivoPrincipal: "defesa_pessoal" }),
    ).toBe(false);
  });

  it("serviço de defesa pessoal / posse não passa", () => {
    expect(
      admiteSegundoEnderecoNaEntradaPublica({
        categoriaServico: "sinarm_pf",
        servicoPrincipal: "aquisicao_posse",
      }),
    ).toBe(false);
  });

  it("outros serviços da própria categoria CAC não passam", () => {
    for (const servicoPrincipal of ["renovacao_cr", "guia_trafego", "emissao_craf"]) {
      expect(
        admiteSegundoEnderecoNaEntradaPublica({ categoriaServico: "sinarm_cac_cr", servicoPrincipal }),
      ).toBe(false);
    }
  });

  it("escolha vazia deixa o portão fechado", () => {
    expect(admiteSegundoEnderecoNaEntradaPublica({})).toBe(false);
  });
});

describe("campos do 2º endereço", () => {
  it("reconhece as colunas do bloco e ignora as do endereço principal", () => {
    expect(ehCampoSegundoEndereco("endereco2")).toBe(true);
    expect(ehCampoSegundoEndereco("tem_segundo_endereco")).toBe(true);
    expect(ehCampoSegundoEndereco("endereco")).toBe(false);
    expect(ehCampoSegundoEndereco("cep")).toBe(false);
  });

  it("detecta preenchimento real, não string vazia", () => {
    expect(segundoEnderecoPreenchido({ endereco2: "   " })).toBe(false);
    expect(segundoEnderecoPreenchido({ endereco2: "Rua B" })).toBe(true);
    expect(segundoEnderecoPreenchido(null)).toBe(false);
  });
});

describe("a edge de autoatualização do cliente mantém a trava", () => {
  const fonte = ler(EDGE);

  it("os campos do 2º endereço NÃO estão na lista branca comum", () => {
    const i = fonte.indexOf("const CAMPOS_PERMITIDOS");
    const listaBranca = fonte.slice(i, fonte.indexOf("]", i));
    for (const campo of CAMPOS_SEGUNDO_ENDERECO) {
      expect(listaBranca).not.toContain(`"${campo}"`);
    }
  });

  it("os campos do 2º endereço vão para o balde condicionado", () => {
    const i = fonte.indexOf("const CAMPOS_SEGUNDO_ENDERECO");
    expect(i).toBeGreaterThan(-1);
    const balde = fonte.slice(i, fonte.indexOf("]", i));
    for (const campo of CAMPOS_SEGUNDO_ENDERECO) {
      if (campo === "geolocalizacao2") continue; // resolvida no servidor, não vem do cliente
      expect(balde).toContain(`"${campo}"`);
    }
  });

  it("o balde só é mesclado depois do portão responder TRUE", () => {
    expect(fonte).toContain("qa_cliente_admite_segundo_endereco");
    const rpc = fonte.indexOf("qa_cliente_admite_segundo_endereco");
    const merge = fonte.indexOf("Object.assign(updates, updatesSegundoEndereco)");
    expect(merge).toBeGreaterThan(rpc);
    expect(fonte).toContain("if (portaoErr || admite !== true)");
  });

  it("erro no portão descarta os campos em vez de gravar", () => {
    const i = fonte.indexOf("if (portaoErr || admite !== true)");
    const ramo = fonte.slice(i, fonte.indexOf("} else {", i));
    expect(ramo).toContain("ignorados.push");
    expect(ramo).not.toContain("Object.assign");
  });
});

describe("a migration mantém a trava", () => {
  const sql = ler(MIGRATION);

  it("o portão nasce fechado para todo serviço", () => {
    expect(sql).toContain("admite_segundo_endereco boolean NOT NULL DEFAULT false");
  });

  it("defesa pessoal é fechada por último, depois de qualquer regra que abra", () => {
    const fecha = sql.lastIndexOf("modalidade_cac = 'defesa_pessoal'");
    const abreCr = sql.indexOf("servico_id = 44");
    const abreCompra = sql.indexOf("servico_id IN (50, 51)");
    expect(abreCr).toBeGreaterThan(-1);
    expect(abreCompra).toBeGreaterThan(-1);
    expect(fecha).toBeGreaterThan(abreCr);
    expect(fecha).toBeGreaterThan(abreCompra);
  });

  it("a função do portão lê o catálogo, não o id do serviço solto", () => {
    expect(sql).toContain("FUNCTION public.qa_cliente_admite_segundo_endereco");
    expect(sql).toContain("JOIN public.qa_servicos_catalogo c ON c.servico_id = p.servico_id");
    expect(sql).toContain("AND c.admite_segundo_endereco");
  });

  it("o backfill não inventa FALSE para quem nunca foi perguntado", () => {
    const i = sql.indexOf("UPDATE public.qa_clientes");
    const bloco = sql.slice(i, sql.indexOf(";", i));
    expect(bloco).toContain("SET tem_segundo_endereco = true");
    expect(bloco).toContain("tem_segundo_endereco IS NULL");
  });
});
