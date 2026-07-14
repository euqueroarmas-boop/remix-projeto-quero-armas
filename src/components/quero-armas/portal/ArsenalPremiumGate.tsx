// Gate do Arsenal Inteligente Premium.
// Fluxo obrigatório de dois passos:
//   1) Cartão de crédito — verificação com R$0,01 (igual ao modelo Apple)
//   2) Escolha da forma de pagamento — PIX, BOLETO ou CARTÃO (12x)
//
// Cartão é permanente: o cliente só pode trocar, nunca remover (requer chamado).
// Mesmo na gratuidade o cartão é exigido — necessário para eventual renovação.
// PIX/BOLETO para o serviço principal → cartão ainda obrigatório para o Arsenal.

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Check, Crosshair, CreditCard, FileText, Lock,
  ShieldCheck, Sparkles,
} from "lucide-react";
import type { ArsenalPremiumState } from "@/hooks/useArsenalPremium";
import { useArsenalPlano } from "@/hooks/useArsenalPlano";

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
.qagate{position:relative}
.qagate__dim{filter:grayscale(.9) opacity(.35);pointer-events:none;user-select:none;max-height:420px;overflow:hidden}
.qagate__dim::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,#f6f5f1 95%)}
.qagate__cta{position:relative;margin-top:-360px;z-index:2;background:#fff;border:1px solid #e3e0d8;border-top:4px solid #7A1F2B;border-radius:12px;padding:26px 28px;max-width:680px;margin-left:auto;margin-right:auto;box-shadow:0 14px 40px rgba(17,17,17,.10)}
.qagate__kicker{display:flex;align-items:center;gap:8px;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#7A1F2B;font-weight:600}
.qagate h2{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:22px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#0A0A0A;margin:8px 0 6px}
.qagate__lead{font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#4a4a4a;margin:0 0 14px}
.qagate__bens{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:0 0 16px}
.qagate__ben{display:flex;gap:8px;align-items:flex-start;font-family:Arial,sans-serif;font-size:12.5px;color:#141414;line-height:1.35}
.qagate__ben svg{width:14px;height:14px;color:#1f4d2b;margin-top:2px;flex-shrink:0}

/* Cartão — bloco obrigatório estilo Apple */
.qagate__card-box{border:1px solid #e3e0d8;border-radius:10px;padding:16px 18px;margin-bottom:16px;background:#faf9f5}
.qagate__card-box.verified{background:#f4faf5;border-color:#c6deca}
.qagate__card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.qagate__card-head h3{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#4a4a4a;font-weight:600;margin:0}
.qagate__card-head .required{font-family:Oswald,sans-serif;font-size:9px;letter-spacing:.14em;color:#7A1F2B;font-weight:600}
.qagate__verified-badge{display:flex;align-items:center;gap:8px;font-family:'Arial Narrow',Arial;font-size:14px;font-weight:700}
.qagate__verified-badge svg{color:#1f4d2b}
.qagate__verified-sub{font-family:Arial;font-size:11px;color:#4a4a4a;margin-top:3px}
.qagate__change-btn{font-family:Oswald,sans-serif;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#7A1F2B;font-weight:600;background:none;border:none;cursor:pointer;padding:0;text-decoration:underline}
.qagate__row{display:grid;gap:10px;margin-bottom:10px}
.qagate__row.cols-3{grid-template-columns:2fr 1fr 1fr}
.qagate__label{font-family:Oswald,sans-serif;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#6a6a6a;font-weight:600;display:block;margin-bottom:3px}
.qagate__input{width:100%;padding:9px 11px;font-family:'Arial Narrow',Arial;font-size:14px;border:1.5px solid #e3e0d8;border-radius:7px;background:#fff;color:#141414;outline:none;box-sizing:border-box}
.qagate__input:focus{border-color:#7A1F2B}
.qagate__note{font-family:Arial;font-size:10.5px;color:#6a6a6a;line-height:1.5;margin-top:10px}

.qagate__price{display:flex;align-items:baseline;gap:10px;border:1px dashed #e3e0d8;background:#faf9f5;border-radius:8px;padding:12px 16px;margin-bottom:16px}
.qagate__price .v{font-family:Oswald,sans-serif;font-size:28px;font-weight:600;color:#7A1F2B}
.qagate__price .s{font-family:Arial,sans-serif;font-size:12px;color:#6a6a6a}
.qagate__formas{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.qagate__forma{padding:10px 16px;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;border:1px solid #e3e0d8;background:#fff;color:#141414;border-radius:8px;cursor:pointer}
.qagate__forma.on{background:#7A1F2B;color:#fff;border-color:#7A1F2B}
.qagate__pix-note{font-family:Arial;font-size:12px;color:#4a4a4a;line-height:1.5;background:#fffdf6;border:1px solid #fbeed3;border-radius:6px;padding:10px 12px;margin-bottom:12px}
.qagate__aceite{display:flex;gap:10px;align-items:flex-start;font-family:Arial,sans-serif;font-size:12px;color:#4a4a4a;line-height:1.45;margin-bottom:16px}
.qagate__aceite input{margin-top:2px}
.qagate__btn{width:100%;padding:13px;background:#7A1F2B;color:#fff;border:0;border-radius:8px;font-family:Oswald,sans-serif;font-size:13px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;cursor:pointer}
.qagate__btn:disabled{opacity:.5;cursor:not-allowed}
.qagate__btn.secondary{background:#fff;color:#7A1F2B;border:1.5px solid #7A1F2B}
.qagate__copy{font-family:'Courier New',monospace;font-size:10.5px;background:#faf9f5;border:1px dashed #e3e0d8;padding:10px;border-radius:6px;word-break:break-all;line-height:1.5;margin-top:10px}
.qagate__qr{width:150px;height:150px;border:1px solid #e3e0d8;border-radius:6px;background:#fff;object-fit:contain;display:block;margin:12px auto 4px}
.qagate__ok{border:1px solid #dcecdf;background:#f4faf5;border-radius:8px;padding:14px 16px;font-family:Arial,sans-serif;font-size:13px;color:#1f4d2b;line-height:1.5}
.qagate__pend{border:1px solid #fbeed3;background:#fffdf6;border-radius:8px;padding:12px 14px;font-family:Arial,sans-serif;font-size:12px;color:#7a5410;line-height:1.5;margin-bottom:12px}
.qagate__steps{display:flex;gap:6px;align-items:center;margin-bottom:18px;font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#a0a0a0}
.qagate__steps .active{color:#7A1F2B;font-weight:700}
.qagate__steps .sep{color:#d0d0d0}
@media(max-width:720px){.qagate__bens{grid-template-columns:1fr}.qagate__cta{margin-top:-300px;padding:20px}.qagate__row.cols-3{grid-template-columns:1fr 1fr 1fr}}
`;

const BENEFICIOS = [
  { icon: Sparkles,   txt: "Klal — assistente jurídico exclusivo, disponível 24h" },
  { icon: Crosshair,  txt: "Gestão completa de armas, munições e habitualidade" },
  { icon: FileText,   txt: "Alertas de vencimento de CR, CRAF, GTE e documentos" },
  { icon: ShieldCheck,txt: "Análise de Alvo e Recarga de Munições (em breve)" },
];

const BLANK_CARD = { holderName: "", number: "", expiryMonth: "", expiryYear: "", ccv: "" };

type Forma = "CREDIT_CARD" | "PIX" | "BOLETO";

interface CardVerificado {
  verificacao_id: string;
  card_token: string;
  brand: string | null;
  last4: string;
  holder: string;
  expiry: string;
}

interface Props {
  arsenal: ArsenalPremiumState;
  children: React.ReactNode;
  recurso?: string;
}

export default function ArsenalPremiumGate({ arsenal, children, recurso }: Props) {
  const { plano, valorParcela } = useArsenalPlano();

  // Passo: "card" → formulário de cartão; "subscription" → forma de pgto; "done" → concluído
  const [step, setStep] = useState<"card" | "subscription" | "done">("card");
  const [cardVerificado, setCardVerificado] = useState<CardVerificado | null>(null);
  const [replacingCard, setReplacingCard]   = useState(false);

  const [cardForm, setCardForm] = useState(BLANK_CARD);
  const [verifying, setVerifying] = useState(false);

  const [forma, setForma]   = useState<Forma>("CREDIT_CARD");
  const [aceite, setAceite] = useState(false);
  const [busy, setBusy]     = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  // Se já tem cartão salvo, pula o step de cartão
  const temCartaoSalvo = !!arsenal.assinatura && !!(arsenal.assinatura as any).asaas_credit_card_last4;

  if (arsenal.loading || arsenal.liberado) return <>{children}</>;

  const pendente = arsenal.assinatura?.status === "aguardando_pagamento" ? arsenal.assinatura : null;

  function setC(k: keyof typeof BLANK_CARD, v: string) {
    setCardForm(prev => ({ ...prev, [k]: v }));
  }

  // ── Passo 1: verificar cartão ───────────────────────────────────────────────
  async function verificarCartao(e: React.FormEvent) {
    e.preventDefault();
    if (verifying) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-arsenal-cartao", {
        body: { action: "verificar", ...cardForm },
      });
      if (error) throw new Error(error.message || "Falha na verificação");
      if ((data as any)?.error) throw new Error((data as any).detalhe || String((data as any).error));
      const d = data as any;
      setCardVerificado({
        verificacao_id: d.verificacao_id,
        card_token:     d.card_token,
        brand:          d.brand,
        last4:          d.last4,
        holder:         d.holder,
        expiry:         d.expiry,
      });
      setReplacingCard(false);
      setStep("subscription");
      toast.success(`Cartão ${d.brand || ""} •••• ${d.last4} verificado. Cobrança de R$0,01 gerada.`);
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível verificar o cartão.");
    } finally {
      setVerifying(false);
    }
  }

  // ── Passo 2: assinar ────────────────────────────────────────────────────────
  async function assinar() {
    if (!aceite) { toast.error("É preciso aceitar o termo de adesão."); return; }
    setBusy(true);
    try {
      const body: Record<string, unknown> = { forma, aceite: true };
      // Passa dados do cartão recém-verificado, se houver
      if (cardVerificado) {
        body.verificacao_id = cardVerificado.verificacao_id;
        body.card_token     = cardVerificado.card_token;
        body.card_brand     = cardVerificado.brand;
        body.card_last4     = cardVerificado.last4;
        body.card_holder    = cardVerificado.holder;
        body.card_expiry    = cardVerificado.expiry;
      }
      const { data, error } = await supabase.functions.invoke("qa-arsenal-assinar", { body });
      if (error) throw new Error(error.message || "Falha na adesão");
      if ((data as any)?.error) throw new Error(String((data as any).error));
      setResultado(data);
      if ((data as any)?.modo === "gratuidade") {
        toast.success(`Arsenal Premium ativado — ${(data as any).meses_gratis} mês(es) grátis!`);
        arsenal.refresh();
      } else if ((data as any)?.invoice_url && forma !== "PIX") {
        window.open((data as any).invoice_url, "_blank", "noopener");
      }
    } catch (e: any) {
      // Se o servidor pediu cartão, volta para o passo de cartão
      if ((e?.message || "").includes("cartao_obrigatorio")) {
        setStep("card");
        toast.error("É necessário adicionar um cartão para continuar.");
      } else {
        toast.error(e?.message || "Não foi possível concluir a adesão.");
      }
    } finally {
      setBusy(false);
    }
  }

  const TERMO_RESUMO =
    `Assinatura anual de R$ ${plano.valor_anual.toFixed(2).replace(".", ",")} com renovação automática. ` +
    "Cancelamento mediante chamado à equipe com 30 dias de aviso prévio. " +
    "Direito de arrependimento em 7 dias com reembolso integral (art. 49, CDC). " +
    "Após o vencimento, 3 dias de carência antes da suspensão do acesso Premium.";

  // Cartão verificado a exibir (da sessão atual OU já salvo na assinatura)
  const ccDisplay = cardVerificado
    ? { brand: cardVerificado.brand || "CARTÃO", last4: cardVerificado.last4 }
    : temCartaoSalvo
      ? { brand: (arsenal.assinatura as any).asaas_credit_card_brand || "CARTÃO", last4: (arsenal.assinatura as any).asaas_credit_card_last4 }
      : null;

  // Se tem cartão salvo e não está trocando, pula o formulário de cartão
  const showCardForm = !ccDisplay || replacingCard;
  const effectiveStep = (ccDisplay && !replacingCard && step === "card") ? "subscription" : step;

  return (
    <div className="qagate">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="qagate__dim" aria-hidden>{children}</div>

      <div className="qagate__cta">
        <div className="qagate__kicker"><Lock size={13} /> Arsenal Inteligente · Premium</div>
        <h2>{recurso ? `Desbloqueie: ${recurso}` : "Desbloqueie o Arsenal completo"}</h2>
        <p className="qagate__lead">
          {arsenal.assinatura?.status === "suspensa"
            ? "Sua assinatura está suspensa. Renove para reativar o acesso na hora."
            : "Assine o Arsenal Inteligente Premium e tenha controle total do seu acervo, prazos e documentação."}
        </p>

        <div className="qagate__bens">
          {BENEFICIOS.map((b, i) => (
            <div key={i} className="qagate__ben"><b.icon /> <span>{b.txt}</span></div>
          ))}
        </div>

        {/* Indicador de passos */}
        {!resultado && (
          <div className="qagate__steps">
            <span className={effectiveStep === "card" || showCardForm ? "active" : ""}>
              <CreditCard size={11} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />
              Cartão
            </span>
            <span className="sep">›</span>
            <span className={effectiveStep === "subscription" && !showCardForm ? "active" : ""}>Adesão</span>
          </div>
        )}

        {/* ── RESULTADO FINAL ─────────────────────────────────────────────── */}
        {resultado?.modo === "gratuidade" ? (
          <div className="qagate__ok">
            <Check size={14} style={{ verticalAlign: "-2px" }} /> Pronto! Seu período gratuito de{" "}
            <b>{resultado.meses_gratis} mês(es)</b> está ativo até{" "}
            <b>{String(resultado.periodo_fim).split("-").reverse().join("/")}</b>.
            {resultado.card_brand && <> Cartão {resultado.card_brand} •••• {resultado.card_last4} salvo para renovação.</>}
          </div>
        ) : resultado?.modo === "cobranca" || resultado?.modo === "cobranca_pendente" ? (
          <div>
            {resultado.pix_payload ? (
              <>
                {resultado.pix_encoded_image && (
                  <img className="qagate__qr" src={`data:image/png;base64,${resultado.pix_encoded_image}`} alt="QR Code PIX" />
                )}
                <div className="qagate__copy">{resultado.pix_payload}</div>
                <button className="qagate__btn" style={{ marginTop: 10 }}
                  onClick={() => { navigator.clipboard.writeText(resultado.pix_payload); toast.success("Código PIX copiado"); }}>
                  Copiar código PIX
                </button>
              </>
            ) : resultado.invoice_url ? (
              <a className="qagate__btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}
                href={resultado.invoice_url} target="_blank" rel="noreferrer">
                Abrir fatura para pagamento
              </a>
            ) : null}
            <p className="qagate__lead" style={{ marginTop: 12 }}>
              Assim que o pagamento for confirmado, o acesso Premium é liberado automaticamente.
            </p>
          </div>
        ) : (
          <>
            {/* ── PASSO 1: CARTÃO ──────────────────────────────────────────── */}
            <div className={`qagate__card-box${ccDisplay && !replacingCard ? " verified" : ""}`}>
              <div className="qagate__card-head">
                <h3>
                  <CreditCard size={11} style={{ display: "inline", verticalAlign: "-1px", marginRight: 5 }} />
                  Método de pagamento
                </h3>
                {!ccDisplay && <span className="required">OBRIGATÓRIO</span>}
                {ccDisplay && !replacingCard && (
                  <button className="qagate__change-btn" onClick={() => { setReplacingCard(true); setCardForm(BLANK_CARD); }}>
                    Trocar cartão
                  </button>
                )}
              </div>

              {ccDisplay && !replacingCard ? (
                <div>
                  <div className="qagate__verified-badge">
                    <Check size={15} />
                    {ccDisplay.brand} •••• {ccDisplay.last4}
                  </div>
                  <div className="qagate__verified-sub">
                    Cartão verificado — {cardVerificado ? "cobrança de R$0,01 gerada" : "já cadastrado no sistema"}
                  </div>
                </div>
              ) : (
                <form onSubmit={verificarCartao}>
                  {replacingCard && (
                    <p style={{ fontFamily: "Arial", fontSize: 12, color: "#4a4a4a", marginBottom: 12, marginTop: 0 }}>
                      O cartão atual ({ccDisplay?.brand} •••• {ccDisplay?.last4}) continuará ativo até que o novo seja verificado.
                    </p>
                  )}
                  {!replacingCard && (
                    <p style={{ fontFamily: "Arial", fontSize: 12, color: "#4a4a4a", marginBottom: 12, marginTop: 0 }}>
                      Adicione um cartão de crédito para ativar o Arsenal. Será feita uma cobrança de <b>R$0,01</b> para verificar que o cartão está ativo — esse valor aparecerá na sua fatura mas <b>não é cobrado do plano</b>.
                    </p>
                  )}
                  <div className="qagate__row">
                    <div>
                      <span className="qagate__label">Nome no cartão</span>
                      <input className="qagate__input" placeholder="Como impresso no cartão"
                        value={cardForm.holderName}
                        onChange={e => setC("holderName", e.target.value.toUpperCase())}
                        required autoComplete="cc-name" />
                    </div>
                  </div>
                  <div className="qagate__row">
                    <div>
                      <span className="qagate__label">Número do cartão</span>
                      <input className="qagate__input" placeholder="0000 0000 0000 0000"
                        value={cardForm.number} maxLength={19}
                        onChange={e => setC("number", e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim())}
                        required autoComplete="cc-number" inputMode="numeric" />
                    </div>
                  </div>
                  <div className="qagate__row cols-3">
                    <div>
                      <span className="qagate__label">Mês</span>
                      <input className="qagate__input" placeholder="MM" maxLength={2}
                        value={cardForm.expiryMonth}
                        onChange={e => setC("expiryMonth", e.target.value.replace(/\D/g, ""))}
                        required autoComplete="cc-exp-month" inputMode="numeric" />
                    </div>
                    <div>
                      <span className="qagate__label">Ano</span>
                      <input className="qagate__input" placeholder="AAAA" maxLength={4}
                        value={cardForm.expiryYear}
                        onChange={e => setC("expiryYear", e.target.value.replace(/\D/g, ""))}
                        required autoComplete="cc-exp-year" inputMode="numeric" />
                    </div>
                    <div>
                      <span className="qagate__label">CVV</span>
                      <input className="qagate__input" placeholder="000" maxLength={4}
                        value={cardForm.ccv}
                        onChange={e => setC("ccv", e.target.value.replace(/\D/g, ""))}
                        required autoComplete="cc-csc" inputMode="numeric" />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    {replacingCard && (
                      <button type="button" className="qagate__btn secondary"
                        style={{ flex: 1 }} onClick={() => { setReplacingCard(false); setCardForm(BLANK_CARD); }}>
                        Cancelar
                      </button>
                    )}
                    <button type="submit" className="qagate__btn" style={{ flex: 2 }} disabled={verifying}>
                      {verifying ? "Verificando…" : "Verificar cartão"}
                    </button>
                  </div>
                  <div className="qagate__note">
                    Seus dados são enviados à Asaas (PCI-DSS nível 1) — não armazenamos o número completo do cartão.
                    O cartão fica salvo no sistema e pode ser substituído a qualquer momento; para removê-lo, abra um chamado com nossa equipe.
                  </div>
                </form>
              )}
            </div>

            {/* ── PASSO 2: ADESÃO ─────────────────────────────────────────── */}
            {(ccDisplay && !replacingCard) && (
              <>
                {pendente?.asaas_invoice_url && (
                  <div className="qagate__pend">
                    Você já tem uma adesão aguardando pagamento.{" "}
                    <a href={pendente.asaas_invoice_url} target="_blank" rel="noreferrer" style={{ color: "#7A1F2B", fontWeight: 700 }}>
                      Abrir fatura pendente
                    </a>{" "}
                    — ou gere uma nova cobrança abaixo.
                  </div>
                )}

                <div className="qagate__price">
                  <span className="v">R$ {plano.valor_anual}<span style={{ fontSize: 14 }}>/ano</span></span>
                  <span className="s">{plano.parcelas_max}x de R$ {valorParcela.toFixed(2).replace(".", ",")} no cartão · ou à vista no PIX/boleto</span>
                </div>

                <div className="qagate__formas">
                  {(["CREDIT_CARD", "PIX", "BOLETO"] as Forma[]).map(f => (
                    <button key={f} className={`qagate__forma ${forma === f ? "on" : ""}`} onClick={() => setForma(f)}>
                      {f === "CREDIT_CARD" ? `Cartão ${plano.parcelas_max}x` : f === "PIX" ? "PIX" : "Boleto"}
                    </button>
                  ))}
                </div>

                {(forma === "PIX" || forma === "BOLETO") && (
                  <div className="qagate__pix-note">
                    Você optou por pagar via <b>{forma === "PIX" ? "PIX" : "Boleto"}</b>.
                    O cartão verificado acima <b>não será cobrado agora</b> — fica salvo apenas para renovação automática ao final do período.
                  </div>
                )}

                <label className="qagate__aceite">
                  <input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} />
                  <span>
                    Li e aceito o <b>Termo de Adesão do Arsenal Inteligente Premium</b>: {TERMO_RESUMO}
                  </span>
                </label>

                <button className="qagate__btn" disabled={busy || !aceite} onClick={assinar}>
                  {busy ? "Processando…" : "Assinar Arsenal Premium"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
