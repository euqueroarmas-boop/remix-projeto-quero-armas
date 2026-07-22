import { Check, Clock, ShieldCheck, FileSignature, MailCheck, PackageOpen, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { openMinutaContratoQueroArmas } from "@/lib/quero-armas/minutaContratoDownload";
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
  /** Credenciais temporárias do Arsenal — local apenas (não persiste no zustand). */
  const [credenciais, setCredenciais] = useState<{
    email: string;
    senha_temporaria: string;
    expira_em: string;
  } | null>(null);
  const [copiado, setCopiado] = useState<"email" | "senha" | null>(null);

  function copiar(valor: string, qual: "email" | "senha") {
    if (!valor) return;
    navigator.clipboard
      .writeText(valor)
      .then(() => {
        setCopiado(qual);
        window.setTimeout(() => setCopiado((c) => (c === qual ? null : c)), 1800);
      })
      .catch(() => {});
  }

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
   * 1. número do processo PF/administrativo (numero_processo) — só depois de protocolado
   * 2. protocolo OFICIAL da Quero Armas (QA{SIGLA}{ANO}{SEQ}) gerado no webhook PAGO
   * 3. número temporário derivado da venda enquanto webhook não confirmou */
  const numeroProcesso = r.numero_processo || null;
  const numeroProtocolo = r.numero_protocolo || null;
  const numeroPedidoDefinitivo = numeroProcesso || numeroProtocolo;
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
        const patch: any = {};
        if (data.pago && statusAtual === "aguardando_pagamento") {
          patch.pagamento_status = "pagamento_confirmado";
        }
        if (data.numero_protocolo && !(r as any).numero_protocolo) {
          patch.numero_protocolo = data.numero_protocolo;
        }
        if (Object.keys(patch).length > 0) {
          update({ resultado: { ...r, ...patch } });
        }
        if (data.portal_credenciais && !credenciais) {
          setCredenciais(data.portal_credenciais);
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
      await openMinutaContratoQueroArmas({
        vendaId: Number(r.venda_id),
        checkoutToken: r.checkout_token,
      });
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
            <dt>{numeroProcesso ? "Processo" : "Protocolo"}</dt>
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

      {credenciais && (
        <div
          style={{
            marginTop: 18,
            padding: 18,
            borderRadius: 12,
            background: "rgba(214, 166, 75, 0.08)",
            border: "1px solid rgba(214, 166, 75, 0.35)",
          }}
        >
          <div
            style={{
              fontFamily: "Oswald, sans-serif",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              fontSize: 13,
              color: "var(--qa-ref-brass, #D6A64B)",
              marginBottom: 10,
              fontWeight: 600,
            }}
          >
            Acesso temporário ao Arsenal
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--qa-ref-ink-soft)",
              margin: "0 0 14px",
            }}
          >
            Use estes dados para entrar agora. Você poderá trocar a senha no
            primeiro acesso. Este acesso temporário expira em 24h.
          </p>

          {[
            { label: "E-mail", valor: credenciais.email, qual: "email" as const },
            { label: "Senha temporária", valor: credenciais.senha_temporaria, qual: "senha" as const },
          ].map(({ label, valor, qual }) => (
            <div
              key={qual}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 12px",
                marginBottom: qual === "email" ? 8 : 0,
                background: "rgba(0,0,0,0.35)",
                borderRadius: 8,
                border: "1px solid rgba(214, 166, 75, 0.2)",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: "var(--qa-ref-ink-soft)",
                    marginBottom: 2,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                    fontSize: 14,
                    color: "#fff",
                    overflowWrap: "anywhere",
                  }}
                >
                  {valor}
                </div>
              </div>
              <button
                type="button"
                onClick={() => copiar(valor, qual)}
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  background: "transparent",
                  color: "var(--qa-ref-brass, #D6A64B)",
                  border: "1px solid var(--qa-ref-brass, #D6A64B)",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
                aria-label={`Copiar ${label}`}
              >
                <Copy size={13} />
                {copiado === qual ? "Copiado" : "Copiar"}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              onReset();
              navigate("/area-do-cliente/login", {
                state: {
                  prefillEmail: credenciais.email,
                  prefillPassword: credenciais.senha_temporaria,
                },
              });
            }}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "12px 16px",
              background: "var(--qa-ref-brass, #D6A64B)",
              color: "#0A0A0A",
              border: "none",
              borderRadius: 8,
              fontFamily: "Oswald, sans-serif",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Entrar no Arsenal agora
          </button>
          <p
            style={{
              fontSize: 11,
              color: "var(--qa-ref-ink-soft)",
              margin: "10px 0 0",
              textAlign: "center",
            }}
          >
            Preenchemos login e senha automaticamente. Você poderá definir
            uma nova senha logo após entrar.
          </p>
        </div>
      )}

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
