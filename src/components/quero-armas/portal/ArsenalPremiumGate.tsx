// Gate do Arsenal Inteligente Premium.
// Com assinatura liberada, renderiza a seção normalmente. Sem assinatura
// (ou suspensa/vencida), a seção fica esmaecida ao fundo e um cartão de
// adesão assume a tela: benefícios, preço (R$ 297/ano — 12x de R$ 24,75 no
// cartão ou PIX/boleto à vista), aceite do termo e chamada à edge function
// qa-arsenal-assinar. PIX renderiza QR/copia-e-cola inline; cartão e boleto
// abrem a fatura da Asaas (migra para cobrança inline quando a tokenização
// de cartão estiver disponível).

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Crosshair, FileText, Lock, ShieldCheck, Sparkles } from "lucide-react";
import type { ArsenalPremiumState } from "@/hooks/useArsenalPremium";

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
.qagate__price{display:flex;align-items:baseline;gap:10px;border:1px dashed #e3e0d8;background:#faf9f5;border-radius:8px;padding:12px 16px;margin-bottom:16px}
.qagate__price .v{font-family:Oswald,sans-serif;font-size:28px;font-weight:600;color:#7A1F2B}
.qagate__price .s{font-family:Arial,sans-serif;font-size:12px;color:#6a6a6a}
.qagate__formas{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.qagate__forma{padding:10px 16px;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;border:1px solid #e3e0d8;background:#fff;color:#141414;border-radius:8px;cursor:pointer}
.qagate__forma.on{background:#7A1F2B;color:#fff;border-color:#7A1F2B}
.qagate__aceite{display:flex;gap:10px;align-items:flex-start;font-family:Arial,sans-serif;font-size:12px;color:#4a4a4a;line-height:1.45;margin-bottom:16px}
.qagate__aceite input{margin-top:2px}
.qagate__btn{width:100%;padding:13px;background:#7A1F2B;color:#fff;border:0;border-radius:8px;font-family:Oswald,sans-serif;font-size:13px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;cursor:pointer}
.qagate__btn:disabled{opacity:.5;cursor:not-allowed}
.qagate__copy{font-family:'Courier New',monospace;font-size:10.5px;background:#faf9f5;border:1px dashed #e3e0d8;padding:10px;border-radius:6px;word-break:break-all;line-height:1.5;margin-top:10px}
.qagate__qr{width:150px;height:150px;border:1px solid #e3e0d8;border-radius:6px;background:#fff;object-fit:contain;display:block;margin:12px auto 4px}
.qagate__ok{border:1px solid #dcecdf;background:#f4faf5;border-radius:8px;padding:14px 16px;font-family:Arial,sans-serif;font-size:13px;color:#1f4d2b;line-height:1.5}
.qagate__pend{border:1px solid #fbeed3;background:#fffdf6;border-radius:8px;padding:12px 14px;font-family:Arial,sans-serif;font-size:12px;color:#7a5410;line-height:1.5;margin-bottom:12px}
@media(max-width:720px){.qagate__bens{grid-template-columns:1fr}.qagate__cta{margin-top:-300px;padding:20px}}
`;

const BENEFICIOS = [
  { icon: Sparkles, txt: "Klal — assistente jurídico exclusivo, disponível 24h" },
  { icon: Crosshair, txt: "Gestão completa de armas, munições e habitualidade" },
  { icon: FileText, txt: "Alertas de vencimento de CR, CRAF, GTE e documentos" },
  { icon: ShieldCheck, txt: "Análise de Alvo e Recarga de Munições (em breve)" },
];

const TERMO_RESUMO =
  "Assinatura anual de R$ 297,00 com renovação automática. Cancelamento mediante " +
  "chamado à equipe com 30 dias de aviso prévio; sem o aviso, cobra-se pro-rata do mês em uso. " +
  "Direito de arrependimento em 7 dias com reembolso integral (art. 49, CDC). " +
  "Após o vencimento, 3 dias de carência antes da suspensão do acesso Premium. " +
  "O acompanhamento de processos contratados independe da assinatura.";

interface Props {
  arsenal: ArsenalPremiumState;
  children: React.ReactNode;
  /** nome da funcionalidade bloqueada, para o título do CTA */
  recurso?: string;
}

type Forma = "CREDIT_CARD" | "PIX" | "BOLETO";

export default function ArsenalPremiumGate({ arsenal, children, recurso }: Props) {
  const [forma, setForma] = useState<Forma>("CREDIT_CARD");
  const [aceite, setAceite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  // Enquanto carrega, não pisca o CTA em cima de quem tem assinatura.
  if (arsenal.loading || arsenal.liberado) return <>{children}</>;

  const pendente = arsenal.assinatura?.status === "aguardando_pagamento"
    ? arsenal.assinatura
    : null;

  async function assinar() {
    if (!aceite) { toast.error("É preciso aceitar o termo de adesão."); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-arsenal-assinar", {
        body: { forma, aceite: true },
      });
      if (error) throw new Error(error.message || "Falha na adesão");
      if (data?.error) throw new Error(String(data.error));
      setResultado(data);
      if (data?.modo === "gratuidade") {
        toast.success(`Arsenal Premium ativado — ${data.meses_gratis} mês(es) grátis!`);
        arsenal.refresh();
      } else if (data?.invoice_url && forma !== "PIX") {
        window.open(data.invoice_url, "_blank", "noopener");
      }
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível concluir a adesão.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="qagate">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="qagate__dim" aria-hidden>{children}</div>

      <div className="qagate__cta">
        <div className="qagate__kicker"><Lock size={13} /> Arsenal Inteligente · Premium</div>
        <h2>{recurso ? `Desbloqueie: ${recurso}` : "Desbloqueie o Arsenal completo"}</h2>
        <p className="qagate__lead">
          {arsenal.assinatura?.status === "suspensa"
            ? "Sua assinatura está suspensa por falta de pagamento. Renove para reativar o acesso na hora — o acompanhamento dos seus processos contratados segue garantido."
            : "Assine o Arsenal Inteligente Premium e tenha o controle total do seu acervo, prazos e documentação — com o Klal ao seu lado."}
        </p>

        <div className="qagate__bens">
          {BENEFICIOS.map((b, i) => (
            <div key={i} className="qagate__ben"><b.icon /> <span>{b.txt}</span></div>
          ))}
        </div>

        {resultado?.modo === "gratuidade" ? (
          <div className="qagate__ok">
            <Check size={14} style={{ verticalAlign: "-2px" }} /> Pronto! Seu período gratuito de{" "}
            <b>{resultado.meses_gratis} mês(es)</b> está ativo até{" "}
            <b>{String(resultado.periodo_fim).split("-").reverse().join("/")}</b>. Aproveite o Arsenal completo.
          </div>
        ) : resultado?.modo === "cobranca" || resultado?.modo === "cobranca_pendente" ? (
          <div>
            {resultado.pix_payload ? (
              <>
                {resultado.pix_encoded_image && (
                  <img className="qagate__qr" src={`data:image/png;base64,${resultado.pix_encoded_image}`} alt="QR Code PIX" />
                )}
                <div className="qagate__copy">{resultado.pix_payload}</div>
                <button
                  className="qagate__btn"
                  style={{ marginTop: 10 }}
                  onClick={() => { navigator.clipboard.writeText(resultado.pix_payload); toast.success("Código PIX copiado"); }}
                >
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
              <span className="v">R$ 297<span style={{ fontSize: 14 }}>/ano</span></span>
              <span className="s">12x de R$ 24,75 no cartão · ou à vista no PIX/boleto</span>
            </div>

            <div className="qagate__formas">
              {(["CREDIT_CARD", "PIX", "BOLETO"] as Forma[]).map((f) => (
                <button key={f} className={`qagate__forma ${forma === f ? "on" : ""}`} onClick={() => setForma(f)}>
                  {f === "CREDIT_CARD" ? "Cartão 12x" : f === "PIX" ? "PIX" : "Boleto"}
                </button>
              ))}
            </div>

            <label className="qagate__aceite">
              <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
              <span>
                Li e aceito o <b>Termo de Adesão do Arsenal Inteligente Premium</b>: {TERMO_RESUMO}
              </span>
            </label>

            <button className="qagate__btn" disabled={busy || !aceite} onClick={assinar}>
              {busy ? "Processando…" : "Assinar Arsenal Premium"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
