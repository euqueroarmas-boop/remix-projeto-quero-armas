import { Check, Clock, ShieldCheck, FileSignature, MailCheck, PackageOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import QACadastroRefinadoShell from "../components/QACadastroRefinadoShell";
import QAReiniciarLink from "../components/QAReiniciarLink";
import { CadastroRefinadoState } from "../hooks/useCadastroRefinadoState";

function humanizeSlug(slug: string): string {
  if (!slug) return "—";
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  state: CadastroRefinadoState;
  /** Permite atualizar o resultado conforme o status real avança (webhook → DB). */
  update?: (patch: Partial<CadastroRefinadoState>) => void;
  onReset: () => void;
}

/* Catálogo de estados reais — derivados de qa-checkout-status (Pipeline 2C).
 * NUNCA declarar "pagamento confirmado" antes do webhook. */
const STATUS_META: Record<
  NonNullable<NonNullable<CadastroRefinadoState["resultado"]>["pagamento_status"]>,
  { label: string; tone: "wait" | "ok" | "info"; icon: typeof Clock; desc: string }
> = {
  aguardando_pagamento: {
    label: "Cobrança criada — aguardando pagamento",
    tone: "wait",
    icon: Clock,
    desc: "Assim que seu banco confirmar o pagamento, liberamos os próximos passos por e-mail e WhatsApp.",
  },
  pagamento_confirmado: {
    label: "Pagamento confirmado",
    tone: "ok",
    icon: ShieldCheck,
    desc: "Recebemos a confirmação do banco. Estamos gerando o contrato oficial.",
  },
  contrato_gerado: {
    label: "Contrato gerado para assinatura",
    tone: "info",
    icon: FileSignature,
    desc: "O contrato definitivo já está pronto. Você receberá o link para assinatura ICP-Brasil.",
  },
  acesso_enviado: {
    label: "Acesso ao Arsenal enviado",
    tone: "ok",
    icon: MailCheck,
    desc: "Verifique seu e-mail e WhatsApp. O Arsenal Inteligente é gratuito e já está liberado.",
  },
  servico_aguardando_contrato: {
    label: "Serviço aguardando contrato assinado",
    tone: "wait",
    icon: FileSignature,
    desc: "Assine o contrato definitivo para iniciarmos a execução do serviço.",
  },
  servico_liberado: {
    label: "Serviço liberado para execução",
    tone: "ok",
    icon: PackageOpen,
    desc: "Tudo pronto. Nossa equipe iniciou seu processo.",
  },
};

export default function Etapa05Conclusao({ state, update, onReset }: Props) {
  const navigate = useNavigate();
  const r = state.resultado || {};
  const primeiroNome = (state.dadosPessoais.nome_completo || "").split(" ")[0] || "tudo certo";
  const [baixando, setBaixando] = useState(false);
  const [erroBaixar, setErroBaixar] = useState<string | null>(null);

  /* Status real derivado de qa-checkout-status. Default seguro: aguardando_pagamento. */
  const statusAtual = r.pagamento_status ?? "aguardando_pagamento";
  const meta = STATUS_META[statusAtual];
  const IconNow = meta.icon;
  const pagamentoConfirmado =
    statusAtual !== "aguardando_pagamento";

  /* Slugs efetivos da contratação (bundle ou single). */
  const slugsContratados = (
    state.servicosSlugs && state.servicosSlugs.length > 0
      ? state.servicosSlugs
      : state.servicoSlug
        ? [state.servicoSlug]
        : []
  );

  /* Nome legível dos serviços (qa_servicos_catalogo) + valor pago (qa_vendas).
   * Render-only: não cria/duplica registros, não toca em webhook/contrato. */
  const [servicosNomes, setServicosNomes] = useState<string[]>([]);
  const [valorTotal, setValorTotal] = useState<number | null>(null);
  useEffect(() => {
    if (slugsContratados.length === 0) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("qa_servicos_catalogo")
        .select("slug, nome")
        .in("slug", slugsContratados);
      if (cancel) return;
      const map = new Map((data || []).map((r: any) => [r.slug, r.nome]));
      setServicosNomes(slugsContratados.map((s) => map.get(s) || humanizeSlug(s)));
    })();
    return () => { cancel = true; };
  }, [slugsContratados.join(",")]);

  useEffect(() => {
    if (!r.venda_id) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("qa_vendas")
        .select("valor_cobrado, valor_a_pagar, numero_processo")
        .eq("id", Number(r.venda_id))
        .maybeSingle();
      if (cancel || !data) return;
      const v = Number((data as any).valor_cobrado ?? (data as any).valor_a_pagar);
      if (!Number.isNaN(v) && v > 0) setValorTotal(v);
      if ((data as any).numero_processo && update && !r.numero_processo) {
        update({ resultado: { ...r, numero_processo: (data as any).numero_processo } });
      }
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.venda_id]);

  const valorFormatado =
    valorTotal != null
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorTotal)
      : null;

  const formaPagamentoLabel: Record<typeof state.formaPagamento, string> = {
    pix: "PIX",
    cartao: "Cartão de crédito",
    boleto: "Boleto bancário",
  };

  /* Prioridade de exibição do número de pedido/protocolo:
   * 1. número definitivo do processo (numero_processo)
   * 2. número temporário derivado da venda (nunca fixo/hardcoded)
   * 3. texto neutro quando ainda não há identificador */
  const numeroPedidoDefinitivo = r.numero_processo || null;
  const numeroPedidoTemporario =
    !numeroPedidoDefinitivo && r.venda_id
      ? `PED-${String(r.venda_id).slice(0, 8).toUpperCase()}`
      : null;
  const numeroPedido = numeroPedidoDefinitivo || numeroPedidoTemporario;

  /* Acesso ao Arsenal só é "enviado" quando o status real reflete isso ou serviço liberado.
   * Arsenal Inteligente continua GRATUITO e nunca bloqueado — apenas o aviso de envio
   * é condicional ao webhook ter disparado o e-mail. */
  const acessoEnviado = statusAtual === "acesso_enviado" || statusAtual === "servico_liberado";


  /* Polling leve enquanto não atingimos um estado terminal — atualiza status real
   * sem criar processo/checklist (isso só acontece após contrato validado). */
  const pollRef = useRef<number | null>(null);
  useEffect(() => {
    if (!update) return;
    if (!r.venda_id || !r.checkout_token) return;
    if (statusAtual === "servico_liberado") return;
    const tick = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("qa-checkout-status", {
          body: { venda_id: Number(r.venda_id), checkout_token: r.checkout_token },
        });
        if (error || !data) return;
        if (data.pago && statusAtual === "aguardando_pagamento") {
          update({ resultado: { ...r, pagamento_status: "pagamento_confirmado" } });
        }
      } catch { /* silencioso */ }
    };
    pollRef.current = window.setInterval(tick, 8000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.venda_id, r.checkout_token, statusAtual]);

  async function handleBaixarContrato() {
    setErroBaixar(null);
    setBaixando(true);
    try {
      if (!r.venda_id || !r.checkout_token) {
        setErroBaixar("Não conseguimos identificar sua contratação. Recarregue a página e tente novamente.");
        return;
      }
      const { data, error } = await supabase.functions.invoke("qa-baixar-contrato-aceite", {
        body: { venda_id: Number(r.venda_id), checkout_token: r.checkout_token },
      });
      if (error) {
        // Edge function devolve 202 quando o contrato ainda não foi gerado.
        const ctx: any = (error as any)?.context;
        if (ctx?.status === 202) {
          setErroBaixar("Contrato sendo gerado. Tente novamente em instantes.");
          return;
        }
        throw error;
      }
      if (!data?.ok || !data?.html_doc) {
        setErroBaixar(
          data?.message ||
            "Contrato ainda não disponível. Tente novamente em instantes.",
        );
        return;
      }
      const w = window.open("", "_blank", "width=900,height=1100");
      if (!w) {
        setErroBaixar("Habilite pop-ups para baixar o contrato.");
        return;
      }
      w.document.write(data.html_doc);
      w.document.close();
      setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 400);
    } catch (e: any) {
      console.error("[Etapa05] baixar contrato falhou:", e);
      setErroBaixar("Não foi possível baixar o contrato agora. Nossa equipe foi notificada.");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <QACadastroRefinadoShell
      step={5}
      eyebrow="ETAPA 05 · CONCLUSÃO"
      title={pagamentoConfirmado ? "Pagamento confirmado" : `Tudo certo, ${primeiroNome}`}
      subtitle={
        pagamentoConfirmado
          ? "Recebemos a confirmação do pagamento. Seu pedido foi registrado e o acompanhamento será feito pelo Arsenal."
          : "Sua contratação foi registrada. Acompanhe o status real abaixo — os próximos passos chegam por e-mail e WhatsApp conforme o banco confirma o pagamento."
      }
      showBack={false}
    >
      <div style={{ textAlign: "center" }}>
        <div className="qa-ref-check" aria-hidden>
          {pagamentoConfirmado ? <Check size={28} /> : <Clock size={28} />}
        </div>
      </div>

      <dl className="qa-ref-ficha">
        <div className="qa-ref-ficha-row">
          <dt>{servicosNomes.length > 1 ? "Serviços" : "Serviço"}</dt>
          <dd>
            {servicosNomes.length > 0
              ? servicosNomes.join(" + ")
              : slugsContratados.map(humanizeSlug).join(" + ") || "—"}
          </dd>
        </div>
        {numeroPedidoDefinitivo ? (
          <div className="qa-ref-ficha-row">
            <dt>Processo</dt>
            <dd className="qa-ref-mono">{numeroPedidoDefinitivo}</dd>
          </div>
        ) : numeroPedidoTemporario ? (
          <div className="qa-ref-ficha-row">
            <dt>Pedido temporário</dt>
            <dd className="qa-ref-mono">{numeroPedidoTemporario}</dd>
          </div>
        ) : (
          <div className="qa-ref-ficha-row">
            <dt>Pedido</dt>
            <dd>Pedido em processamento</dd>
          </div>
        )}
        {valorFormatado && (
          <div className="qa-ref-ficha-row">
            <dt>{pagamentoConfirmado ? "Valor pago" : "Valor"}</dt>
            <dd>{valorFormatado}</dd>
          </div>
        )}
        <div className="qa-ref-ficha-row">
          <dt>Forma de pagamento</dt>
          <dd>{formaPagamentoLabel[state.formaPagamento] || state.formaPagamento.toUpperCase()}</dd>
        </div>
        <div className="qa-ref-ficha-row">
          <dt>Status</dt>
          <dd>{pagamentoConfirmado ? "Pagamento confirmado" : meta.label}</dd>
        </div>
      </dl>

      <div className="qa-ref-banner" style={{ marginTop: 20 }}>
        <IconNow size={18} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>{acessoEnviado ? "Acesso ao Arsenal enviado" : "Próximo passo"}</strong>
          {" "}— {meta.desc}
        </div>
      </div>
      {numeroPedidoTemporario && (
        <p className="qa-ref-aceite-fineprint" style={{ marginTop: 12, paddingLeft: 0 }}>
          O número definitivo será atualizado automaticamente após a criação do processo.
        </p>
      )}
      <p className="qa-ref-aceite-fineprint" style={{ marginTop: 12, paddingLeft: 0 }}>
        O Arsenal Inteligente é onde você acompanha esta contratação em tempo real:
        andamento do processo, documentos, prazos e mensagens da Equipe Quero Armas.
      </p>
      {!acessoEnviado && (
        <p className="qa-ref-aceite-fineprint" style={{ marginTop: 12, paddingLeft: 0 }}>
          O Arsenal Inteligente é gratuito e nunca bloqueado. Após a confirmação do
          pagamento e da assinatura do contrato definitivo, liberamos a execução do
          serviço contratado.
        </p>
      )}

      <div style={{ marginTop: 28, display: "grid", gap: 12 }}>
        <button
          className="qa-ref-btn qa-ref-btn-primary"
          onClick={async () => {
            const params = new URLSearchParams();
            if (r.venda_id) params.set("pedido", String(r.venda_id));
            if (r.numero_processo) params.set("processo", r.numero_processo);
            const qs = params.toString();
            const destino = qs ? `/area-do-cliente?${qs}` : "/area-do-cliente";

            /* Cenário A — autenticado: vai direto pro Arsenal carregando o pedido.
             * Cenário B — deslogado: NUNCA cair em "/". Manda para login seguro
             * com ?next=destino, preservando o contexto da contratação. Nunca
             * enviamos senha em texto puro nem expomos dados só por CPF. */
            let autenticado = false;
            try {
              const { data } = await supabase.auth.getSession();
              autenticado = !!data.session?.user;
            } catch {
              autenticado = false;
            }

            onReset();
            if (autenticado) {
              navigate(destino);
            } else {
              const next = encodeURIComponent(destino);
              navigate(`/area-do-cliente/login?next=${next}`);
            }
          }}
        >
          {numeroPedido ? "Acompanhar pedido no Arsenal" : "Acessar meu Arsenal"}
        </button>
        {state.clienteExistente ? (
          <>
            <button className="qa-ref-btn qa-ref-btn-ghost" onClick={() => navigate("/area-do-cliente/login")}>
              Fazer login
            </button>
            <button
              className="qa-ref-btn-link"
              type="button"
              style={{ display: "block", textAlign: "center" }}
              onClick={() => navigate("/redefinir-senha")}
            >
              Esqueci minha senha
            </button>
          </>
        ) : (
          <button
            className="qa-ref-btn qa-ref-btn-ghost"
            type="button"
            disabled={baixando}
            onClick={handleBaixarContrato}
          >
            {baixando ? "Contrato sendo gerado" : "Baixar contrato aceito"}
          </button>
        )}
        {erroBaixar && <div className="qa-ref-error-text">{erroBaixar}</div>}
        <div style={{ marginTop: 8, textAlign: "center" }}>
          <QAReiniciarLink label="Começar um novo processo" preservarServico={false} />
        </div>
      </div>
    </QACadastroRefinadoShell>
  );
}