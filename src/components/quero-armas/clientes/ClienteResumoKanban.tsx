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
type Urgent = { label: string; days: number; navTo: string };

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

    const fronts: Front[] = [
      { key: "arsenal", title: "ARSENAL", count: arsenalItems.length, tone: "bordo", items: arsenalItems.slice(0, 3), navTo: "arsenal" },
      { key: "exames", title: "EXAMES", count: examesItems.length, tone: "amber", items: examesItems.slice(0, 3), navTo: "documentos" },
      { key: "filiacao", title: "FILIAÇÃO", count: filiacaoItems.length, tone: "amber", items: filiacaoItems.slice(0, 3), navTo: "documentos" },
      { key: "processos", title: "PROCESSOS", count: activeItems.length, tone: "bordo", items: processoItems.slice(0, 3), navTo: "processos" },
    ];

    const urgents: Urgent[] = [];
    const pushUrgent = (label: string, date: string | null | undefined, navTo: string) => {
      const days = daysUntil(date);
      if (days === null || days > 7) return;
      urgents.push({ label, days, navTo });
    };
    if (cadastro?.validade_cr) pushUrgent("CR — CERTIFICADO", cadastro.validade_cr, "arsenal");
    crafs.forEach((cr: any) => pushUrgent(`CRAF — ${shortName(cr.nome_arma || cr.nome_craf, "ARMA")}`, cr.data_validade, "arsenal"));
    gtes.forEach((g: any) => pushUrgent(`GTE — ${shortName(g.nome_arma || g.nome_gte, "ARMA")}`, g.data_validade, "arsenal"));
    filiacoes.forEach((f: any) => pushUrgent(`FILIAÇÃO — ${shortName(f.nome_filiacao || f.nome_clube, "CLUBE")}`, f.validade_filiacao, "documentos"));
    examesItems.forEach((e) => {
      const source = e.label.includes("PSICOLÓGICO") ? exameByTipo.get("psicologico") : exameByTipo.get("tiro");
      pushUrgent(e.label, source?.data_vencimento, "documentos");
    });
    meusDocs.forEach((doc: any) => pushUrgent(shortName(doc?.nome_documento || doc?.tipo_documento || doc?.arquivo_nome, "DOCUMENTO"), doc?.data_validade_efetiva || doc?.data_validade, "documentos"));
    processoDocs.forEach((doc: any) => pushUrgent(shortName(doc?.nome_documento || doc?.tipo_documento || doc?.arquivo_nome, "DOCUMENTO DO PROCESSO"), doc?.data_validade_efetiva || doc?.data_validade, "processos"));
    prazosProc.forEach((p: any) => {
      if (typeof p.diasRestantes === "number" && p.diasRestantes <= 7) urgents.push({ label: `${p.evento} — ${p.servicoNome || "PROCESSO"}`, days: p.diasRestantes, navTo: "processos" });
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

  const activeUrgent = snapshot.urgents[focusIndex] || null;
  const statusLine = `${cadastro?.categoria_titular || cliente?.status_cliente || "CAÇADOR"}${cadastro?.numero_cr ? ` · CR ${cadastro.numero_cr}` : ""} · ${snapshot.activeItems.length} PROCESSOS EM ANDAMENTO`;
  const filters = [
    `TODOS ${snapshot.totalFronts}`,
    `ARSENAL ${snapshot.fronts[0].count}`,
    `EXAMES ${snapshot.fronts[1].count}`,
    `PROCESSOS ${snapshot.fronts[3].count}`,
  ];
  const updated = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date()).replace(/\./g, "").toUpperCase();
  const updatedTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());

  return (
    <main className="qa-client-summary-print">
      <style>{`
        .qa-client-summary-print{--paper:#f3f3f2;--card:#ffffff;--ink:#111111;--muted:#77777d;--line:#e3e3e1;--bordo:#7A1F2B;--amber:#d5a33d;--green:#278652;--red:#df2727;background:var(--paper);color:var(--ink);font-family:'Arial Narrow',Arial,sans-serif;letter-spacing:.02em;padding:28px 28px 34px;min-height:620px;border:0;border-radius:0;box-shadow:none;text-transform:uppercase}
        .qa-client-summary-print *{box-sizing:border-box}.qa-client-summary-print__wrap{max-width:1280px;margin:0 auto}.qa-client-summary-print__top{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:24px}.qa-client-summary-print h1{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-weight:900;font-size:28px;line-height:1.05;margin:0;letter-spacing:.04em}.qa-client-summary-print__meta{display:flex;align-items:center;gap:8px;margin-top:11px;font-size:10px;font-weight:900;letter-spacing:.22em;color:var(--muted)}.qa-client-summary-print__dot{width:7px;height:7px;border-radius:999px;background:var(--bordo);display:inline-block}.qa-client-summary-print__updated{text-align:right;font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-weight:900;font-size:14px;line-height:1.15;letter-spacing:.08em;padding-top:22px;white-space:nowrap}.qa-client-summary-print__updated small{display:block;color:var(--muted);font-size:9px;letter-spacing:.36em;margin-bottom:4px}.qa-client-summary-print__toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.qa-client-summary-print__chip{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:8px 13px 7px;font-size:9px;font-weight:900;letter-spacing:.18em;color:#303030;box-shadow:0 1px 1px rgba(0,0,0,.04)}.qa-client-summary-print__chip:first-child{background:#111;color:#fff;border-color:#111}.qa-client-summary-print__label{font-size:12px;font-weight:900;letter-spacing:.22em;margin:0 0 15px}.qa-client-summary-print__fronts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px}.qa-front-card{background:var(--card);border:1px solid var(--line);border-radius:3px;min-height:240px;padding:27px 18px 18px;box-shadow:0 6px 14px rgba(17,17,17,.04);position:relative}.qa-front-card:before{content:"";position:absolute;left:-1px;right:-1px;top:-1px;height:4px;background:var(--bordo);border-radius:3px 3px 0 0}.qa-front-card.amber:before{background:var(--amber)}.qa-front-card__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px solid #ededed;padding-bottom:9px;margin-bottom:9px}.qa-front-card h2{font-family:Oswald,'Arial Narrow',Arial,sans-serif;margin:0;font-size:15px;font-weight:900;letter-spacing:.24em;line-height:1}.qa-front-card__sub{font-size:11px;letter-spacing:0;text-transform:none;color:#9a9a9f;margin-top:5px}.qa-front-card__num{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:34px;line-height:.82;font-weight:900;color:var(--bordo);letter-spacing:0}.qa-front-card.amber .qa-front-card__num{color:var(--amber)}.qa-front-card__item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:baseline;padding:8px 0;font-size:12px;font-weight:900;letter-spacing:-.01em;text-transform:none;border-bottom:1px solid #f1f1f1}.qa-front-card__item:last-child{border-bottom:0}.qa-front-card__item span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qa-front-card__item strong{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:12px;letter-spacing:.08em;color:var(--muted);white-space:nowrap}.qa-front-card__item strong.bad{color:var(--red)}.qa-front-card__item strong.warn{color:var(--amber)}.qa-front-card__item strong.ok{color:var(--green)}.qa-client-summary-print__focus{margin-top:28px;background:var(--card);border:1px solid var(--line);border-radius:3px;min-height:78px;display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;padding:18px 18px 18px 22px;position:relative}.qa-client-summary-print__focus:before{content:"";position:absolute;left:-1px;top:-1px;bottom:-1px;width:4px;background:var(--red);border-radius:3px 0 0 3px}.qa-focus__k{font-size:10px;font-weight:900;letter-spacing:.24em;color:var(--red);margin-bottom:8px}.qa-focus__text{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:18px;font-weight:900;letter-spacing:0;text-transform:none}.qa-focus__actions{display:flex;align-items:center;gap:10px}.qa-focus__pages{display:flex;gap:5px}.qa-focus__page{width:22px;height:22px;border:1px solid var(--line);background:#fff;color:var(--muted);font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:10px;font-weight:900;cursor:pointer}.qa-focus__page.is-active{background:var(--bordo);border-color:var(--bordo);color:#fff}.qa-focus__btn{border:0;background:var(--bordo);color:#fff;font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:10px;font-weight:900;letter-spacing:.18em;padding:8px 12px;cursor:pointer}.qa-client-summary-print__summary{display:grid;grid-template-columns:repeat(4,1fr);margin-top:22px;border:1px solid var(--line);border-radius:3px;overflow:hidden;background:var(--card)}.qa-client-summary-print__sm{padding:16px 18px;border-right:1px solid var(--line);min-height:82px}.qa-client-summary-print__sm:last-child{border-right:0}.qa-client-summary-print__k{font-size:10px;font-weight:900;letter-spacing:.24em;color:var(--muted);margin-bottom:9px}.qa-client-summary-print__v{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:26px;line-height:1;font-weight:900;letter-spacing:0}.qa-client-summary-print__v small{font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:var(--muted);margin-left:6px;text-transform:none}.qa-client-summary-print__footer{text-align:center;margin-top:21px;color:#b1b1b1;font-size:9px;font-weight:900;letter-spacing:.22em}@media (max-width:1100px){.qa-client-summary-print__fronts{grid-template-columns:repeat(2,1fr)}.qa-client-summary-print__summary{grid-template-columns:repeat(2,1fr)}.qa-client-summary-print__sm:nth-child(2){border-right:0}.qa-client-summary-print__sm:nth-child(-n+2){border-bottom:1px solid var(--line)}}@media (max-width:680px){.qa-client-summary-print{padding:20px 14px 28px}.qa-client-summary-print__top{flex-direction:column;gap:8px}.qa-client-summary-print__updated{text-align:left;padding-top:0}.qa-client-summary-print h1{font-size:24px}.qa-client-summary-print__fronts{grid-template-columns:1fr}.qa-client-summary-print__focus{grid-template-columns:1fr}.qa-focus__actions{justify-content:space-between;flex-wrap:wrap}.qa-client-summary-print__summary{grid-template-columns:1fr}.qa-client-summary-print__sm,.qa-client-summary-print__sm:nth-child(2){border-right:0;border-bottom:1px solid var(--line)}.qa-client-summary-print__sm:last-child{border-bottom:0}}
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

        <div className="qa-client-summary-print__label">SUAS QUATRO FRENTES</div>
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

        <section className="qa-client-summary-print__focus" aria-label="Foco do dia" aria-live="polite">
          <div>
            <div className="qa-focus__k">FOCO DO DIA</div>
            <div className="qa-focus__text">
              {activeUrgent
                ? snapshot.urgents.length > 1
                  ? `${snapshot.urgents.length} documentos vencem nesta semana`
                  : `${activeUrgent.label} ${activeUrgent.days < 0 ? `venceu há ${Math.abs(activeUrgent.days)} dias` : activeUrgent.days === 0 ? "vence hoje" : `vence em ${activeUrgent.days} dias`}`
                : "Nenhum documento em status vermelho nesta semana"}
            </div>
          </div>
          <div className="qa-focus__actions">
            {snapshot.urgents.length > 1 && (
              <div className="qa-focus__pages" role="tablist" aria-label="Documentos críticos">
                {snapshot.urgents.map((urgent, index) => (
                  <button
                    className={`qa-focus__page ${index === focusIndex ? "is-active" : ""}`}
                    key={`${urgent.label}-${index}`}
                    type="button"
                    aria-label={`Ir para ${urgent.label}`}
                    onClick={() => { setFocusIndex(index); onNavigate(urgent.navTo); }}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            )}
            <button className="qa-focus__btn" type="button" onClick={() => onNavigate(activeUrgent?.navTo || "documentos")}>RESOLVER AGORA →</button>
          </div>
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