// ============================================================================
// F8 — a exigência repetida pela PF volta para a fila, e a equipe fica sabendo
// ----------------------------------------------------------------------------
// Dois furos medidos em 18/08/2026, os dois silenciosos:
//
// 1) EXIGÊNCIA REPETIDA VIRAVA SUMIDOURO. `qa-manifestacao-analisar` só criava
//    a exigência quando NÃO existia linha daquele tipo no processo. E a PF pede
//    de novo o tempo todo: o comprovante venceu, a certidão saiu com nome
//    divergente, o laudo é de outro ano. Havendo linha antiga — mesmo aprovada
//    há oito meses — a exigência era descartada em silêncio e contada como
//    "já existente". O cliente nunca era cobrado, e os 10 dias corriam até o
//    requerimento ser arquivado.
//
// 2) NINGUÉM SABIA QUANDO O CLIENTE RESPONDIA. O e-mail `exigencia-cumprida`
//    existia no sistema, mas só disparava por `Etapa4Salvar.tsx`, o assistente
//    de pré-piloto. O fluxo real — cliente sobe no portal, IA valida, equipe
//    aprova — nunca o acionava.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

describe("exigência repetida pela PF REABRE", () => {
  const src = r("supabase/functions/qa-manifestacao-analisar/index.ts");

  it("lê id e regra_validacao — sem eles não há como reabrir", () => {
    expect(src).toContain('.select("id, tipo_documento, nome_documento, status, regra_validacao")');
  });

  it("separa criar de reabrir", () => {
    expect(src).toMatch(/const aCriar: typeof elementos = \[\]/);
    expect(src).toMatch(/const aReabrir: Array</);
  });

  it("linha cumprida volta a pendente quando a PF pede de novo", () => {
    const bloco = src.slice(src.indexOf("for (const { elemento: e, linha } of aReabrir)"));
    expect(bloco).toMatch(/status: "pendente"/);
    expect(bloco).toMatch(/data_validacao: null/);
    expect(bloco).toMatch(/A Polícia Federal pediu este documento novamente/);
  });

  it("a reaberta entra no grupo da PF, que é o de prioridade máxima", () => {
    const bloco = src.slice(src.indexOf("for (const { elemento: e, linha } of aReabrir)"));
    expect(bloco).toMatch(/grupo_checklist: "exigencias_pf"/);
    expect(bloco).toMatch(/origem: "manifestacao_pf"/);
  });

  it("as condicionais saem: o que a PF exige é incondicional", () => {
    // Uma linha reaberta com `exige_quando` insatisfeito voltaria INVISÍVEL
    // para o cliente — o mesmo silêncio, por outra porta.
    const bloco = src.slice(src.indexOf("for (const { elemento: e, linha } of aReabrir)"));
    expect(bloco).toMatch(/exige_quando: _eq/);
    expect(bloco).toMatch(/dispensa_quando: _dq/);
    expect(bloco).toMatch(/depende_de: _dd/);
    expect(bloco).toMatch(/\.\.\.regraPreservada/);
  });

  it("não mexe no que já está pendente pela MESMA manifestação (idempotência)", () => {
    expect(src).toMatch(/if \(jaDestaManifestacao && !cumprida\) continue;/);
  });

  it("a reabertura vira evento na linha do tempo", () => {
    expect(src).toContain("exigencia_pf_reaberta");
    expect(src).toMatch(/status_anterior: linha\.status/);
  });

  it("o retorno separa criadas, reabertas e já pendentes", () => {
    expect(src).toMatch(/exigencias_criadas: criadas/);
    expect(src).toMatch(/exigencias_reabertas: reabertas/);
    expect(src).toMatch(/exigencias_ja_pendentes:/);
    // O nome antigo escondia a reabertura dentro de "já existia".
    expect(src).not.toMatch(/exigencias_ja_existentes/);
  });

  it("a equipe vê a reabertura no toast, não só a criação", () => {
    const modal = r("src/components/quero-armas/processos/ColarManifestacaoPFModal.tsx");
    expect(modal).toMatch(/exigencias_reabertas/);
    expect(modal).toMatch(/reaberta\(s\)/);
  });
});

describe("a equipe recebe os disparos do fluxo real", () => {
  const helper = r("supabase/functions/_shared/notificarExigenciaPF.ts");

  it("reconhece a exigência da PF pelos dois marcadores", () => {
    expect(helper).toMatch(/r\.origem === "manifestacao_pf" \|\| r\.grupo_checklist === "exigencias_pf"/);
  });

  it("avisa na ENTREGA e no CUMPRIMENTO — perguntas diferentes", () => {
    expect(helper).toMatch(/export async function avisarEntregaExigenciaPF/);
    expect(helper).toMatch(/export async function avisarCumprimentoExigenciaPF/);
  });

  it("o aviso de cumprimento só sai quando não resta pendência", () => {
    expect(helper).toMatch(/if \(pendentes\.length > 0\) return \{ completo: false/);
  });

  it("agrupa pela manifestação, com fallback para o processo inteiro", () => {
    expect(helper).toMatch(/if \(!manifestacaoId\) return true;/);
  });

  it("reenvio depois de recusa avisa de novo (chave varia por envio)", () => {
    expect(helper).toMatch(/exig-pf-entrega-\$\{args\.documentoId\}-\$\{args\.chaveExtra\}/);
  });

  it("não duplica o aviso de manifestação fechada", () => {
    expect(helper).toMatch(/exig-pf-completa-\$\{chave\}/);
  });

  it("o cliente também é avisado, pelo evento que existia e não era usado", () => {
    expect(helper).toContain('evento: "exigencia_cumprida"');
  });

  it("é best-effort: nunca derruba upload nem validação", () => {
    expect(helper).toMatch(/catch \(e\) \{[\s\S]*console\.warn\("\[notificarExigenciaPF\] entrega falhou/);
    expect(helper).toMatch(/catch \(e\) \{[\s\S]*console\.warn\("\[notificarExigenciaPF\] cumprimento falhou/);
  });
});

describe("os três caminhos do fluxo real estão ligados", () => {
  it("upload do cliente dispara o aviso de entrega", () => {
    const src = r("supabase/functions/qa-processo-doc-upload/index.ts");
    expect(src).toMatch(/avisarEntregaExigenciaPF/);
    expect(src).toMatch(/chaveExtra: String\(storage_path\)/);
  });

  it("aprovação pela IA dispara o aviso de cumprimento", () => {
    const src = r("supabase/functions/qa-processo-doc-validar-ia/index.ts");
    expect(src).toMatch(/avisarCumprimentoExigenciaPF/);
    expect(src).toMatch(/if \(novoStatus === "aprovado"\)/);
  });

  it("aprovação manual pela equipe também — é o caminho mais comum na PF", () => {
    // A IA manda para revisão humana com frequência justamente nas exigências
    // da PF, e o painel escreve direto no banco, sem passar por edge nenhuma.
    const edge = r("supabase/functions/qa-exigencia-pf-checar/index.ts");
    expect(edge).toMatch(/requireQAStaff/);
    expect(edge).toMatch(/avisarCumprimentoExigenciaPF/);
    const drawer = r("src/components/quero-armas/processos/ProcessoDetalheDrawer.tsx");
    expect(drawer).toMatch(/qa-exigencia-pf-checar/);
  });
});

describe("o template do e-mail à equipe existe e está registrado", () => {
  it("cobre os dois estados: parcial e completo", () => {
    const tpl = r("supabase/functions/_shared/transactional-email-templates/exigencia-pf-respondida.tsx");
    expect(tpl).toMatch(/p\.completo/);
    expect(tpl).toContain("Ainda pendente");
    expect(tpl).toContain("Prazo da PF");
  });

  it("está no registry — sem isso o envio falha em runtime", () => {
    const reg = r("supabase/functions/_shared/transactional-email-templates/registry.ts");
    expect(reg).toContain("exigencia-pf-respondida.tsx");
    expect(reg).toMatch(/'exigencia-pf-respondida': exigenciaPfRespondida,/);
  });
});
