// ============================================================================
// F9 — a petição volta para o cliente aprovar
// ----------------------------------------------------------------------------
// Furo levantado na PRIMEIRA mensagem da auditoria, 18/08/2026:
//
//   As peças geradas pela IA (defesa de posse, defesa de porte, resposta à
//   notificação) viviam inteiras na área da equipe. NENHUMA tela do portal do
//   cliente lia `qa_geracoes_pecas`. O documento que sustenta o pedido dele —
//   o que a Polícia Federal lê e que decide o processo — era escrito, revisado
//   e protocolado sem que ele visse uma linha.
//
//   Só duas coisas voltavam para o cliente: o relato da efetiva necessidade e
//   o relato do recurso. A peça principal, não.
//
// Petição protocolada com fato errado não se conserta: vira parte do processo e
// a autoridade seguinte lê aquilo. Nos indeferimentos reais, dois motivos não
// tinham nada a ver com mérito — divergência de nome e de endereço. Quem pega
// isso é o cliente, não o revisor.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

describe("a migration abre o ciclo de aprovação", () => {
  const sql = r("supabase/migrations/20260818130000_peca_aprovacao_do_cliente.sql");

  it("é reexecutável", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS/);
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS/);
  });

  it("liga a peça ao PROCESSO, não só ao caso", () => {
    expect(sql).toMatch(/processo_id uuid REFERENCES public\.qa_processos\(id\)/);
  });

  it("o vocabulário do ciclo é fechado", () => {
    expect(sql).toMatch(/'nao_enviada','aguardando_cliente','aprovada','devolvida'/);
  });

  it("toda peça antiga nasce nao_enviada — nada muda sozinho", () => {
    expect(sql).toMatch(/status_cliente text NOT NULL DEFAULT 'nao_enviada'/);
  });

  it("guarda prova de sessão do aceite (MP 2.200-2/2001)", () => {
    for (const col of ["aprovacao_ip", "aprovacao_user_agent", "aprovacao_accept_language", "aprovacao_hash"]) {
      expect(sql).toContain(col);
    }
  });

  it("guarda a devolução com o motivo do cliente", () => {
    expect(sql).toContain("devolucao_motivo");
    expect(sql).toContain("devolvida_em");
  });
});

describe("a equipe devolve a peça", () => {
  const src = r("supabase/functions/qa-peca-enviar-cliente/index.ts");

  it("é ação de equipe", () => {
    expect(src).toMatch(/requireQAStaff/);
  });

  it("recusa peça sem texto — o cliente abriria a fila e não teria o que ler", () => {
    expect(src).toMatch(/peca_sem_texto/);
    expect(src).toMatch(/minuta\.length < 200/);
  });

  it("não manda a petição de um cliente para a fila de outro", () => {
    expect(src).toMatch(/peca_de_outro_cliente/);
    expect(src).toMatch(/clienteDaPeca !== clienteDoProcesso/);
  });

  it("reenvio depois de devolução limpa o motivo antigo", () => {
    expect(src).toMatch(/devolucao_motivo: null/);
    expect(src).toMatch(/devolvida_em: null/);
  });

  it("e-mail avisa, mas o guiado é onde ele age", () => {
    expect(src).toContain("peca-pronta-aprovacao");
    expect(src).toMatch(/area-do-cliente/);
  });
});

describe("o cliente decide", () => {
  const src = r("supabase/functions/qa-peca-aprovar-cliente/index.ts");

  it("aceita aprovar E devolver — aprovar não pode ser o único caminho", () => {
    expect(src).toMatch(/acao !== "aprovar" && acao !== "devolver"/);
  });

  it("devolver exige um motivo escrito", () => {
    expect(src).toMatch(/acao === "devolver" && motivo\.length < 5/);
  });

  it("autoriza o dono do processo, direto ou por auth link", () => {
    expect(src).toMatch(/cliente_auth_links/);
    expect(src).toMatch(/ehCliente = true/);
  });

  it("carimba prova de sessão com hash do texto aprovado", () => {
    expect(src).toMatch(/sha256Hex/);
    expect(src).toMatch(/aprovacao_hash: hash/);
    expect(src).toMatch(/aprovacao_ip: ip/);
  });

  it("preserva a edição do cliente como veio", () => {
    expect(src).toMatch(/const final = textoEditado\.trim\(\) \? textoEditado : gerada;/);
    expect(src).toMatch(/editada_pelo_cliente: editada && ehCliente/);
  });

  it("é idempotente: aprovar de novo não reenvia e-mail", () => {
    expect(src).toMatch(/if \(statusAtual === "aprovada"\)/);
    expect(src).toMatch(/ja_aprovada: true/);
  });

  it("recusa decidir peça que não está com o cliente", () => {
    expect(src).toMatch(/peca_nao_esta_com_o_cliente/);
  });

  it("avisa a equipe nos DOIS desfechos — aprovação parada é aprovação perdida", () => {
    expect(src).toMatch(/notificarEquipe/);
    expect(src).toContain("peca-decidida-equipe");
  });

  it("aprovou: rechecar se o processo já pode andar", () => {
    expect(src).toMatch(/qa-processo-checar-conclusao-checklist/);
    expect(src).toMatch(/origem: "peca_aprovada"/);
  });
});

describe("o protocolo trava enquanto a petição não for aprovada", () => {
  const src = r("supabase/functions/qa-processo-checar-conclusao-checklist/index.ts");

  it("consulta as peças do processo", () => {
    expect(src).toMatch(/from\("qa_geracoes_pecas"\)/);
    expect(src).toMatch(/\.in\("status_cliente", \["aguardando_cliente", "devolvida"\]\)/);
  });

  it("distingue aguardando de devolvida no motivo", () => {
    expect(src).toContain("peticao_aguardando_aprovacao_do_cliente");
    expect(src).toContain("peticao_devolvida_pelo_cliente");
  });

  it("rascunho da equipe (nao_enviada) NÃO trava nada", () => {
    const bloco = src.slice(src.indexOf("qa_geracoes_pecas"), src.indexOf("const agora = new Date"));
    expect(bloco).not.toContain("nao_enviada");
  });

  it("o gate roda antes de promover o status", () => {
    const gate = src.indexOf("peticao_aguardando_aprovacao_do_cliente");
    const update = src.indexOf('status: "pronto_para_protocolar"');
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(update);
  });
});

describe("a aprovação acontece dentro do pop-up guiado", () => {
  const portal = r("src/pages/quero-armas/QAClientePortalPage.tsx");
  const painel = r("src/components/quero-armas/portal/PecaAprovacaoPanel.tsx");

  it("a peça entra na fila do guiado como item próprio", () => {
    // mem://constraints/quero-armas-popup-guiado-canal-do-cliente
    expect(portal).toContain("<PecaAprovacaoPanel");
    expect(portal).toMatch(/id: `peca:\$\{peca\.id\}`/);
  });

  it("vem ANTES do checklist — cobrar certidão com petição parada é cobrar errado", () => {
    const posPeca = portal.indexOf("1.4) PETIÇÃO ESPERANDO A APROVAÇÃO DELE");
    const posCadastro = portal.indexOf("1.5) Dados cadastrais");
    expect(posPeca).toBeGreaterThan(-1);
    expect(posPeca).toBeLessThan(posCadastro);
  });

  it("só busca peças que estão com o cliente", () => {
    expect(portal).toMatch(/\.in\("status_cliente", \["aguardando_cliente", "devolvida"\]\)/);
  });

  it("o texto vem editável — quem viveu o fato é ele", () => {
    expect(painel).toMatch(/<textarea/);
    expect(painel).toContain("Corrigir algo");
  });

  it("existe saída para discordar, não só aprovar", () => {
    expect(painel).toContain("Tem algo errado — pedir ajuste");
    expect(painel).toMatch(/decidir\("devolver"\)/);
  });

  it("diz o que acontece ao aprovar, sem esconder a consequência", () => {
    expect(painel).toMatch(/n[ãa]o pode mais ser corrigido/i);
  });

  it("peça já aprovada não pede ação de novo", () => {
    expect(painel).toMatch(/peca\.status_cliente === "aprovada"/);
  });
});

describe("os templates existem e estão registrados", () => {
  const reg = r("supabase/functions/_shared/transactional-email-templates/registry.ts");

  it("cliente e equipe, os dois no registry", () => {
    expect(reg).toMatch(/'peca-pronta-aprovacao': pecaProntaAprovacao,/);
    expect(reg).toMatch(/'peca-decidida-equipe': pecaDecididaEquipe,/);
  });

  it("o template da equipe distingue aprovada, aprovada-com-edição e devolvida", () => {
    const tpl = r("supabase/functions/_shared/transactional-email-templates/peca-decidida-equipe.tsx");
    expect(tpl).toMatch(/APROVADA COM EDIÇÃO/);
    expect(tpl).toMatch(/DEVOLVIDA/);
    expect(tpl).toMatch(/a correção dele é a que vale/);
  });

  it("o template do cliente usa um status válido do shell", () => {
    // StatusTipo é 'critico' | 'alerta' | 'ok'. Um valor fora disso quebra em runtime.
    const tpl = r("supabase/functions/_shared/transactional-email-templates/peca-pronta-aprovacao.tsx");
    expect(tpl).toMatch(/status="(critico|alerta|ok)"/);
  });
});

// ============================================================================
// Fecho do bloco: a aprovação do RECURSO também migrou para o guiado.
// ----------------------------------------------------------------------------
// Era o único passo do fluxo que o cliente aprovava fora da fila — o painel
// vivia dentro da linha do tempo do processo. Dois problemas: contrariava a
// regra de 18/08 (o guiado é o canal), e o carregamento só olhava o processo
// que estivesse "na PF", então cliente com dois processos indeferidos tinha o
// segundo recurso invisível. Corre prazo fatal de 10 dias.
// ============================================================================

describe("a aprovação do recurso migrou para o guiado", () => {
  const portal = r("src/pages/quero-armas/QAClientePortalPage.tsx");
  const linha = r("src/components/quero-armas/portal/LinhaDoTempoProcessoPF.tsx");

  it("o recurso entra na fila do guiado como item próprio", () => {
    expect(portal).toContain("<RecursoAprovacaoPanel");
    expect(portal).toMatch(/id: `recurso:\$\{rec\.id\}`/);
  });

  it("carrega recursos de TODOS os processos, não só o que está na PF", () => {
    expect(portal).toMatch(/setRecursosParaAprovar/);
    expect(portal).toMatch(/\.in\("status", \["rascunho", "aguardando_aprovacao"\]\)/);
  });

  it("vem na frente da petição — é o item com o relógio mais curto", () => {
    const posRecurso = portal.indexOf("1.3) RECURSO ESPERANDO A APROVAÇÃO DELE");
    const posPeca = portal.indexOf("1.4) PETIÇÃO ESPERANDO A APROVAÇÃO DELE");
    expect(posRecurso).toBeGreaterThan(-1);
    expect(posRecurso).toBeLessThan(posPeca);
  });

  it("entra no grupo de prioridade máxima (exigências da PF)", () => {
    const bloco = portal.slice(portal.indexOf("id: `recurso:${rec.id}`"), portal.indexOf("1.4) PETIÇÃO"));
    expect(bloco).toMatch(/grupoProprio: "exigencias_pf"/);
  });

  it("a linha do tempo NÃO renderiza mais o painel de aprovação", () => {
    expect(linha).not.toContain("<RecursoAprovacaoPanel");
    // O tipo continua importado — a linha do tempo ainda recebe o recurso para
    // decidir se mostra o aviso.
    expect(linha).toMatch(/import \{ type RecursoParaAprovar \}/);
  });

  it("mas continua avisando que existe recurso esperando, com caminho para a fila", () => {
    expect(linha).toMatch(/recursoPendente/);
    expect(linha).toContain("Ler e aprovar agora");
    expect(linha).toMatch(/onAbrirAprovacaoRecurso/);
  });

  it("o aviso só aparece enquanto o recurso não foi aprovado", () => {
    expect(linha).toMatch(/\["rascunho", "aguardando_aprovacao"\]\.includes\(String\(recurso\.status/);
  });

  it("o botão abre a fila JÁ no passo do recurso", () => {
    expect(portal).toMatch(/pinnedId: `recurso:\$\{recursoPF\.id\}`/);
  });
});
