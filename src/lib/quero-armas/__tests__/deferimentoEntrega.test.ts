// ============================================================================
// F11 — o deferimento deixa de ser uma etiqueta
// ----------------------------------------------------------------------------
// Último furo do fim do fluxo, auditoria de 18/08/2026:
//
//   `deferido` era só um rótulo em `qa_processos.status`. Não existia e-mail de
//   deferimento, não existia passo para entregar o documento ao cliente, não
//   existia baixa do serviço, não existia registro no Arsenal.
//
//   Para um serviço chamado "AUTORIZAÇÃO DE COMPRA DE ARMA DE FOGO", o produto
//   final — a autorização — não tinha lugar nenhum no sistema. O cliente
//   pagava, entregava documento por documento durante meses, e no fim via a
//   palavra "Deferido" numa tela. O papel que ele comprou chegava por fora.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

describe("a migration amarra o resultado ao processo", () => {
  const sql = r("supabase/migrations/20260818140000_deferimento_entrega_ao_cliente.sql");

  it("é reexecutável", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS/);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS/);
  });

  it("aponta para o documento do HUB — é ele que entra no Arsenal", () => {
    expect(sql).toMatch(/deferimento_documento_id uuid\s*\n?\s*REFERENCES public\.qa_documentos_cliente\(id\)/);
  });

  it("guarda a data do ÓRGÃO, separada da data do registro", () => {
    expect(sql).toContain("deferimento_data date");
    expect(sql).toContain("deferimento_registrado_em");
  });

  it("entrega sem confirmação não é entrega", () => {
    expect(sql).toContain("deferimento_visto_cliente_em");
  });

  it("o índice serve a fila do guiado (deferido e não confirmado)", () => {
    expect(sql).toMatch(/WHERE deferimento_documento_id IS NOT NULL\s*\n?\s*AND deferimento_visto_cliente_em IS NULL/);
  });
});

describe("a edge fecha o ciclo num ato", () => {
  const src = r("supabase/functions/qa-processo-deferir/index.ts");

  it("exige o documento — sem ele vira etiqueta de novo", () => {
    expect(src).toMatch(/documento_id_obrigatorio/);
  });

  it("não entrega a autorização de um cliente a outro", () => {
    expect(src).toMatch(/documento_de_outro_cliente/);
  });

  it("só aceita tipo que pode ser resultado de processo", () => {
    expect(src).toMatch(/TIPOS_RESULTADO/);
    expect(src).toMatch(/tipo_de_documento_nao_e_resultado_de_processo/);
    expect(src).toContain("autorizacao_compra");
  });

  it("dá baixa no item da venda", () => {
    expect(src).toMatch(/data_deferimento: dataDeferimento/);
    expect(src).toMatch(/from\("qa_itens_venda"\)/);
  });

  it("a DATA é gravada antes do status — o status é validado por trigger", () => {
    // Se o código de status mudar de nome no catálogo, a data (que é o que
    // encerra o prazo) não pode cair junto.
    const posData = src.indexOf("update({ data_deferimento: dataDeferimento })");
    const posStatus = src.indexOf('update({ status: "DEFERIDO" })');
    expect(posData).toBeGreaterThan(-1);
    expect(posStatus).toBeGreaterThan(posData);
  });

  it("faz a tradução venda_id → id_legado", () => {
    expect(src).toMatch(/id_legado/);
    expect(src).toMatch(/const fkVenda/);
  });

  it("registrar de novo reabre a confirmação do cliente", () => {
    // Correção de data ou de documento: ele precisa ver o certo.
    expect(src).toMatch(/deferimento_visto_cliente_em: null/);
  });

  it("tem as duas ações, com atores diferentes", () => {
    expect(src).toMatch(/acao === "confirmar_recebimento"/);
    expect(src).toMatch(/if \(acao !== "registrar"\) return json\(\{ error: "acao_invalida" \}, 400\)/);
    expect(src).toMatch(/if \(!ehStaff\) return json\(\{ error: "forbidden" \}, 403\)/);
  });

  it("a confirmação é idempotente", () => {
    expect(src).toMatch(/ja_confirmado: true/);
  });

  it("manda o e-mail com a validade — papel sem prazo é meia entrega", () => {
    expect(src).toContain("processo-deferido");
    expect(src).toMatch(/validade: validade \? /);
  });
});

describe("o cliente recebe dentro do guiado", () => {
  const portal = r("src/pages/quero-armas/QAClientePortalPage.tsx");
  const painel = r("src/components/quero-armas/portal/DeferimentoEntregaPanel.tsx");

  it("a entrega entra na fila como item próprio", () => {
    // mem://constraints/quero-armas-popup-guiado-canal-do-cliente
    expect(portal).toContain("<DeferimentoEntregaPanel");
    expect(portal).toMatch(/id: `deferimento:\$\{p\.id\}`/);
  });

  it("vem antes do recurso e da petição — é a única boa notícia da fila", () => {
    const posDefer = portal.indexOf("1.2) DEFERIMENTO");
    const posRecurso = portal.indexOf("1.3) RECURSO ESPERANDO");
    expect(posDefer).toBeGreaterThan(-1);
    expect(posDefer).toBeLessThan(posRecurso);
  });

  it("some da fila depois que o cliente confirma", () => {
    expect(portal).toMatch(/if \(!p\?\.deferimento_documento_id \|\| p\.deferimento_visto_cliente_em\) continue;/);
  });

  it("o portal busca as colunas do deferimento", () => {
    expect(portal).toMatch(/deferimento_documento_id, deferimento_visto_cliente_em, deferimento_data/);
  });

  it("baixa por blob — nunca expõe URL do Supabase", () => {
    const codigo = painel.split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    expect(codigo).toMatch(/URL\.createObjectURL/);
    expect(codigo).toMatch(/revokeObjectURL/);
    expect(codigo).not.toMatch(/createSignedUrl/);
    expect(codigo).not.toMatch(/window\.open/);
  });

  it("mostra a validade em destaque, não em rodapé", () => {
    expect(painel).toMatch(/Válido até/);
    expect(painel).toMatch(/avisamos com antecedência/);
  });

  it("diz que confirmar não apaga o documento", () => {
    expect(painel).toMatch(/continua guardado na sua Área do Cliente/);
  });
});

describe("a equipe registra pelo painel", () => {
  const src = r("src/components/quero-armas/processos/ProcessoDetalheDrawer.tsx");

  it("o botão aparece com o processo na PF", () => {
    expect(src).toContain("REGISTRAR DEFERIMENTO");
    expect(src).toMatch(/\["protocolado", "em_analise_orgao", "notificado", "recurso_administrativo"\]/);
  });

  it("só lista documentos do Hub que podem ser resultado", () => {
    expect(src).toMatch(/TIPOS_RESULTADO/);
    expect(src).toMatch(/\.in\("tipo_documento", TIPOS_RESULTADO\)/);
  });

  it("mostra a validade de cada opção — e avisa quando não há", () => {
    expect(src).toMatch(/SEM VALIDADE/);
  });

  it("orienta a subir o documento antes, quando o Hub está vazio", () => {
    expect(src).toMatch(/NENHUM DOCUMENTO DE RESULTADO NO HUB/);
  });

  it("avisa quando a baixa da venda falha", () => {
    expect(src).toMatch(/baixa_venda_ok/);
    expect(src).toMatch(/item da venda não recebeu baixa/);
  });

  it("o template está registrado", () => {
    const reg = r("supabase/functions/_shared/transactional-email-templates/registry.ts");
    expect(reg).toMatch(/'processo-deferido': processoDeferido,/);
    const tpl = r("supabase/functions/_shared/transactional-email-templates/processo-deferido.tsx");
    expect(tpl).toMatch(/status="(critico|alerta|ok)"/);
    expect(tpl).toMatch(/Válido até/);
  });
});
