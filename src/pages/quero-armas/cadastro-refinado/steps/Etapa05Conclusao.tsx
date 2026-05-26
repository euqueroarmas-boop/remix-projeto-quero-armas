import { Check, Clock, ShieldCheck, FileSignature, MailCheck, PackageOpen, Camera } from "lucide-react";
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

  const numeroPedido =
    r.numero_processo ||
    (r.venda_id ? `PED-${String(r.venda_id).padStart(6, "0")}` : null);

  /* Acesso ao Arsenal só é "enviado" quando o status real reflete isso ou serviço liberado.
   * Arsenal Inteligente continua GRATUITO e nunca bloqueado — apenas o aviso de envio
   * é condicional ao webhook ter disparado o e-mail. */
  const acessoEnviado = statusAtual === "acesso_enviado" || statusAtual === "servico_liberado";

  /* PR4 — Selfie/foto pós-checkout.
   * Reutiliza /cadastro/foto (QAEnviarFotoPage) já existente, com CPF pré-preenchido
   * e returnTo para a Área do Cliente. Nunca bloqueia o fluxo. */
  const cpfDigits = (state.dadosPessoais.cpf || "").replace(/\D/g, "");
  const [jaTemFoto, setJaTemFoto] = useState<boolean | null>(null);
  useEffect(() => {
    if (cpfDigits.length !== 11) return;
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("qa-atualizar-foto", {
          body: { action: "lookup", cpf: cpfDigits },
        });
        if (cancel) return;
        const has =
          !!(data?.cadastro?.selfie_path) || !!(data?.cliente?.imagem);
        setJaTemFoto(has);
      } catch { /* silencioso — CTA cai para "Enviar sua foto" */ }
    })();
    return () => { cancel = true; };
  }, [cpfDigits]);

  function irParaFoto() {
    navigate("/cadastro/foto", {
      state: { cpf: cpfDigits, returnTo: "/area-do-cliente" },
    });
  }

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
      const baseQuery: any = supabase
        .from("qa_contracts")
        .select("conteudo_renderizado, aceite_eletronico_data, aceite_ip, aceite_user_agent, aceite_hash, status, created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      const filtered = r.venda_id
        ? baseQuery.eq("venda_id", r.venda_id)
        : r.cliente_id
          ? baseQuery.eq("cliente_id", r.cliente_id)
          : baseQuery;
      const { data, error } = await filtered.maybeSingle();
      if (error) throw error;
      if (!data?.conteudo_renderizado) {
        setErroBaixar("Contrato ainda não disponível para download. Tente novamente em instantes.");
        return;
      }
      const w = window.open("", "_blank", "width=900,height=1100");
      if (!w) return;
      const hoje = new Date().toLocaleString("pt-BR");
      const rodape = `Documento gerado em ${hoje}. Aceite eletrônico registrado em ${data.aceite_eletronico_data || "—"}, IP ${data.aceite_ip || "—"}, dispositivo ${data.aceite_user_agent || "—"}, hash de integridade ${data.aceite_hash || "—"}. Status atual: ${data.status || "—"}.`;
      w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contrato — Quero Armas</title>
        <style>
          body{font-family:Georgia,'Times New Roman',serif;color:#0a0a0a;max-width:780px;margin:32px auto;padding:0 24px;line-height:1.65;font-size:13px;}
          h1{font-size:18px;text-align:center;text-transform:uppercase;letter-spacing:0.04em;}
          h2,h3{font-size:13px;text-transform:uppercase;letter-spacing:0.04em;margin-top:24px;}
          p{margin:10px 0;text-align:justify;} ul,ol{padding-left:22px;} li{margin:6px 0;}
          .qa-rodape-probatorio{margin-top:36px;padding-top:14px;border-top:0.5px solid rgba(0,0,0,0.2);font-size:10.5px;color:#4a4a4a;text-align:left;}
          @media print { body{margin:0;} }
        </style></head><body>${data.conteudo_renderizado}<div class="qa-rodape-probatorio">${rodape}</div></body></html>`);
      w.document.close();
      setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 400);
    } catch (e: any) {
      setErroBaixar(e?.message || "Não foi possível baixar o contrato agora.");
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
        {numeroPedido && (
          <div className="qa-ref-ficha-row">
            <dt>{r.numero_processo ? "Processo" : "Pedido"}</dt>
            <dd className="qa-ref-mono">{numeroPedido}</dd>
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
          onClick={() => {
            onReset();
            const params = new URLSearchParams();
            if (r.venda_id) params.set("pedido", String(r.venda_id));
            if (r.numero_processo) params.set("processo", r.numero_processo);
            const qs = params.toString();
            navigate(qs ? `/area-do-cliente?${qs}` : "/area-do-cliente");
          }}
        >
          {numeroPedido ? "Acompanhar pedido no Arsenal" : "Acessar meu Arsenal"}
        </button>
        {cpfDigits.length === 11 && (
          <button
            type="button"
            className="qa-ref-btn qa-ref-btn-ghost"
            onClick={irParaFoto}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <Camera size={16} />
            {jaTemFoto ? "Atualizar minha foto" : "Enviar sua foto agora"}
          </button>
        )}
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
            {baixando ? "Preparando…" : "Baixar contrato assinado"}
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