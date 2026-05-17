import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { supabase } from "@/integrations/supabase/client";
import QACadastroRefinadoShell from "../components/QACadastroRefinadoShell";
import ContractPreviewCard from "../components/ContractPreviewCard";
import { CadastroRefinadoState } from "../hooks/useCadastroRefinadoState";

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
}

const PAY_OPTIONS: { id: CadastroRefinadoState["formaPagamento"]; nome: string; hint: string }[] = [
  { id: "pix", nome: "PIX", hint: "Aprovação imediata. Recomendado." },
  { id: "cartao", nome: "Cartão de crédito", hint: "Em até 12x. Aprovação imediata." },
  { id: "boleto", nome: "Boleto bancário", hint: "Compensação em até 2 dias úteis." },
];

const BILLING_MAP: Record<CadastroRefinadoState["formaPagamento"], "PIX" | "BOLETO" | "CREDIT_CARD"> = {
  pix: "PIX", boleto: "BOLETO", cartao: "CREDIT_CARD",
};

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 30 * 60 * 1000; // 30min

export default function Etapa04Pagamento({ state, update, onNext, onBack }: Props) {
  const navigate = useNavigate();
  const [preco, setPreco] = useState<number>(0);
  const [servicoId, setServicoId] = useState<string | null>(null);
  const [nomeServico, setNomeServico] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("form");
  const [error, setError] = useState<string | null>(null);
  const [pay, setPay] = useState<PaymentData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<"pix" | "boleto" | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);

  const pollRef = useRef<number | null>(null);
  const pollStartRef = useRef<number>(0);
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  /* Mantém referência sempre fresca de state.resultado para o closure do polling
   * — evita sobrescrever checkout_token/asaas_invoice_url/etc com versão stale
   * no momento em que o webhook confirma o pagamento. */
  const resultadoRef = useRef(state.resultado);
  useEffect(() => {
    resultadoRef.current = state.resultado;
  }, [state.resultado]);

  useEffect(() => {
    if (!state.servicoSlug) return;
    (async () => {
      const { data } = await supabase
        .from("qa_servicos_catalogo")
        .select("id, preco, nome")
        .eq("slug", state.servicoSlug)
        .maybeSingle();
      setPreco(Number(data?.preco) || 0);
      setServicoId((data as any)?.id ?? null);
      setNomeServico((data as any)?.nome ?? null);
    })();
  }, [state.servicoSlug]);

  // Render QR code when PIX payload chega
  useEffect(() => {
    if (!pay || pay.billing_type !== "PIX" || !pay.asaas_pix_payload) { setQrDataUrl(null); return; }
    QRCode.toDataURL(pay.asaas_pix_payload, { margin: 1, width: 440, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch((e) => console.warn("[Etapa04] QR gen failed:", e));
  }, [pay]);

  // Render barcode when boleto chega
  useEffect(() => {
    if (!pay || pay.billing_type !== "BOLETO" || !pay.asaas_bank_slip_url || !barcodeRef.current) return;
    // Asaas devolve só a invoice URL — usamos asaas_payment_id como código visual.
    const code = pay.asaas_payment_id || "";
    if (!code) return;
    try {
      JsBarcode(barcodeRef.current, code, {
        format: "CODE128", height: 60, displayValue: false, margin: 0,
      });
    } catch (e) { console.warn("[Etapa04] barcode gen failed:", e); }
  }, [pay]);

  // Cleanup polling
  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  const startPolling = useCallback((venda_id: number, checkout_token: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollStartRef.current = Date.now();
    setPollTimedOut(false);

    const tick = async () => {
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setPollTimedOut(true);
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("qa-checkout-status", {
          body: { venda_id, checkout_token },
        });
        if (error) { console.warn("[Etapa04] status err:", error); return; }
        if (data?.pago) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setStage("confirmed");
          /* Webhook Asaas confirmou — agora sim podemos declarar pagamento confirmado.
           * Etapas pós-pagamento (contrato_gerado, acesso_enviado, servico_liberado)
           * são derivadas separadamente pela Etapa05 via polling do mesmo endpoint. */
          update({
            resultado: {
              ...(resultadoRef.current || {}),
              pagamento_status: "pagamento_confirmado",
            },
          });
          // Redireciona para Etapa 05 após 4s — botão "Assinar contrato" continua disponível.
          window.setTimeout(() => onNext(), 4000);
        }
      } catch (e) {
        console.warn("[Etapa04] poll exception:", e);
      }
    };

    pollRef.current = window.setInterval(tick, POLL_INTERVAL_MS);
    // primeira tentativa imediata após 1s
    window.setTimeout(tick, 1000);
  }, [onNext]);

  const labelBtn = (() => {
    const v = `R$ ${preco.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (state.formaPagamento === "pix") return `Gerar PIX e assinar contrato — ${v}`;
    if (state.formaPagamento === "cartao") return `Pagar com cartão e assinar contrato — ${v}`;
    return `Gerar boleto e assinar contrato — ${v}`;
  })();

  async function handleSubmit() {
    setError(null);
    if (!state.aceiteContrato) {
      setError("É necessário aceitar o contrato e a política de privacidade.");
      return;
    }
    if (!servicoId) {
      setError("Catálogo de serviço indisponível. Recarregue a página.");
      return;
    }
    setStage("preparing");
    try {
      const d = state.dadosPessoais;
      // 1) Cria conta pública (preserva Bug 2 — notificações e venda_pendente já existentes).
      // A senha é gerada aleatória; o cliente recebe e-mail de boas-vindas e usa "Esqueci minha senha"
      // para definir sua senha no primeiro acesso ao portal.
      const senhaAuto =
        "QA-" +
        crypto.getRandomValues(new Uint32Array(2)).reduce((s, n) => s + n.toString(36), "") +
        "!a1";
      const { data: contaData, error: contaErr } = await supabase.functions.invoke("qa-cliente-criar-conta-publica", {
        body: {
          nome: d.nome_completo,
          nome_completo: d.nome_completo,
          cpf: d.cpf.replace(/\D/g, ""),
          email: d.email.trim().toLowerCase(),
          telefone: d.telefone,
          senha: senhaAuto,
          catalogo_slug: state.servicoSlug,
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
          servico_slug: state.servicoSlug,
          origem: state.origem || "cadastro_refinado",
          documentos: state.documentos,
        },
      });
      if (contaErr) throw contaErr;

      const qaClienteId = contaData?.qa_cliente_id ?? contaData?.cliente_id ?? null;
      update({
        resultado: {
          ...(state.resultado || {}),
          cliente_id: qaClienteId,
        },
        clienteExistente: !!contaData?.cpf_ja_possui_login || state.clienteExistente,
      });

      // 2) Pipeline B — cria venda no checkout_site
      const cpfDigits = d.cpf.replace(/\D/g, "");
      const celular = (d.telefone || "").replace(/\D/g, "");
      const { data: vendaResp, error: vendaErr } = await supabase.functions.invoke("qa-checkout-criar-venda", {
        body: {
          cart: [{ servico_id: servicoId, slug: state.servicoSlug, quantidade: 1 }],
          identificacao: {
            nome_completo: d.nome_completo,
            cpf: cpfDigits,
            email: d.email.trim().toLowerCase(),
            celular,
          },
        },
      });
      if (vendaErr) throw vendaErr;
      if (!vendaResp?.venda_id || !vendaResp?.checkout_token) {
        throw new Error(vendaResp?.error || "Falha ao criar venda no checkout.");
      }
      const vendaId: number = vendaResp.venda_id;
      const checkoutToken: string = vendaResp.checkout_token;

      // Fallback: se conta-publica não retornou cliente_id (ex.: cpf_ja_possui_login),
      // usa o qa_cliente_id resolvido pelo checkout.
      const clienteIdFinalRaw = qaClienteId ?? vendaResp?.qa_cliente_id ?? vendaResp?.cliente_id ?? null;
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

      // 3) Registro probatório do aceite (não bloqueia)
      try {
        await supabase.functions.invoke("qa-contract-aceite-registrar", {
          body: {
            cliente_id: clienteIdFinal,
            venda_id: vendaId,
            solicitacao_id: null,
            servico_slug: state.servicoSlug,
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
            motivo: "aceite_registro_falhou", cliente_id: qaClienteId, venda_id: vendaId,
            servico_slug: state.servicoSlug, erro: aceiteFail?.message || String(aceiteFail),
          },
        }).catch(() => { /* silencioso */ });
      }

      // 4) Pipeline B — gera cobrança Asaas
      const billing = BILLING_MAP[state.formaPagamento];
      const { data: payResp, error: payErr } = await supabase.functions.invoke("qa-checkout-iniciar-pagamento", {
        body: {
          venda_id: vendaId,
          checkout_token: checkoutToken,
          billing_type: billing,
        },
      });
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
          billing_type: billing,
          /* Cobrança apenas criada — webhook Asaas ainda não confirmou.
           * Etapa05 lê este status para renderizar o estado correto. */
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
    navigator.clipboard.writeText(value).then(() => {
      setCopied(which);
      window.setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
    }).catch(() => {/* ignore */});
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
          : "Após a confirmação você assina o contrato digitalmente e libera o início do serviço."
      }
      onBack={stage === "form" ? onBack : undefined}
    >
      <div className="qa-ref-total">
        <div>
          <div className="qa-ref-total-label">Total a pagar</div>
          <div className="qa-ref-caps" style={{ marginTop: 4 }}>1 serviço selecionado</div>
        </div>
        <div className="qa-ref-total-value">
          R$ {preco.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </div>
      </div>

      {stage === "form" && (
        <>
          <div className="qa-ref-pay-list">
            {PAY_OPTIONS.map((opt) => (
              <label key={opt.id} className={`qa-ref-pay-opt ${state.formaPagamento === opt.id ? "is-selected" : ""}`}>
                <input
                  type="radio"
                  name="forma_pagamento"
                  value={opt.id}
                  checked={state.formaPagamento === opt.id}
                  onChange={() => update({ formaPagamento: opt.id })}
                />
                <div>
                  <div className="qa-ref-pay-name">{opt.nome}</div>
                  <div className="qa-ref-pay-hint">{opt.hint}</div>
                </div>
              </label>
            ))}
          </div>

          <div style={{ marginTop: 24 }}>
            <ContractPreviewCard state={state} precoServico={preco} nomeServico={nomeServico} />
          </div>

          <label className="qa-ref-checkbox-row">
            <input
              type="checkbox"
              checked={state.aceiteContrato}
              onChange={(e) => update({ aceiteContrato: e.target.checked })}
            />
            <span>
              Li e aceito o <a href="/termos" target="_blank" rel="noreferrer">contrato de prestação de serviços</a>
              {" "}e a <a href="/privacidade" target="_blank" rel="noreferrer">política de privacidade</a> (LGPD).
            </span>
          </label>
          <p className="qa-ref-aceite-fineprint">
            Ao prosseguir, o aceite eletrônico será registrado com data, hora, IP e identificação do dispositivo,
            na forma da MP 2.200-2/2001 e Lei 14.063/2020. Para os atos perante PF/Exército/órgãos competentes,
            será solicitada assinatura digital ICP-Brasil em momento posterior.
          </p>

          {error && <div className="qa-ref-error-text">{error}</div>}

          <div style={{ marginTop: 28 }}>
            <button
              className="qa-ref-btn qa-ref-btn-primary"
              disabled={!state.aceiteContrato}
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

          {pay.billing_type === "PIX" && (
            <>
              <div className="qa-ref-qr-wrap">
                {qrDataUrl
                  ? <img src={qrDataUrl} alt="QR Code PIX" className="qa-ref-qr-img" />
                  : <div className="qa-ref-qr-img" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--qa-ref-ink-soft)", fontSize: 12 }}>Gerando QR…</div>}
                <div style={{ fontSize: 12, color: "var(--qa-ref-ink-soft)", textAlign: "center" }}>
                  Aponte a câmera do seu app do banco ou copie o código abaixo.
                </div>
              </div>
              <div className="qa-ref-copia-cola">
                <input readOnly value={pay.asaas_pix_payload || ""} onFocus={(e) => e.currentTarget.select()} />
                <button
                  type="button"
                  className={`qa-ref-copy-btn ${copied === "pix" ? "is-copied" : ""}`}
                  onClick={() => handleCopy(pay.asaas_pix_payload || "", "pix")}
                >
                  {copied === "pix" ? "Copiado" : "Copiar"}
                </button>
              </div>
              {pay.asaas_invoice_url && (
                <a href={pay.asaas_invoice_url} target="_blank" rel="noreferrer" className="qa-ref-pay-invoice-link">
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
                <input readOnly value={pay.asaas_payment_id || ""} onFocus={(e) => e.currentTarget.select()} />
                <button
                  type="button"
                  className={`qa-ref-copy-btn ${copied === "boleto" ? "is-copied" : ""}`}
                  onClick={() => handleCopy(pay.asaas_payment_id || "", "boleto")}
                >
                  {copied === "boleto" ? "Copiado" : "Copiar"}
                </button>
              </div>
              <div className="qa-ref-pay-warn">
                Compensação em até 3 dias úteis. Não feche esta página antes de confirmar o pagamento.
                Para imprimir o boleto, baixe o PDF na fatura completa.
              </div>
              {(pay.asaas_bank_slip_url || pay.asaas_invoice_url) && (
                <a
                  href={pay.asaas_bank_slip_url || pay.asaas_invoice_url || "#"}
                  target="_blank" rel="noreferrer"
                  className="qa-ref-pay-invoice-link"
                >
                  Baixar PDF do boleto
                </a>
              )}
            </>
          )}

          {pay.billing_type === "CREDIT_CARD" && (
            <>
              <div className="qa-ref-iframe-wrap">
                {pay.asaas_invoice_url
                  ? <iframe
                      src={pay.asaas_invoice_url}
                      title="Pagamento com cartão"
                      sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
                    />
                  : <div className="qa-ref-empty">Carregando ambiente seguro…</div>}
              </div>
              {pay.asaas_invoice_url && (
                <a href={pay.asaas_invoice_url} target="_blank" rel="noreferrer" className="qa-ref-pay-invoice-link">
                  Não carregou? Abrir checkout em nova aba
                </a>
              )}
            </>
          )}

          {pollTimedOut && (
            <div className="qa-ref-pay-warn" style={{ marginTop: 14 }}>
              Pagamento ainda não detectado. Verifique seu app bancário e atualize esta página para retomar a verificação.
            </div>
          )}

          <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" className="qa-ref-btn qa-ref-btn-ghost" onClick={handleRetry}>
              Trocar forma de pagamento
            </button>
            <a href="mailto:eu@queroarmas.com.br" className="qa-ref-btn-link" style={{ alignSelf: "center", fontSize: 12 }}>
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
          <p style={{ fontSize: 11.5, color: "var(--qa-ref-ink-soft)", marginTop: 14 }}>
            Redirecionando para a próxima etapa em alguns segundos…
          </p>
        </div>
      )}
    </QACadastroRefinadoShell>
  );
}