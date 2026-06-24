import { useEffect, useMemo, useState } from "react";
import { useQAServicosMap } from "@/hooks/useQAServicosMap";
import { calcularPrazosProcessuais } from "@/lib/quero-armas/prazosProcessuais";

interface Props {
  cliente: any;
  vendas: any[];
  itens: any[];
  crafs: any[];
  gtes: any[];
  filiacoes: any[];
  cadastro: any;
  examesAtuais?: any[];
  armasManual?: any[];
  meusDocs?: any[];
  processoDocs?: any[];
  onNavigate: (tab: string) => void;
}

type FrontTone = "bordo" | "amber" | "green";
type FrontItem = { label: string; status: string; tone: "bad" | "warn" | "ok" | "muted" };
type Front = { key: string; title: string; count: number; tone: FrontTone; items: FrontItem[]; navTo: string };
type Urgent = { label: string; sub: string; days: number; navTo: string; ctaLabel: string };

const ACTIVE_FINAL_STATUSES = ["CONCLUÍDO", "DEFERIDO", "INDEFERIDO", "DESISTIU", "RESTITUÍDO"];

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const raw = String(dateStr).trim();
  if (!raw) return null;
  let parsed: Date | null = null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (iso) parsed = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  if (br) parsed = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return Math.floor((parsed.getTime() - today.getTime()) / 86400000);
}

function frontStatus(days: number | null): FrontItem["tone"] {
  if (days === null) return "muted";
  if (days < 0 || days <= 7) return "bad";
  if (days <= 45) return "warn";
  return "ok";
}

function compactStatus(days: number | null, percent?: number | null) {
  if (typeof percent === "number") return `${Math.max(0, Math.min(100, Math.round(percent)))}%`;
  if (days === null) return "—";
  if (days < 0) return `VENC. - ${Math.abs(days)}D`;
  return `${days}D`;
}

function shortName(value: string, fallback: string) {
  return String(value || fallback).replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function firstName(cliente: any) {
  const nome = String(cliente?.nome_completo || cliente?.nome || cliente?.name || "WILLIAN").trim();
  return (nome.split(/\s+/)[0] || "WILLIAN").toUpperCase();
}

function serviceProgress(item: any) {
  const marks = [!!item?.data_protocolo, !!item?.numero_processo, !!item?.data_ultima_atualizacao, !!item?.data_deferimento];
  return Math.round((marks.filter(Boolean).length / marks.length) * 100);
}

export default function ClienteResumoKanban({
  cliente,
  itens,
  crafs,
  gtes,
  filiacoes,
  cadastro,
  examesAtuais = [],
  armasManual = [],
  meusDocs = [],
  processoDocs = [],
  onNavigate,
}: Props) {
  const { map: SERVICO_MAP } = useQAServicosMap();

  const URG_SUB: Record<string, string> = {
    cr: "Certificado de Registro · sem ele toda atividade na PF trava",
    craf: "Sem CRAF vigente o transporte da arma é ilegal",
    gte: "Guia de Tráfego expirada bloqueia movimentações",
    psicologico: "Exame obrigatório · sem ele, processos travam na PF",
    tiro: "Capacidade técnica obrigatória · renove para manter o CR",
    filiacao: "Filiação vigente é exigida para CAC ativo",
    documento: "Certidão ou regularidade próxima do vencimento",
    processo: "Prazo processual crítico · ação imediata na PF",
  };

  const snapshot = useMemo(() => {
    const activeItems = itens.filter((i: any) => !ACTIVE_FINAL_STATUSES.includes(String(i.status || "").toUpperCase()));
    const prazosProc = calcularPrazosProcessuais(
      itens.map((it: any) => ({
        id: it.id,
        servico_id: it.servico_id,
        servico_nome: SERVICO_MAP[it.servico_id] || `Serviço #${it.servico_id}`,
        status: it.status,
        numero_processo: it.numero_processo,
        data_notificacao: it.data_notificacao,
        data_indeferimento: it.data_indeferimento,
        data_recurso_administrativo: it.data_recurso_administrativo,
        data_indeferimento_recurso: it.data_indeferimento_recurso,
      })),
    );

    const arsenalItems: FrontItem[] = [];
    const addArsenal = (label: string, date: string | null | undefined) => {
      const days = daysUntil(date);
      arsenalItems.push({ label, status: compactStatus(days), tone: frontStatus(days) });
    };
    if (cadastro?.validade_cr) addArsenal("CR — CERTIFICADO", cadastro.validade_cr);
    crafs.forEach((cr: any) => addArsenal(`CRAF — ${shortName(cr.nome_arma || cr.nome_craf, "ARMA")}`, cr.data_validade));
    gtes.forEach((g: any) => addArsenal(`GTE — ${shortName(g.nome_arma || g.nome_gte, "ARMA")}`, g.data_validade));
    armasManual.forEach((arma: any) => {
      const nome = shortName(arma?.modelo || arma?.nome || arma?.tipo || "ARMA MANUAL", "ARMA MANUAL");
      arsenalItems.push({ label: nome, status: "—", tone: "muted" });
    });

    const exameByTipo = new Map<string, any>();
    for (const e of examesAtuais) if (e?.tipo && !exameByTipo.has(e.tipo)) exameByTipo.set(e.tipo, e);
    const examesItems: FrontItem[] = [
      exameByTipo.get("psicologico") && {
        label: "LAUDO PSICOLÓGICO",
        status: compactStatus(daysUntil(exameByTipo.get("psicologico")?.data_vencimento)),
        tone: frontStatus(daysUntil(exameByTipo.get("psicologico")?.data_vencimento)),
      },
      exameByTipo.get("tiro") && {
        label: "EXAME DE TIRO",
        status: compactStatus(daysUntil(exameByTipo.get("tiro")?.data_vencimento)),
        tone: frontStatus(daysUntil(exameByTipo.get("tiro")?.data_vencimento)),
      },
    ].filter(Boolean) as FrontItem[];

    const filiacaoItems = filiacoes.map((f: any) => {
      const days = daysUntil(f.validade_filiacao);
      return {
        label: shortName(f.nome_filiacao || f.nome_clube || `CLUBE #${f.clube_id || ""}`, "CLUBE"),
        status: compactStatus(days),
        tone: frontStatus(days),
      };
    });

    const processoItems = activeItems.map((item: any) => {
      const nome = SERVICO_MAP[item.servico_id] || item.servico_nome || `SERVIÇO #${item.servico_id || ""}`;
      const prazo = prazosProc.find((p: any) => p.id === item.id || p.servicoId === item.servico_id);
      if (prazo?.diasRestantes !== undefined) {
        return { label: shortName(nome, "PROCESSO"), status: compactStatus(Number(prazo.diasRestantes)), tone: frontStatus(Number(prazo.diasRestantes)) };
      }
      return { label: shortName(nome, "PROCESSO"), status: compactStatus(null, serviceProgress(item)), tone: "warn" as const };
    });

    const docItems: FrontItem[] = meusDocs
      .map((doc: any) => {
        const nome = shortName(doc?.nome_documento || doc?.tipo_documento || doc?.arquivo_nome, "DOCUMENTO");
        const days = daysUntil(doc?.data_validade_efetiva || doc?.data_validade);
        return { label: nome, status: compactStatus(days), tone: frontStatus(days) };
      })
      .sort((a, b) => (a.tone === "bad" ? -1 : b.tone === "bad" ? 1 : 0));

    const fronts: Front[] = [
      { key: "arsenal", title: "ARSENAL", count: arsenalItems.length, tone: "bordo", items: arsenalItems.slice(0, 3), navTo: "arsenal" },
      { key: "exames", title: "EXAMES", count: examesItems.length, tone: "amber", items: examesItems.slice(0, 3), navTo: "documentos" },
      { key: "filiacao", title: "FILIAÇÃO", count: filiacaoItems.length, tone: "amber", items: filiacaoItems.slice(0, 3), navTo: "documentos" },
      { key: "documentos", title: "DOCUMENTOS", count: docItems.length, tone: "amber", items: docItems.slice(0, 3), navTo: "documentos" },
      { key: "processos", title: "PROCESSOS", count: activeItems.length, tone: "bordo", items: processoItems.slice(0, 3), navTo: "processos" },
    ];

    const urgents: Urgent[] = [];
    const pushUrgent = (label: string, sub: string, date: string | null | undefined, navTo: string, ctaLabel = "AGENDAR AGORA →") => {
      const days = daysUntil(date);
      if (days === null || days > 7) return;
      urgents.push({ label, sub, days, navTo, ctaLabel });
    };
    if (cadastro?.validade_cr) pushUrgent("CR — Certificado", URG_SUB.cr, cadastro.validade_cr, "arsenal", "RENOVAR AGORA →");
    crafs.forEach((cr: any) => pushUrgent(`CRAF — ${shortName(cr.nome_arma || cr.nome_craf, "Arma")}`, URG_SUB.craf, cr.data_validade, "arsenal", "RENOVAR AGORA →"));
    gtes.forEach((g: any) => pushUrgent(`GTE — ${shortName(g.nome_arma || g.nome_gte, "Arma")}`, URG_SUB.gte, g.data_validade, "arsenal", "RENOVAR AGORA →"));
    filiacoes.forEach((f: any) => pushUrgent(`Filiação — ${shortName(f.nome_filiacao || f.nome_clube, "Clube")}`, URG_SUB.filiacao, f.validade_filiacao, "documentos"));
    examesItems.forEach((e) => {
      const isPsi = e.label.includes("PSICOLÓGICO");
      const source = isPsi ? exameByTipo.get("psicologico") : exameByTipo.get("tiro");
      pushUrgent(isPsi ? "Laudo Psicológico" : "Exame de Tiro", isPsi ? URG_SUB.psicologico : URG_SUB.tiro, source?.data_vencimento, "documentos", "AGENDAR EXAMES →");
    });
    meusDocs.forEach((doc: any) => pushUrgent(shortName(doc?.nome_documento || doc?.tipo_documento || doc?.arquivo_nome, "Documento"), URG_SUB.documento, doc?.data_validade_efetiva || doc?.data_validade, "documentos", "ATUALIZAR AGORA →"));
    processoDocs.forEach((doc: any) => pushUrgent(shortName(doc?.nome_documento || doc?.tipo_documento || doc?.arquivo_nome, "Documento do processo"), URG_SUB.documento, doc?.data_validade_efetiva || doc?.data_validade, "processos", "ATUALIZAR AGORA →"));
    prazosProc.forEach((p: any) => {
      if (typeof p.diasRestantes === "number" && p.diasRestantes <= 7) urgents.push({ label: `${p.evento} — ${p.servicoNome || "Processo"}`, sub: URG_SUB.processo, days: p.diasRestantes, navTo: "processos", ctaLabel: "AGENDAR AGORA →" });
    });

    const sortedUrgents = urgents.sort((a, b) => a.days - b.days);
    const nextDue = [...arsenalItems, ...examesItems, ...filiacaoItems]
      .map((item) => {
        const match = item.status.match(/^(\d+)D$/);
        return match ? Number(match[1]) : null;
      })
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b)[0];
    const totalFronts = fronts.reduce((sum, front) => sum + front.count, 0);
    const redCount = sortedUrgents.length;
    const totalTasks = Math.max(totalFronts + activeItems.length, redCount + activeItems.length);
    const summary: Array<[string, string, string]> = [
      ["TAREFAS ABERTAS", String(redCount + activeItems.length), `de ${totalTasks}`],
      ["PRÓXIMO VENCIMENTO", nextDue !== undefined ? String(nextDue) : "—", nextDue !== undefined ? "dias" : ""],
      ["DOCUMENTOS A RENOVAR", String(redCount), redCount > 0 ? "urgente" : ""],
      ["PROCESSOS ATIVOS", String(activeItems.length), ""],
    ];

    return { fronts, urgents: sortedUrgents, totalFronts, activeItems, summary };
  }, [SERVICO_MAP, armasManual, cadastro, crafs, examesAtuais, filiacoes, gtes, itens, meusDocs, processoDocs]);

  const [focusIndex, setFocusIndex] = useState(0);
  useEffect(() => setFocusIndex(0), [snapshot.urgents.length]);
  useEffect(() => {
    if (snapshot.urgents.length <= 1) return;
    const id = window.setInterval(() => setFocusIndex((current) => (current + 1) % snapshot.urgents.length), 6000);
    return () => window.clearInterval(id);
  }, [snapshot.urgents.length]);

  // Trava o scroll da página enquanto o Resumo estiver visível
  useEffect(() => {
    const { body, documentElement: html } = document;
    const prevBody = body.style.overflow;
    const prevHtml = html.style.overflow;
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
    };
  }, []);

  const activeUrgent = snapshot.urgents[focusIndex] || null;
  const memberSince = (() => {
    const d = (cliente as any)?.created_at || (cliente as any)?.data_cadastro;
    if (!d) return null;
    const p = new Date(d);
    if (isNaN(p.getTime())) return null;
    const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    return `${meses[p.getMonth()]}/${p.getFullYear()}`;
  })();
  const statusLine = `${cadastro?.categoria_titular || cliente?.status_cliente || "CAÇADOR"}${cadastro?.numero_cr ? ` · CR ${cadastro.numero_cr}` : ""}${memberSince ? ` · MEMBRO DESDE ${memberSince}` : ""} · ${snapshot.activeItems.length} PROCESSOS EM ANDAMENTO`;
  const filters = [
    `TODOS ${snapshot.totalFronts}`,
    `ARSENAL ${snapshot.fronts[0].count}`,
    `EXAMES ${snapshot.fronts[1].count}`,
    `DOCUMENTOS ${snapshot.fronts[3].count}`,
    `PROCESSOS ${snapshot.fronts[4].count}`,
  ];
  const updated = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date()).replace(/\./g, "").toUpperCase();
  const updatedTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());

  return (
    <main className="qa-client-summary-print">
      <style>{`
        .qa-client-summary-print{--paper:#f3f3f2;--card:#ffffff;--ink:#111111;--muted:#6A6A6A;--line:#e3e3e1;--bordo:#7A1F2B;--amber:#d5a33d;--green:#278652;--red:#df2727;color:var(--ink);font-family:'Arial Narrow',Arial,sans-serif;letter-spacing:.02em;padding:0;min-height:560px;border:0;border-radius:0;box-shadow:none;text-transform:uppercase}
        .qa-client-summary-print *{box-sizing:border-box}.qa-client-summary-print__wrap{max-width:none;margin:0}.qa-client-summary-print__top{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px}.qa-client-summary-print h1{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-weight:700;font-size:24px;line-height:1.05;margin:0;letter-spacing:.04em;color:#0A0A0A;text-transform:uppercase}.qa-client-summary-print__meta{display:flex;align-items:center;gap:8px;margin-top:11px;font-size:10px;font-weight:900;letter-spacing:.22em;color:var(--muted)}.qa-client-summary-print__dot{width:7px;height:7px;border-radius:999px;background:var(--bordo);display:inline-block}.qa-client-summary-print__updated{text-align:right;font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-weight:700;font-size:11px;line-height:1.15;letter-spacing:.08em;padding-top:6px;white-space:nowrap;color:#6A6A6A}.qa-client-summary-print__updated small{display:block;color:var(--muted);font-size:9px;letter-spacing:.36em;margin-bottom:4px}.qa-client-summary-print__toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.qa-client-summary-print__chip{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:8px 13px 7px;font-size:9px;font-weight:900;letter-spacing:.18em;color:#303030;box-shadow:0 1px 1px rgba(0,0,0,.04)}.qa-client-summary-print__chip:first-child{background:#111;color:#fff;border-color:#111}.qa-client-summary-print__label{font-size:12px;font-weight:900;letter-spacing:.22em;margin:0 0 15px}.qa-client-summary-print__fronts{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}.qa-front-card{background:var(--card);border:1px solid var(--line);border-radius:3px;min-height:200px;padding:20px 14px 14px;box-shadow:0 6px 14px rgba(17,17,17,.04);position:relative}.qa-front-card:before{content:"";position:absolute;left:-1px;right:-1px;top:-1px;height:4px;background:var(--bordo);border-radius:3px 3px 0 0}.qa-front-card.amber:before{background:var(--amber)}.qa-front-card__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px solid #ededed;padding-bottom:9px;margin-bottom:9px}.qa-front-card h2{font-family:Oswald,'Arial Narrow',Arial,sans-serif;margin:0;font-size:13px;font-weight:900;letter-spacing:.24em;line-height:1}.qa-front-card__sub{font-size:11px;letter-spacing:0;text-transform:none;color:#9a9a9f;margin-top:5px}.qa-front-card__num{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:28px;line-height:.82;font-weight:900;color:var(--bordo);letter-spacing:0}.qa-front-card.amber .qa-front-card__num{color:var(--amber)}.qa-front-card__item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:baseline;padding:6px 0;font-size:11px;font-weight:900;letter-spacing:-.01em;text-transform:none;border-bottom:1px solid #f1f1f1}.qa-front-card__item:last-child{border-bottom:0}.qa-front-card__item span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qa-front-card__item strong{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:12px;letter-spacing:.08em;color:var(--muted);white-space:nowrap}.qa-front-card__item strong.bad{color:var(--red)}.qa-front-card__item strong.warn{color:var(--amber)}.qa-front-card__item strong.ok{color:var(--green)}.qa-client-summary-print__focus{margin-top:0;margin-bottom:24px;background:var(--card);border:1px solid var(--line);border-radius:3px;min-height:78px;display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;padding:18px 18px 18px 22px;position:relative}.qa-client-summary-print__focus:before{content:"";position:absolute;left:-1px;top:-1px;bottom:-1px;width:4px;background:var(--red);border-radius:3px 0 0 3px}.qa-focus__k{font-size:10px;font-weight:900;letter-spacing:.24em;color:var(--red);margin-bottom:8px}.qa-focus__text{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:18px;font-weight:900;letter-spacing:0;text-transform:none}.qa-focus__actions{display:flex;align-items:center;gap:10px}.qa-focus__pages{display:flex;gap:5px}.qa-focus__page{width:22px;height:22px;border:1px solid var(--line);background:#fff;color:var(--muted);font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:10px;font-weight:900;cursor:pointer}.qa-focus__page.is-active{background:var(--bordo);border-color:var(--bordo);color:#fff}.qa-focus__btn{border:0;background:var(--bordo);color:#fff;font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:10px;font-weight:900;letter-spacing:.18em;padding:8px 12px;cursor:pointer}.qa-client-summary-print__summary{display:grid;grid-template-columns:repeat(4,1fr);margin-top:22px;border:1px solid var(--line);border-radius:3px;overflow:hidden;background:var(--card)}.qa-client-summary-print__sm{padding:16px 18px;border-right:1px solid var(--line);min-height:82px}.qa-client-summary-print__sm:last-child{border-right:0}.qa-client-summary-print__k{font-size:10px;font-weight:900;letter-spacing:.24em;color:var(--muted);margin-bottom:9px}.qa-client-summary-print__v{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:26px;line-height:1;font-weight:900;letter-spacing:0}.qa-client-summary-print__v small{font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:var(--muted);margin-left:6px;text-transform:none}.qa-client-summary-print__footer{text-align:center;margin-top:21px;color:#b1b1b1;font-size:9px;font-weight:900;letter-spacing:.22em}@media (max-width:1399px){.qa-client-summary-print__fronts{grid-template-columns:repeat(3,1fr)}}@media (max-width:900px){.qa-client-summary-print__fronts{grid-template-columns:repeat(2,1fr)}.qa-client-summary-print__summary{grid-template-columns:repeat(2,1fr)}.qa-client-summary-print__sm:nth-child(2){border-right:0}.qa-client-summary-print__sm:nth-child(-n+2){border-bottom:1px solid var(--line)}}.qa-urgbanner{position:relative;background:var(--card);border:1px solid var(--line);border-radius:3px;padding:18px 22px 18px 26px;margin-bottom:18px;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;box-shadow:0 6px 14px rgba(17,17,17,.04)}.qa-urgbanner:before{content:"";position:absolute;left:-1px;top:-1px;bottom:-1px;width:5px;background:var(--red);border-radius:3px 0 0 3px}.qa-urgbanner__kicker{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.28em;color:var(--red);margin-bottom:10px;text-transform:uppercase}.qa-urgbanner__title{font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:26px;line-height:1.05;margin:0 0 6px;color:#0c0c0c;text-transform:none;letter-spacing:-.01em}.qa-urgbanner__sub{margin:0 0 16px;font-family:Arial,sans-serif;font-size:13px;color:#5a5a5a;text-transform:none;letter-spacing:0}.qa-urgbanner__actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.qa-urgbanner__cta{border:0;background:var(--bordo);color:#fff;font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.22em;padding:11px 16px;cursor:pointer;border-radius:2px;text-transform:uppercase}.qa-urgbanner__ghost{border:1px solid #d6d6d4;background:transparent;color:#111;font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.22em;padding:10px 16px;cursor:pointer;border-radius:2px;text-transform:uppercase}.qa-urgbanner__pages{display:flex;gap:6px;margin-top:14px;flex-wrap:wrap}.qa-urgbanner__page{min-width:30px;height:26px;border:1px solid var(--line);background:#fff;color:var(--muted);font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.06em;cursor:pointer;border-radius:2px;padding:0 6px}.qa-urgbanner__page.is-active{background:var(--bordo);border-color:var(--bordo);color:#fff}.qa-urgbanner__count{text-align:right;padding-left:18px}.qa-urgbanner__num{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-weight:900;font-size:78px;line-height:.82;color:var(--red);letter-spacing:-.02em}.qa-urgbanner__numk{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.32em;color:#0c0c0c;margin-top:6px}@media (max-width:880px){.qa-urgbanner{grid-template-columns:1fr;padding:20px 18px 18px 24px}.qa-urgbanner__count{text-align:left;padding-left:0}.qa-urgbanner__num{font-size:72px}.qa-urgbanner__title{font-size:26px}}@media (max-width:680px){.qa-client-summary-print{padding:20px 14px 28px}.qa-client-summary-print__top{flex-direction:column;gap:8px}.qa-client-summary-print__updated{text-align:left;padding-top:0}.qa-client-summary-print h1{font-size:24px}.qa-client-summary-print__fronts{grid-template-columns:1fr}.qa-client-summary-print__focus{grid-template-columns:1fr}.qa-focus__actions{justify-content:space-between;flex-wrap:wrap}.qa-client-summary-print__summary{grid-template-columns:1fr}.qa-client-summary-print__sm,.qa-client-summary-print__sm:nth-child(2){border-right:0;border-bottom:1px solid var(--line)}.qa-client-summary-print__sm:last-child{border-bottom:0}}
      `}</style>
      <div className="qa-client-summary-print__wrap">
        <header className="qa-client-summary-print__top">
          <div>
            <h1>{firstName(cliente)}, ESTE É O RESUMO DE TUDO</h1>
            <div className="qa-client-summary-print__meta"><span className="qa-client-summary-print__dot" />{statusLine}</div>
          </div>
          <div className="qa-client-summary-print__updated"><small>ATUALIZADO</small>{updated} · {updatedTime}</div>
        </header>

        <div className="qa-client-summary-print__toolbar" aria-label="Filtros do resumo">
          {filters.map((filter) => <span className="qa-client-summary-print__chip" key={filter}>{filter}</span>)}
        </div>

        <section className="qa-urgbanner" aria-label="Próximo vencimento" aria-live="polite">
          <div className="qa-urgbanner__body">
            <div className="qa-urgbanner__kicker">PRÓXIMO VENCIMENTO · AÇÃO IMEDIATA</div>
            <h2 className="qa-urgbanner__title">{activeUrgent ? activeUrgent.label : "Nenhum documento crítico"}</h2>
            <p className="qa-urgbanner__sub">{activeUrgent ? activeUrgent.sub : "Tudo em dia · nenhum item em status vermelho nesta semana."}</p>
            <div className="qa-urgbanner__actions">
              <button className="qa-urgbanner__cta" type="button" onClick={() => onNavigate(activeUrgent?.navTo || "documentos")}>{(() => {
                const txt = `${activeUrgent?.label || ""} ${activeUrgent?.sub || ""}`.toLowerCase();
                if (/residênc|residenc|comprovante/.test(txt)) return "ATUALIZAR AGORA →";
                return activeUrgent?.ctaLabel || "AGENDAR AGORA →";
              })()}</button>
              <button className="qa-urgbanner__ghost" type="button" onClick={() => onNavigate(activeUrgent?.navTo || "documentos")}>VER DETALHES</button>
            </div>
            {snapshot.urgents.length > 1 && (
              <div className="qa-urgbanner__pages" role="tablist" aria-label="Documentos críticos">
                {snapshot.urgents.map((urgent, index) => (
                  <button
                    className={`qa-urgbanner__page ${index === focusIndex ? "is-active" : ""}`}
                    key={`${urgent.label}-${index}`}
                    type="button"
                    aria-label={`Ir para ${urgent.label}`}
                    onClick={() => setFocusIndex(index)}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="qa-urgbanner__count" aria-hidden={!activeUrgent}>
            <div className="qa-urgbanner__num">{activeUrgent ? String(Math.max(0, activeUrgent.days)).padStart(2, "0") : "--"}</div>
            <div className="qa-urgbanner__numk">DIAS RESTANTES</div>
          </div>
        </section>

        <div className="qa-client-summary-print__label" style={{ marginTop: 24 }}>SUAS CINCO FRENTES</div>
        <section className="qa-client-summary-print__fronts" aria-label="Suas quatro frentes">
          {snapshot.fronts.map((front) => (
            <article className={`qa-front-card ${front.tone === "amber" ? "amber" : ""}`} key={front.key} onClick={() => onNavigate(front.navTo)} role="button" tabIndex={0}>
              <div className="qa-front-card__head">
                <div><h2>{front.title}</h2><div className="qa-front-card__sub">Total de itens monitorados</div></div>
                <div className="qa-front-card__num">{front.count}</div>
              </div>
              {front.items.length === 0 && <div className="qa-front-card__item"><span>Nenhum item monitorado</span><strong>—</strong></div>}
              {front.items.map((item, index) => (
                <div className="qa-front-card__item" key={`${front.key}-${index}-${item.label}`}>
                  <span>{item.label}</span><strong className={item.tone}>{item.status}</strong>
                </div>
              ))}
            </article>
          ))}
        </section>

        <section className="qa-client-summary-print__summary" aria-label="Indicadores do resumo">
          {snapshot.summary.map(([label, value, small]) => (
            <div className="qa-client-summary-print__sm" key={label}>
              <div className="qa-client-summary-print__k">{label}</div>
              <div className="qa-client-summary-print__v">{value}{small && <small>{small}</small>}</div>
            </div>
          ))}
        </section>
        <div className="qa-client-summary-print__footer">QUERO ARMAS · COCKPIT Z6 · RESUMO · DECK V29</div>
      </div>
    </main>
  );
}