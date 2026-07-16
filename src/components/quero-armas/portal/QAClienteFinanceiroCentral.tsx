// Central Financeira do Cliente — implantação do mockup "Financeiro 75"
// (recorrência + cobrança expandida boleto). Layout preto/vermelho bordô
// sobre papel #f6f5f1, Oswald + Arial Narrow. NENHUM botão preto.
//
// Dados 100% reais (nenhum mock inventado):
//   • Cobranças em aberto / concluídas → vendas do cliente (props `vendas`).
//   • Boleto / PIX inline → edge function qa-cliente-cobranca-inline
//     (chama Asaas em tempo real; identificationField + pixQrCode).
//   • NF-e → fiscal_documents.asaas_invoice_id = venda.asaas_payment_id.
//   • Assinatura Premium (Arsenal) → só renderiza quando `premium != null`.
//     Hoje sempre null (o plano ainda não existe); o bloco fica pronto para
//     receber o dado quando a equipe modelar.
//   • Banner "Próxima ação" foi ocultado por decisão explícita do cliente.

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calcularPrecoFinal } from "@/lib/checkoutPricing";

// ─── Tokens (papel, tinta, bordô) ────────────────────────────────────────────
const CSS = `
.qafin-central{--paper:#f6f5f1;--ink:#141414;--ink-soft:#4a4a4a;--line:#e3e0d8;
  --bordo:#7A1F2B;--bordo-soft:#f4e6e8;--amber:#a8741a;--danger:#8a1414;
  --ok:#1f4d2b;--card:#fff;background:var(--paper);color:var(--ink);
  font-family:'Arial Narrow',Arial,sans-serif;padding:4px 0 24px}
.qafin-central .eyebrow{font-family:Oswald,sans-serif;font-size:11px;
  letter-spacing:.22em;text-transform:uppercase;color:var(--bordo);font-weight:600}
.qafin-central h1.qatitle{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:24px;
  line-height:1.05;letter-spacing:.04em;font-weight:700;text-transform:uppercase;
  color:#0A0A0A;margin:0 0 14px}
.qafin-central .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0 22px}
.qafin-central .summary.cols-3{grid-template-columns:repeat(3,1fr)}
.qafin-central .sumcard{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.qafin-central .sumlabel{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.16em;
  text-transform:uppercase;color:var(--ink-soft);font-weight:600}
.qafin-central .sumval{font-family:Oswald,sans-serif;font-size:22px;font-weight:600;margin-top:4px;letter-spacing:.02em}
.qafin-central .sumval.danger{color:var(--danger)}
.qafin-central .sumval.amber{color:var(--amber)}
.qafin-central .sumval.ok{color:var(--ok)}
.qafin-central .sumsub{font-family:Arial;font-size:11px;color:var(--ink-soft);margin-top:2px}
.qafin-central .section{font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.22em;
  text-transform:uppercase;color:var(--ink-soft);font-weight:600;margin:22px 0 10px;
  display:flex;justify-content:space-between;align-items:center}
.qafin-central .section .cnt{background:#efece4;padding:2px 8px;border-radius:100px;font-size:10px;letter-spacing:.14em;color:var(--ink-soft)}
.qafin-central .charge{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--amber);
  border-radius:10px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:10px}
.qafin-central .charge.d{border-left-color:var(--danger)}
.qafin-central .charge.o{border-left-color:var(--ok);background:#fafaf7}
.qafin-central .charge .body{min-width:0;flex:1}
.qafin-central .charge .t{font-family:'Arial Narrow',Arial;font-size:15px;font-weight:700;line-height:1.25}
.qafin-central .charge .m{font-family:Arial;font-size:11.5px;color:var(--ink-soft);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qafin-central .charge .val{font-family:Oswald,sans-serif;font-size:22px;font-weight:600;text-align:right;min-width:110px}
.qafin-central .actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.qafin-central .btn{padding:7px 11px;font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.1em;
  text-transform:uppercase;font-weight:600;border:1px solid var(--line);background:#fff;color:var(--ink);
  border-radius:6px;cursor:pointer;white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.qafin-central .btn:disabled{opacity:.5;cursor:not-allowed}
.qafin-central .btn.pri{background:var(--bordo);color:#fff;border-color:var(--bordo)}
.qafin-central .btn.out{background:#fff;color:var(--bordo);border-color:var(--bordo)}
.qafin-central .btn.ghost{background:transparent;color:var(--ink-soft)}
.qafin-central .pill{font-family:Oswald,sans-serif;display:inline-block;padding:2px 8px;font-size:10px;
  letter-spacing:.14em;text-transform:uppercase;font-weight:600;border-radius:100px;background:#efece4;color:var(--ink-soft)}
.qafin-central .pill.wait{background:#fbeed3;color:#7a5410}
.qafin-central .pill.over{background:#fbeaea;color:var(--danger)}
.qafin-central .pill.paid{background:#dcecdf;color:var(--ok)}
.qafin-central .pill.rec{background:var(--bordo);color:#fff}
.qafin-central .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
.qafin-central .card h3{font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;
  font-weight:600;color:var(--ink-soft);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}
.qafin-central .cc-light{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;
  display:flex;justify-content:space-between;align-items:center;gap:14px}
.qafin-central .cc-light .brand{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.24em;color:var(--ink-soft)}
.qafin-central .cc-light .num{font-family:'Courier New',monospace;font-size:15px;letter-spacing:.12em;margin-top:6px}
.qafin-central .cc-light .sub{font-family:Arial;font-size:11px;color:var(--ink-soft);margin-top:4px}
.qafin-central .cc-light .flag{font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.16em;color:var(--bordo);font-weight:700}
.qafin-central .ptabs{display:flex;gap:4px;background:#faf9f5;border:1px solid var(--line);border-radius:8px;padding:4px;width:fit-content}
.qafin-central .ptab{padding:8px 16px;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.14em;
  text-transform:uppercase;font-weight:600;color:var(--ink-soft);border-radius:6px;cursor:pointer;background:transparent;border:0}
.qafin-central .ptab.on{background:var(--bordo);color:#fff}
.qafin-central .qr{width:120px;height:120px;border:1px solid var(--line);border-radius:6px;background:#fff;object-fit:contain}
.qafin-central .bar-code{height:56px;background:repeating-linear-gradient(90deg,#141414 0 2px,#fff 2px 4px,#141414 4px 5px,#fff 5px 9px);border-radius:4px}
.qafin-central .copy{font-family:'Courier New',monospace;font-size:10.5px;background:#faf9f5;
  border:1px dashed var(--line);padding:10px;border-radius:6px;word-break:break-all;color:var(--ink);line-height:1.5}
.qafin-central .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;background:#faf9f5;
  border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin-top:12px}
.qafin-central .meta>div{text-align:center}
.qafin-central .meta .k{font-family:Oswald,sans-serif;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft);font-weight:600}
.qafin-central .meta .v{font-family:'Arial Narrow',Arial;font-size:13px;font-weight:700;margin-top:3px}
.qafin-central .expanded{background:#fff;border:1px solid var(--line);border-left:4px solid var(--amber);border-radius:10px;padding:16px 18px;margin-bottom:10px}
.qafin-central .expanded.d{border-left-color:var(--danger)}
.qafin-central .expanded .head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:12px;border-bottom:1px dashed var(--line);margin-bottom:14px}
.qafin-central .expanded .head .t{font-family:'Arial Narrow',Arial;font-size:16px;font-weight:700}
.qafin-central .expanded .head .m{font-family:Arial;font-size:11.5px;color:var(--ink-soft);margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.qafin-central .expanded .head .val{font-family:Oswald,sans-serif;font-size:26px;font-weight:600;color:var(--ink);text-align:right}
.qafin-central .expanded .head .val small{display:block;font-size:10px;letter-spacing:.14em;color:var(--ink-soft);font-weight:600;text-transform:uppercase;margin-top:2px}
.qafin-central .paybody{display:grid;grid-template-columns:1fr auto;gap:22px;align-items:start;margin-top:14px}
.qafin-central .h4c{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft);font-weight:600;display:block;margin-bottom:8px}
.qafin-central .empty{background:#fff;border:1px dashed var(--line);border-radius:10px;padding:24px;text-align:center;color:var(--ink-soft);font-family:Arial;font-size:13px}
.qafin-central .cc-form{background:#faf9f5;border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin-top:14px}
.qafin-central .cc-form h4{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-soft);font-weight:600;margin-bottom:12px}
.qafin-central .cc-form .row{display:grid;gap:10px;margin-bottom:10px}
.qafin-central .cc-form .row.cols-2{grid-template-columns:1fr 1fr}
.qafin-central .cc-form .row.cols-3{grid-template-columns:2fr 1fr 1fr}
.qafin-central .cc-form label{font-family:Oswald,sans-serif;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft);font-weight:600;display:block;margin-bottom:4px}
.qafin-central .cc-form input{width:100%;padding:8px 10px;font-family:'Arial Narrow',Arial;font-size:13px;border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--ink);outline:none;box-sizing:border-box}
.qafin-central .cc-form input:focus{border-color:var(--bordo)}
.qafin-central .cc-form .actions{display:flex;gap:8px;margin-top:14px}
@media(max-width:720px){.qafin-central .summary,.qafin-central .summary.cols-3{grid-template-columns:repeat(2,1fr)}
.qafin-central .charge,.qafin-central .expanded .head,.qafin-central .paybody{flex-direction:column;grid-template-columns:1fr}
.qafin-central .charge .val,.qafin-central .expanded .head .val{text-align:left}
.qafin-central .meta{grid-template-columns:repeat(2,1fr)}
.qafin-central .cc-form .row.cols-2,.qafin-central .cc-form .row.cols-3{grid-template-columns:1fr}}
`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QAVendaFinanceira {
  id: number;
  id_legado: number;
  cliente_id: number | null;
  status: string | null;
  cobranca_status: string | null;
  valor_a_pagar: number | null;
  data_cadastro: string | null;
  forma_pagamento: string | null;
  asaas_payment_id: string | null;
  asaas_invoice_url: string | null;
  asaas_bank_slip_url: string | null;
  asaas_pix_payload: string | null;
  asaas_due_date: string | null;
  cobranca_confirmada_em: string | null;
}

export interface QAVendaItemLite {
  venda_id: number | string;
  servico_id?: number | null;
  nome_servico?: string | null;
}

export interface QAArsenalPremiumSubscription {
  ativa: boolean;
  status?: "gratuidade" | "ativa" | "aguardando_pagamento" | "suspensa" | "cancelada" | null;
  forma_pagamento?: "CREDIT_CARD" | "PIX" | "BOLETO" | null;
  valor_mensal: number;      // em reais
  dia_cobranca: number;      // 1..31
  proxima_em: string | null; // ISO date
  /** Texto livre do plano (gratuidade, anual 12x…). Se ausente, usa a frase mensal padrão. */
  descricao?: string | null;
  cartao?: {
    bandeira: string;        // VISA, MASTER…
    ultimos4: string;
    titular: string;
    validade: string;        // MM/AA
  } | null;
}

interface Props {
  vendas: QAVendaFinanceira[];
  itens: QAVendaItemLite[];
  servicoNomePorId?: Record<number, string>;
  premium?: QAArsenalPremiumSubscription | null;
  onPremiumRefresh?: () => void;
  onRefresh?: () => void;
  scopeLabel?: string;
  clienteNome?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtBRLShort = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const parseISO = (s: string | null): Date | null => {
  if (!s) return null;
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  return isNaN(d.getTime()) ? null : d;
};
const fmtDatePt = (s: string | null) => {
  const d = parseISO(s); if (!d) return "—";
  return d.toLocaleDateString("pt-BR");
};
const diasAte = (s: string | null): number | null => {
  const d = parseISO(s); if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
};

const isPaga = (v: QAVendaFinanceira) =>
  String(v.status || "").toUpperCase() === "PAGO"
  || String(v.cobranca_status || "").toLowerCase() === "confirmada";

const isCancelada = (v: QAVendaFinanceira) => {
  const st = String(v.status || "").toUpperCase();
  const cb = String(v.cobranca_status || "").toLowerCase();
  return st === "CANCELADO" || st === "DESISTIU" || cb === "cancelada" || cb === "estornada";
};

async function copyToClipboard(text: string, label = "Copiado") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Não foi possível copiar");
  }
}

// Nome do serviço contratado (real; se não achar, cai no numero_processo ou id)
function servicoDaVenda(
  v: QAVendaFinanceira,
  itens: QAVendaItemLite[],
  nomePorId: Record<number, string>,
): string {
  const its = itens.filter(i => String(i.venda_id) === String(v.id_legado));
  const nomes = its
    .map(i => i.nome_servico || (i.servico_id ? nomePorId[i.servico_id] : null))
    .filter(Boolean) as string[];
  if (nomes.length) return nomes.map(titleCasePt).join(" · ");
  return "Serviço contratado";
}

// Title Case pt-BR: primeira letra de cada palavra maiúscula, exceto preposições/artigos curtos.
const MINUSCULAS_PT = new Set([
  "a","o","as","os","um","uma","uns","umas","de","do","da","dos","das",
  "e","em","no","na","nos","nas","para","por","pelo","pela","pelos","pelas",
  "com","sem","sob","sobre","ao","aos","à","às","ou","se","que"
]);
// Siglas do domínio de armas/documentação preservadas em caixa alta.
const SIGLAS_QA = new Set([
  "CR","CRAF","GTE","CAC","CPF","RG","DPF","PF","PM","PC","NF","NFE",
  "LAC","PPMB","SINARM","SIGMA","CRM","OAB","CNPJ","CEP","UFG",
]);
function titleCasePt(s: string): string {
  const origTokens = s.split(/(\s+)/);
  return origTokens.map((tok, i) => {
    if (/^\s+$/.test(tok)) return tok;
    const lower = tok.toLowerCase();
    // Preposições/artigos nunca ficam em maiúscula no meio da frase
    if (i > 0 && MINUSCULAS_PT.has(lower)) return lower;
    // Sigla conhecida ou ≤ 3 letras todas maiúsculas (ex.: CR, GTE)
    const isAcronym = SIGLAS_QA.has(tok) ||
      (tok.length <= 3 && /^[A-ZÀ-Ý]+$/.test(tok));
    if (isAcronym) return tok;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join("");
}

// Banco emissor a partir da linha digitável / código de barras do boleto.
// Os 3 primeiros dígitos do código de barras são o código COMPE do banco.
const BANCOS_COMPE: Record<string, string> = {
  "001": "Banco do Brasil",
  "033": "Santander",
  "041": "Banrisul",
  "070": "BRB",
  "077": "Inter",
  "104": "Caixa",
  "212": "Banco Original",
  "237": "Bradesco",
  "260": "Nubank",
  "290": "PagBank",
  "323": "Mercado Pago",
  "336": "C6 Bank",
  "341": "Itaú",
  "380": "PicPay",
  "422": "Safra",
  "748": "Sicredi",
  "756": "Sicoob",
};
function bancoEmissor(identificationField?: string | null, barCode?: string | null): string | null {
  const raw = String(identificationField || barCode || "").replace(/\D/g, "");
  if (raw.length < 3) return null;
  return BANCOS_COMPE[raw.slice(0, 3)] || null;
}

// ─── Cards ───────────────────────────────────────────────────────────────────

const BLANK_FORM = { holderName: "", number: "", expiryMonth: "", expiryYear: "", ccv: "" };

function PremiumCard({ premium, onRefresh }: { premium: QAArsenalPremiumSubscription; onRefresh?: () => void }) {
  const [showForm, setShowForm]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [vinculando, setVinculando]   = useState(false);
  const [form, setForm]               = useState(BLANK_FORM);
  const numRef = useRef<HTMLInputElement>(null);

  const cc  = premium.cartao;
  const st  = premium.status;
  const pagouCartao = premium.forma_pagamento === "CREDIT_CARD";
  const badgeCls   = st === "gratuidade" ? "pill paid" : st === "aguardando_pagamento" ? "pill wait" : st === "suspensa" ? "pill over" : "pill rec";
  const badgeLabel = st === "gratuidade" ? "GRATUIDADE" : st === "aguardando_pagamento" ? "PENDENTE" : st === "suspensa" ? "SUSPENSA" : "ANUAL";

  function setF(k: keyof typeof BLANK_FORM, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function vincularDoPagamento() {
    if (vinculando) return;
    setVinculando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-arsenal-cartao", {
        body: { action: "vincular_do_pagamento" },
      });
      if (error) throw new Error(error.message || "Falha ao vincular cartão");
      if ((data as any)?.error) throw new Error((data as any).detalhe || String((data as any).error));
      toast.success(`Cartão ${(data as any).brand || ""} •••• ${(data as any).last4} vinculado com sucesso.`);
      onRefresh?.();
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível vincular o cartão do pagamento.");
    } finally {
      setVinculando(false);
    }
  }

  async function salvarCartao(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-arsenal-cartao", {
        body: { action: "tokenizar", ...form },
      });
      if (error) throw new Error(error.message || "Falha ao salvar cartão");
      if ((data as any)?.error) throw new Error((data as any).detalhe || String((data as any).error));
      toast.success(`Cartão ${(data as any).brand || ""} •••• ${(data as any).last4} salvo com sucesso.`);
      setShowForm(false);
      setForm(BLANK_FORM);
      onRefresh?.();
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível salvar o cartão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ borderLeft: "4px solid var(--bordo)", marginBottom: 20 }}>
      <h3>
        <span>Arsenal Inteligente · Premium</span>
        <span className={badgeCls}>{badgeLabel}</span>
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "'Arial Narrow',Arial", fontSize: 15, fontWeight: 700 }}>
            {premium.ativa ? "Assinatura ativa" : "Assinatura pausada"}
          </div>
          <div style={{ fontFamily: "Arial", fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>
            {premium.descricao || (
              <>
                Cobrança automática de <b>{fmtBRL(premium.valor_mensal)}</b> todo dia {String(premium.dia_cobranca).padStart(2, "0")}
                {cc ? <>, direto no cartão {cc.bandeira} •••• {cc.ultimos4}</> : null}
                {premium.proxima_em ? <>. Próxima em <b>{fmtDatePt(premium.proxima_em)}</b>.</> : "."}
              </>
            )}
          </div>
        </div>

        {cc ? (
          <div className="cc-light">
            <div>
              <div className="brand">CARTÃO SALVO</div>
              <div className="num">•••• {cc.ultimos4}</div>
              <div className="sub">{cc.titular ? cc.titular.toUpperCase() : ""}{cc.validade ? ` · ${cc.validade}` : ""}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <div className="flag">{cc.bandeira.toUpperCase()}</div>
              <button className="btn ghost" style={{ fontSize: 10 }} onClick={() => setShowForm(v => !v)}>
                {showForm ? "CANCELAR" : "TROCAR"}
              </button>
            </div>
          </div>
        ) : (
          <div className="cc-light" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
            <div className="sub">Nenhum cartão salvo</div>
            {pagouCartao && (
              <button
                className="btn pri"
                style={{ fontSize: 10.5, width: "100%" }}
                disabled={vinculando}
                onClick={vincularDoPagamento}
              >
                {vinculando ? "VINCULANDO…" : "USAR CARTÃO DO PAGAMENTO"}
              </button>
            )}
            <button
              className="btn out"
              style={{ fontSize: 10.5, width: "100%" }}
              onClick={() => setShowForm(v => !v)}
            >
              {showForm ? "CANCELAR" : "DIGITAR NOVO CARTÃO"}
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <form className="cc-form" onSubmit={salvarCartao}>
          <h4>Dados do cartão de crédito</h4>
          <div className="row">
            <div>
              <label>Nome no cartão</label>
              <input
                placeholder="Como impresso no cartão"
                value={form.holderName}
                onChange={e => setF("holderName", e.target.value.toUpperCase())}
                required autoComplete="cc-name"
              />
            </div>
          </div>
          <div className="row">
            <div>
              <label>Número do cartão</label>
              <input
                ref={numRef}
                placeholder="0000 0000 0000 0000"
                value={form.number}
                maxLength={19}
                onChange={e => setF("number", e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim())}
                required autoComplete="cc-number" inputMode="numeric"
              />
            </div>
          </div>
          <div className="row cols-3">
            <div>
              <label>Mês</label>
              <input
                placeholder="MM"
                value={form.expiryMonth}
                maxLength={2}
                onChange={e => setF("expiryMonth", e.target.value.replace(/\D/g, ""))}
                required autoComplete="cc-exp-month" inputMode="numeric"
              />
            </div>
            <div>
              <label>Ano</label>
              <input
                placeholder="AAAA"
                value={form.expiryYear}
                maxLength={4}
                onChange={e => setF("expiryYear", e.target.value.replace(/\D/g, ""))}
                required autoComplete="cc-exp-year" inputMode="numeric"
              />
            </div>
            <div>
              <label>CVV</label>
              <input
                placeholder="000"
                value={form.ccv}
                maxLength={4}
                onChange={e => setF("ccv", e.target.value.replace(/\D/g, ""))}
                required autoComplete="cc-csc" inputMode="numeric"
              />
            </div>
          </div>
          <div className="actions">
            <button type="button" className="btn ghost" onClick={() => { setShowForm(false); setForm(BLANK_FORM); }}>
              CANCELAR
            </button>
            <button type="submit" className="btn pri" disabled={saving}>
              {saving ? "SALVANDO…" : "SALVAR CARTÃO"}
            </button>
          </div>
          <div style={{ fontFamily: "Arial", fontSize: 10.5, color: "var(--ink-soft)", marginTop: 10, lineHeight: 1.5 }}>
            Seus dados são enviados diretamente à Asaas (PCI-DSS nível 1) — a Quero Armas não armazena o número completo do cartão.
          </div>
        </form>
      )}
    </div>
  );
}

function KpiRow({
  emAbertoTotal, emAbertoQtd, vencidasTotal, vencidasQtd, pagasAnoTotal, pagasAnoQtd, ano, premium,
}: {
  emAbertoTotal: number; emAbertoQtd: number;
  vencidasTotal: number; vencidasQtd: number;
  pagasAnoTotal: number; pagasAnoQtd: number;
  ano: number;
  premium: QAArsenalPremiumSubscription | null | undefined;
}) {
  const cols = premium ? 4 : 3;
  return (
    <div className={`summary ${cols === 3 ? "cols-3" : ""}`}>
      <div className="sumcard">
        <div className="sumlabel">Em aberto</div>
        <div className={`sumval ${emAbertoTotal > 0 ? "amber" : ""}`}>{fmtBRLShort(emAbertoTotal)}</div>
        <div className="sumsub">{emAbertoQtd} {emAbertoQtd === 1 ? "cobrança" : "cobranças"}</div>
      </div>
      <div className="sumcard">
        <div className="sumlabel">Vencidas</div>
        <div className={`sumval ${vencidasTotal > 0 ? "danger" : ""}`}>{fmtBRLShort(vencidasTotal)}</div>
        <div className="sumsub">{vencidasQtd} {vencidasQtd === 1 ? "cobrança" : "cobranças"}</div>
      </div>
      <div className="sumcard">
        <div className="sumlabel">Pagas em {ano}</div>
        <div className={`sumval ${pagasAnoTotal > 0 ? "ok" : ""}`}>{fmtBRLShort(pagasAnoTotal)}</div>
        <div className="sumsub">{pagasAnoQtd} {pagasAnoQtd === 1 ? "cobrança" : "cobranças"}</div>
      </div>
      {premium && (
        <div className="sumcard">
          <div className="sumlabel">Assinatura Premium</div>
          {premium.status === "gratuidade" ? (
            <>
              <div className="sumval ok" style={{ fontSize: 16 }}>Gratuidade</div>
              <div className="sumsub">até {fmtDatePt(premium.proxima_em)}</div>
            </>
          ) : premium.status === "aguardando_pagamento" ? (
            <>
              <div className="sumval amber" style={{ fontSize: 16 }}>Pendente</div>
              <div className="sumsub">aguardando pagamento</div>
            </>
          ) : (
            <>
              <div className="sumval">
                {fmtBRLShort(Number(premium.valor_mensal) * 12)}
                <small style={{ fontFamily: "Oswald,sans-serif", fontSize: 12, color: "var(--ink-soft)" }}>/ano</small>
              </div>
              <div className="sumsub">anual {premium.cartao ? "· cartão" : ""}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Cobrança em aberto (colapsada / expandida) ─────────────────────────────

type CardForm = { holderName: string; number: string; expiryMonth: string; expiryYear: string; ccv: string };
const BLANK_CARD: CardForm = { holderName: "", number: "", expiryMonth: "", expiryYear: "", ccv: "" };

type Detalhe = {
  loading: boolean;
  error?: string | null;
  boleto?: { identificationField?: string | null; barCode?: string | null; nossoNumero?: string | null } | null;
  pix?: { payload?: string | null; encodedImage?: string | null } | null;
  bankSlipUrl?: string | null;
  invoiceUrl?: string | null;
  billingType?: string | null;
  boletoError?: string | null;
  cartaoInvoiceUrl?: string | null;
  cartaoCobrado?: { status: string; pago: boolean; valorTotal: number; valorParcela: number; parcelas: number } | null;
};

function CobrancaAberta({
  venda, servico, defaultMode, onExpand, expanded, mode, setMode, detalhe, onFetchMode, onReemitirBoleto, reemitindoBoleto, temNfe,
  selectedParcelas, onSelectParcelas, onCobrarCartao, onVerificarPagamento, verificandoPagamento, arsenalCartao,
}: {
  venda: QAVendaFinanceira;
  servico: string;
  defaultMode: "pix" | "boleto" | "cartao";
  onExpand: () => void;
  expanded: boolean;
  mode: "pix" | "boleto" | "cartao";
  setMode: (m: "pix" | "boleto" | "cartao") => void;
  detalhe: Detalhe | undefined;
  onFetchMode: (m: "pix" | "boleto") => void;
  onReemitirBoleto: () => void;
  reemitindoBoleto: boolean;
  temNfe: boolean;
  selectedParcelas?: number;
  onSelectParcelas: (n: number) => void;
  onCobrarCartao: (parcelas: number, card?: CardForm) => void;
  onVerificarPagamento: () => void;
  verificandoPagamento: boolean;
  arsenalCartao?: { ultimos4: string; bandeira: string } | null;
}) {
  const [cardForm, setCardForm] = useState<CardForm>(BLANK_CARD);
  const setC = (k: keyof CardForm, v: string) => setCardForm(prev => ({ ...prev, [k]: v }));

  const dias = diasAte(venda.asaas_due_date);
  const vencida = dias !== null && dias < 0;
  const lvl = vencida ? "d" : "";
  const pillCls = vencida ? "over" : "wait";
  const stLabel = vencida
    ? `VENCIDA HÁ ${Math.abs(dias!)} ${Math.abs(dias!) === 1 ? "DIA" : "DIAS"}`
    : "AGUARDANDO PAGAMENTO";
  const valor = Number(venda.valor_a_pagar || 0);
  const cobId = `#${venda.id_legado}`;
  const bancoDetectado = bancoEmissor(detalhe?.boleto?.identificationField, detalhe?.boleto?.barCode);
  const banco = bancoDetectado || "Asaas";

  // ─── COLAPSADO ─────────────────────────────────────
  if (!expanded) {
    return (
      <div className={`charge ${lvl}`}>
        <div className="body">
          <div className="t">{servico}</div>
          <div className="m">
            Cob. {cobId} · vence {fmtDatePt(venda.asaas_due_date)}
            {banco ? <> · <b style={{ color: "var(--ink)" }}>{banco}</b></> : null}
          </div>
          <div style={{ marginTop: 8 }}>
            <span className={`pill ${pillCls}`}>{stLabel}</span>
          </div>
        </div>
        <div className="val">{fmtBRL(valor)}</div>
        <div className="actions" style={{ flexDirection: "column", gap: 6, minWidth: 160 }}>
          <button className="btn pri" onClick={() => { setMode("pix"); onExpand(); onFetchMode("pix"); }}>PIX</button>
          <button className="btn out" onClick={() => { setMode("boleto"); onExpand(); onFetchMode("boleto"); }}>BOLETO</button>
          <button className="btn" onClick={() => { setMode("cartao"); onExpand(); }}>CARTÃO</button>
        </div>
      </div>
    );
  }

  // ─── EXPANDIDO ─────────────────────────────────────
  const pixPayload = detalhe?.pix?.payload || venda.asaas_pix_payload || null;
  const pixImg = detalhe?.pix?.encodedImage || null;
  const boletoLine = detalhe?.boleto?.identificationField || null;
  const boletoPdf = detalhe?.bankSlipUrl || venda.asaas_bank_slip_url || null;
  const invoiceUrl = detalhe?.invoiceUrl || venda.asaas_invoice_url || null;

  return (
    <div className={`expanded ${lvl}`}>
      <div className="head">
        <div>
          <div className="t">{servico}</div>
          <div className="m">
            Cob. {cobId} · <span className={`pill ${pillCls}`}>{stLabel}</span>
          </div>
        </div>
        <div className="val">{fmtBRL(valor)}<small>VENCE {fmtDatePt(venda.asaas_due_date)}</small></div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="ptabs">
          <button className={`ptab ${mode === "pix" ? "on" : ""}`} onClick={() => { setMode("pix"); onFetchMode("pix"); }}>PIX</button>
          <button className={`ptab ${mode === "boleto" ? "on" : ""}`} onClick={() => { setMode("boleto"); onFetchMode("boleto"); }}>BOLETO</button>
          <button className={`ptab ${mode === "cartao" ? "on" : ""}`} onClick={() => setMode("cartao")}>CARTÃO</button>
        </div>
        <button className="btn ghost" onClick={onExpand}>RECOLHER</button>
      </div>

      <div className="meta">
        <div><div className="k">Serviço contratado</div><div className="v">{servico}</div></div>
        <div><div className="k">Código Asaas</div><div className="v">{cobId}</div></div>
        <div><div className="k">Vencimento</div><div className="v">{fmtDatePt(venda.asaas_due_date)}</div></div>
        {banco ? (
          <div><div className="k">Banco emissor</div><div className="v">{banco}</div></div>
        ) : null}
      </div>

      <div style={{ marginTop: 14 }}>
        {mode === "pix" && (
          <div className="paybody">
            <div>
              <span className="h4c">Código PIX Copia e Cola</span>
              {detalhe?.loading && !pixPayload ? (
                <div className="copy">Buscando código PIX na Asaas…</div>
              ) : pixPayload ? (
                <div className="copy">{pixPayload}</div>
              ) : (
                <div className="copy">Não foi possível recuperar o código PIX. {detalhe?.error || ""}</div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button className="btn pri" disabled={!pixPayload} onClick={() => pixPayload && copyToClipboard(pixPayload, "Código PIX copiado")}>COPIAR CÓDIGO PIX</button>
                {invoiceUrl && <a className="btn out" href={invoiceUrl} target="_blank" rel="noreferrer">ABRIR NA ASAAS</a>}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              {pixImg ? (
                <img className="qr" src={`data:image/png;base64,${pixImg}`} alt="QR Code PIX" />
              ) : (
                <div className="qr" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)", fontFamily: "Oswald,sans-serif", fontSize: 10, letterSpacing: ".14em", padding: 8 }}>
                  {detalhe?.loading ? "GERANDO…" : "SEM QR"}
                </div>
              )}
              <div style={{ fontFamily: "Oswald,sans-serif", fontSize: 9.5, letterSpacing: ".14em", color: "var(--ink-soft)", marginTop: 6 }}>ESCANEIE PARA PAGAR</div>
            </div>
          </div>
        )}

        {mode === "boleto" && (
          <div>
            <span className="h4c">Linha digitável do boleto</span>
            <div style={{ fontFamily: "Arial", fontSize: 11, color: "var(--ink-soft)", marginBottom: 6 }}>
              Valor do boleto: <strong style={{ color: "var(--ink)" }}>{fmtBRL(calcularPrecoFinal(valor, "BOLETO").valorTotal)}</strong>
              <span style={{ marginLeft: 6, opacity: 0.7 }}>(+R$ 1,99 de taxa bancária)</span>
            </div>
            <div className="bar-code" style={{ marginBottom: 8 }} />
            {detalhe?.loading && !boletoLine ? (
              <div className="copy">{reemitindoBoleto ? "Reemitindo boleto na Asaas…" : "Buscando linha digitável na Asaas…"}</div>
            ) : boletoLine ? (
              <div className="copy">{boletoLine}</div>
            ) : detalhe?.billingType && detalhe.billingType !== "BOLETO" ? (
              <div className="copy">
                Esta cobrança não possui boleto: forma configurada na Asaas é <b>{detalhe.billingType}</b>.
                Use a aba <b>{detalhe.billingType === "PIX" ? "PIX" : "CARTÃO"}</b> acima.
              </div>
            ) : (
              <div className="copy">Não foi possível recuperar a linha digitável. {detalhe?.error || ""}</div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn pri" disabled={!boletoLine} onClick={() => boletoLine && copyToClipboard(boletoLine, "Linha digitável copiada")}>COPIAR LINHA DIGITÁVEL</button>
              {vencida && (
                <button
                  className="btn out"
                  disabled={reemitindoBoleto || !!detalhe?.loading}
                  onClick={onReemitirBoleto}
                >
                  {reemitindoBoleto ? "REEMITINDO…" : "REEMITIR BOLETO"}
                </button>
              )}
              {boletoPdf && <a className="btn" href={boletoPdf} target="_blank" rel="noreferrer">BAIXAR PDF</a>}
              {invoiceUrl && (
                <a className="btn" href={invoiceUrl} target="_blank" rel="noreferrer">
                  {banco ? `PAGAR NO APP DO ${banco.toUpperCase()}` : "ABRIR NA ASAAS"}
                </a>
              )}
            </div>
          </div>
        )}

        {mode === "cartao" && (() => {
          const MIN_PARCELA = 5;
          const OPCOES = [1, 2, 3, 4, 5, 6, 9, 12].filter(n => {
            const p = calcularPrecoFinal(valor, "CREDIT_CARD", n);
            return p.valorParcela >= MIN_PARCELA;
          });
          const selP = selectedParcelas ? calcularPrecoFinal(valor, "CREDIT_CARD", selectedParcelas) : null;
          const cobrado = detalhe?.cartaoCobrado ?? null;
          const iS = { fontFamily: "Arial, sans-serif", fontSize: 13, padding: "8px 10px", border: "1px solid #d0ccc4", borderRadius: 8, background: "#fff", width: "100%", outline: "none" };

          return (
            <div>
              <span className="h4c">Cartão de crédito</span>

              {/* ── Cartão Arsenal salvo ──────────────────────────────── */}
              {arsenalCartao ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "#F8F5F0", border: "1px solid #e0d8cc", marginBottom: 14 }}>
                  <span style={{ fontSize: 20 }}>💳</span>
                  <div>
                    <div style={{ fontFamily: "Oswald,sans-serif", fontSize: 11, letterSpacing: ".06em", color: "var(--ink-soft)" }}>CARTÃO ARSENAL SALVO</div>
                    <div style={{ fontFamily: "'Arial Narrow',Arial", fontSize: 14, fontWeight: 700 }}>
                      {arsenalCartao.bandeira} •••• {arsenalCartao.ultimos4}
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Formulário de cartão inline ─────────────────────── */
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  <input
                    type="text"
                    placeholder="Nome no cartão"
                    maxLength={60}
                    style={iS}
                    value={cardForm.holderName}
                    onChange={e => setC("holderName", e.target.value.toUpperCase())}
                    autoComplete="cc-name"
                  />
                  <input
                    type="text"
                    placeholder="Número do cartão"
                    maxLength={19}
                    inputMode="numeric"
                    style={iS}
                    value={cardForm.number.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim()}
                    onChange={e => setC("number", e.target.value.replace(/\D/g, "").slice(0, 16))}
                    autoComplete="cc-number"
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Mês (MM)"
                      maxLength={2}
                      inputMode="numeric"
                      style={{ ...iS, flex: 1 }}
                      value={cardForm.expiryMonth}
                      onChange={e => setC("expiryMonth", e.target.value.replace(/\D/g, "").slice(0, 2))}
                      autoComplete="cc-exp-month"
                    />
                    <input
                      type="text"
                      placeholder="Ano (AAAA)"
                      maxLength={4}
                      inputMode="numeric"
                      style={{ ...iS, flex: 1 }}
                      value={cardForm.expiryYear}
                      onChange={e => setC("expiryYear", e.target.value.replace(/\D/g, "").slice(0, 4))}
                      autoComplete="cc-exp-year"
                    />
                    <input
                      type="text"
                      placeholder="CVV"
                      maxLength={4}
                      inputMode="numeric"
                      style={{ ...iS, flex: 1 }}
                      value={cardForm.ccv}
                      onChange={e => setC("ccv", e.target.value.replace(/\D/g, "").slice(0, 4))}
                      autoComplete="cc-csc"
                    />
                  </div>
                </div>
              )}

              {/* ── Seleção de parcelas ───────────────────────────────── */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", gap: 8, marginBottom: 14 }}>
                {OPCOES.map(n => {
                  const p = calcularPrecoFinal(valor, "CREDIT_CARD", n);
                  return (
                    <button
                      key={n}
                      className={`btn${selectedParcelas === n ? " pri" : ""}`}
                      style={{ justifyContent: "space-between", padding: "10px 14px" }}
                      onClick={() => onSelectParcelas(n)}
                    >
                      <span style={{ fontFamily: "Oswald,sans-serif", fontSize: 11, letterSpacing: ".1em" }}>
                        {n === 1 ? "À VISTA" : `${n}×`}
                      </span>
                      <span style={{ fontFamily: "'Arial Narrow',Arial", fontWeight: 700, fontSize: 14 }}>
                        {fmtBRL(p.valorParcela)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* ── Estado após cobrança ──────────────────────────────── */}
              {cobrado ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px", borderRadius: 10, background: cobrado.pago ? "#F0FDF4" : "#FEF9C3", border: `1.5px solid ${cobrado.pago ? "#86EFAC" : "#FDE047"}` }}>
                    <span style={{ fontSize: 17, lineHeight: 1, marginTop: 1 }}>{cobrado.pago ? "✅" : "⏳"}</span>
                    <div>
                      <div style={{ fontFamily: "Oswald,sans-serif", fontSize: 11.5, fontWeight: 700, letterSpacing: ".06em", color: cobrado.pago ? "#15803D" : "#92400E", marginBottom: 2 }}>
                        {cobrado.pago ? "PAGAMENTO CONFIRMADO" : `COBRANÇA ENVIADA EM ${cobrado.parcelas}×`}
                      </div>
                      <div style={{ fontFamily: "Arial", fontSize: 11.5, color: cobrado.pago ? "#166534" : "#92400E", lineHeight: 1.45 }}>
                        {cobrado.pago
                          ? `${fmtBRL(cobrado.valorTotal)} confirmado — esta tela será atualizada em instantes.`
                          : `${fmtBRL(cobrado.valorParcela)}/mês · total ${fmtBRL(cobrado.valorTotal)}. A Asaas processa em alguns instantes.`}
                      </div>
                    </div>
                  </div>
                  {!cobrado.pago && (
                    <button
                      className="btn out"
                      style={{ padding: "9px 16px", fontSize: 12 }}
                      disabled={verificandoPagamento}
                      onClick={onVerificarPagamento}
                    >
                      {verificandoPagamento ? "VERIFICANDO…" : "Já processou — verificar confirmação"}
                    </button>
                  )}
                </div>
              ) : selP ? (
                /* ── Botão de pagar ──────────────────────────────────── */
                <>
                  <button
                    className="btn pri"
                    style={{ width: "100%", padding: "11px 16px" }}
                    disabled={!!detalhe?.loading}
                    onClick={() => {
                      if (arsenalCartao) {
                        onCobrarCartao(selectedParcelas!);
                      } else {
                        onCobrarCartao(selectedParcelas!, cardForm);
                      }
                    }}
                  >
                    {detalhe?.loading
                      ? "PROCESSANDO…"
                      : selectedParcelas === 1
                        ? `PAGAR À VISTA — ${fmtBRL(selP.valorTotal)}`
                        : `PAGAR EM ${selectedParcelas}× — ${fmtBRL(selP.valorParcela)}/MÊS`}
                  </button>
                  {selP.parcelas > 1 && (
                    <div style={{ fontFamily: "Arial", fontSize: 10.5, color: "var(--ink-soft)", marginTop: 6 }}>
                      Total: {fmtBRL(selP.valorTotal)} · inclui MDR + antecipação Asaas.
                      PIX sem acréscimo: {fmtBRL(valor)}.
                    </div>
                  )}
                  <div style={{ fontFamily: "Arial", fontSize: 10.5, color: "var(--ink-soft)", marginTop: 4, lineHeight: 1.5 }}>
                    Checkout PCI-DSS nível 1 via Asaas — sem redirect.
                  </div>
                </>
              ) : (
                <p style={{ fontFamily: "Arial", fontSize: 12, color: "var(--ink-soft)", margin: 0 }}>
                  Selecione acima o número de parcelas para continuar.
                </p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Pagamento concluído ─────────────────────────────────────────────────────

function CobrancaPaga({ venda, servico, nfeUrl }: {
  venda: QAVendaFinanceira; servico: string; nfeUrl: string | null;
}) {
  const dataPg = venda.cobranca_confirmada_em || venda.data_cadastro;
  const forma = (venda.forma_pagamento || "").trim();
  return (
    <div className="charge o">
      <div className="body">
        <div className="t">{servico}</div>
        <div className="m">
          Cob. #{venda.id_legado} · pago {fmtDatePt(dataPg ? String(dataPg).slice(0, 10) : null)}
          {forma ? ` · ${forma}` : ""}
        </div>
        <div style={{ marginTop: 8 }}><span className="pill paid">PAGA</span></div>
      </div>
      <div className="val" style={{ color: "var(--ok)" }}>{fmtBRL(Number(venda.valor_a_pagar || 0))}</div>
      <div className="actions" style={{ flexDirection: "column", gap: 6, minWidth: 170 }}>
        {venda.asaas_invoice_url
          ? <a className="btn" href={venda.asaas_invoice_url} target="_blank" rel="noreferrer">COMPROVANTE</a>
          : <button className="btn" disabled>COMPROVANTE</button>}
        {nfeUrl && <a className="btn out" href={nfeUrl} target="_blank" rel="noreferrer">BAIXAR NF-E</a>}
      </div>
    </div>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────

export default function QAClienteFinanceiroCentral({
  vendas, itens, servicoNomePorId = {}, premium = null, onPremiumRefresh, onRefresh, clienteNome,
}: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [modePorVenda, setModePorVenda] = useState<Record<number, "pix" | "boleto" | "cartao">>({});
  const [detalhePorVenda, setDetalhePorVenda] = useState<Record<number, Detalhe>>({});
  const [reemitindoPorVenda, setReemitindoPorVenda] = useState<Record<number, boolean>>({});
  const [nfePorPayment, setNfePorPayment] = useState<Record<string, string>>({});
  const [parcelasPorVenda, setParcelasPorVenda] = useState<Record<number, number>>({});

  const vendasVisiveis = useMemo(() => vendas.filter(v => !isCancelada(v)), [vendas]);
  const abertas = useMemo(() => vendasVisiveis.filter(v => !isPaga(v)), [vendasVisiveis]);
  const pagas = useMemo(
    () => vendasVisiveis.filter(isPaga).sort((a, b) => {
      const da = a.cobranca_confirmada_em || a.data_cadastro || "";
      const db = b.cobranca_confirmada_em || b.data_cadastro || "";
      return db.localeCompare(da);
    }),
    [vendasVisiveis],
  );

  const anoAtual = new Date().getFullYear();
  const kpi = useMemo(() => {
    let emAbertoTotal = 0, emAbertoQtd = 0;
    let vencidasTotal = 0, vencidasQtd = 0;
    for (const v of abertas) {
      const val = Number(v.valor_a_pagar || 0);
      emAbertoTotal += val; emAbertoQtd++;
      const d = diasAte(v.asaas_due_date);
      if (d !== null && d < 0) { vencidasTotal += val; vencidasQtd++; }
    }
    let pagasAnoTotal = 0, pagasAnoQtd = 0;
    for (const v of pagas) {
      const d = (v.cobranca_confirmada_em || v.data_cadastro || "").slice(0, 4);
      if (d === String(anoAtual)) {
        pagasAnoTotal += Number(v.valor_a_pagar || 0);
        pagasAnoQtd++;
      }
    }
    return { emAbertoTotal, emAbertoQtd, vencidasTotal, vencidasQtd, pagasAnoTotal, pagasAnoQtd };
  }, [abertas, pagas, anoAtual]);

  // Buscar NF-e reais para as vendas pagas com asaas_payment_id
  useEffect(() => {
    const paymentIds = pagas.map(v => v.asaas_payment_id).filter(Boolean) as string[];
    if (paymentIds.length === 0) { setNfePorPayment({}); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("fiscal_documents")
        .select("asaas_invoice_id, file_url, is_active")
        .in("asaas_invoice_id", paymentIds)
        .eq("is_active", true);
      if (cancelled || error || !data) return;
      const m: Record<string, string> = {};
      for (const row of data as any[]) {
        if (row.asaas_invoice_id && row.file_url) m[row.asaas_invoice_id] = row.file_url;
      }
      setNfePorPayment(m);
    })();
    return () => { cancelled = true; };
  }, [pagas]);

  const fetchDetalhe = async (venda: QAVendaFinanceira, wanted: "pix" | "boleto") => {
    const already = detalhePorVenda[venda.id_legado];
    if (already?.loading) return;
    if (wanted === "pix"    && already?.pix?.payload) return;
    if (wanted === "boleto" && already?.boleto?.identificationField) return;

    setDetalhePorVenda(prev => ({
      ...prev,
      [venda.id_legado]: { ...(prev[venda.id_legado] || {}), loading: true, error: null },
    }));

    try {
      const forma = wanted === "pix" ? "PIX" : "BOLETO";
      const { data, error } = await supabase.functions.invoke("qa-cliente-cobranca-inline", {
        body: { venda_id: venda.id_legado, action: "gerar_por_forma", forma },
      });
      if (error) throw error;
      const d = data as any;
      setDetalhePorVenda(prev => {
        const cur = prev[venda.id_legado] || {};
        return {
          ...prev,
          [venda.id_legado]: {
            loading: false,
            error: null,
            pix: wanted === "pix" ? {
              payload:      d?.pix_payload       ?? cur.pix?.payload      ?? null,
              encodedImage: d?.pix_encoded_image  ?? cur.pix?.encodedImage ?? null,
            } : cur.pix ?? null,
            boleto: wanted === "boleto" ? {
              identificationField: d?.boleto_identification_field ?? cur.boleto?.identificationField ?? null,
              barCode:             d?.boleto_barCode              ?? null,
              nossoNumero:         d?.boleto_nossoNumero          ?? null,
            } : cur.boleto ?? null,
            bankSlipUrl:       d?.asaas_bank_slip_url ?? cur.bankSlipUrl ?? venda.asaas_bank_slip_url ?? null,
            invoiceUrl:        d?.asaas_invoice_url   ?? cur.invoiceUrl  ?? venda.asaas_invoice_url   ?? null,
            billingType:       wanted === "boleto" ? "BOLETO" : cur.billingType ?? null,
            boletoError:       wanted === "boleto" ? (d?.boleto_error ?? null) : cur.boletoError ?? null,
            cartaoInvoiceUrl:  cur.cartaoInvoiceUrl ?? null,
          },
        };
      });
    } catch (e: any) {
      setDetalhePorVenda(prev => ({
        ...prev,
        [venda.id_legado]: { ...(prev[venda.id_legado] || {}), loading: false, error: e?.message || "erro" },
      }));
    }
  };

  const cobrarCartao = async (venda: QAVendaFinanceira, parcelas: number, card?: CardForm) => {
    if (detalhePorVenda[venda.id_legado]?.loading) return;
    setDetalhePorVenda(prev => ({
      ...prev,
      [venda.id_legado]: { ...(prev[venda.id_legado] || {}), loading: true, error: null, cartaoCobrado: null },
    }));
    try {
      const usarArsenal = !card && !!premium?.cartao?.ultimos4;
      const body: Record<string, unknown> = {
        venda_id: venda.id_legado,
        action: "cobrar_cartao",
        parcelas,
      };
      if (usarArsenal) {
        body.usar_arsenal_cartao = true;
      } else if (card) {
        Object.assign(body, card);
      } else {
        throw new Error("Preencha os dados do cartão para continuar.");
      }
      const { data, error } = await supabase.functions.invoke("qa-cliente-cobranca-inline", { body });
      if (error) throw error;
      const d = data as any;
      if (d?.error || d?.network_error) throw new Error(d.detalhe || d.network_error || String(d.error));
      if (!d?.payment_id) throw new Error("Não foi possível criar a cobrança. Verifique os dados do cartão e tente novamente.");
      const precoBase = Number(venda.valor_a_pagar || 0);
      const gu = precoBase > 0 ? calcularPrecoFinal(precoBase, "CREDIT_CARD", parcelas) : null;
      const cobrado = {
        status:       String(d.status || "PENDING"),
        pago:         !!d.pago,
        valorTotal:   Number(d.valor_total) || gu?.valorTotal || 0,
        valorParcela: Number(d.valor_parcela) || gu?.valorParcela || 0,
        parcelas:     Number(d.parcelas) || parcelas,
      };
      setDetalhePorVenda(prev => ({
        ...prev,
        [venda.id_legado]: { ...(prev[venda.id_legado] || {}), loading: false, error: null, cartaoCobrado: cobrado },
      }));
      if (cobrado.pago) {
        toast.success("Pagamento confirmado!");
        onRefresh?.();
      } else {
        toast.info("Cobrança enviada — a Asaas está processando. Clique em verificar em alguns instantes.");
      }
    } catch (e: any) {
      setDetalhePorVenda(prev => ({
        ...prev,
        [venda.id_legado]: { ...(prev[venda.id_legado] || {}), loading: false, error: e?.message || "erro" },
      }));
      toast.error(e?.message || "Erro ao processar cobrança no cartão.");
    }
  };

  const [verificandoPorVenda, setVerificandoPorVenda] = useState<Record<number, boolean>>({});

  const verificarPagamento = async (venda: QAVendaFinanceira) => {
    if (verificandoPorVenda[venda.id_legado]) return;
    setVerificandoPorVenda(prev => ({ ...prev, [venda.id_legado]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("qa-cliente-cobranca-inline", {
        body: { venda_id: venda.id_legado, action: "verificar_pagamento" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(String((data as any).error));
      if ((data as any)?.pago) {
        toast.success("Pagamento confirmado! A cobrança foi baixada.");
        onRefresh?.();
      } else {
        toast.info("Pagamento ainda não confirmado pela Asaas. Aguarde alguns instantes e tente novamente.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao verificar pagamento.");
    } finally {
      setVerificandoPorVenda(prev => ({ ...prev, [venda.id_legado]: false }));
    }
  };

  const reemitirBoleto = async (venda: QAVendaFinanceira) => {
    if (reemitindoPorVenda[venda.id_legado]) return;
    setReemitindoPorVenda(prev => ({ ...prev, [venda.id_legado]: true }));
    setDetalhePorVenda(prev => ({
      ...prev,
      [venda.id_legado]: { ...(prev[venda.id_legado] || {}), loading: true, error: null },
    }));
    try {
      const { data, error } = await supabase.functions.invoke("qa-cliente-cobranca-inline", {
        body: { venda_id: venda.id_legado, action: "reemitir_boleto" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(String((data as any).error));
      const boletoLine = (data as any)?.boleto_identification_field ?? null;
      setDetalhePorVenda(prev => ({
        ...prev,
        [venda.id_legado]: {
          loading: false,
          error: null,
          boleto: {
            identificationField: boletoLine,
            barCode: (data as any)?.boleto_barCode ?? null,
            nossoNumero: (data as any)?.boleto_nossoNumero ?? null,
          },
          pix: prev[venda.id_legado]?.pix ?? null,
          bankSlipUrl: prev[venda.id_legado]?.bankSlipUrl ?? null,
          invoiceUrl: prev[venda.id_legado]?.invoiceUrl ?? venda.asaas_invoice_url ?? null,
          billingType: "BOLETO",
        },
      }));
      toast.success("Boleto reemitido com vencimento em 3 dias.");
      // Se Asaas ainda não retornou o código (sandbox ou atraso), tenta novamente em 3s
      if (!boletoLine) {
        setTimeout(() => void fetchDetalhe(venda, "boleto"), 3000);
      }
    } catch (e: any) {
      setDetalhePorVenda(prev => ({
        ...prev,
        [venda.id_legado]: { ...(prev[venda.id_legado] || {}), loading: false, error: e?.message || "erro" },
      }));
      toast.error("Não foi possível reemitir o boleto. Tente pelo PIX.");
    } finally {
      setReemitindoPorVenda(prev => ({ ...prev, [venda.id_legado]: false }));
    }
  };

  const primeiraAbertaId = abertas[0]?.id_legado ?? null;
  const [expandedInitDone, setExpandedInitDone] = useState(false);
  useEffect(() => {
    if (expandedInitDone) return;
    if (primeiraAbertaId !== null) {
      setExpandedId(primeiraAbertaId);
      setModePorVenda(prev => ({ ...prev, [primeiraAbertaId]: "boleto" }));
      const v = abertas.find(x => x.id_legado === primeiraAbertaId);
      if (v?.asaas_payment_id) void fetchDetalhe(v, "boleto");
    }
    setExpandedInitDone(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primeiraAbertaId, expandedInitDone]);

  return (
    <div className="qafin-central">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div>
        <h1 className="qatitle">
          {(clienteNome ? String(clienteNome).trim().split(/\s+/)[0].toUpperCase() : "CLIENTE")}
          , ESTE É O SEU CONTROLE FINANCEIRO
        </h1>
      </div>

      {premium && <PremiumCard premium={premium} onRefresh={onPremiumRefresh} />}

      <KpiRow
        emAbertoTotal={kpi.emAbertoTotal} emAbertoQtd={kpi.emAbertoQtd}
        vencidasTotal={kpi.vencidasTotal} vencidasQtd={kpi.vencidasQtd}
        pagasAnoTotal={kpi.pagasAnoTotal} pagasAnoQtd={kpi.pagasAnoQtd}
        ano={anoAtual}
        premium={premium}
      />

      <div className="section">
        <span>Cobranças em aberto</span>
        <span className="cnt">{abertas.length}</span>
      </div>
      {abertas.length === 0 ? (
        <div className="empty">Nenhuma cobrança em aberto no momento.</div>
      ) : (
        abertas.map(v => {
          const isOpen = expandedId === v.id_legado;
          const mode = modePorVenda[v.id_legado] || "boleto";
          const servico = servicoDaVenda(v, itens, servicoNomePorId);
          return (
            <CobrancaAberta
              key={v.id}
              venda={v}
              servico={servico}
              defaultMode="boleto"
              expanded={isOpen}
              mode={mode}
              setMode={(m) => setModePorVenda(prev => ({ ...prev, [v.id_legado]: m }))}
              onExpand={() => setExpandedId(isOpen ? null : v.id_legado)}
              detalhe={detalhePorVenda[v.id_legado]}
              onFetchMode={(m) => { if (v.asaas_payment_id) void fetchDetalhe(v, m); }}
              onReemitirBoleto={() => void reemitirBoleto(v)}
              reemitindoBoleto={!!reemitindoPorVenda[v.id_legado]}
              temNfe={false}
              selectedParcelas={parcelasPorVenda[v.id_legado]}
              onSelectParcelas={(n) => setParcelasPorVenda(prev => ({ ...prev, [v.id_legado]: n }))}
              onCobrarCartao={(n, card) => void cobrarCartao(v, n, card)}
              onVerificarPagamento={() => void verificarPagamento(v)}
              verificandoPagamento={!!verificandoPorVenda[v.id_legado]}
              arsenalCartao={premium?.cartao ? { ultimos4: premium.cartao.ultimos4, bandeira: premium.cartao.bandeira } : null}
            />
          );
        })
      )}

      <div className="section">
        <span>Pagamentos concluídos</span>
        <span className="cnt">{pagas.length}</span>
      </div>
      {pagas.length === 0 ? (
        <div className="empty">Você ainda não tem pagamentos confirmados.</div>
      ) : (
        pagas.map(v => (
          <CobrancaPaga
            key={v.id}
            venda={v}
            servico={servicoDaVenda(v, itens, servicoNomePorId)}
            nfeUrl={v.asaas_payment_id ? (nfePorPayment[v.asaas_payment_id] || null) : null}
          />
        ))
      )}
    </div>
  );
}