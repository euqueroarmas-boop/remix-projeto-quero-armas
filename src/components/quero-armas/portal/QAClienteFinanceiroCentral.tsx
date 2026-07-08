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

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
.qafin-central .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;background:#faf9f5;
  border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin-top:12px}
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
@media(max-width:720px){.qafin-central .summary,.qafin-central .summary.cols-3{grid-template-columns:repeat(2,1fr)}
.qafin-central .charge,.qafin-central .expanded .head,.qafin-central .paybody{flex-direction:column;grid-template-columns:1fr}
.qafin-central .charge .val,.qafin-central .expanded .head .val{text-align:left}
.qafin-central .meta{grid-template-columns:repeat(2,1fr)}}
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
  valor_mensal: number;      // em reais
  dia_cobranca: number;      // 1..31
  proxima_em: string | null; // ISO date
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
  premium?: QAArsenalPremiumSubscription | null; // hoje sempre null
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
function titleCasePt(s: string): string {
  const lower = s.toLowerCase();
  return lower.split(/(\s+)/).map((tok, i) => {
    if (/^\s+$/.test(tok)) return tok;
    if (i > 0 && MINUSCULAS_PT.has(tok)) return tok;
    return tok.charAt(0).toUpperCase() + tok.slice(1);
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

function PremiumCard({ premium }: { premium: QAArsenalPremiumSubscription }) {
  const cc = premium.cartao;
  return (
    <div className="card" style={{ borderLeft: "4px solid var(--bordo)", marginBottom: 20 }}>
      <h3>
        <span>Arsenal Inteligente · Premium</span>
        <span className="pill rec">RECORRENTE</span>
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "'Arial Narrow',Arial", fontSize: 15, fontWeight: 700 }}>
            {premium.ativa ? "Assinatura mensal ativa" : "Assinatura pausada"}
          </div>
          <div style={{ fontFamily: "Arial", fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>
            Cobrança automática de <b>{fmtBRL(premium.valor_mensal)}</b> todo dia {String(premium.dia_cobranca).padStart(2, "0")}
            {cc ? <>, direto no cartão {cc.bandeira} •••• {cc.ultimos4}</> : null}
            {premium.proxima_em ? <>. Próxima em <b>{fmtDatePt(premium.proxima_em)}</b>.</> : "."}
          </div>
        </div>
        {cc ? (
          <div className="cc-light">
            <div>
              <div className="brand">CARTÃO SALVO</div>
              <div className="num">•••• {cc.ultimos4}</div>
              <div className="sub">{cc.titular.toUpperCase()} · {cc.validade}</div>
            </div>
            <div className="flag">{cc.bandeira.toUpperCase()}</div>
          </div>
        ) : (
          <div className="cc-light"><div className="sub">Nenhum cartão salvo</div></div>
        )}
      </div>
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
          <div className="sumval">
            {fmtBRLShort(premium.valor_mensal)}
            <small style={{ fontFamily: "Oswald,sans-serif", fontSize: 12, color: "var(--ink-soft)" }}>/mês</small>
          </div>
          <div className="sumsub">recorrente {premium.cartao ? "· cartão" : ""}</div>
        </div>
      )}
    </div>
  );
}

// ─── Cobrança em aberto (colapsada / expandida) ─────────────────────────────

type Detalhe = {
  loading: boolean;
  error?: string | null;
  boleto?: { identificationField?: string | null; barCode?: string | null; nossoNumero?: string | null } | null;
  pix?: { payload?: string | null; encodedImage?: string | null } | null;
  bankSlipUrl?: string | null;
  invoiceUrl?: string | null;
  billingType?: string | null;
  boletoError?: string | null;
};

function CobrancaAberta({
  venda, servico, defaultMode, onExpand, expanded, mode, setMode, detalhe, onFetchMode, temNfe,
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
  temNfe: boolean;
}) {
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
            <div className="bar-code" style={{ marginBottom: 8 }} />
            {detalhe?.loading && !boletoLine ? (
              <div className="copy">Buscando linha digitável na Asaas…</div>
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
              {boletoPdf && <a className="btn out" href={boletoPdf} target="_blank" rel="noreferrer">BAIXAR PDF</a>}
              {invoiceUrl && (
                <a className="btn" href={invoiceUrl} target="_blank" rel="noreferrer">
                  {banco ? `PAGAR NO APP DO ${banco.toUpperCase()}` : "ABRIR NA ASAAS"}
                </a>
              )}
            </div>
          </div>
        )}

        {mode === "cartao" && (
          <div className="paybody">
            <div>
              <span className="h4c">Pagamento no cartão de crédito</span>
              <div style={{ fontFamily: "Arial", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                O pagamento com cartão de crédito é feito no ambiente seguro da Asaas.
                As parcelas e taxas são exibidas na tela de checkout.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {invoiceUrl
                  ? <a className="btn pri" href={invoiceUrl} target="_blank" rel="noreferrer">PAGAR COM CARTÃO</a>
                  : <button className="btn pri" disabled>PAGAR COM CARTÃO</button>}
              </div>
            </div>
            <div style={{ minWidth: 140, textAlign: "center" }}>
              <div style={{ fontFamily: "Oswald,sans-serif", fontSize: 10, letterSpacing: ".14em", color: "var(--ink-soft)", textTransform: "uppercase" }}>Cobrado por</div>
              <div style={{ fontFamily: "Oswald,sans-serif", fontWeight: 600, fontSize: 14, marginTop: 4 }}>ASAAS</div>
            </div>
          </div>
        )}
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
  vendas, itens, servicoNomePorId = {}, premium = null, clienteNome,
}: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [modePorVenda, setModePorVenda] = useState<Record<number, "pix" | "boleto" | "cartao">>({});
  const [detalhePorVenda, setDetalhePorVenda] = useState<Record<number, Detalhe>>({});
  const [nfePorPayment, setNfePorPayment] = useState<Record<string, string>>({});

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
    if (wanted === "pix" && already?.pix?.payload) return;
    if (wanted === "boleto" && already?.boleto?.identificationField) return;

    setDetalhePorVenda(prev => ({
      ...prev,
      [venda.id_legado]: { ...(prev[venda.id_legado] || {}), loading: true, error: null },
    }));

    try {
      const { data, error } = await supabase.functions.invoke("qa-cliente-cobranca-inline", {
        body: { venda_id: venda.id_legado, action: wanted },
      });
      if (error) throw error;
      setDetalhePorVenda(prev => ({
        ...prev,
        [venda.id_legado]: {
          loading: false,
          error: null,
          pix: {
            payload: (data as any)?.pix_payload ?? prev[venda.id_legado]?.pix?.payload ?? null,
            encodedImage: (data as any)?.pix_encoded_image ?? prev[venda.id_legado]?.pix?.encodedImage ?? null,
          },
          boleto: {
            identificationField: (data as any)?.boleto_identification_field ?? prev[venda.id_legado]?.boleto?.identificationField ?? null,
            barCode: (data as any)?.boleto_barCode ?? null,
            nossoNumero: (data as any)?.boleto_nossoNumero ?? null,
          },
          bankSlipUrl: (data as any)?.asaas_bank_slip_url ?? venda.asaas_bank_slip_url ?? null,
          invoiceUrl: (data as any)?.asaas_invoice_url ?? venda.asaas_invoice_url ?? null,
          billingType: (data as any)?.billing_type ?? prev[venda.id_legado]?.billingType ?? null,
          boletoError: (data as any)?.boleto_error ?? null,
        },
      }));
    } catch (e: any) {
      setDetalhePorVenda(prev => ({
        ...prev,
        [venda.id_legado]: { ...(prev[venda.id_legado] || {}), loading: false, error: e?.message || "erro" },
      }));
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

      {premium && <PremiumCard premium={premium} />}

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
              temNfe={false}
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