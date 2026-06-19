import { useEffect } from "react";

const STYLES = `
:root{
  --paper:#f6f5f1;
  --ink:#141414;
  --ink-soft:#4a4a4a;
  --line:#e3e0d8;
  --bordo:#7A1F2B;
  --bordo-soft:#a83847;
  --amber:#a8741a;
  --danger:#8a1414;
  --ok:#1f4d2b;
  --card:#ffffff;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{background:var(--paper);color:var(--ink);font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.foco-wrap{max-width:880px;margin:0 auto;padding:32px 20px 80px}
.foco-header{display:flex;flex-direction:column;gap:6px;margin-bottom:24px}
.foco-eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--bordo);font-weight:600}
.foco-title{font-family:Fraunces,Georgia,serif;font-size:34px;line-height:1.1;letter-spacing:-.01em;font-weight:600;color:var(--ink)}
.foco-sub{font-size:14px;color:var(--ink-soft);margin-top:2px}

.foco-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0 28px}
.foco-sumcard{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.foco-sumlabel{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft);font-weight:600}
.foco-sumval{font-family:Fraunces,Georgia,serif;font-size:22px;font-weight:600;margin-top:4px;color:var(--ink)}
.foco-sumval.danger{color:var(--danger)}
.foco-sumval.amber{color:var(--amber)}

.foco-tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);margin-bottom:16px;overflow-x:auto;scrollbar-width:none}
.foco-tabs::-webkit-scrollbar{display:none}
.foco-tab{flex:0 0 auto;padding:10px 14px;font-size:13px;color:var(--ink-soft);border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;font-weight:500}
.foco-tab.active{color:var(--bordo);border-bottom-color:var(--bordo);font-weight:600}
.foco-tab .count{font-size:11px;color:var(--ink-soft);margin-left:6px;background:#efece4;padding:2px 6px;border-radius:8px}
.foco-tab.active .count{background:var(--bordo);color:#fff}

.foco-list{display:flex;flex-direction:column;gap:10px}
.foco-item{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:10px;padding:14px 16px;display:grid;grid-template-columns:64px 1fr auto;gap:14px;align-items:center}
.foco-item.lvl-danger{border-left-color:var(--danger)}
.foco-item.lvl-amber{border-left-color:var(--amber)}
.foco-item.lvl-ok{border-left-color:var(--ok)}
.foco-item.lvl-soft{border-left-color:#cbc6b8}

.foco-when{display:flex;flex-direction:column;align-items:center;justify-content:center;border-right:1px solid var(--line);padding-right:10px;min-width:64px}
.foco-when .num{font-family:Fraunces,Georgia,serif;font-size:28px;font-weight:600;line-height:1;color:var(--ink)}
.foco-when .unit{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);margin-top:4px;font-weight:600}
.foco-item.lvl-danger .foco-when .num{color:var(--danger)}
.foco-item.lvl-amber .foco-when .num{color:var(--amber)}
.foco-item.lvl-ok .foco-when .num{color:var(--ok)}

.foco-body{display:flex;flex-direction:column;gap:4px;min-width:0}
.foco-itemtitle{font-size:15px;font-weight:600;color:var(--ink);line-height:1.3}
.foco-meta{font-size:12px;color:var(--ink-soft);display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.foco-dot{width:3px;height:3px;border-radius:50%;background:var(--ink-soft);display:inline-block}
.foco-ctx{font-size:11px;color:var(--bordo);font-weight:600;letter-spacing:.04em;text-transform:uppercase}

.foco-cta{padding:8px 14px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;border:1px solid var(--ink);background:transparent;color:var(--ink);border-radius:6px;cursor:pointer;white-space:nowrap}
.foco-item.lvl-danger .foco-cta{background:var(--bordo);color:#fff;border-color:var(--bordo)}

.foco-section{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft);font-weight:600;margin:24px 0 10px}
.foco-section:first-of-type{margin-top:0}

@media (max-width:640px){
  .foco-wrap{padding:20px 14px 60px}
  .foco-title{font-size:26px}
  .foco-summary{grid-template-columns:repeat(3,1fr);gap:8px}
  .foco-sumval{font-size:18px}
  .foco-item{grid-template-columns:56px 1fr;gap:10px;padding:12px 14px}
  .foco-cta{grid-column:1 / -1;margin-top:6px;width:100%}
  .foco-when{min-width:56px;padding-right:8px}
  .foco-when .num{font-size:24px}
}
`;

type Level = "danger" | "amber" | "ok" | "soft";
type Item = { num: string; unit: string; title: string; meta: string; ctx: string; cta: string; level: Level };

const SECTIONS: { label: string; items: Item[] }[] = [
  {
    label: "Vence esta semana",
    items: [
      { num: "2", unit: "dias", title: "Comprovante de endereço (Pistola 9mm CAC)", meta: "Aquisição · SIGMA", ctx: "Bloqueia protocolo", cta: "Enviar agora", level: "danger" },
      { num: "4", unit: "dias", title: "Antecedentes Federal — validade expira", meta: "Renovação CR · PF/SP", ctx: "Reemitir", cta: "Reemitir", level: "danger" },
    ],
  },
  {
    label: "Próximos 30 dias",
    items: [
      { num: "12", unit: "dias", title: "Laudo psicológico — validade", meta: "CR Renovação · Dr. Almeida", ctx: "Agendar revalidação", cta: "Agendar", level: "amber" },
      { num: "18", unit: "dias", title: "Certidão estadual criminal", meta: "Porte Trânsito · SSP/SP", ctx: "Em revisão interna", cta: "Acompanhar", level: "amber" },
      { num: "25", unit: "dias", title: "Comprovante Clube de Tiro (frequência)", meta: "CR Renovação · Clube Alvo", ctx: "Solicitar ao clube", cta: "Solicitar", level: "amber" },
    ],
  },
  {
    label: "Sem prazo crítico",
    items: [
      { num: "60", unit: "dias", title: "Renovação de filiação CBC", meta: "CAC · contexto secundário", ctx: "Lembrete", cta: "Ver", level: "soft" },
      { num: "—", unit: "ok", title: "Compra autorizada — Pistola .380", meta: "Concluído · 03/06", ctx: "Arquivado", cta: "Abrir", level: "ok" },
    ],
  },
];

const TABS = [
  { key: "todos", label: "Todos", count: 7 },
  { key: "docs", label: "Documentos", count: 4 },
  { key: "prazos", label: "Prazos", count: 2 },
  { key: "renovacao", label: "Renovação", count: 3 },
  { key: "aquisicao", label: "Aquisição", count: 1 },
];

export default function ResumoClienteFocoMockPage() {
  useEffect(() => {
    const prev = document.title;
    document.title = "Mock · Resumo do Cliente — Foco no que vence";
    const linkInter = document.createElement("link");
    linkInter.rel = "stylesheet";
    linkInter.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap";
    document.head.appendChild(linkInter);
    return () => { document.title = prev; linkInter.remove(); };
  }, []);

  return (
    <>
      <style>{STYLES}</style>
      <div className="foco-wrap">
        <header className="foco-header">
          <span className="foco-eyebrow">Resumo do cliente</span>
          <h1 className="foco-title">Foco no que vence</h1>
          <p className="foco-sub">Joaquim Pereira · CR 123.456 · Processos como contexto secundário</p>
        </header>

        <div className="foco-summary">
          <div className="foco-sumcard">
            <div className="foco-sumlabel">Vence em ≤ 7 dias</div>
            <div className="foco-sumval danger">2</div>
          </div>
          <div className="foco-sumcard">
            <div className="foco-sumlabel">Em até 30 dias</div>
            <div className="foco-sumval amber">3</div>
          </div>
          <div className="foco-sumcard">
            <div className="foco-sumlabel">Processos ativos</div>
            <div className="foco-sumval">3</div>
          </div>
        </div>

        <div className="foco-tabs">
          {TABS.map((t, i) => (
            <div key={t.key} className={`foco-tab${i === 0 ? " active" : ""}`}>
              {t.label}<span className="count">{t.count}</span>
            </div>
          ))}
        </div>

        {SECTIONS.map((sec) => (
          <div key={sec.label}>
            <div className="foco-section">{sec.label}</div>
            <div className="foco-list">
              {sec.items.map((it, idx) => (
                <div key={idx} className={`foco-item lvl-${it.level}`}>
                  <div className="foco-when">
                    <span className="num">{it.num}</span>
                    <span className="unit">{it.unit}</span>
                  </div>
                  <div className="foco-body">
                    <div className="foco-itemtitle">{it.title}</div>
                    <div className="foco-meta">
                      <span>{it.meta}</span>
                      <span className="foco-dot" />
                      <span className="foco-ctx">{it.ctx}</span>
                    </div>
                  </div>
                  <button className="foco-cta">{it.cta}</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}