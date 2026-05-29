import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { supabase } from "@/integrations/supabase/client";
import QACadastroRefinadoShell from "../components/QACadastroRefinadoShell";
import ContractPreviewCard from "../components/ContractPreviewCard";
import { CadastroRefinadoState } from "../hooks/useCadastroRefinadoState";
import {
  DEFAULT_PRICING_CONFIG,
  calcularPrecoFinal,
  formatarReais,
  listarOpcoesParcelamento,
  uiPagamentoToBillingType,
  type PricingResult,
} from "@/lib/checkoutPricing";

interface Props {
  state: CadastroRefinadoState;
  update: (patch: Partial<CadastroRefinadoState>) => void;
  onNext: () => void;
  onBack: () => void;
}

type Stage = "form" | "preparing" | "awaiting" | "confirmed";

interface PaymentData {
  venda_id: number;
  checkout_token: string;
  asaas_payment_id: string | null;
  asaas_invoice_url: string | null;
  asaas_bank_slip_url: string | null;
  asaas_pix_payload: string | null;
  billing_type: "PIX" | "BOLETO" | "CREDIT_CARD";
  parcelas: number;
  valor_cobrado: number;
}

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 30 * 60 * 1000;

export default function Etapa04Pagamento({ state, update, onNext, onBack }: Props) {
  const navigate = useNavigate();
  const [preco, setPreco] = useState<number>(0);
  const [servicos, setServicos] = useState<
    Array<{ id: string; slug: string; nome: string; preco: number }>
  >([]);
  const [catalogoCarregado, setCatalogoCarregado] = useState(false);
  const [catalogoErro, setCatalogoErro] = useState<string | null>(null);
  // Mantém compat para chamadas antigas/edge function: 1º serviço como "principal".
  const servicoIdPrincipal = servicos[0]?.id ?? null;
  const nomeServicoPrincipal = servicos[0]?.nome ?? null;
  const [stage, setStage] = useState<Stage>("form");
  const [error, setError] = useState<string | null>(null);
  const [pay, setPay] = useState<PaymentData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<"pix" | "boleto" | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);

  /** Número de parcelas escolhidas para CREDIT_CARD. Default 1. */
  const [parcelas, setParcelas] = useState<number>(1);
  /** Toggle de exibição do seletor 1x..12x. */
  const [openParcelaPicker, setOpenParcelaPicker] = useState(false);

  const pollRef = useRef<number | null>(null);
  const pollStartRef = useRef<number>(0);
  const resumedRef = useRef(false);
  const [checkingNow, setCheckingNow] = useState(false);
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const resultadoRef = useRef(state.resultado);
  useEffect(() => {
    resultadoRef.current = state.resultado;
  }, [state.resultado]);

  useEffect(() => {
    const slugs =
      state.servicosSlugs && state.servicosSlugs.length > 0
        ? state.servicosSlugs
        : state.servicoSlug
          ? [state.servicoSlug]
          : [];
    if (slugs.length === 0) {
      setServicos([]);
      setPreco(0);
      setCatalogoCarregado(true);
      setCatalogoErro(null);
      return;
    }
    (async () => {
      setCatalogoCarregado(false);
      setCatalogoErro(null);
      const { data, error } = await supabase
        .from("qa_servicos_catalogo")
        .select("id, preco, nome, slug")
        .in("slug", slugs)
        .eq("ativo", true);
      if (error) {
        console.error("[Etapa04] falha ao carregar catálogo:", error);
        setCatalogoErro("Não foi possível carregar os serviços. Recarregue a página.");
        setCatalogoCarregado(true);
        return;
      }
      const rows = (data || []) as Array<{
        id: string;
        slug: string;
        nome: string;
        preco: number | null;
      }>;
      // Reordena pela ordem do state
      const map = new Map(rows.map((r) => [r.slug, r]));
      const ordered = slugs
        .map((s) => map.get(s))
        .filter(Boolean) as typeof rows;
      const normalized = ordered.map((r) => ({
        id: r.id,
        slug: r.slug,
        nome: r.nome,
        preco: Number(r.preco) || 0,
      }));
      setServicos(normalized);
      setPreco(normalized.reduce((acc, r) => acc + r.preco, 0));
      setCatalogoCarregado(true);
      if (normalized.length === 0) {
        setCatalogoErro(
          "Nenhum serviço ativo encontrado para esta contratação. Selecione um serviço novamente.",
        );
      }
    })();
  }, [state.servicosSlugs?.join(","), state.servicoSlug]);

  /* ---- Cálculo de preview (frontend exibe, backend recalcula a verdade) ---- */
  const pricingPix = useMemo(
    () => (preco > 0 ? calcularPrecoFinal(preco, "PIX") : null),
    [preco],
  );
  const pricingBoleto = useMemo(
    () => (preco > 0 ? calcularPrecoFinal(preco, "BOLETO") : null),
    [preco],
  );
  const pricingCartao = useMemo(
    () => (preco > 0 ? calcularPrecoFinal(preco, "CREDIT_CARD", parcelas) : null),
    [preco, parcelas],
  );
  const opcoesParcelas = useMemo(
    () => (preco > 0 ? listarOpcoesParcelamento(preco) : []),
    [preco],
  );

  /** Pricing efetivo conforme o modo de pagamento selecionado. */
  const pricingSelecionado: PricingResult | null = useMemo(() => {
    if (preco <= 0) return null;
    if (state.formaPagamento === "pix") return pricingPix;
    if (state.formaPagamento === "boleto") return pricingBoleto;
    return pricingCartao;
  }, [preco, state.formaPagamento, pricingPix, pricingBoleto, pricingCartao]);

  // Render QR code quando PIX payload chega
  useEffect(() => {
    if (!pay || pay.billing_type !== "PIX" || !pay.asaas_pix_payload) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(pay.asaas_pix_payload, {
      margin: 1,
      width: 440,
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch((e) => console.warn("[Etapa04] QR gen failed:", e));
  }, [pay]);

  // Render barcode quando boleto chega
  useEffect(() => {
    if (!pay || pay.billing_type !== "BOLETO" || !pay.asaas_bank_slip_url || !barcodeRef.current) return;
    const code = pay.asaas_payment_id || "";
    if (!code) return;
    try {
      JsBarcode(barcodeRef.current, code, {
        format: "CODE128",
        height: 60,
        displayValue: false,
        margin: 0,
      });
    } catch (e) {
      console.warn("[Etapa04] barcode gen failed:", e);
    }
  }, [pay]);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  /** Consulta o status uma única vez. Retorna true se já está pago. */
  const checkPaymentOnce = useCallback(
    async (venda_id: number, checkout_token: string): Promise<boolean> => {
      try {
        const { data, error } = await supabase.functions.invoke("qa-checkout-status", {
          body: { venda_id, checkout_token },
        });
        if (error) {
          console.warn("[Etapa04] status err:", error);
          return false;
        }
        if (data?.pago) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setStage("confirmed");
          update({
            resultado: {
              ...(resultadoRef.current || {}),
              pagamento_status: "pagamento_confirmado",
            },
          });
          window.setTimeout(() => onNext(), 4000);
          return true;
        }
      } catch (e) {
        console.warn("[Etapa04] poll exception:", e);
      }
      return false;
    },
    [onNext, update],
  );

  const startPolling = useCallback(
    (venda_id: number, checkout_token: string) => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollStartRef.current = Date.now();
      setPollTimedOut(false);

      const tick = async () => {
        if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setPollTimedOut(true);
          return;
        }
        await checkPaymentOnce(venda_id, checkout_token);
      };

      pollRef.current = window.setInterval(tick, POLL_INTERVAL_MS);
      window.setTimeout(tick, 1000);
    },
    [checkPaymentOnce],
  );

  /**
   * Retoma polling após reload/retorno da aba: se o estado persistido tem
   * venda_id + checkout_token e o pagamento estava "aguardando", reidrata
   * o stage e volta a consultar o backend automaticamente.
   */
  useEffect(() => {
    if (resumedRef.current) return;
    // Se o pay já foi setado nesta sessão (fluxo normal pós-submit),
    // não sobrescreve com dados parcialmente persistidos — o resume
    // só deve atuar em reloads reais da página.
    if (pay) {
      resumedRef.current = true;
      return;
    }
    const r: any = state.resultado || {};
    const vendaIdNum = Number(r.venda_id);
    const token: string = r.checkout_token || "";
    if (
      Number.isFinite(vendaIdNum) &&
      vendaIdNum > 0 &&
      token.length >= 16 &&
      r.pagamento_status === "aguardando_pagamento"
    ) {
      resumedRef.current = true;
      const billing =
        (r.billing_type as PaymentData["billing_type"]) ||
        (state.formaPagamento === "pix"
          ? "PIX"
          : state.formaPagamento === "boleto"
            ? "BOLETO"
            : "CREDIT_CARD");
      setPay({
        venda_id: vendaIdNum,
        checkout_token: token,
        asaas_payment_id: r.asaas_payment_id ?? null,
        asaas_invoice_url: r.asaas_invoice_url ?? null,
        asaas_bank_slip_url: r.asaas_bank_slip_url ?? null,
        asaas_pix_payload: r.asaas_pix_payload ?? null,
        billing_type: billing,
        parcelas: Number(r.parcelas) || 1,
        valor_cobrado: Number(r.valor_cobrado) || 0,
      });
      setStage("awaiting");
      // Verifica imediatamente — webhook pode já ter confirmado durante o reload.
      void checkPaymentOnce(vendaIdNum, token).then((ok) => {
        if (!ok) startPolling(vendaIdNum, token);
      });
    }
  }, [state.resultado, state.formaPagamento, checkPaymentOnce, startPolling, pay]);

  /**
   * Quando o usuário volta para a aba (após pagar no Asaas em outra aba),
   * dispara verificação imediata em vez de esperar o próximo tick do polling.
   */
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (!pay) return;
      void checkPaymentOnce(pay.venda_id, pay.checkout_token);
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [pay, checkPaymentOnce]);

  async function handleCheckNow() {
    if (!pay || checkingNow) return;
    setCheckingNow(true);
    try {
      const ok = await checkPaymentOnce(pay.venda_id, pay.checkout_token);
      if (!ok) {
        // Reinicia janela de polling para dar mais 30min a partir daqui.
        pollStartRef.current = Date.now();
        setPollTimedOut(false);
        if (!pollRef.current) startPolling(pay.venda_id, pay.checkout_token);
      }
    } finally {
      setCheckingNow(false);
    }
  }

  const labelBtn = useMemo(() => {
    if (!pricingSelecionado) return "Continuar";
    const total = formatarReais(pricingSelecionado.valorTotal);
    return `PAGAMENTO E ACEITE DO CONTRATO — ${total}`;
  }, [pricingSelecionado]);

  async function handleSubmit() {
    setError(null);
    if (!state.aceiteContrato) {
      setError("É necessário aceitar o contrato e a política de privacidade.");
      return;
    }
    if (!servicoIdPrincipal || servicos.length === 0) {
      setError("Catálogo de serviço indisponível. Recarregue a página.");
      return;
    }
    if (!pricingSelecionado) {
      setError("Não foi possível calcular o valor. Recarregue a página.");
      return;
    }
    setStage("preparing");
    try {
      const d = state.dadosPessoais;
      // 1) Cria conta pública
      const senhaAuto =
        "QA-" +
        crypto.getRandomValues(new Uint32Array(2)).reduce((s, n) => s + n.toString(36), "") +
        "!a1";
      const { data: contaData, error: contaErr } = await supabase.functions.invoke(
        "qa-cliente-criar-conta-publica",
        {
          body: {
            nome: d.nome_completo,
            nome_completo: d.nome_completo,
            cpf: d.cpf.replace(/\D/g, ""),
            email: d.email.trim().toLowerCase(),
            telefone: d.telefone,
            senha: senhaAuto,
            catalogo_slug:
              state.servicosSlugs && state.servicosSlugs.length > 0
                ? state.servicosSlugs.join(",")
                : state.servicoSlug,
            data_nascimento: d.data_nascimento,
            endereco: {
              cep: d.endereco_cep,
              logradouro: d.endereco_logradouro,
              numero: d.endereco_numero,
              complemento: d.endereco_complemento,
              bairro: d.endereco_bairro,
              cidade: d.endereco_cidade,
              estado: d.endereco_estado,
            },
            servico_slug:
              state.servicosSlugs && state.servicosSlugs.length > 0
                ? state.servicosSlugs.join(",")
                : state.servicoSlug,
            origem: state.origem || "cadastro_refinado",
            documentos: state.documentos,
          },
        },
      );
      if (contaErr) throw contaErr;

      // Idempotência por CPF (checkout público SEM login obrigatório):
      // Se a conta pública já existir (CPF/e-mail), NÃO redirecionar para
      // login. A venda é criada e vinculada ao qa_cliente existente pelo
      // CPF normalizado dentro de qa-checkout-criar-venda. O acesso ao
      // Arsenal/histórico continua exigindo autenticação posterior — aqui
      // apenas seguimos com a contratação. Nenhum dado sensível antigo é
      // exibido no checkout enquanto o cliente estiver deslogado.
      const reasonExistente = contaData?.reason as string | undefined;
      const clienteJaExistente =
        contaData?.ok === false &&
        (reasonExistente === "cpf_ja_possui_login" ||
          reasonExistente === "email_ja_cadastrado" ||
          reasonExistente === "cpf_ja_possui_cadastro_sem_login");
      if (clienteJaExistente) {
        update({ clienteExistente: true });
      }

      const qaClienteId = contaData?.qa_cliente_id ?? contaData?.cliente_id ?? null;
      update({
        resultado: {
          ...(state.resultado || {}),
          cliente_id: qaClienteId,
        },
        clienteExistente: !!contaData?.cpf_ja_possui_login || state.clienteExistente,
      });

      // 2) Cria venda
      const cpfDigits = d.cpf.replace(/\D/g, "");
      const celular = (d.telefone || "").replace(/\D/g, "");
      const { data: vendaResp, error: vendaErr } = await supabase.functions.invoke(
        "qa-checkout-criar-venda",
        {
          body: {
            cart: servicos.map((s) => ({
              servico_id: s.id,
              slug: s.slug,
              quantidade: 1,
            })),
            identificacao: {
              nome_completo: d.nome_completo,
              cpf: cpfDigits,
              email: d.email.trim().toLowerCase(),
              celular,
            },
          },
        },
      );
      if (vendaErr) throw vendaErr;
      if (!vendaResp?.venda_id || !vendaResp?.checkout_token) {
        throw new Error(vendaResp?.error || "Falha ao criar venda no checkout.");
      }
      const vendaId: number = vendaResp.venda_id;
      const vendaIdLegado: number = vendaResp.id_legado ?? vendaResp.venda_id;
      const checkoutToken: string = vendaResp.checkout_token;

      const clienteIdFinalRaw =
        qaClienteId ?? vendaResp?.qa_cliente_id ?? vendaResp?.cliente_id ?? null;
      const clienteIdFinal: string | null =
        clienteIdFinalRaw == null ? null : String(clienteIdFinalRaw);
      if (clienteIdFinal && clienteIdFinal !== qaClienteId) {
        update({
          resultado: {
            ...(state.resultado || {}),
            cliente_id: clienteIdFinal,
          },
        });
      }

      // PR3 — Persistência dos 2 documentos (identidade + comprovante) no painel
      // da equipe. Best-effort: falha NÃO bloqueia checkout/contrato/pagamento.
      try {
        const temDocs =
          !!state.documentos?.doc_identidade?.storagePath ||
          !!state.documentos?.doc_endereco?.storagePath;
        if (temDocs) {
          await supabase.functions.invoke("qa-cadastro-refinado-persistir-docs", {
            body: {
              qa_cliente_id: clienteIdFinal,
              dados_pessoais: state.dadosPessoais,
              documentos: state.documentos,
              servico_slug:
                state.servicoSlug || (state.servicosSlugs?.[0] ?? null),
              origem: state.origem || "cadastro_refinado",
            },
          });
        }
      } catch (persistErr) {
        console.warn("[cadastro-refinado] persistência de documentos falhou:", persistErr);
      }

      // 3) Aceite (não bloqueia)
      try {
        await supabase.functions.invoke("qa-contract-aceite-registrar", {
          body: {
            cliente_id: clienteIdFinal,
            venda_id: vendaIdLegado,
            solicitacao_id: null,
            servico_slug: state.servicoSlug || (state.servicosSlugs?.[0] ?? null),
            servico_slugs:
              state.servicosSlugs && state.servicosSlugs.length > 0
                ? state.servicosSlugs
                : state.servicoSlug
                  ? [state.servicoSlug]
                  : [],
            servico_preco: preco,
            dados_pessoais: state.dadosPessoais,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            template_codigo: "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS",
          },
        });
      } catch (aceiteFail: any) {
        console.warn("[Etapa04] aceite-registrar falhou:", aceiteFail);
        supabase.functions.invoke("qa-notificar-admin-contratacao", {
          body: {
            motivo: "aceite_registro_falhou",
            cliente_id: qaClienteId,
            venda_id: vendaId,
            servico_slug:
              state.servicosSlugs && state.servicosSlugs.length > 0
                ? state.servicosSlugs.join(",")
                : state.servicoSlug,
            erro: aceiteFail?.message || String(aceiteFail),
          },
        }).catch(() => {});
      }

      // 4) Gera cobrança Asaas — envia billing_type + installment_count.
      //    O backend recalcula o valor via mesma função calcularPrecoFinal
      //    (NÃO confiamos no frontend para preço final).
      const billing = uiPagamentoToBillingType(state.formaPagamento);
      const installmentCount = billing === "CREDIT_CARD" ? pricingSelecionado.parcelas : 1;

      const { data: payResp, error: payErr } = await supabase.functions.invoke(
        "qa-checkout-iniciar-pagamento",
        {
          body: {
            venda_id: vendaId,
            checkout_token: checkoutToken,
            billing_type: billing,
            installment_count: installmentCount,
          },
        },
      );
      if (payErr) throw payErr;
      if (!payResp?.success) {
        throw new Error(payResp?.error || "Não foi possível gerar a cobrança.");
      }

      const payData: PaymentData = {
        venda_id: vendaId,
        checkout_token: checkoutToken,
        asaas_payment_id: payResp.asaas_payment_id ?? null,
        asaas_invoice_url: payResp.asaas_invoice_url ?? null,
        asaas_bank_slip_url: payResp.asaas_bank_slip_url ?? null,
        asaas_pix_payload: payResp.asaas_pix_payload ?? null,
        billing_type: billing,
        parcelas: payResp.parcelas ?? installmentCount,
        valor_cobrado: payResp.valor_cobrado ?? pricingSelecionado.valorTotal,
      };
      setPay(payData);
      update({
        resultado: {
          ...(state.resultado || {}),
          cliente_id: qaClienteId,
          venda_id: String(vendaId),
          checkout_token: checkoutToken,
          asaas_invoice_url: payData.asaas_invoice_url ?? undefined,
          asaas_payment_id: payData.asaas_payment_id ?? undefined,
          asaas_pix_payload: payData.asaas_pix_payload ?? undefined,
          asaas_bank_slip_url: payData.asaas_bank_slip_url ?? undefined,
          parcelas: payData.parcelas,
          valor_cobrado: payData.valor_cobrado,
          billing_type: billing,
          pagamento_status: "aguardando_pagamento",
          pagamento_url: payData.asaas_invoice_url ?? undefined,
        },
      });
      setStage("awaiting");
      startPolling(vendaId, checkoutToken);
    } catch (e: any) {
      setError(e?.message || "Não foi possível processar. Tente novamente.");
      setStage("form");
    }
  }

  function handleCopy(value: string, which: "pix" | "boleto") {
    if (!value) return;
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(which);
        window.setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
      })
      .catch(() => {});
  }

  function handleRetry() {
    setError(null);
    setPay(null);
    if (pollRef.current) window.clearInterval(pollRef.current);
    setStage("form");
  }

  return (
    <QACadastroRefinadoShell
      step={4}
      eyebrow="ETAPA 04 · PAGAMENTO E CONTRATO"
      title={stage === "confirmed" ? "Pagamento confirmado" : "Escolha como pagar"}
      subtitle={
        stage === "confirmed"
          ? "Estamos preparando seu contrato para assinatura."
          : "Após a confirmação do pagamento, seu aceite eletrônico do contrato será registrado e o serviço será iniciado."
      }
      onBack={stage === "form" ? onBack : undefined}
    >
      {/* Bloco de preço destacado — espelho do estilo Mercado Livre */}
      <div className="qa-ref-total">
        <div>
          <div className="qa-ref-total-label">Total a pagar</div>
          <div className="qa-ref-caps" style={{ marginTop: 4 }}>
            {servicos.length === 0
              ? "Nenhum serviço selecionado"
              : servicos.length === 1
                ? "1 serviço selecionado"
                : `${servicos.length} serviços selecionados`}
          </div>
          {servicos.length > 0 && (
            <ul
              style={{
                marginTop: 8,
                paddingLeft: 0,
                listStyle: "none",
                fontSize: 13,
                color: "var(--qa-ref-ink-soft)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {servicos.map((s) => (
                <li key={s.id}>
                  · {s.nome} — {formatarReais(s.preco)}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div className="qa-ref-total-value">
            {pricingSelecionado ? formatarReais(pricingSelecionado.valorTotal) : "—"}
          </div>
          {pricingPix && pricingSelecionado && state.formaPagamento !== "pix" && (
            <div
              style={{
                fontSize: 13,
                color: "var(--qa-ref-ink-soft)",
                marginTop: 4,
              }}
            >
              ou {formatarReais(pricingPix.valorTotal)} à vista no PIX
            </div>
          )}
        </div>
      </div>

      {stage === "form" && catalogoCarregado && servicos.length === 0 && (
        <div
          className="qa-ref-pay-panel"
          style={{ marginTop: 16, borderColor: "var(--qa-ref-danger, #b91c1c)" }}
        >
          <div className="qa-ref-pay-status">Selecione um serviço para continuar</div>
          <p style={{ marginTop: 10, fontSize: 13.5, color: "var(--qa-ref-ink-soft)" }}>
            {catalogoErro ||
              "Não identificamos nenhum serviço vinculado a esta contratação. Volte e escolha o serviço desejado para que possamos exibir os valores e as opções de parcelamento."}
          </p>
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="qa-ref-btn qa-ref-btn-primary"
              onClick={() => navigate("/cadastro?etapa=1")}
            >
              Escolher serviço
            </button>
          </div>
        </div>
      )}

      {stage === "form" && (
        <>
          {/* Cards de forma de pagamento — cada um mostra o valor próprio */}
          <div className="qa-ref-pay-list">
            {/* PIX */}
            <label
              className={`qa-ref-pay-opt ${
                state.formaPagamento === "pix" ? "is-selected" : ""
              }`}
            >
              <input
                type="radio"
                name="forma_pagamento"
                value="pix"
                checked={state.formaPagamento === "pix"}
                onChange={() => {
                  update({ formaPagamento: "pix" });
                  setOpenParcelaPicker(false);
                }}
              />
              <div style={{ flex: 1 }}>
                <div className="qa-ref-pay-name">PIX</div>
                <div className="qa-ref-pay-hint">
                  Aprovação imediata · Recomendado
                </div>
                {pricingPix && (
                  <div
                    style={{
                      fontSize: 13,
                      marginTop: 4,
                      fontWeight: 600,
                      color: "var(--qa-ref-accent, #0a7d2c)",
                    }}
                  >
                    {formatarReais(pricingPix.valorTotal)} à vista
                  </div>
                )}
              </div>
            </label>

            {/* CARTÃO */}
            <label
              className={`qa-ref-pay-opt ${
                state.formaPagamento === "cartao" ? "is-selected" : ""
              }`}
            >
              <input
                type="radio"
                name="forma_pagamento"
                value="cartao"
                checked={state.formaPagamento === "cartao"}
                onChange={() => update({ formaPagamento: "cartao" })}
              />
              <div style={{ flex: 1 }}>
                <div className="qa-ref-pay-name">Cartão de crédito</div>
                <div className="qa-ref-pay-hint">
                  Em até {DEFAULT_PRICING_CONFIG.maxParcelas}x · Aprovação imediata
                </div>
                {pricingCartao && (
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    <strong>
                      {pricingCartao.parcelas}x de{" "}
                      {formatarReais(pricingCartao.valorParcela)}
                    </strong>{" "}
                    <span style={{ color: "var(--qa-ref-ink-soft)" }}>
                      ({formatarReais(pricingCartao.valorTotal)} total
                      {pricingCartao.encargosReais > 0
                        ? ` · +${Math.round(pricingCartao.encargosFracao * 100)}%`
                        : ""}
                      )
                    </span>
                  </div>
                )}
                {state.formaPagamento === "cartao" && (
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.preventDefault();
                      setOpenParcelaPicker((v) => !v);
                    }}
                    style={{
                      marginTop: 8,
                      background: "transparent",
                      border: "1px solid var(--qa-ref-line, #d4d4d4)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {openParcelaPicker
                      ? "Fechar opções de parcelamento"
                      : "Ver todas as opções de parcelamento"}
                  </button>
                )}
              </div>
            </label>

            {/* Seletor de parcelas — só aparece quando cartão está selecionado */}
            {state.formaPagamento === "cartao" && openParcelaPicker && (
              <div
                className="qa-ref-parcela-list"
                style={{
                  border: "1px solid var(--qa-ref-line, #e5e5e5)",
                  borderRadius: 8,
                  padding: 8,
                  marginTop: -8,
                  marginBottom: 8,
                  background: "var(--qa-ref-bg-soft, #fafafa)",
                  maxHeight: 280,
                  overflowY: "auto",
                  color: "var(--qa-ref-ink, #f5f5f5)",
                }}
              >
                {opcoesParcelas.map((opt) => (
                  <button
                    key={opt.parcelas}
                    type="button"
                    onClick={() => {
                      setParcelas(opt.parcelas);
                      setOpenParcelaPicker(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      border: "none",
                      borderRadius: 6,
                      background:
                        parcelas === opt.parcelas
                          ? "var(--qa-ref-bg-strong, #eaeaea)"
                          : "transparent",
                      cursor: "pointer",
                      fontSize: 13,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      color: "var(--qa-ref-ink, #f5f5f5)",
                    }}
                  >
                    <span>
                      <strong>{opt.parcelas}x</strong> de{" "}
                      {formatarReais(opt.valorParcela)}
                    </span>
                    <span style={{ color: "var(--qa-ref-ink-soft)" }}>
                      {formatarReais(opt.valorTotal)}
                      {opt.encargosReais > 0
                        ? ` · +${Math.round(opt.encargosFracao * 100)}%`
                        : " · sem juros"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* BOLETO */}
            <label
              className={`qa-ref-pay-opt ${
                state.formaPagamento === "boleto" ? "is-selected" : ""
              }`}
            >
              <input
                type="radio"
                name="forma_pagamento"
                value="boleto"
                checked={state.formaPagamento === "boleto"}
                onChange={() => {
                  update({ formaPagamento: "boleto" });
                  setOpenParcelaPicker(false);
                }}
              />
              <div style={{ flex: 1 }}>
                <div className="qa-ref-pay-name">Boleto bancário</div>
                <div className="qa-ref-pay-hint">
                  Compensação em até 2 dias úteis
                </div>
                {pricingBoleto && (
                  <div style={{ fontSize: 13, marginTop: 4, fontWeight: 600 }}>
                    {formatarReais(pricingBoleto.valorTotal)} à vista
                  </div>
                )}
              </div>
            </label>
          </div>

          <div style={{ marginTop: 24 }}>
            <ContractPreviewCard
              state={state}
              precoServico={preco}
              nomeServico={nomeServicoPrincipal}
            />
          </div>

          <label className="qa-ref-checkbox-row">
            <input
              type="checkbox"
              checked={state.aceiteContrato}
              onChange={(e) => update({ aceiteContrato: e.target.checked })}
            />
            <span>
              Li e aceito o{" "}
              <a href="/termos" target="_blank" rel="noreferrer">
                contrato de prestação de serviços
              </a>{" "}
              e a{" "}
              <a href="/privacidade" target="_blank" rel="noreferrer">
                política de privacidade
              </a>{" "}
              (LGPD).
            </span>
          </label>
          <p className="qa-ref-aceite-fineprint">
            Ao prosseguir, o aceite eletrônico será registrado com data, hora, IP e
            identificação do dispositivo, na forma da MP 2.200-2/2001 e Lei
            14.063/2020. Para os atos perante PF/Exército/órgãos competentes, será
            solicitada assinatura digital ICP-Brasil em momento posterior.
          </p>

          {error && <div className="qa-ref-error-text">{error}</div>}

          <div style={{ marginTop: 28 }}>
            <button
              className="qa-ref-btn qa-ref-btn-primary"
              disabled={
                !state.aceiteContrato || servicos.length === 0 || !pricingSelecionado
              }
              onClick={handleSubmit}
            >
              {labelBtn}
            </button>
          </div>
        </>
      )}

      {stage === "preparing" && (
        <div className="qa-ref-pay-panel">
          <div className="qa-ref-pay-status is-waiting">Preparando pagamento…</div>
          <p style={{ marginTop: 14, fontSize: 13.5, color: "var(--qa-ref-ink-soft)" }}>
            Estamos gerando sua cobrança junto ao banco. Não feche esta página.
          </p>
        </div>
      )}

      {stage === "awaiting" && pay && (
        <div className="qa-ref-pay-panel">
          <div className={`qa-ref-pay-status ${pollTimedOut ? "" : "is-waiting"}`}>
            {pollTimedOut ? "Pagamento ainda não detectado" : "Aguardando pagamento"}
          </div>

          {pay.billing_type === "CREDIT_CARD" && pay.parcelas > 1 && (
            <p
              style={{
                fontSize: 13,
                color: "var(--qa-ref-ink-soft)",
                marginTop: 4,
                marginBottom: 14,
              }}
            >
              Parcelado em {pay.parcelas}x · total {formatarReais(pay.valor_cobrado)}
            </p>
          )}

          {pay.billing_type === "PIX" && (
            <>
              <div className="qa-ref-qr-wrap">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code PIX" className="qa-ref-qr-img" />
                ) : (
                  <div
                    className="qa-ref-qr-img"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--qa-ref-ink-soft)",
                      fontSize: 12,
                    }}
                  >
                    Gerando QR…
                  </div>
                )}
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--qa-ref-ink-soft)",
                    textAlign: "center",
                  }}
                >
                  Aponte a câmera do seu app do banco ou copie o código abaixo.
                </div>
              </div>
              <div className="qa-ref-copia-cola">
                <input
                  readOnly
                  value={pay.asaas_pix_payload || ""}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className={`qa-ref-copy-btn ${copied === "pix" ? "is-copied" : ""}`}
                  onClick={() => handleCopy(pay.asaas_pix_payload || "", "pix")}
                >
                  {copied === "pix" ? "Copiado" : "Copiar"}
                </button>
              </div>
              {pay.asaas_invoice_url && (
                <a
                  href={pay.asaas_invoice_url}
                  target="_blank"
                  rel="noreferrer"
                  className="qa-ref-pay-invoice-link"
                >
                  Abrir fatura completa em nova aba
                </a>
              )}
            </>
          )}

          {pay.billing_type === "BOLETO" && (
            <>
              <div className="qa-ref-barcode-wrap">
                <svg ref={barcodeRef} />
              </div>
              <div className="qa-ref-copia-cola">
                <input
                  readOnly
                  value={pay.asaas_payment_id || ""}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className={`qa-ref-copy-btn ${copied === "boleto" ? "is-copied" : ""}`}
                  onClick={() => handleCopy(pay.asaas_payment_id || "", "boleto")}
                >
                  {copied === "boleto" ? "Copiado" : "Copiar"}
                </button>
              </div>
              <div className="qa-ref-pay-warn">
                Compensação em até 3 dias úteis. Não feche esta página antes de
                confirmar o pagamento. Para imprimir o boleto, baixe o PDF na fatura
                completa.
              </div>
              {(pay.asaas_bank_slip_url || pay.asaas_invoice_url) && (
                <a
                  href={pay.asaas_bank_slip_url || pay.asaas_invoice_url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="qa-ref-pay-invoice-link"
                >
                  Baixar PDF do boleto
                </a>
              )}
            </>
          )}

          {pay.billing_type === "CREDIT_CARD" && (
            <>
              {pay.asaas_invoice_url ? (
                <>
                  <a
                    href={pay.asaas_invoice_url}
                    target="_blank"
                    rel="noreferrer"
                    className="qa-ref-pay-cta"
                    style={{
                      display: "block",
                      textAlign: "center",
                      padding: "18px 22px",
                      background: "var(--qa-ref-brass, #D6A64B)",
                      color: "#0a0a0a",
                      fontWeight: 700,
                      borderRadius: 10,
                      textDecoration: "none",
                      fontSize: 16,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                    }}
                  >
                    Pagar com cartão — abrir checkout seguro
                  </a>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--qa-ref-ink-soft)",
                      marginTop: 10,
                      textAlign: "center",
                    }}
                  >
                    O checkout do cartão abre em uma nova aba segura do banco.
                    Após o pagamento, volte para esta página — o status será
                    atualizado automaticamente.
                  </p>
                </>
              ) : (
                <div className="qa-ref-empty">Carregando ambiente seguro…</div>
              )}
            </>
          )}

          {pollTimedOut && (
            <div className="qa-ref-pay-warn" style={{ marginTop: 14 }}>
              Pagamento ainda não detectado. Verifique seu app bancário e atualize
              esta página para retomar a verificação.
            </div>
          )}

          <div
            style={{
              marginTop: 22,
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="qa-ref-btn qa-ref-btn-ghost"
              onClick={handleRetry}
            >
              Trocar forma de pagamento
            </button>
            <a
              href="mailto:eu@queroarmas.com.br"
              className="qa-ref-btn-link"
              style={{ alignSelf: "center", fontSize: 12 }}
            >
              Falar com suporte
            </a>
          </div>
        </div>
      )}

      {stage === "confirmed" && (
        <div className="qa-ref-pay-panel qa-ref-pay-confirmed">
          <div className="qa-ref-check">✓</div>
          <h3>Pagamento confirmado!</h3>
          <p>Seu contrato está pronto para assinatura digital.</p>
          <button
            type="button"
            className="qa-ref-btn qa-ref-btn-primary"
            onClick={() => navigate("/area-do-cliente")}
          >
            Assinar contrato →
          </button>
          <p
            style={{
              fontSize: 11.5,
              color: "var(--qa-ref-ink-soft)",
              marginTop: 14,
            }}
          >
            Redirecionando para a próxima etapa em alguns segundos…
          </p>
        </div>
      )}
    </QACadastroRefinadoShell>
  );
}
