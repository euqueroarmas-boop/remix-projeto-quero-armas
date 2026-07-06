/**
 * Cockpit Z6 Light — CANÔNICO do Portal do Cliente.
 *
 * Stack visual oficial aprovada no mockup `cockpits/cockpit-z6.jpg`.
 * Toda página nova da área do cliente deve seguir esta composição.
 * Ver mem://style/quero-armas/cockpit-z6-light-canonical.
 *
 * Implementação fiel ao mockup: tokens HEX explícitos (não substituir por
 * tokens hsl/tailwind), Oswald para labels/números/H1, Inter para corpo.
 */
import React from "react";

export type CockpitZ6Stage = {
  label: string;        // ENDEREÇO, PROFISSIONAL, ANTECEDENTES, …
  status: "done" | "current" | "pending";
  date?: string;        // 12/02 | EM ANÁLISE
  index: number;        // 1..N
};

export type CockpitZ6TimelineEvent = {
  title: string;
  sub?: string;
  status: "done" | "current" | "pending";
};

export type CockpitZ6ChecklistItem = {
  label: string;
  badge: "RECEBIDO" | "EM ANÁLISE" | "PENDENTE" | string;
  tone: "green" | "amber" | "red" | "gray";
};

export type CockpitZ6Process = {
  id: string;
  badge: string;                                // EM ANDAMENTO | AGUARDA VOCÊ | NA POLÍCIA FEDERAL
  badgeTone: "bordo" | "amber" | "green" | "red" | "gray";
  protocolo?: string;                           // PROTOCOLO PF · 0451-2024-PF/RJ
  titulo: string;                               // CR-2024-0451 · REGISTRO CR — PISTOLA GLOCK G19
  progressoPct: number;                         // 45
  progressoTone: "bordo" | "amber" | "green" | "red";
  etapaAtual: string;                           // ANTECEDENTES
  etapaAtualTone?: "default" | "danger";
  previsao?: { label: string; value: string };  // {label: "Prev. conclusão", value: "14/MAR/2026"}
  metricaTempo?: { label: string; value: string; tone?: "default" | "danger" }; // {label: "Dias em andamento", value: "16 DIAS"}
  /** Variante detalhada (Z6 processo 1): stepper de 5 etapas + timeline + checklist. */
  detalhado?: {
    stages: CockpitZ6Stage[];
    timeline: CockpitZ6TimelineEvent[];
    checklist: CockpitZ6ChecklistItem[];
    proximoPasso?: string;
  };
  /** Variante compacta (Z6 processos 2 e 3): banner opcional + barras horizontais. */
  compacto?: {
    banner?: { tipo: "danger" | "info"; titulo: string; sub: string; cta?: { label: string; onClick?: () => void } };
    barras: { label: string; tone: "done" | "current" | "pending" }[];
    rodape?: React.ReactNode;
  };
};

export type CockpitZ6Kpi = {
  label: string;
  value: string;
  sub: string;
  dot: "amber" | "blue" | "bordo" | "green" | "gray" | "red";
};

export type CockpitZ6FocoDoDia = {
  titulo: string;
  descricao: string;
  cta: { label: string; onClick?: () => void };
};

export interface CockpitZ6MeusProcessosProps {
  nomeCliente: string;
  cpfMascarado: string;
  membroDesde: string;             // FEV/2024
  processosAtivos: number;
  focoDoDia?: CockpitZ6FocoDoDia | null;
  kpis: CockpitZ6Kpi[];            // 6 KPIs humanos
  processos: CockpitZ6Process[];
}

const DOT: Record<CockpitZ6Kpi["dot"], string> = {
  amber: "#D6A64B",
  blue: "#3A6FB3",
  bordo: "#7A1F2B",
  green: "#2F8F4A",
  gray: "#8A8A8A",
  red: "#D9342B",
};

const BADGE_TONE: Record<NonNullable<CockpitZ6Process["badgeTone"]>, { bg: string; fg: string }> = {
  bordo: { bg: "#7A1F2B", fg: "#FFFFFF" },
  amber: { bg: "#FCEFCE", fg: "#7A5A14" },
  green: { bg: "#E3F2E8", fg: "#1F6638" },
  red: { bg: "#FCE3E1", fg: "#8A1410" },
  gray: { bg: "#EDEDED", fg: "#444444" },
};

const CHECK_TONE: Record<CockpitZ6ChecklistItem["tone"], { bg: string; fg: string }> = {
  green: { bg: "#E3F2E8", fg: "#1F6638" },
  amber: { bg: "#FCEFCE", fg: "#7A5A14" },
  red: { bg: "#FCE3E1", fg: "#8A1410" },
  gray: { bg: "#EDEDED", fg: "#444444" },
};

const PROGRESS_FILL: Record<CockpitZ6Process["progressoTone"], string> = {
  bordo: "#7A1F2B",
  amber: "#D6A64B",
  green: "#2F8F4A",
  red: "#D9342B",
};

const STAGE_CIRCLE: Record<CockpitZ6Stage["status"], { bg: string; fg: string }> = {
  done: { bg: "#2F8F4A", fg: "#FFFFFF" },
  current: { bg: "#D6A64B", fg: "#0A0A0A" },
  pending: { bg: "#EDEDED", fg: "#7A7A7A" },
};

const Badge: React.FC<{ tone: CockpitZ6Process["badgeTone"]; children: React.ReactNode }> = ({ tone, children }) => {
  const t = BADGE_TONE[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: 2,
        fontSize: 10,
        fontFamily: "Oswald, sans-serif",
        letterSpacing: ".14em",
        fontWeight: 600,
        background: t.bg,
        color: t.fg,
      }}
    >
      {children}
    </span>
  );
};

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 4, overflow: "hidden", ...style }}>{children}</div>
);

/* -------------------- Variante detalhada (processo 1 do mockup) -------------------- */
const ProcessoDetalhado: React.FC<{ p: CockpitZ6Process }> = ({ p }) => {
  const d = p.detalhado!;
  return (
    <div className="z6-proc-grid">
      <div className="z6-proc-left">
        <div className="z6-lab">PROGRESSO</div>
        <div className="z6-pct">
          {p.progressoPct}
          <small>%</small>
        </div>
        <div className="z6-bar"><i style={{ width: `${p.progressoPct}%`, background: PROGRESS_FILL[p.progressoTone] }} /></div>
        <div style={{ fontSize: 11, color: "#6A6A6A", marginTop: 14 }}>Etapa atual</div>
        <div className="z6-etapa" style={p.etapaAtualTone === "danger" ? { color: "#8A1410" } : undefined}>{p.etapaAtual}</div>
        {p.previsao && (
          <div className="z6-prev">
            {p.previsao.label} <b>{p.previsao.value}</b>
          </div>
        )}
        {p.metricaTempo && (
          <div className="z6-prev">
            {p.metricaTempo.label} <b style={p.metricaTempo.tone === "danger" ? { color: "#8A1410" } : undefined}>{p.metricaTempo.value}</b>
          </div>
        )}
      </div>
      <div>
        {/* Stepper 5 etapas */}
        <div className="z6-step-row">
          {d.stages.map((s, idx) => (
            <React.Fragment key={s.label}>
              <div className="z6-item">
                <div
                  className="z6-c"
                  style={{ background: STAGE_CIRCLE[s.status].bg, color: STAGE_CIRCLE[s.status].fg }}
                >
                  {s.status === "done" ? "✓" : s.index}
                </div>
                <div className="z6-t" style={s.status === "pending" ? { color: "#7A7A7A" } : undefined}>{s.label}</div>
                {s.date && (
                  <div className="z6-d" style={s.status === "current" ? { color: "#D6A64B" } : undefined}>{s.date}</div>
                )}
              </div>
              {idx < d.stages.length - 1 && (
                <div className="z6-seg" style={{ background: s.status === "done" ? "#2F8F4A" : "#E5E5E5" }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Linha do tempo + Checklist */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 6 }}>
          <div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 10, letterSpacing: ".2em", color: "#7A7A7A", marginBottom: 10 }}>LINHA DO TEMPO</div>
            <div style={{ borderLeft: "2px solid #E5E5E5", paddingLeft: 14, marginLeft: 6 }}>
              {d.timeline.map((ev, i) => {
                const dotBg = ev.status === "done" ? "#2F8F4A" : ev.status === "current" ? "#D6A64B" : "#CDCDCD";
                const isCurrent = ev.status === "current";
                const isPending = ev.status === "pending";
                return (
                  <div key={i} style={{ marginBottom: 11, position: "relative", opacity: isPending ? 0.55 : 1 }}>
                    <span
                      style={{
                        position: "absolute",
                        left: -21,
                        top: 3,
                        width: isCurrent ? 11 : 10,
                        height: isCurrent ? 11 : 10,
                        borderRadius: "50%",
                        background: dotBg,
                        boxShadow: isCurrent ? "0 0 0 3px #FCEFCE" : undefined,
                      }}
                    />
                    <div style={{ fontSize: 11.5, fontWeight: isPending ? 400 : 600 }}>{ev.title}</div>
                    {ev.sub && <div style={{ fontSize: 10.5, color: "#7A7A7A" }}>{ev.sub}</div>}
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 10, letterSpacing: ".2em", color: "#7A7A7A", marginBottom: 10 }}>CHECKLIST · ETAPA ATUAL</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {d.checklist.map((c, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#F7F7F7", borderRadius: 3 }}>
                  <span style={{ fontSize: 11.5 }}>{c.label}</span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "3px 8px",
                      borderRadius: 2,
                      fontSize: 10,
                      fontFamily: "Oswald, sans-serif",
                      letterSpacing: ".14em",
                      fontWeight: 600,
                      background: CHECK_TONE[c.tone].bg,
                      color: CHECK_TONE[c.tone].fg,
                    }}
                  >
                    {c.badge}
                  </span>
                </div>
              ))}
            </div>
            {d.proximoPasso && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: "#FCEFCE", borderLeft: "3px solid #D6A64B", borderRadius: 2, fontSize: 11 }}>
                <b>Próximo passo automático:</b> {d.proximoPasso}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------- Variante compacta (processos 2 e 3 do mockup) -------------------- */
const ProcessoCompacto: React.FC<{ p: CockpitZ6Process }> = ({ p }) => {
  const c = p.compacto!;
  return (
    <div className="z6-proc-grid">
      <div className="z6-proc-left">
        <div className="z6-lab">PROGRESSO</div>
        <div className="z6-pct">
          {p.progressoPct}
          <small>%</small>
        </div>
        <div className="z6-bar"><i style={{ width: `${p.progressoPct}%`, background: PROGRESS_FILL[p.progressoTone] }} /></div>
        <div style={{ fontSize: 11, color: "#6A6A6A", marginTop: 14 }}>Etapa atual</div>
        <div className="z6-etapa" style={p.etapaAtualTone === "danger" ? { color: "#8A1410" } : undefined}>{p.etapaAtual}</div>
        {p.previsao && (
          <div className="z6-prev">
            {p.previsao.label} <b>{p.previsao.value}</b>
          </div>
        )}
        {p.metricaTempo && (
          <div className="z6-prev">
            {p.metricaTempo.label} <b style={p.metricaTempo.tone === "danger" ? { color: "#8A1410" } : undefined}>{p.metricaTempo.value}</b>
          </div>
        )}
      </div>
      <div>
        {c.banner && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 12px",
              background: c.banner.tipo === "danger" ? "#FCE3E1" : "#FCEFCE",
              borderRadius: 3,
              marginBottom: 14,
            }}
          >
            <div>
              <b style={{ fontSize: 12, color: c.banner.tipo === "danger" ? "#8A1410" : "#7A5A14" }}>{c.banner.titulo}</b>
              <div style={{ fontSize: 11, color: "#6A6A6A", marginTop: 2 }}>{c.banner.sub}</div>
            </div>
            {c.banner.cta && (
              <button
                type="button"
                onClick={c.banner.cta.onClick}
                style={{ background: "#7A1F2B", color: "#fff", border: 0, padding: "8px 14px", fontFamily: "Oswald, sans-serif", fontSize: 10, letterSpacing: ".14em", cursor: "pointer", borderRadius: 2 }}
              >
                {c.banner.cta.label}
              </button>
            )}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, textAlign: "center" }}>
          {c.barras.map((b, i) => {
            const bg = b.tone === "done" ? "#2F8F4A" : b.tone === "current" ? "#D6A64B" : "#EDEDED";
            const color = b.tone === "current" ? "#D6A64B" : b.tone === "pending" ? "#999" : "#0A0A0A";
            return (
              <div key={i}>
                <div style={{ height: 4, background: bg, borderRadius: 2 }} />
                <div style={{ fontSize: 9.5, fontFamily: "Oswald, sans-serif", letterSpacing: ".14em", marginTop: 6, color }}>{b.label}</div>
              </div>
            );
          })}
        </div>
        {c.rodape && <div style={{ fontSize: 11.5, color: "#6A6A6A", marginTop: 12 }}>{c.rodape}</div>}
      </div>
    </div>
  );
};

/* -------------------- Componente principal -------------------- */
export const CockpitZ6MeusProcessos: React.FC<CockpitZ6MeusProcessosProps> = ({
  nomeCliente,
  cpfMascarado,
  membroDesde,
  processosAtivos,
  focoDoDia,
  kpis,
  processos,
}) => {
  return (
    <div className="z6-root" style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: "#0A0A0A", fontSize: 13, lineHeight: 1.45 }}>
      {/* Estilos isolados do cockpit (não afetam outras telas) */}
      <style>{`
        .z6-root .z6-proc-grid{display:grid;grid-template-columns:170px 1fr;gap:24px}
        .z6-root .z6-proc-left{border-right:1px solid #ECECEC;padding-right:20px}
        .z6-root .z6-lab{font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:.2em;color:#7A7A7A}
        .z6-root .z6-pct{font-family:'Oswald',sans-serif;font-size:54px;font-weight:600;line-height:1;margin-top:4px;color:#0A0A0A}
        .z6-root .z6-pct small{font-size:20px;color:#7A7A7A;font-weight:500}
        .z6-root .z6-bar{height:6px;background:#EDEDED;border-radius:3px;margin-top:10px;overflow:hidden}
        .z6-root .z6-bar > i{display:block;height:100%;border-radius:3px}
        .z6-root .z6-etapa{font-family:'Oswald',sans-serif;font-size:13px;letter-spacing:.08em;font-weight:600;margin-top:4px;color:#0A0A0A}
        .z6-root .z6-prev{font-size:10.5px;color:#7A7A7A;margin-top:12px}
        .z6-root .z6-prev b{color:#0A0A0A;font-size:12px;display:block;margin-top:2px;font-family:'Oswald',sans-serif;letter-spacing:.06em}
        .z6-root .z6-step-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
        .z6-root .z6-item{flex:1;text-align:center}
        .z6-root .z6-item .z6-c{width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;margin:0 auto}
        .z6-root .z6-item .z6-t{font-size:9.5px;font-family:'Oswald',sans-serif;letter-spacing:.14em;margin-top:6px;color:#0A0A0A}
        .z6-root .z6-item .z6-d{font-size:9px;color:#7A7A7A;margin-top:1px}
        .z6-root .z6-step-row .z6-seg{flex:1;height:2px;margin:0 -8px}
        @media (max-width: 900px){ .z6-root .z6-proc-grid{grid-template-columns:1fr} .z6-root .z6-proc-left{border-right:0;border-bottom:1px solid #ECECEC;padding-right:0;padding-bottom:16px} }
      `}</style>

      {/* HEADER cliente-centric */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 24, fontWeight: 700, letterSpacing: ".04em", color: "#0A0A0A", lineHeight: 1.05, margin: 0, textTransform: "uppercase" }}>
          {nomeCliente.toUpperCase()}, ESSES SÃO SEUS PROCESSOS
        </h1>
        <div style={{ marginTop: 11, fontSize: 10, fontWeight: 900, color: "#6A6A6A", display: "flex", gap: 18, flexWrap: "wrap", fontFamily: "'Arial Narrow', Arial, sans-serif", letterSpacing: ".22em", textTransform: "uppercase" }}>
          <span>CPF · <b style={{ color: "#0A0A0A", fontWeight: 600 }}>{cpfMascarado}</b></span>
          <span>MEMBRO DESDE · <b style={{ color: "#0A0A0A", fontWeight: 600 }}>{membroDesde}</b></span>
          <span>{processosAtivos} PROCESSOS ATIVOS</span>
        </div>
      </div>

      {/* FOCO DO DIA */}
      {focoDoDia && (
        <Card style={{ marginBottom: 16, borderLeft: "3px solid #D9342B" }}>
          <div style={{ padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif", fontSize: 11, fontWeight: 900, letterSpacing: ".28em", color: "#D9342B", textTransform: "uppercase" }}>FOCO DO DIA · AÇÃO BLOQUEANTE</div>
              <div style={{ fontFamily: "Georgia,'Times New Roman',serif", fontSize: 26, lineHeight: 1.1, marginTop: 10, fontWeight: 700, letterSpacing: "-.015em", color: "#0c0c0c" }}>{focoDoDia.titulo}</div>
              <div style={{ fontFamily: "Arial,sans-serif", fontSize: 13, color: "#5a5a5a", marginTop: 6 }}>{focoDoDia.descricao}</div>
            </div>
            <button
              type="button"
              onClick={focoDoDia.cta.onClick}
              style={{ background: "#7A1F2B", color: "#fff", border: 0, padding: "11px 16px", fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif", fontWeight: 900, letterSpacing: ".22em", fontSize: 11, cursor: "pointer", borderRadius: 2, textTransform: "uppercase" }}
            >
              {focoDoDia.cta.label}
            </button>
          </div>
        </Card>
      )}

      {/* 6 KPIs humanos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 10,
          marginBottom: 20,
        }}
        className="z6-kpis"
      >
        <style>{`
          @media (max-width: 1100px){ .z6-kpis{grid-template-columns:repeat(3,minmax(0,1fr)) !important} }
          @media (max-width: 640px){ .z6-kpis{grid-template-columns:repeat(2,minmax(0,1fr)) !important} }
        `}</style>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid #E5E5E5", padding: "14px 14px", borderRadius: 4 }}>
            <div style={{ fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif", fontSize: 10, fontWeight: 900, letterSpacing: ".18em", color: "#7A7A7A", display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", whiteSpace: "nowrap" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", display: "inline-block", background: DOT[k.dot], flexShrink: 0 }} />
              <span style={{ whiteSpace: "nowrap" }}>{k.label}</span>
            </div>
            <div style={{ fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif", fontSize: 26, lineHeight: 1, fontWeight: 900, marginTop: 9, color: "#0A0A0A" }}>{k.value}</div>
            <div style={{ fontFamily: "Arial,sans-serif", fontSize: 11, fontWeight: 700, color: "#7A7A7A", marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Cards de processo */}
      {processos.map((p, idx) => (
        <Card key={p.id} style={{ marginBottom: idx === processos.length - 1 ? 0 : 14 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #EFEFEF", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <Badge tone={p.badgeTone}>{p.badge}</Badge>
              <h2 style={{ fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif", fontSize: 13, letterSpacing: ".24em", color: "#0A0A0A", fontWeight: 900, margin: 0, textTransform: "uppercase" }}>{p.titulo}</h2>
            </div>
            {p.protocolo && (
              <div style={{ fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif", fontSize: 10, fontWeight: 900, color: "#6A6A6A", letterSpacing: ".22em", textTransform: "uppercase" }}>{p.protocolo}</div>
            )}
          </div>
          <div style={{ padding: "16px 18px" }}>
            {p.detalhado ? <ProcessoDetalhado p={p} /> : p.compacto ? <ProcessoCompacto p={p} /> : null}
          </div>
        </Card>
      ))}
    </div>
  );
};

export default CockpitZ6MeusProcessos;