import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  clearEmuSessao,
  codificarParaUrl,
  formatarRestante,
  getEmuSessao,
  isEmuAtivo,
  segundosRestantes,
  setEmuSessao,
  type EmuSessao,
} from "../emuSessao";

const r = (p: string) => readFileSync(p, "utf8");

const MIGRATION = "supabase/migrations/20260816300000_emulador_espelho_equipe.sql";
const PORTAL = "src/pages/quero-armas/QAClientePortalPage.tsx";
const ROUTES = "src/pages/quero-armas/QARoutes.tsx";
const FN_EMU = "supabase/functions/qa-emu-sessao/index.ts";

function sessaoFake(overrides: Partial<EmuSessao> = {}): EmuSessao {
  return {
    sessaoId: "11111111-1111-1111-1111-111111111111",
    clienteId: 42,
    clienteNome: "Fulano de Tal",
    operadorNome: "Operador Um",
    operadorEmail: "operador@queroarmas.com.br",
    expiraEm: new Date(Date.now() + 30 * 60_000).toISOString(),
    ...overrides,
  };
}

describe("modo espelho — estado da aba", () => {
  it("guarda e devolve a sessão da aba", () => {
    clearEmuSessao();
    expect(getEmuSessao()).toBeNull();
    expect(isEmuAtivo()).toBe(false);

    const s = sessaoFake();
    setEmuSessao(s);
    expect(getEmuSessao()).toEqual(s);
    expect(isEmuAtivo()).toBe(true);
    clearEmuSessao();
  });

  it("descarta sozinha a janela vencida — o banco também já a ignora", () => {
    setEmuSessao(sessaoFake({ expiraEm: new Date(Date.now() - 1000).toISOString() }));
    expect(getEmuSessao()).toBeNull();
    expect(isEmuAtivo()).toBe(false);
  });

  it("codifica a sessão para a URL sem quebrar acentuação", () => {
    const s = sessaoFake({ clienteNome: "João Conceição" });
    const encoded = codificarParaUrl(s);
    expect(encoded).not.toContain(" ");
    const decoded = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(encoded)))));
    expect(decoded.clienteNome).toBe("João Conceição");
    expect(decoded.clienteId).toBe(42);
  });

  it("conta o tempo restante em mm:ss", () => {
    const s = sessaoFake({ expiraEm: new Date(Date.now() + 125_000).toISOString() });
    expect(segundosRestantes(s)).toBeGreaterThan(120);
    expect(formatarRestante(125)).toBe("02:05");
    expect(formatarRestante(9)).toBe("00:09");
  });
});

describe("modo espelho — portal renderiza o cliente, não o operador", () => {
  const src = r(PORTAL);

  it("resolve o cliente-alvo pelo id da sessão de espelho", () => {
    expect(src).toContain("const emu = getEmuSessao();");
    expect(src).toContain('.eq("id", emu.clienteId)');
  });

  it("não trata o operador como titular da conta", () => {
    // Troca de senha e aviso de novo login são atos do cliente.
    expect(src).toContain("if (!emu && deveForcarTrocaSenha(user))");
    expect(src).toContain("if (!emu) registrarLoginArsenal(");
    // Vincular cadastro pelo auth.uid() do operador criaria vínculo errado.
    expect(src).toContain("if (!clienteData && !emu) {");
  });

  it("exibe o nome do CLIENTE no topo, não o do perfil de staff", () => {
    expect(src).toContain('emu\n            ? (clienteData?.nome_completo || "")');
  });

  it("sair do espelho não derruba a sessão do operador", () => {
    expect(src).toContain("if (isEmuAtivo()) {");
    expect(src).toContain("clearEmuSessao();");
    // O signOut segue existindo para o cliente de verdade.
    expect(src).toContain("await supabase.auth.signOut();");
  });

  it("usa a faixa de espelho e não a faixa antiga de suporte", () => {
    expect(src).toContain("<EmuEspelhoBanner />");
    expect(src).not.toContain("SuporteModoBanner");
  });

  it("barra a contratação na tela", () => {
    expect(src).toContain("const irParaContratar = () => {");
    expect(src).toContain("toast.error(EMU_BLOQUEIO_COMPRA)");
    expect(src).not.toContain('onClick={() => navigate("/area-do-cliente/contratar")}');
  });
});

describe("modo espelho — compra é o único bloqueio", () => {
  it("cerca as rotas de contratação", () => {
    const src = r(ROUTES);
    expect(src).toContain("import EmuCompraGate from");
    for (const rota of [
      "area-do-cliente/contratar",
      "area-do-cliente/contratar/:slug/identificar",
      "area-do-cliente/contratar/:slug/solicitar",
      "area-do-cliente/contratar/:slug/confirmar",
    ]) {
      const linha = src.split("\n").find((l) => l.includes(`path="${rota}"`));
      expect(linha, `rota ${rota} sem EmuCompraGate`).toContain("<EmuCompraGate>");
    }
  });

  it("bloqueia venda, item, assinatura e aceite no banco", () => {
    const sql = r(MIGRATION);
    for (const t of ["qa_vendas", "qa_itens_venda", "qa_contract_signatures", "qa_contract_aceites_log"]) {
      expect(sql).toContain(`'${t}'`);
    }
    expect(sql).toContain("CREATE TRIGGER qa_emu_block_compra BEFORE INSERT OR UPDATE OR DELETE");
  });

  it("estoura em vez de deixar passar se a tabela de compra sumir ou virar view", () => {
    const sql = r(MIGRATION);
    expect(sql).toContain("Bloqueio de compra não pôde ser instalado");
    expect(sql).toContain("RAISE EXCEPTION");
  });

  it("fecha o flanco das edge functions de checkout (service_role burla o trigger)", () => {
    for (const fn of [
      "supabase/functions/qa-checkout-criar-venda/index.ts",
      "supabase/functions/qa-checkout-iniciar-pagamento/index.ts",
      "supabase/functions/qa-contratar-publico/index.ts",
    ]) {
      const src = r(fn);
      expect(src, fn).toContain('from "../_shared/emuGuard.ts"');
      expect(src, fn).toContain("if (await chamadorEmEspelho(req)) return respostaEmEspelho(corsHeaders);");
    }
  });
});

describe("modo espelho — o cliente vê quem mexeu", () => {
  const sql = r(MIGRATION);

  it("grava cada alteração na linha do tempo que o cliente já lê", () => {
    expect(sql).toContain("INSERT INTO public.qa_cliente_historico_atualizacoes");
    expect(sql).toContain("'equipe_espelho'");
    expect(sql).toContain("'Equipe Quero Armas · ' || COALESCE(v_operador, 'operador')");
  });

  it("instala o rastro nas tabelas do portal", () => {
    for (const t of ["qa_clientes", "qa_documentos_cliente", "qa_processos", "qa_crafs", "qa_procuracoes"]) {
      expect(sql).toContain(`'${t}'`);
    }
    expect(sql).toContain("CREATE TRIGGER qa_emu_rastro AFTER INSERT OR UPDATE OR DELETE");
  });

  it("usa as tabelas-base do acervo, nunca a view qa_cliente_armas", () => {
    // Postgres recusa gatilho de linha em view — foi o que derrubou o bloco.
    expect(sql).toContain("'qa_cliente_armas_manual'");
    expect(sql).not.toMatch(/'qa_cliente_armas'/);
    expect(sql).toContain("'qa_crafs'");
  });

  it("pula relação que não for tabela em vez de abortar o bloco inteiro", () => {
    expect(sql).toContain("IF k NOT IN ('r', 'p') THEN");
    expect(sql).toContain("não é tabela (relkind=%) — pulando");
  });

  it("a janela expira sozinha — sessão esquecida não trava nada", () => {
    expect(sql).toContain("AND s.expira_em > now()");
    expect(sql).toContain("expira_em timestamptz NOT NULL DEFAULT now() + interval '30 minutes'");
  });

  it("remove a trava antiga que engessava a conta do cliente de verdade", () => {
    expect(sql).toContain("DROP TRIGGER IF EXISTS qa_suporte_block ON public.%I");
    expect(sql).toContain("UPDATE public.qa_suporte_sessoes");
  });

  it("o operador não forja a própria sessão: escrita só por service_role", () => {
    expect(sql).toContain("qa_emu_sessoes_staff_select");
    expect(sql).not.toMatch(/CREATE POLICY qa_emu_sessoes\w*_(insert|update)/);
  });
});

describe("modo espelho — processo se escolhe, não se digita", () => {
  const card = r("src/components/quero-armas/clientes/EmuAcessoCard.tsx");

  it("carrega as contratações do cliente, ignorando canceladas", () => {
    expect(card).toContain('.from("qa_processos")');
    expect(card).toContain('.not("status", "in", "(cancelado,arquivado)")');
    // qa_processos grava ora o id real, ora o legado — os dois entram na busca.
    expect(card).toContain("clienteIdLegado ?? clienteId");
    expect(card).toContain('.in("cliente_id", ids)');
  });

  it("põe o pago na frente e marca o pendente", () => {
    expect(card).toContain('p.pagamento_status === "confirmado" ? 0 : 1');
    expect(card).toContain("PAGAMENTO PENDENTE");
  });

  it("um processo só já vem selecionado", () => {
    expect(card).toContain("if (lista.length === 1) setProcessoId(lista[0].id)");
  });

  it("mantém saída para quem não tem contratação", () => {
    expect(card).toContain('<option value="outro">');
    expect(card).toContain('processoId === "outro"');
  });

  it("manda o id do processo junto do nome", () => {
    expect(card).toContain("processo_id: escolhido ? escolhido.id : null");
    expect(card).toContain("const processoRef = escolhido ? escolhido.servico_nome : processoLivre.trim()");
    expect(r(FN_EMU)).toContain("processo_id: processoId");
    expect(r(MIGRATION)).toContain("ADD COLUMN IF NOT EXISTS processo_id uuid");
  });
});

describe("modo espelho — edge function", () => {
  const src = r(FN_EMU);

  it("exige staff ativo e motivo", () => {
    expect(src).toContain("const guard = await requireQAStaff(req);");
    expect(src).toContain('if (motivo.length < 5) return json({ error: "motivo_required" }, 400);');
  });

  it("não emite magic link nem troca a sessão do operador", () => {
    expect(src).not.toContain("generateLink");
    expect(src).not.toContain("magiclink");
  });

  it("uma janela por operador — abrir outra fecha a anterior", () => {
    expect(src).toContain('.eq("operador_user_id", guard.userId)');
    expect(src).toContain('.is("encerrado_em", null)');
    expect(src).toContain("substituida_por_nova_sessao");
  });

  it("avisa o cliente na abertura e manda resumo no fim", () => {
    expect(src).toContain("emu-inicio-");
    expect(src).toContain("emu-fim-");
  });

  it("encerrar/registrar só pelo dono da sessão", () => {
    expect(src).toContain('if (!s || s.operador_user_id !== guard.userId) return json({ error: "forbidden" }, 403);');
    expect(src).toContain('if (s.operador_user_id !== guard.userId) return json({ error: "forbidden" }, 403);');
  });
});
