/**
 * Mockups · Hub documental "Adicionar Documento" — Stack Cockpit Z6 Light.
 *
 * Renderiza 5 variantes em HTML/React puro, reaproveitando os tokens HEX e a
 * tipografia canônica do Cockpit Z6 Light (Oswald + Inter). Nenhum texto é
 * inventado: as strings exibidas vêm do modal real
 * `src/components/quero-armas/clientes/ClienteDocsHubModal.tsx`.
 *
 * Uso: /mockups-hub-doc           → grade com as 5 variantes
 *      /mockups-hub-doc?v=1..5    → variante isolada (usada pelo Playwright)
 */
import React from "react";

/* Tokens canônicos Z6 Light */
const T = {
  page: "#F2F2F2",
  card: "#FFFFFF",
  border: "#E5E5E5",
  line: "#EFEFEF",
  ink: "#0A0A0A",
  ink2: "#6A6A6A",
  ink3: "#7A7A7A",
  bordo: "#7A1F2B",
  amber: "#D6A64B",
  amberBg: "#FCEFCE",
  amberInk: "#7A5A14",
  green: "#2F8F4A",
  greenBg: "#E3F2E8",
  greenInk: "#1F6638",
  red: "#D9342B",
  redBg: "#FCE3E1",
  redInk: "#8A1410",
  soft: "#F7F7F7",
};

const OSWALD = "'Oswald', sans-serif";
const INTER = "'Inter', -apple-system, sans-serif";

/* ---------- Copy literal extraída do modal real ---------- */
const COPY = {
  eyebrow: "HUB DOCUMENTAL",
  h1: "ADICIONAR DOCUMENTO",
  sub: "Anexe foto ou PDF — a IA identifica o tipo e preenche os campos automaticamente. Você só revisa antes de salvar.",
  arquivoLabel: "ARQUIVO",
  arquivoSub: "A IA identifica o tipo automaticamente",
  dropTitle: "Toque ou arraste o arquivo",
  dropSub: "JPG · PNG · PDF · até 20MB",
  ctaCamera: "Tirar foto agora",
  fileName: "antecedentes-justica-federal.pdf",
  fileSize: "184 KB",
  iaEyebrow: "TIPO IDENTIFICADO PELA IA",
  iaTitle: "CERTIDÃO DE ANTECEDENTES — JUSTIÇA FEDERAL",
  iaConf: "98% confiança",
  iaJust: "Documento emitido em 03/12/2025 com selo verificável da JF. Campos extraídos com alta legibilidade.",
  conformidadeLabel: "CONFORMIDADE COM DOCUMENTOS APROVADOS",
  revisarLabel: "REVISAR DADOS",
  revisarSub: "Preencha ou ajuste os dados identificados",
  campoTipo: "TIPO DE DOCUMENTO",
  campoTipoVal: "CERTIDÃO — ANTECEDENTES JF",
  campoEmissor: "ÓRGÃO EMISSOR",
  campoEmissorVal: "JUSTIÇA FEDERAL · 1ª REGIÃO",
  campoData: "DATA DE EMISSÃO",
  campoDataVal: "03/12/2025",
  campoValidade: "VALIDADE",
  campoValidadeVal: "03/03/2026",
  campoCpf: "CPF DO TITULAR",
  campoCpfVal: "***.456.789-**",
  salvar: "SALVAR NO ARSENAL",
  cancelar: "CANCELAR",
};

/* ---------- Átomos visuais Z6 ---------- */
const Card: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties }>> = ({ children, style }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 4, ...style }}>{children}</div>
);

const Lab: React.FC<React.PropsWithChildren<{ color?: string; style?: React.CSSProperties }>> = ({ children, color = T.ink3, style }) => (
  <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: ".2em", color, ...style }}>{children}</div>
);

const H1: React.FC<React.PropsWithChildren> = ({ children }) => (
  <h1 style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 700, letterSpacing: ".06em", color: T.ink, margin: 0, textTransform: "uppercase" }}>{children}</h1>
);

const BtnBordo: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties }>> = ({ children, style }) => (
  <button type="button" style={{ background: T.bordo, color: "#fff", border: 0, padding: "10px 18px", fontFamily: OSWALD, letterSpacing: ".16em", fontSize: 11, cursor: "pointer", borderRadius: 2, ...style }}>{children}</button>
);
const BtnGhost: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties }>> = ({ children, style }) => (
  <button type="button" style={{ background: "#fff", color: T.ink, border: `1px solid ${T.border}`, padding: "10px 16px", fontFamily: OSWALD, letterSpacing: ".16em", fontSize: 11, cursor: "pointer", borderRadius: 2, ...style }}>{children}</button>
);

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={{ fontFamily: OSWALD, fontSize: 9.5, letterSpacing: ".18em", color: T.ink3 }}>{label}</div>
    <div style={{ marginTop: 6, padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 2, background: "#fff", fontFamily: OSWALD, fontSize: 12, letterSpacing: ".05em", color: T.ink, textTransform: "uppercase" }}>{value}</div>
  </div>
);

const ArquivoBlock: React.FC = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: T.soft, borderRadius: 3 }}>
    <div style={{ width: 44, height: 44, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: OSWALD, fontSize: 11, letterSpacing: ".1em", color: T.bordo }}>PDF</div>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{COPY.fileName}</div>
      <div style={{ fontSize: 10.5, color: T.ink3, marginTop: 2 }}>{COPY.fileSize}</div>
    </div>
    <div style={{ width: 24, height: 24, borderRadius: "50%", background: T.green, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✓</div>
  </div>
);

const ConfChip: React.FC = () => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 9px", background: T.greenBg, color: T.greenInk, fontFamily: OSWALD, fontSize: 10, letterSpacing: ".14em", borderRadius: 2 }}>
    <span style={{ width: 6, height: 6, borderRadius: 99, background: T.green }} />
    {COPY.iaConf}
  </span>
);

const ConformidadeRow: React.FC<{ label: string; badge: string; tone: "green" | "amber" }> = ({ label, badge, tone }) => {
  const bg = tone === "green" ? T.greenBg : T.amberBg;
  const fg = tone === "green" ? T.greenInk : T.amberInk;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: T.soft, borderRadius: 3 }}>
      <span style={{ fontSize: 11.5, color: T.ink }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: 2, fontSize: 10, fontFamily: OSWALD, letterSpacing: ".14em", fontWeight: 600, background: bg, color: fg }}>{badge}</span>
    </div>
  );
};

const Header: React.FC = () => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: ".32em", color: T.ink3 }}>{COPY.eyebrow}</div>
    <H1>{COPY.h1}</H1>
    <p style={{ marginTop: 8, maxWidth: 720, fontSize: 12.5, lineHeight: 1.5, color: T.ink2 }}>{COPY.sub}</p>
  </div>
);

const Footer: React.FC = () => (
  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 18px", borderTop: `1px solid ${T.border}`, background: T.soft }}>
    <BtnGhost>{COPY.cancelar}</BtnGhost>
    <BtnBordo>{COPY.salvar}</BtnBordo>
  </div>
);

/* ============================================================
 *  V1 — Ficha catalográfica em 3 colunas (Arquivo · IA · Dados)
 * ============================================================ */
const V1: React.FC = () => (
  <Card>
    <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}` }}>
      <Header />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.1fr", gap: 0 }}>
      <div style={{ padding: 22, borderRight: `1px solid ${T.border}` }}>
        <Lab>01 · ARQUIVO</Lab>
        <div style={{ marginTop: 14 }}>
          <ArquivoBlock />
        </div>
        <div style={{ marginTop: 14, fontSize: 11.5, color: T.ink3 }}>{COPY.arquivoSub}</div>
      </div>
      <div style={{ padding: 22, borderRight: `1px solid ${T.border}` }}>
        <Lab>02 · {COPY.iaEyebrow}</Lab>
        <div style={{ marginTop: 12, fontFamily: OSWALD, fontSize: 14, letterSpacing: ".05em", color: T.ink }}>{COPY.iaTitle}</div>
        <div style={{ marginTop: 8 }}><ConfChip /></div>
        <p style={{ marginTop: 12, fontSize: 11.5, lineHeight: 1.5, color: T.ink2 }}>{COPY.iaJust}</p>
        <div style={{ marginTop: 16 }}>
          <Lab>{COPY.conformidadeLabel}</Lab>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            <ConformidadeRow label="CPF confere com cadastro" badge="OK" tone="green" />
            <ConformidadeRow label="Validade vigente" badge="OK" tone="green" />
            <ConformidadeRow label="Endereço cruzado" badge="VERIFICAR" tone="amber" />
          </div>
        </div>
      </div>
      <div style={{ padding: 22 }}>
        <Lab>03 · {COPY.revisarLabel}</Lab>
        <div style={{ marginTop: 8, fontSize: 11.5, color: T.ink3 }}>{COPY.revisarSub}</div>
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoTipo} value={COPY.campoTipoVal} /></div>
          <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoEmissor} value={COPY.campoEmissorVal} /></div>
          <Field label={COPY.campoData} value={COPY.campoDataVal} />
          <Field label={COPY.campoValidade} value={COPY.campoValidadeVal} />
          <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoCpf} value={COPY.campoCpfVal} /></div>
        </div>
      </div>
    </div>
    <Footer />
  </Card>
);

/* ============================================================
 *  V2 — Stepper Z6 horizontal (4 etapas) + conteúdo da etapa atual
 * ============================================================ */
const Stepper: React.FC<{ current: number }> = ({ current }) => {
  const steps = ["ANEXAR", "IA IDENTIFICOU", "REVISAR", "SALVAR"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {steps.map((s, i) => {
        const idx = i + 1;
        const done = idx < current;
        const cur = idx === current;
        const bg = done ? T.green : cur ? T.amber : "#EDEDED";
        const fg = done ? "#fff" : cur ? T.ink : T.ink3;
        return (
          <React.Fragment key={s}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: OSWALD, fontSize: 12, fontWeight: 700 }}>
                {done ? "✓" : idx}
              </div>
              <div style={{ fontFamily: OSWALD, fontSize: 11, letterSpacing: ".16em", color: cur ? T.ink : T.ink3 }}>{s}</div>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 2, margin: "0 14px", background: done ? T.green : T.border }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const V2: React.FC = () => (
  <Card>
    <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}` }}><Header /></div>
    <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}`, background: T.soft }}>
      <Stepper current={3} />
    </div>
    <div style={{ padding: 22, display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
      <div>
        <Lab>ARQUIVO ANEXADO</Lab>
        <div style={{ marginTop: 12 }}><ArquivoBlock /></div>
        <div style={{ marginTop: 14, padding: 12, background: T.greenBg, border: `1px solid ${T.green}33`, borderRadius: 3 }}>
          <Lab color={T.greenInk}>{COPY.iaEyebrow}</Lab>
          <div style={{ marginTop: 6, fontFamily: OSWALD, fontSize: 12.5, color: T.ink, letterSpacing: ".04em" }}>{COPY.iaTitle}</div>
          <div style={{ marginTop: 8 }}><ConfChip /></div>
        </div>
      </div>
      <div>
        <Lab>{COPY.revisarLabel}</Lab>
        <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 6 }}>{COPY.revisarSub}</div>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoTipo} value={COPY.campoTipoVal} /></div>
          <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoEmissor} value={COPY.campoEmissorVal} /></div>
          <Field label={COPY.campoData} value={COPY.campoDataVal} />
          <Field label={COPY.campoValidade} value={COPY.campoValidadeVal} />
          <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoCpf} value={COPY.campoCpfVal} /></div>
        </div>
      </div>
    </div>
    <Footer />
  </Card>
);

/* ============================================================
 *  V3 — Master/Detail com KPI strip Z6 (4 KPIs)
 * ============================================================ */
const Kpi: React.FC<{ label: string; value: string; sub: string; dot: string }> = ({ label, value, sub, dot }) => (
  <div style={{ padding: 14, border: `1px solid ${T.border}`, borderRadius: 3, background: "#fff" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: dot }} />
      <span style={{ fontFamily: OSWALD, fontSize: 9.5, letterSpacing: ".18em", color: T.ink3 }}>{label}</span>
    </div>
    <div style={{ marginTop: 8, fontFamily: OSWALD, fontSize: 26, fontWeight: 600, color: T.ink, lineHeight: 1 }}>{value}</div>
    <div style={{ marginTop: 6, fontSize: 10.5, color: T.ink3 }}>{sub}</div>
  </div>
);

const V3: React.FC = () => (
  <Card>
    <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}` }}><Header /></div>
    <div style={{ padding: "16px 22px", borderBottom: `1px solid ${T.border}`, background: T.soft }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <Kpi label="CONFIANÇA IA" value="98%" sub="ACIMA DO LIMIAR DE 85%" dot={T.green} />
        <Kpi label="CAMPOS LIDOS" value="5/5" sub="LEGIBILIDADE ALTA" dot={T.green} />
        <Kpi label="CONFORMIDADE" value="2/3" sub="1 ITEM PARA VERIFICAR" dot={T.amber} />
        <Kpi label="VALIDADE ATÉ" value="03/03/26" sub="VIGENTE POR 67 DIAS" dot={T.bordo} />
      </div>
    </div>
    <div style={{ padding: 22, display: "grid", gridTemplateColumns: "340px 1fr", gap: 24 }}>
      <div>
        <Lab>{COPY.arquivoLabel}</Lab>
        <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 6 }}>{COPY.arquivoSub}</div>
        <div style={{ marginTop: 12 }}><ArquivoBlock /></div>
        <div style={{ marginTop: 14 }}>
          <Lab>{COPY.conformidadeLabel}</Lab>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            <ConformidadeRow label="CPF confere com cadastro" badge="OK" tone="green" />
            <ConformidadeRow label="Validade vigente" badge="OK" tone="green" />
            <ConformidadeRow label="Endereço cruzado" badge="VERIFICAR" tone="amber" />
          </div>
        </div>
      </div>
      <div>
        <Lab>{COPY.revisarLabel}</Lab>
        <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 6 }}>{COPY.revisarSub}</div>
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoTipo} value={COPY.campoTipoVal} /></div>
          <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoEmissor} value={COPY.campoEmissorVal} /></div>
          <Field label={COPY.campoData} value={COPY.campoDataVal} />
          <Field label={COPY.campoValidade} value={COPY.campoValidadeVal} />
          <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoCpf} value={COPY.campoCpfVal} /></div>
        </div>
      </div>
    </div>
    <Footer />
  </Card>
);

/* ============================================================
 *  V4 — Timeline vertical Z6 (4 nós) à esquerda, conteúdo à direita
 * ============================================================ */
const Timeline: React.FC = () => {
  const ev = [
    { t: "ARQUIVO ANEXADO", s: COPY.fileName, status: "done" as const },
    { t: "IDENTIFICADO PELA IA", s: COPY.iaTitle, status: "done" as const },
    { t: "REVISÃO DOS DADOS", s: COPY.revisarSub, status: "current" as const },
    { t: "CONFORMIDADE & SALVAR", s: "Confirmar antes de gravar no Arsenal", status: "pending" as const },
  ];
  return (
    <div style={{ borderLeft: `2px solid ${T.border}`, paddingLeft: 18, marginLeft: 8 }}>
      {ev.map((e, i) => {
        const bg = e.status === "done" ? T.green : e.status === "current" ? T.amber : "#CDCDCD";
        const isCur = e.status === "current";
        const isPen = e.status === "pending";
        return (
          <div key={i} style={{ marginBottom: 18, position: "relative", opacity: isPen ? 0.6 : 1 }}>
            <span style={{ position: "absolute", left: -25, top: 3, width: isCur ? 12 : 10, height: isCur ? 12 : 10, borderRadius: 99, background: bg, boxShadow: isCur ? `0 0 0 3px ${T.amberBg}` : undefined }} />
            <div style={{ fontFamily: OSWALD, fontSize: 11, letterSpacing: ".16em", color: T.ink }}>{e.t}</div>
            <div style={{ fontSize: 11, color: T.ink3, marginTop: 3 }}>{e.s}</div>
          </div>
        );
      })}
    </div>
  );
};

const V4: React.FC = () => (
  <Card>
    <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}` }}><Header /></div>
    <div style={{ padding: 22, display: "grid", gridTemplateColumns: "260px 1fr", gap: 24 }}>
      <div>
        <Lab>FLUXO</Lab>
        <div style={{ marginTop: 14 }}><Timeline /></div>
      </div>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <Lab>{COPY.arquivoLabel}</Lab>
            <div style={{ marginTop: 10 }}><ArquivoBlock /></div>
          </div>
          <div>
            <Lab>{COPY.iaEyebrow}</Lab>
            <div style={{ marginTop: 10, padding: 12, background: T.soft, borderRadius: 3 }}>
              <div style={{ fontFamily: OSWALD, fontSize: 12.5, color: T.ink, letterSpacing: ".04em" }}>{COPY.iaTitle}</div>
              <div style={{ marginTop: 8 }}><ConfChip /></div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <Lab>{COPY.revisarLabel}</Lab>
          <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 6 }}>{COPY.revisarSub}</div>
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoTipo} value={COPY.campoTipoVal} /></div>
            <Field label={COPY.campoEmissor} value={COPY.campoEmissorVal} />
            <Field label={COPY.campoCpf} value={COPY.campoCpfVal} />
            <Field label={COPY.campoData} value={COPY.campoDataVal} />
            <Field label={COPY.campoValidade} value={COPY.campoValidadeVal} />
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <Lab>{COPY.conformidadeLabel}</Lab>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            <ConformidadeRow label="CPF confere com cadastro" badge="OK" tone="green" />
            <ConformidadeRow label="Validade vigente" badge="OK" tone="green" />
            <ConformidadeRow label="Endereço cruzado" badge="VERIFICAR" tone="amber" />
          </div>
        </div>
      </div>
    </div>
    <Footer />
  </Card>
);

/* ============================================================
 *  V5 — Cockpit denso com top rail preto Z6 + 4 cards em grid
 * ============================================================ */
const V5: React.FC = () => (
  <Card>
    {/* Top rail preto Z6 (mesma linguagem da sidebar do portal) */}
    <div style={{ background: T.ink, color: "#fff", padding: "14px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `3px solid ${T.amber}` }}>
      <div>
        <div style={{ fontFamily: OSWALD, fontSize: 9.5, letterSpacing: ".32em", color: T.amber }}>{COPY.eyebrow}</div>
        <div style={{ fontFamily: OSWALD, fontSize: 18, letterSpacing: ".08em", marginTop: 4 }}>{COPY.h1}</div>
      </div>
      <div style={{ fontSize: 11, color: "#BFBFBF", maxWidth: 480 }}>{COPY.sub}</div>
    </div>

    <div style={{ padding: 18, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>
      <div style={{ gridColumn: "span 4" }}>
        <Card style={{ padding: 16 }}>
          <Lab>01 · {COPY.arquivoLabel}</Lab>
          <div style={{ marginTop: 10 }}><ArquivoBlock /></div>
          <div style={{ marginTop: 10, fontSize: 11, color: T.ink3 }}>{COPY.dropSub}</div>
        </Card>
      </div>
      <div style={{ gridColumn: "span 4" }}>
        <Card style={{ padding: 16 }}>
          <Lab>02 · {COPY.iaEyebrow}</Lab>
          <div style={{ marginTop: 10, fontFamily: OSWALD, fontSize: 13, letterSpacing: ".05em", color: T.ink }}>{COPY.iaTitle}</div>
          <div style={{ marginTop: 8 }}><ConfChip /></div>
          <p style={{ marginTop: 10, fontSize: 11, color: T.ink2, lineHeight: 1.45 }}>{COPY.iaJust}</p>
        </Card>
      </div>
      <div style={{ gridColumn: "span 4" }}>
        <Card style={{ padding: 16 }}>
          <Lab>03 · {COPY.conformidadeLabel}</Lab>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            <ConformidadeRow label="CPF confere com cadastro" badge="OK" tone="green" />
            <ConformidadeRow label="Validade vigente" badge="OK" tone="green" />
            <ConformidadeRow label="Endereço cruzado" badge="VERIFICAR" tone="amber" />
          </div>
        </Card>
      </div>
      <div style={{ gridColumn: "span 12" }}>
        <Card style={{ padding: 16 }}>
          <Lab>04 · {COPY.revisarLabel}</Lab>
          <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 6 }}>{COPY.revisarSub}</div>
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <Field label={COPY.campoTipo} value={COPY.campoTipoVal} />
            <Field label={COPY.campoEmissor} value={COPY.campoEmissorVal} />
            <Field label={COPY.campoData} value={COPY.campoDataVal} />
            <Field label={COPY.campoValidade} value={COPY.campoValidadeVal} />
            <div style={{ gridColumn: "span 4" }}><Field label={COPY.campoCpf} value={COPY.campoCpfVal} /></div>
          </div>
        </Card>
      </div>
    </div>
    <Footer />
  </Card>
);

/* ============================================================
 *  V6 — Foco do Dia (card com borda esquerda #D9342B, padrão Z6)
 * ============================================================ */
const V6: React.FC = () => (
  <Card>
    <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}` }}><Header /></div>
    <div style={{ padding: 22 }}>
      <Card style={{ borderLeft: `3px solid ${T.red}`, marginBottom: 16 }}>
        <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <Lab color={T.red}>FOCO DO DIA · AÇÃO BLOQUEANTE</Lab>
            <div style={{ fontSize: 15, marginTop: 6, fontWeight: 600, color: T.ink }}>Revise os dados identificados pela IA e salve o documento no Arsenal.</div>
            <div style={{ fontSize: 11.5, color: T.ink2, marginTop: 4 }}>{COPY.iaTitle} · {COPY.iaConf}</div>
          </div>
          <BtnBordo>{COPY.salvar} →</BtnBordo>
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16 }}>
        <Card style={{ padding: 16 }}>
          <Lab>{COPY.arquivoLabel}</Lab>
          <div style={{ marginTop: 12 }}><ArquivoBlock /></div>
          <div style={{ marginTop: 14 }}>
            <Lab>{COPY.conformidadeLabel}</Lab>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              <ConformidadeRow label="CPF confere com cadastro" badge="OK" tone="green" />
              <ConformidadeRow label="Validade vigente" badge="OK" tone="green" />
              <ConformidadeRow label="Endereço cruzado" badge="VERIFICAR" tone="amber" />
            </div>
          </div>
        </Card>
        <Card style={{ padding: 16 }}>
          <Lab>{COPY.revisarLabel}</Lab>
          <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 6 }}>{COPY.revisarSub}</div>
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoTipo} value={COPY.campoTipoVal} /></div>
            <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoEmissor} value={COPY.campoEmissorVal} /></div>
            <Field label={COPY.campoData} value={COPY.campoDataVal} />
            <Field label={COPY.campoValidade} value={COPY.campoValidadeVal} />
            <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoCpf} value={COPY.campoCpfVal} /></div>
          </div>
        </Card>
      </div>
    </div>
    <Footer />
  </Card>
);

/* ============================================================
 *  V7 — Split: viewer de documento à esquerda, dossiê à direita
 * ============================================================ */
const DocViewer: React.FC = () => (
  <div style={{ background: T.soft, border: `1px solid ${T.border}`, borderRadius: 3, aspectRatio: "1 / 1.35", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
    <div style={{ position: "absolute", top: 10, left: 10, fontFamily: OSWALD, fontSize: 9.5, letterSpacing: ".2em", color: T.ink3 }}>PRÉ-VISUALIZAÇÃO</div>
    <div style={{ width: "70%", height: "78%", background: "#fff", border: `1px solid ${T.border}`, borderRadius: 2, padding: 18, fontFamily: OSWALD, color: T.ink, fontSize: 11, letterSpacing: ".06em", lineHeight: 1.6 }}>
      <div style={{ fontSize: 13, color: T.bordo }}>REPÚBLICA FEDERATIVA DO BRASIL</div>
      <div style={{ marginTop: 4, fontSize: 11 }}>JUSTIÇA FEDERAL · 1ª REGIÃO</div>
      <div style={{ marginTop: 18, fontSize: 14 }}>CERTIDÃO DE ANTECEDENTES</div>
      <div style={{ marginTop: 16, color: T.ink2 }}>NOME ▔▔▔▔▔▔▔▔▔▔▔▔▔▔</div>
      <div style={{ marginTop: 6, color: T.ink2 }}>CPF ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔</div>
      <div style={{ marginTop: 6, color: T.ink2 }}>EMISSÃO 03/12/2025</div>
      <div style={{ marginTop: 18, color: T.green }}>✓ NADA CONSTA</div>
    </div>
  </div>
);

const V7: React.FC = () => (
  <Card>
    <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}` }}><Header /></div>
    <div style={{ padding: 22, display: "grid", gridTemplateColumns: "360px 1fr", gap: 24 }}>
      <div>
        <Lab>{COPY.arquivoLabel}</Lab>
        <div style={{ marginTop: 12 }}><DocViewer /></div>
        <div style={{ marginTop: 12 }}><ArquivoBlock /></div>
      </div>
      <div>
        <Lab>{COPY.iaEyebrow}</Lab>
        <div style={{ marginTop: 8, fontFamily: OSWALD, fontSize: 14, letterSpacing: ".05em", color: T.ink }}>{COPY.iaTitle}</div>
        <div style={{ marginTop: 8 }}><ConfChip /></div>
        <p style={{ marginTop: 10, fontSize: 11.5, color: T.ink2, lineHeight: 1.5, maxWidth: 640 }}>{COPY.iaJust}</p>
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoTipo} value={COPY.campoTipoVal} /></div>
          <Field label={COPY.campoEmissor} value={COPY.campoEmissorVal} />
          <Field label={COPY.campoCpf} value={COPY.campoCpfVal} />
          <Field label={COPY.campoData} value={COPY.campoDataVal} />
          <Field label={COPY.campoValidade} value={COPY.campoValidadeVal} />
        </div>
        <div style={{ marginTop: 18 }}>
          <Lab>{COPY.conformidadeLabel}</Lab>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            <ConformidadeRow label="CPF confere com cadastro" badge="OK" tone="green" />
            <ConformidadeRow label="Validade vigente" badge="OK" tone="green" />
            <ConformidadeRow label="Endereço cruzado" badge="VERIFICAR" tone="amber" />
          </div>
        </div>
      </div>
    </div>
    <Footer />
  </Card>
);

/* ============================================================
 *  V8 — Boarding pass tático (ticket horizontal Z6)
 * ============================================================ */
const V8: React.FC = () => (
  <Card>
    <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}` }}><Header /></div>
    <div style={{ padding: 22 }}>
      <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 4, display: "grid", gridTemplateColumns: "1fr 2px 1.6fr 2px 1fr", overflow: "hidden" }}>
        <div style={{ padding: 20, background: T.ink, color: "#fff" }}>
          <Lab color={T.amber}>{COPY.arquivoLabel}</Lab>
          <div style={{ marginTop: 14, fontFamily: OSWALD, fontSize: 16, letterSpacing: ".06em" }}>PDF · 184 KB</div>
          <div style={{ marginTop: 4, fontSize: 11, color: "#BFBFBF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{COPY.fileName}</div>
          <div style={{ marginTop: 24 }}>
            <Lab color={T.amber}>STATUS</Lab>
            <div style={{ marginTop: 6, fontFamily: OSWALD, fontSize: 12, letterSpacing: ".14em", color: T.amber }}>● PRONTO PARA SALVAR</div>
          </div>
        </div>
        <div style={{ background: `repeating-linear-gradient(0deg, ${T.border} 0 4px, transparent 4px 8px)` }} />
        <div style={{ padding: 20 }}>
          <Lab>{COPY.iaEyebrow}</Lab>
          <div style={{ marginTop: 6, fontFamily: OSWALD, fontSize: 15, letterSpacing: ".05em", color: T.ink }}>{COPY.iaTitle}</div>
          <div style={{ marginTop: 8 }}><ConfChip /></div>
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label={COPY.campoEmissor} value={COPY.campoEmissorVal} />
            <Field label={COPY.campoData} value={COPY.campoDataVal} />
            <Field label={COPY.campoValidade} value={COPY.campoValidadeVal} />
          </div>
        </div>
        <div style={{ background: `repeating-linear-gradient(0deg, ${T.border} 0 4px, transparent 4px 8px)` }} />
        <div style={{ padding: 20, background: T.soft }}>
          <Lab>{COPY.conformidadeLabel}</Lab>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <ConformidadeRow label="CPF" badge="OK" tone="green" />
            <ConformidadeRow label="Validade" badge="OK" tone="green" />
            <ConformidadeRow label="Endereço" badge="VERIFICAR" tone="amber" />
          </div>
        </div>
      </div>
    </div>
    <Footer />
  </Card>
);

/* ============================================================
 *  V9 — Sidebar preta Z6 + canvas branco
 * ============================================================ */
const V9: React.FC = () => (
  <Card style={{ overflow: "hidden" }}>
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr" }}>
      <aside style={{ background: T.ink, color: "#fff", padding: "22px 18px", minHeight: 620 }}>
        <div style={{ fontFamily: OSWALD, fontSize: 9.5, letterSpacing: ".32em", color: T.amber }}>{COPY.eyebrow}</div>
        <div style={{ fontFamily: OSWALD, fontSize: 16, letterSpacing: ".08em", marginTop: 6 }}>ADICIONAR DOCUMENTO</div>
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { l: "ARQUIVO", s: "done" },
            { l: "IA IDENTIFICOU", s: "done" },
            { l: "REVISAR DADOS", s: "current" },
            { l: "CONFORMIDADE", s: "pending" },
            { l: "SALVAR", s: "pending" },
          ].map((it) => {
            const active = it.s === "current";
            return (
              <div key={it.l} style={{ padding: "10px 12px", background: active ? "#161616" : "transparent", borderLeft: `3px solid ${active ? T.amber : "transparent"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: OSWALD, fontSize: 10.5, letterSpacing: ".18em", color: it.s === "pending" ? "#7A7A7A" : "#fff" }}>{it.l}</span>
                <span style={{ fontSize: 10, color: it.s === "done" ? T.green : active ? T.amber : "#5A5A5A" }}>
                  {it.s === "done" ? "✓" : active ? "●" : "○"}
                </span>
              </div>
            );
          })}
        </div>
      </aside>
      <div style={{ padding: 22 }}>
        <Header />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card style={{ padding: 16 }}>
            <Lab>{COPY.arquivoLabel}</Lab>
            <div style={{ marginTop: 12 }}><ArquivoBlock /></div>
            <div style={{ marginTop: 14, padding: 12, background: T.greenBg, borderRadius: 3 }}>
              <Lab color={T.greenInk}>{COPY.iaEyebrow}</Lab>
              <div style={{ marginTop: 6, fontFamily: OSWALD, fontSize: 12.5, color: T.ink }}>{COPY.iaTitle}</div>
              <div style={{ marginTop: 8 }}><ConfChip /></div>
            </div>
          </Card>
          <Card style={{ padding: 16 }}>
            <Lab>{COPY.revisarLabel}</Lab>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoTipo} value={COPY.campoTipoVal} /></div>
              <Field label={COPY.campoData} value={COPY.campoDataVal} />
              <Field label={COPY.campoValidade} value={COPY.campoValidadeVal} />
              <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoCpf} value={COPY.campoCpfVal} /></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
    <Footer />
  </Card>
);

/* ============================================================
 *  V10 — Stepper vertical com trilho bordô na ativa
 * ============================================================ */
const V10: React.FC = () => {
  const steps = [
    { l: "ANEXAR ARQUIVO", s: "done" as const, sub: COPY.fileName },
    { l: "IA IDENTIFICOU", s: "done" as const, sub: COPY.iaTitle },
    { l: "REVISAR DADOS", s: "current" as const, sub: COPY.revisarSub },
    { l: "CONFORMIDADE", s: "pending" as const, sub: "Cruzamento final" },
    { l: "SALVAR NO ARSENAL", s: "pending" as const, sub: "Gravar e indexar" },
  ];
  return (
    <Card>
      <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}` }}><Header /></div>
      <div style={{ padding: 22, display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
        <div>
          {steps.map((st, i) => {
            const done = st.s === "done";
            const cur = st.s === "current";
            const bg = done ? T.green : cur ? T.bordo : "#EDEDED";
            const fg = done || cur ? "#fff" : T.ink3;
            return (
              <div key={st.l} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 12, position: "relative", paddingBottom: i === steps.length - 1 ? 0 : 18 }}>
                {i < steps.length - 1 && <span style={{ position: "absolute", left: 15, top: 30, bottom: 6, width: 2, background: done ? T.green : T.border }} />}
                <div style={{ width: 32, height: 32, borderRadius: 99, background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: OSWALD, fontSize: 13, fontWeight: 700 }}>
                  {done ? "✓" : i + 1}
                </div>
                <div>
                  <div style={{ fontFamily: OSWALD, fontSize: 11.5, letterSpacing: ".14em", color: cur ? T.bordo : T.ink }}>{st.l}</div>
                  <div style={{ fontSize: 11, color: T.ink3, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{st.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div>
          <Card style={{ padding: 16, marginBottom: 14 }}>
            <Lab>{COPY.iaEyebrow}</Lab>
            <div style={{ marginTop: 6, fontFamily: OSWALD, fontSize: 14, letterSpacing: ".05em", color: T.ink }}>{COPY.iaTitle}</div>
            <div style={{ marginTop: 8 }}><ConfChip /></div>
          </Card>
          <Card style={{ padding: 16 }}>
            <Lab>{COPY.revisarLabel}</Lab>
            <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 6 }}>{COPY.revisarSub}</div>
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoTipo} value={COPY.campoTipoVal} /></div>
              <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoEmissor} value={COPY.campoEmissorVal} /></div>
              <Field label={COPY.campoData} value={COPY.campoDataVal} />
              <Field label={COPY.campoValidade} value={COPY.campoValidadeVal} />
              <div style={{ gridColumn: "1 / -1" }}><Field label={COPY.campoCpf} value={COPY.campoCpfVal} /></div>
            </div>
          </Card>
        </div>
      </div>
      <Footer />
    </Card>
  );
};

const VARIANTS: { id: number; nome: string; subtitulo: string; render: () => React.ReactNode }[] = [
  { id: 1, nome: "V1 · Ficha catalográfica 3 colunas", subtitulo: "ARQUIVO · IA · DADOS", render: () => <V1 /> },
  { id: 2, nome: "V2 · Wizard horizontal 4 etapas",   subtitulo: "STEPPER Z6 ANEXAR → SALVAR", render: () => <V2 /> },
  { id: 3, nome: "V3 · KPI strip + master/detail",    subtitulo: "4 KPIs Z6 NO TOPO",          render: () => <V3 /> },
  { id: 4, nome: "V4 · Timeline vertical",             subtitulo: "LINHA DO TEMPO Z6 ESQUERDA", render: () => <V4 /> },
  { id: 5, nome: "V5 · Cockpit denso · top rail preto",subtitulo: "RAIL #0A0A0A + GRID 12",    render: () => <V5 /> },
  { id: 6, nome: "V6 · Foco do Dia",                   subtitulo: "BORDA ESQUERDA #D9342B Z6",  render: () => <V6 /> },
  { id: 7, nome: "V7 · Split arquivo · dossiê",        subtitulo: "VIEWER ESQ · CAMPOS DIR",    render: () => <V7 /> },
  { id: 8, nome: "V8 · Boarding pass tático",          subtitulo: "TICKET HORIZONTAL Z6",       render: () => <V8 /> },
  { id: 9, nome: "V9 · Sidebar preta + canvas",         subtitulo: "SIDEBAR #0A0A0A + ÂMBAR",    render: () => <V9 /> },
  { id: 10, nome: "V10 · Stepper vertical bordô",      subtitulo: "TRILHO ESQ · BORDO ATIVO",   render: () => <V10 /> },
];

export default function MockupsHubDoc() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const vRaw = params.get("v");
  const v = vRaw ? Math.max(1, Math.min(5, Number(vRaw))) : null;

  const wrap: React.CSSProperties = {
    minHeight: "100vh",
    background: T.page,
    padding: 32,
    fontFamily: INTER,
    color: T.ink,
  };

  if (v) {
    const variant = VARIANTS[v - 1];
    return (
      <div style={wrap}>
        <div id="mockup-shot" style={{ maxWidth: 1280, margin: "0 auto" }}>
          {variant.render()}
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 1280, margin: "0 auto", marginBottom: 24 }}>
        <Lab>MOCKUPS · STACK COCKPIT Z6 LIGHT</Lab>
        <H1>Hub Documental · Adicionar Documento</H1>
        <p style={{ marginTop: 8, fontSize: 12.5, color: T.ink2, maxWidth: 760 }}>
          5 variantes renderizadas em HTML/React puro reutilizando os tokens HEX e a tipografia canônica do Cockpit Z6 Light. Sem imagens geradas por IA, sem cópia inventada — todas as strings vêm do modal real.
        </p>
      </div>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
        {VARIANTS.map((variant) => (
          <section key={variant.id} id={`v${variant.id}`}>
            <div style={{ marginBottom: 10, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <div>
                <Lab>{variant.subtitulo}</Lab>
                <div style={{ fontFamily: OSWALD, fontSize: 16, letterSpacing: ".06em", color: T.ink, marginTop: 2 }}>{variant.nome}</div>
              </div>
              <a href={`?v=${variant.id}`} style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: ".18em", color: T.bordo, textDecoration: "none" }}>VER ISOLADO →</a>
            </div>
            {variant.render()}
          </section>
        ))}
      </div>
    </div>
  );
}