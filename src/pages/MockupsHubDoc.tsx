/**
 * Mockups · Hub documental "Adicionar Documento" — redesign Z6 Light.
 *
 * 5 layouts modernos que substituem o modal atual, reproduzindo TODO o
 * conteúdo real da tela (alertas IA, vencimento, tabela de conformidade com
 * dupla verificação, painel de escopo, badges "Confirmado" por campo), apenas
 * reorganizado dentro dos tokens canônicos do Cockpit Z6 Light.
 *
 * Uso: /mockups-hub-doc              → grade com as 5 variantes
 *      /mockups-hub-doc?v=1..5       → variante isolada (Playwright)
 */
import React from "react";

/* ───────── Tokens canônicos Z6 Light ───────── */
const T = {
  page: "#F2F2F2",
  card: "#FFFFFF",
  border: "#E5E5E5",
  line: "#EFEFEF",
  soft: "#F7F7F7",
  ink: "#0A0A0A",
  ink2: "#4A4A4A",
  ink3: "#7A7A7A",
  ink4: "#A0A0A0",
  bordo: "#7A1F2B",
  bordoSoft: "#F5E6E8",
  amber: "#D6A64B",
  amberBg: "#FCEFCE",
  amberInk: "#7A5A14",
  amberBorder: "#E8C870",
  green: "#2F8F4A",
  greenBg: "#E3F2E8",
  greenInk: "#1F6638",
  greenBorder: "#9CC8A6",
  red: "#D9342B",
  redBg: "#FCE3E1",
  redInk: "#8A1410",
};
const OSWALD = "'Oswald', sans-serif";
const INTER = "'Inter', -apple-system, sans-serif";

/* ───────── Conteúdo real (extraído do modal) ───────── */
const COPY = {
  eyebrow: "HUB DOCUMENTAL",
  h1: "ADICIONAR DOCUMENTO",
  sub: "Anexe foto ou PDF — a IA identifica o tipo e preenche os campos automaticamente. Você só revisa antes de salvar.",
  cliente: "WILLIAN RODRIGUES DA SILVA",
  arquivoLab: "ARQUIVO",
  arquivoSub: "A IA identifica o tipo automaticamente",
  fileName: "14. Exame de tiro, Willian.pdf",
  fileSize: "1081 KB",
  fileBadge: "LAUDO TÉC.",
  iaEyebrow: "TIPO IDENTIFICADO PELA IA",
  iaTipo: "ATESTADO DE CAPACIDADE TÉCNICA",
  iaConfRaw: 98,
  iaJust:
    "Documento intitulado 'Comprovante de Capacidade Técnica para o Manuseio de Arma de Fogo', assinado por instrutor credenciado pela Polícia Federal.",
  iaAlterar: "Não é esse tipo? Alterar manualmente",
  dadosTitle: "DADOS DO DOCUMENTO",
  alertReviseTitle: "REVISE CAMPO A CAMPO ANTES DE SALVAR",
  alertReviseBody:
    "A IA leu o documento e sugeriu os valores abaixo. Nenhum dado é cadastrado automaticamente. Clique em Confirmar em cada campo OU corrija manualmente. Pendentes: —",
  alertVencidoTitle: "DOCUMENTO VENCIDO — MANTIDO COMO HISTÓRICO",
  alertVencidoData: "19/03/2026",
  alertVencidoBody:
    "Laudos e exames vencidos são aceitos e arquivados no histórico. Eles podem ser exigidos pela PF para comprovar a validade cruzada com outros exames realizados na época (ex.: exame de tiro feito enquanto o psicológico estava vigente). O sistema seleciona automaticamente os exames antigos necessários no momento do protocolo.",
  confTitle: "CONFORMIDADE COM DOCUMENTOS APROVADOS (DUPLA VERIFICAÇÃO)",
  confRows: [
    {
      campo: "Nome completo",
      naCertidao: "Willian Rodrigues da Silva",
      referencia: "WILLIAN RODRIGUES DA SILVA MASSAROTO",
      fonte: "Carteira de Identidade Nacional (CIN) (equipe)",
      status: "Conforme",
    },
    {
      campo: "CPF",
      naCertidao: "377.995.388-99",
      referencia: "37799538899",
      fonte: "Carteira de Identidade Nacional (CIN) (equipe)",
      status: "Conforme",
    },
  ],
  categoriaLab: "CATEGORIA DO DOCUMENTO",
  categoriaVal: "Laudos e exames",
  tipoLab: "TIPO DO DOCUMENTO",
  tipoVal: "Atestado de…",
  escopoEyebrow: "ESCOPO E REAPROVEITAMENTO",
  escopoTitle: "Laudos e exames · escopo permanente",
  escopoBody:
    "Laudos psicológicos, capacidade técnica e exames correlatos. Este documento pode ser reaproveitado em outras jornadas quando continuar válido e compatível.",
  fNumLab: "Nº NÚMERO DO DOCUMENTO",
  fNumVal: "0005/2025",
  fOrgaoLab: "ÓRGÃO EMISSOR",
  fOrgaoVal: "Polícia Federal",
  fEmissLab: "AVALIAÇÃO",
  fEmissVal: "19/03/2025",
  fValLab: "VALIDADE",
  fValVal: "19/03/2026",
  cancelar: "Cancelar",
  salvar: "SALVAR DOCUMENTO",
};

/* ───────── Átomos ───────── */
const Paper: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties }>> = ({ children, style }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 4, ...style }}>{children}</div>
);

const Lab: React.FC<React.PropsWithChildren<{ color?: string; size?: number; spacing?: string; style?: React.CSSProperties }>> = ({
  children,
  color = T.ink3,
  size = 10,
  spacing = ".2em",
  style,
}) => (
  <div style={{ fontFamily: OSWALD, fontSize: size, letterSpacing: spacing, color, textTransform: "uppercase", ...style }}>
    {children}
  </div>
);

const Divider: React.FC<{ vertical?: boolean }> = ({ vertical }) =>
  vertical ? (
    <div style={{ width: 1, background: T.border, alignSelf: "stretch" }} />
  ) : (
    <div style={{ height: 1, background: T.line, width: "100%" }} />
  );

const BtnBordo: React.FC<React.PropsWithChildren<{ icon?: React.ReactNode; style?: React.CSSProperties; size?: "sm" | "md" }>> = ({
  children,
  icon,
  style,
  size = "md",
}) => (
  <button
    type="button"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      background: T.bordo,
      color: "#fff",
      border: 0,
      padding: size === "sm" ? "8px 14px" : "12px 22px",
      fontFamily: OSWALD,
      letterSpacing: ".16em",
      fontSize: size === "sm" ? 10 : 11.5,
      fontWeight: 600,
      cursor: "pointer",
      borderRadius: 2,
      textTransform: "uppercase",
      ...style,
    }}
  >
    {icon}
    {children}
  </button>
);

const BtnGhost: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties }>> = ({ children, style }) => (
  <button
    type="button"
    style={{
      background: "#fff",
      color: T.ink,
      border: `1px solid ${T.border}`,
      padding: "12px 22px",
      fontFamily: OSWALD,
      letterSpacing: ".16em",
      fontSize: 11.5,
      cursor: "pointer",
      borderRadius: 2,
      textTransform: "uppercase",
      ...style,
    }}
  >
    {children}
  </button>
);

const ConfirmBadge: React.FC = () => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "3px 8px",
      background: T.greenBg,
      color: T.greenInk,
      fontFamily: OSWALD,
      fontSize: 9.5,
      letterSpacing: ".18em",
      fontWeight: 600,
      borderRadius: 2,
    }}
  >
    <span style={{ width: 5, height: 5, borderRadius: 99, background: T.green }} />
    CONFIRMADO
  </span>
);

const PendBadge: React.FC = () => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "3px 8px",
      background: T.amberBg,
      color: T.amberInk,
      fontFamily: OSWALD,
      fontSize: 9.5,
      letterSpacing: ".18em",
      fontWeight: 600,
      borderRadius: 2,
    }}
  >
    <span style={{ width: 5, height: 5, borderRadius: 99, background: T.amber }} />
    REVISAR
  </span>
);

/* Campo editável estilizado Z6 (label + valor + opcional badge) */
const FieldZ6: React.FC<{ label: string; value: string; badge?: React.ReactNode; full?: boolean }> = ({
  label,
  value,
  badge,
  full,
}) => (
  <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <Lab size={9.5} spacing=".18em">
        {label}
      </Lab>
      {badge}
    </div>
    <div
      style={{
        padding: "10px 12px",
        border: `1px solid ${T.border}`,
        borderRadius: 2,
        background: "#fff",
        fontFamily: OSWALD,
        fontSize: 13,
        letterSpacing: ".04em",
        color: T.ink,
      }}
    >
      {value}
    </div>
  </div>
);

/* ───── Blocos de conteúdo reutilizáveis (todos com tokens Z6) ───── */

const FileBlock: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: compact ? 10 : 14,
      background: T.soft,
      border: `1px solid ${T.line}`,
      borderRadius: 3,
    }}
  >
    <div
      style={{
        width: compact ? 38 : 46,
        height: compact ? 38 : 46,
        background: "#fff",
        border: `1px solid ${T.border}`,
        borderRadius: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: OSWALD,
        fontSize: compact ? 9.5 : 11,
        letterSpacing: ".12em",
        color: T.bordo,
        fontWeight: 600,
      }}
    >
      PDF
    </div>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div
        style={{
          fontSize: compact ? 11.5 : 13,
          fontWeight: 600,
          color: T.ink,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {COPY.fileName}
      </div>
      <div style={{ marginTop: 3, fontSize: 10.5, color: T.ink3, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: T.green }}>✓</span>
        {COPY.fileSize}
      </div>
    </div>
    <button
      type="button"
      style={{
        width: 28,
        height: 28,
        border: `1px solid ${T.border}`,
        background: "#fff",
        borderRadius: 2,
        color: T.ink3,
        cursor: "pointer",
        lineHeight: 0,
      }}
      aria-label="Remover"
    >
      ×
    </button>
  </div>
);

const IaBlock: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div
    style={{
      border: `1px solid ${T.greenBorder}`,
      background: T.greenBg,
      borderLeft: `3px solid ${T.green}`,
      borderRadius: 3,
      padding: compact ? 12 : 14,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <Lab color={T.greenInk} size={9.5} spacing=".22em">
        ◎ {COPY.iaEyebrow}
      </Lab>
      <span
        style={{
          fontFamily: OSWALD,
          fontSize: 10,
          letterSpacing: ".18em",
          color: T.greenInk,
          background: "#fff",
          padding: "2px 7px",
          border: `1px solid ${T.greenBorder}`,
          borderRadius: 2,
        }}
      >
        {COPY.iaConfRaw}% CONFIANÇA
      </span>
    </div>
    <div style={{ marginTop: 8, fontFamily: OSWALD, fontSize: compact ? 13 : 15, letterSpacing: ".05em", color: T.ink, fontWeight: 600 }}>
      {COPY.iaTipo}
    </div>
    {!compact && (
      <p style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.55, color: T.ink2 }}>{COPY.iaJust}</p>
    )}
    <button
      type="button"
      style={{
        marginTop: 10,
        fontFamily: OSWALD,
        fontSize: 10,
        letterSpacing: ".16em",
        color: T.bordo,
        background: "transparent",
        border: 0,
        padding: 0,
        cursor: "pointer",
        textTransform: "uppercase",
      }}
    >
      ✎ {COPY.iaAlterar}
    </button>
  </div>
);

const AlertRevise: React.FC = () => (
  <div
    style={{
      border: `1px solid ${T.amberBorder}`,
      background: T.amberBg,
      borderLeft: `3px solid ${T.amber}`,
      borderRadius: 3,
      padding: 12,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: T.amberInk, fontWeight: 700 }}>⚠</span>
      <Lab color={T.amberInk} size={10} spacing=".2em">
        {COPY.alertReviseTitle}
      </Lab>
    </div>
    <p style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.5, color: T.amberInk }}>{COPY.alertReviseBody}</p>
  </div>
);

const AlertVencido: React.FC = () => (
  <div
    style={{
      border: `1px solid ${T.amberBorder}`,
      background: T.amberBg,
      borderLeft: `3px solid ${T.amber}`,
      borderRadius: 3,
      padding: 12,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: T.amberInk, fontWeight: 700 }}>⚠</span>
        <Lab color={T.amberInk} size={10} spacing=".2em">
          {COPY.alertVencidoTitle}
        </Lab>
      </div>
      <span
        style={{
          fontFamily: OSWALD,
          fontSize: 10,
          letterSpacing: ".14em",
          padding: "2px 7px",
          background: "#fff",
          border: `1px solid ${T.amberBorder}`,
          borderRadius: 2,
          color: T.amberInk,
        }}
      >
        {COPY.alertVencidoData}
      </span>
    </div>
    <p style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.5, color: T.amberInk }}>{COPY.alertVencidoBody}</p>
  </div>
);

const ConformidadeTable: React.FC<{ dense?: boolean }> = ({ dense }) => (
  <div
    style={{
      border: `1px solid ${T.greenBorder}`,
      background: T.greenBg,
      borderLeft: `3px solid ${T.green}`,
      borderRadius: 3,
      padding: dense ? 10 : 14,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{ color: T.greenInk, fontWeight: 700 }}>◎</span>
      <Lab color={T.greenInk} size={10} spacing=".2em">
        {COPY.confTitle}
      </Lab>
    </div>
    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: INTER, fontSize: dense ? 10.5 : 11.5 }}>
      <thead>
        <tr style={{ textAlign: "left" }}>
          {["CAMPO", "NA CERTIDÃO", "REFERÊNCIA", "STATUS"].map((h) => (
            <th
              key={h}
              style={{
                padding: "0 8px 8px",
                fontFamily: OSWALD,
                fontSize: 9,
                letterSpacing: ".2em",
                color: T.greenInk,
                fontWeight: 600,
                borderBottom: `1px solid ${T.greenBorder}`,
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {COPY.confRows.map((r, i) => (
          <tr key={i} style={{ borderBottom: i === COPY.confRows.length - 1 ? "0" : `1px solid ${T.greenBorder}55` }}>
            <td style={{ padding: "10px 8px", fontFamily: OSWALD, fontSize: 10.5, letterSpacing: ".06em", color: T.ink, verticalAlign: "top" }}>
              {r.campo}
            </td>
            <td style={{ padding: "10px 8px", color: T.ink, verticalAlign: "top", fontFamily: OSWALD, fontSize: 11.5, letterSpacing: ".04em" }}>
              {r.naCertidao}
            </td>
            <td style={{ padding: "10px 8px", color: T.ink, verticalAlign: "top" }}>
              <div style={{ fontFamily: OSWALD, fontSize: 11.5, letterSpacing: ".04em" }}>{r.referencia}</div>
              <div style={{ fontSize: 9.5, color: T.ink3, marginTop: 2 }}>{r.fonte}</div>
            </td>
            <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: OSWALD, fontSize: 10.5, letterSpacing: ".14em", color: T.greenInk, fontWeight: 600 }}>
                ✓ {r.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const EscopoBlock: React.FC = () => (
  <div
    style={{
      padding: 14,
      background: T.soft,
      border: `1px solid ${T.line}`,
      borderRadius: 3,
    }}
  >
    <Lab size={9.5} spacing=".18em">
      {COPY.escopoEyebrow}
    </Lab>
    <div style={{ marginTop: 6, fontFamily: OSWALD, fontSize: 13, letterSpacing: ".04em", color: T.ink, fontWeight: 600, textTransform: "none" }}>
      {COPY.escopoTitle}
    </div>
    <p style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.55, color: T.ink2 }}>{COPY.escopoBody}</p>
  </div>
);

const SelectField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <Lab size={9.5} spacing=".18em" style={{ marginBottom: 6 }}>
      {label}
    </Lab>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 12px",
        border: `1px solid ${T.border}`,
        borderRadius: 2,
        background: "#fff",
        fontFamily: OSWALD,
        fontSize: 13,
        letterSpacing: ".04em",
        color: T.ink,
      }}
    >
      <span>{value}</span>
      <span style={{ color: T.ink3 }}>▾</span>
    </div>
  </div>
);

const HeaderBar: React.FC = () => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "20px 24px", borderBottom: `1px solid ${T.border}` }}>
    <div
      style={{
        width: 42,
        height: 42,
        background: T.bordoSoft,
        color: T.bordo,
        border: `1px solid ${T.border}`,
        borderRadius: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: OSWALD,
        fontSize: 16,
        fontWeight: 700,
      }}
    >
      ◈
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <Lab size={9.5} spacing=".32em">
        {COPY.eyebrow}
      </Lab>
      <div style={{ fontFamily: OSWALD, fontSize: 22, letterSpacing: ".08em", color: T.ink, fontWeight: 700, marginTop: 2 }}>
        {COPY.h1}
      </div>
      <p style={{ marginTop: 6, fontSize: 12, color: T.ink2, lineHeight: 1.5, maxWidth: 640 }}>{COPY.sub}</p>
    </div>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <Lab size={9} spacing=".22em">
        CLIENTE
      </Lab>
      <div style={{ fontFamily: OSWALD, fontSize: 12, letterSpacing: ".08em", color: T.ink }}>{COPY.cliente}</div>
    </div>
    <button
      type="button"
      style={{
        width: 30,
        height: 30,
        marginLeft: 8,
        border: `1px solid ${T.border}`,
        background: "#fff",
        borderRadius: 2,
        color: T.ink3,
        cursor: "pointer",
      }}
      aria-label="Fechar"
    >
      ×
    </button>
  </div>
);

const FooterBar: React.FC<{ status?: string }> = ({ status }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      padding: "14px 24px",
      borderTop: `1px solid ${T.border}`,
      background: T.soft,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: OSWALD, fontSize: 10, letterSpacing: ".2em", color: T.greenInk }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: T.green }} />
        2 CAMPOS CONFIRMADOS
      </span>
      <span style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: ".2em", color: T.ink3 }}>{status ?? "PRONTO PARA SALVAR"}</span>
    </div>
    <div style={{ display: "flex", gap: 10 }}>
      <BtnGhost>{COPY.cancelar}</BtnGhost>
      <BtnBordo icon={<span>◈</span>}>{COPY.salvar}</BtnBordo>
    </div>
  </div>
);


/* ============================================================
 * REDESIGN ZERO · 5 PARADIGMAS REALMENTE DIFERENTES
 * Stack: React + tokens canônicos Z6 Light (Oswald + Inter, #7A1F2B, #D6A64B, #0A0A0A, #2F8F4A, #D9342B).
 * Nenhum paradigma "PDF esquerda + form direita" — cada R{n} é uma metáfora distinta.
 * ============================================================ */

/* Pílula compacta de arquivo + IA (usada quando NÃO há viewer de PDF) */
const FilePill: React.FC<{ withConf?: boolean }> = ({ withConf }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 12px 8px 8px",
      background: "#fff",
      border: `1px solid ${T.border}`,
      borderRadius: 999,
    }}
  >
    <span
      style={{
        width: 28,
        height: 28,
        borderRadius: 999,
        background: T.bordoSoft,
        color: T.bordo,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: OSWALD,
        fontSize: 10,
        letterSpacing: ".12em",
        fontWeight: 700,
      }}
    >
      PDF
    </span>
    <span style={{ fontFamily: OSWALD, fontSize: 11.5, letterSpacing: ".06em", color: T.ink }}>{COPY.fileName}</span>
    <span style={{ fontSize: 10.5, color: T.ink3 }}>· {COPY.fileSize}</span>
    {withConf && (
      <span
        style={{
          marginLeft: 4,
          fontFamily: OSWALD,
          fontSize: 10,
          letterSpacing: ".18em",
          padding: "2px 8px",
          borderRadius: 999,
          background: T.greenBg,
          color: T.greenInk,
          border: `1px solid ${T.greenBorder}`,
        }}
      >
        IA · {COPY.iaConfRaw}%
      </span>
    )}
  </div>
);

const ConfRing: React.FC<{ size?: number; mono?: boolean }> = ({ size = 120, mono }) => {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const pct = COPY.iaConfRaw / 100;
  const fg = mono ? T.amber : T.green;
  const track = mono ? "#2a2a2a" : T.greenBorder;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={6} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={fg} strokeWidth={6} fill="none" strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round" />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: OSWALD,
          color: mono ? T.amber : T.greenInk,
        }}
      >
        <div style={{ fontSize: size * 0.34, fontWeight: 700, lineHeight: 1 }}>{COPY.iaConfRaw}<span style={{ fontSize: size * 0.18 }}>%</span></div>
        <div style={{ fontSize: 9, letterSpacing: ".22em", marginTop: 4 }}>CONFIANÇA</div>
      </div>
    </div>
  );
};

/* ============================================================
 * R1 · TIMELINE NARRATIVA — IA conta em 5 passos, cada passo é uma linha cheia
 * Paradigma: feed de eventos vertical. Sem viewer de PDF. Sem 2 colunas.
 * ============================================================ */
const R1: React.FC = () => {
  const steps: { lab: string; t: string; body: React.ReactNode; state: "done" | "current" }[] = [
    {
      lab: "01 · ANEXO",
      t: "Você anexou um PDF",
      body: <FilePill />,
      state: "done",
    },
    {
      lab: "02 · IA CLASSIFICOU",
      t: COPY.iaTipo,
      body: (
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <ConfRing size={96} />
          <p style={{ fontSize: 12, color: T.ink2, lineHeight: 1.55, margin: 0, flex: 1 }}>{COPY.iaJust}</p>
        </div>
      ),
      state: "done",
    },
    {
      lab: "03 · ALERTAS",
      t: "Documento vencido + revisão campo a campo",
      body: (
        <div style={{ display: "grid", gap: 10 }}>
          <AlertVencido />
          <AlertRevise />
        </div>
      ),
      state: "current",
    },
    {
      lab: "04 · CONFORMIDADE",
      t: "Dupla verificação contra documentos aprovados",
      body: <ConformidadeTable />,
      state: "done",
    },
    {
      lab: "05 · CAMPOS PREENCHIDOS",
      t: "Revise e confirme",
      body: (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <SelectField label={COPY.categoriaLab} value={COPY.categoriaVal} />
          <SelectField label={COPY.tipoLab} value={COPY.tipoVal} />
          <FieldZ6 label={COPY.fNumLab} value={COPY.fNumVal} badge={<ConfirmBadge />} />
          <FieldZ6 label={COPY.fOrgaoLab} value={COPY.fOrgaoVal} />
          <FieldZ6 label={COPY.fEmissLab} value={COPY.fEmissVal} />
          <FieldZ6 label={COPY.fValLab} value={COPY.fValVal} badge={<ConfirmBadge />} />
          <div style={{ gridColumn: "1 / -1" }}>
            <EscopoBlock />
          </div>
        </div>
      ),
      state: "current",
    },
  ];
  return (
    <Paper>
      <HeaderBar />
      <div style={{ padding: "24px 32px", display: "grid", gap: 4 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 24, alignItems: "flex-start", padding: "18px 0", borderBottom: i === steps.length - 1 ? 0 : `1px solid ${T.line}` }}>
            <div style={{ position: "relative", paddingLeft: 24 }}>
              <div style={{ position: "absolute", left: 0, top: 4, width: 12, height: 12, borderRadius: 99, background: s.state === "done" ? T.green : T.amber, border: `2px solid #fff`, boxShadow: `0 0 0 1px ${s.state === "done" ? T.greenBorder : T.amberBorder}` }} />
              {i < steps.length - 1 && <div style={{ position: "absolute", left: 5, top: 22, bottom: -22, width: 2, background: T.line }} />}
              <Lab size={9.5} spacing=".24em" color={T.ink3}>{s.lab}</Lab>
              <div style={{ marginTop: 6, fontFamily: OSWALD, fontSize: 13.5, letterSpacing: ".05em", color: T.ink, fontWeight: 600 }}>{s.t}</div>
            </div>
            <div>{s.body}</div>
          </div>
        ))}
      </div>
      <FooterBar />
    </Paper>
  );
};

/* ============================================================
 * R2 · BENTO ASSIMÉTRICO — mosaico de tiles de tamanhos diferentes
 * Paradigma: dashboard de tiles, hierarquia por tamanho, não por coluna.
 * ============================================================ */
const R2: React.FC = () => {
  const Tile: React.FC<React.PropsWithChildren<{ span?: string; rows?: string; pad?: number; bg?: string; border?: string }>> = ({ children, span = "span 4", rows = "span 1", pad = 18, bg = "#fff", border = T.border }) => (
    <div style={{ gridColumn: span, gridRow: rows, background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: pad, minWidth: 0 }}>{children}</div>
  );
  return (
    <Paper>
      <HeaderBar />
      <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gridAutoRows: "minmax(80px, auto)", gap: 12 }}>
        {/* IA hero */}
        <Tile span="span 5" rows="span 2" bg={T.ink} border={T.ink}>
          <Lab color={T.amber} size={9.5} spacing=".24em">{COPY.iaEyebrow}</Lab>
          <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 16 }}>
            <ConfRing size={140} mono />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: OSWALD, fontSize: 16, letterSpacing: ".06em", color: "#fff", fontWeight: 700, lineHeight: 1.2 }}>{COPY.iaTipo}</div>
              <p style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.55, color: "#cfcfcf" }}>{COPY.iaJust}</p>
              <button type="button" style={{ marginTop: 12, fontFamily: OSWALD, fontSize: 10, letterSpacing: ".18em", color: T.amber, background: "transparent", border: 0, padding: 0, cursor: "pointer", textTransform: "uppercase" }}>✎ {COPY.iaAlterar}</button>
            </div>
          </div>
        </Tile>
        {/* Arquivo */}
        <Tile span="span 4">
          <Lab size={9.5} spacing=".22em">{COPY.arquivoLab}</Lab>
          <div style={{ marginTop: 10 }}><FileBlock compact /></div>
        </Tile>
        {/* Vencimento mini */}
        <Tile span="span 3" bg={T.amberBg} border={T.amberBorder}>
          <Lab size={9} spacing=".22em" color={T.amberInk}>VALIDADE</Lab>
          <div style={{ fontFamily: OSWALD, fontSize: 26, letterSpacing: ".08em", color: T.amberInk, fontWeight: 700, marginTop: 6 }}>{COPY.alertVencidoData}</div>
          <div style={{ fontFamily: OSWALD, fontSize: 9.5, letterSpacing: ".2em", color: T.amberInk, marginTop: 4 }}>VENCIDO · HISTÓRICO</div>
        </Tile>
        {/* Alerta revisar */}
        <Tile span="span 7" bg={T.amberBg} border={T.amberBorder} pad={14}>
          <AlertRevise />
        </Tile>
        {/* Categoria + Tipo */}
        <Tile span="span 4"><SelectField label={COPY.categoriaLab} value={COPY.categoriaVal} /></Tile>
        <Tile span="span 4"><SelectField label={COPY.tipoLab} value={COPY.tipoVal} /></Tile>
        <Tile span="span 4"><FieldZ6 label={COPY.fNumLab} value={COPY.fNumVal} badge={<ConfirmBadge />} /></Tile>
        <Tile span="span 4"><FieldZ6 label={COPY.fOrgaoLab} value={COPY.fOrgaoVal} /></Tile>
        <Tile span="span 4"><FieldZ6 label={COPY.fEmissLab} value={COPY.fEmissVal} /></Tile>
        <Tile span="span 4"><FieldZ6 label={COPY.fValLab} value={COPY.fValVal} badge={<ConfirmBadge />} /></Tile>
        {/* Conformidade larga */}
        <Tile span="span 8" pad={0} border={T.greenBorder} bg={T.greenBg}>
          <div style={{ padding: 6 }}><ConformidadeTable dense /></div>
        </Tile>
        {/* Escopo */}
        <Tile span="span 4"><EscopoBlock /></Tile>
      </div>
      <FooterBar />
    </Paper>
  );
};

/* ============================================================
 * R3 · WORKSHEET HORIZONTAL — ficha catalográfica row-by-row
 * Paradigma: tabela editável densa. Cada campo é uma row: rótulo · valor IA · ação.
 * ============================================================ */
const R3: React.FC = () => {
  const rows: { lab: string; val: string; src: string; state: "ok" | "rev" }[] = [
    { lab: COPY.categoriaLab, val: COPY.categoriaVal, src: "Definido por IA", state: "ok" },
    { lab: COPY.tipoLab, val: COPY.tipoVal, src: "Definido por IA", state: "ok" },
    { lab: COPY.fNumLab, val: COPY.fNumVal, src: "Extraído do PDF", state: "ok" },
    { lab: COPY.fOrgaoLab, val: COPY.fOrgaoVal, src: "Extraído do PDF", state: "rev" },
    { lab: COPY.fEmissLab, val: COPY.fEmissVal, src: "Extraído do PDF", state: "ok" },
    { lab: COPY.fValLab, val: COPY.fValVal, src: "Extraído do PDF · VENCIDO", state: "rev" },
  ];
  return (
    <Paper>
      <HeaderBar />
      <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${T.line}`, background: T.soft, flexWrap: "wrap" }}>
        <FilePill withConf />
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: OSWALD, fontSize: 11, letterSpacing: ".18em", color: T.ink }}>{COPY.iaTipo}</span>
      </div>
      <div style={{ padding: "12px 24px" }}>
        <AlertVencido />
      </div>
      {/* Worksheet rows */}
      <div style={{ padding: "0 24px 18px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 200px 140px", padding: "10px 14px", background: T.ink, color: T.amber }}>
          {["CAMPO", "VALOR SUGERIDO PELA IA", "ORIGEM", "AÇÃO"].map((h) => (
            <div key={h} style={{ fontFamily: OSWALD, fontSize: 9.5, letterSpacing: ".22em", fontWeight: 600 }}>{h}</div>
          ))}
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "220px 1fr 200px 140px", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${T.line}`, background: i % 2 ? T.soft : "#fff" }}>
            <div style={{ fontFamily: OSWALD, fontSize: 11, letterSpacing: ".14em", color: T.ink3, fontWeight: 600 }}>{r.lab}</div>
            <div style={{ fontFamily: OSWALD, fontSize: 14, letterSpacing: ".05em", color: T.ink, fontWeight: 600 }}>{r.val}</div>
            <div style={{ fontSize: 10.5, color: T.ink3 }}>{r.src}</div>
            <div>{r.state === "ok" ? <ConfirmBadge /> : <PendBadge />}</div>
          </div>
        ))}
        {/* Conformidade como bloco de auditoria */}
        <div style={{ marginTop: 14 }}><ConformidadeTable dense /></div>
        <div style={{ marginTop: 14 }}><EscopoBlock /></div>
      </div>
      <FooterBar />
    </Paper>
  );
};

/* ============================================================
 * R4 · COCKPIT DARK + WORKSHEET LIGHT — split dark/light vertical
 * Paradigma: painel esquerdo PRETO Z6 (dossiê IA com ring brass gigante)
 *            painel direito LIGHT (somente campos densos). Sem PDF viewer.
 * ============================================================ */
const R4: React.FC = () => (
  <Paper style={{ overflow: "hidden" }}>
    <HeaderBar />
    <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.4fr" }}>
      {/* DARK · Cockpit IA */}
      <aside style={{ background: T.ink, color: "#fff", padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <Lab color={T.amber} size={9.5} spacing=".28em">DOSSIÊ DA IA</Lab>
          <div style={{ fontFamily: OSWALD, fontSize: 20, letterSpacing: ".07em", color: "#fff", marginTop: 4, fontWeight: 700 }}>{COPY.iaTipo}</div>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <ConfRing size={170} mono />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Lab color="#9a9a9a" size={9} spacing=".22em">JUSTIFICATIVA</Lab>
            <p style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6, color: "#dcdcdc" }}>{COPY.iaJust}</p>
          </div>
        </div>
        <div style={{ border: `1px solid #2a2a2a`, borderRadius: 3, padding: 14, background: "#141414" }}>
          <Lab color={T.amber} size={9} spacing=".22em">ARQUIVO ORIGINAL</Lab>
          <div style={{ marginTop: 8, fontFamily: OSWALD, fontSize: 13, color: "#fff", letterSpacing: ".05em" }}>{COPY.fileName}</div>
          <div style={{ marginTop: 4, fontSize: 11, color: "#9a9a9a" }}>{COPY.fileSize} · {COPY.fileBadge}</div>
        </div>
        <button type="button" style={{ marginTop: "auto", fontFamily: OSWALD, fontSize: 10.5, letterSpacing: ".22em", color: T.amber, background: "transparent", border: `1px solid ${T.amber}`, padding: "10px 14px", borderRadius: 2, cursor: "pointer", textTransform: "uppercase" }}>
          ✎ {COPY.iaAlterar}
        </button>
      </aside>
      {/* LIGHT · Worksheet */}
      <section style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        <AlertRevise />
        <AlertVencido />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <SelectField label={COPY.categoriaLab} value={COPY.categoriaVal} />
          <SelectField label={COPY.tipoLab} value={COPY.tipoVal} />
          <FieldZ6 label={COPY.fNumLab} value={COPY.fNumVal} badge={<ConfirmBadge />} />
          <FieldZ6 label={COPY.fOrgaoLab} value={COPY.fOrgaoVal} />
          <FieldZ6 label={COPY.fEmissLab} value={COPY.fEmissVal} />
          <FieldZ6 label={COPY.fValLab} value={COPY.fValVal} badge={<ConfirmBadge />} />
        </div>
        <ConformidadeTable dense />
        <EscopoBlock />
      </section>
    </div>
    <FooterBar />
  </Paper>
);

/* ============================================================
 * R5 · HERO CONFIANÇA + TABS — banner topo com 98% gigante, conteúdo em abas
 * Paradigma: confiança vira protagonista do topo full-width, painel inferior é tab navigation.
 * ============================================================ */
const R5: React.FC = () => {
  const [tab, setTab] = React.useState<"dados" | "alertas" | "conf" | "escopo">("dados");
  const tabs: { id: typeof tab; lab: string; count?: string }[] = [
    { id: "dados", lab: "DADOS DO DOCUMENTO", count: "6" },
    { id: "alertas", lab: "ALERTAS", count: "2" },
    { id: "conf", lab: "CONFORMIDADE", count: "2/2" },
    { id: "escopo", lab: "ESCOPO" },
  ];
  return (
    <Paper>
      <HeaderBar />
      {/* HERO confiança */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 28, padding: "28px 32px", background: T.ink, color: "#fff" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
          <Lab color={T.amber} size={9.5} spacing=".28em">CONFIANÇA DA IA</Lab>
          <div style={{ fontFamily: OSWALD, fontWeight: 700, lineHeight: 0.9, color: T.amber, fontSize: 132, letterSpacing: "-.02em" }}>
            {COPY.iaConfRaw}<span style={{ fontSize: 56 }}>%</span>
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: ".22em", color: "#9a9a9a" }}>ACIMA DO LIMIAR DE 85%</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <Lab color={T.amber} size={9.5} spacing=".24em">{COPY.iaEyebrow}</Lab>
          <div style={{ marginTop: 6, fontFamily: OSWALD, fontSize: 24, letterSpacing: ".06em", fontWeight: 700, color: "#fff" }}>{COPY.iaTipo}</div>
          <p style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.6, color: "#cfcfcf", maxWidth: 560 }}>{COPY.iaJust}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
          <FilePill />
          <button type="button" style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: ".2em", color: T.amber, background: "transparent", border: `1px solid ${T.amber}`, padding: "8px 12px", borderRadius: 2, cursor: "pointer", textTransform: "uppercase" }}>✎ {COPY.iaAlterar}</button>
        </div>
      </div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, padding: "0 24px", borderBottom: `1px solid ${T.border}`, background: T.soft }}>
        {tabs.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                fontFamily: OSWALD,
                fontSize: 11,
                letterSpacing: ".18em",
                padding: "14px 18px",
                background: "transparent",
                border: 0,
                borderBottom: `2px solid ${active ? T.bordo : "transparent"}`,
                color: active ? T.bordo : T.ink3,
                cursor: "pointer",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              {t.lab} {t.count && <span style={{ marginLeft: 6, fontSize: 9.5, color: active ? T.bordo : T.ink4 }}>· {t.count}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ padding: 24, minHeight: 320 }}>
        {tab === "dados" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <SelectField label={COPY.categoriaLab} value={COPY.categoriaVal} />
            <SelectField label={COPY.tipoLab} value={COPY.tipoVal} />
            <FieldZ6 label={COPY.fNumLab} value={COPY.fNumVal} badge={<ConfirmBadge />} />
            <FieldZ6 label={COPY.fOrgaoLab} value={COPY.fOrgaoVal} />
            <FieldZ6 label={COPY.fEmissLab} value={COPY.fEmissVal} />
            <FieldZ6 label={COPY.fValLab} value={COPY.fValVal} badge={<ConfirmBadge />} />
          </div>
        )}
        {tab === "alertas" && (
          <div style={{ display: "grid", gap: 12 }}>
            <AlertRevise />
            <AlertVencido />
          </div>
        )}
        {tab === "conf" && <ConformidadeTable />}
        {tab === "escopo" && <EscopoBlock />}
      </div>
      <FooterBar />
    </Paper>
  );
};

/* ============================================================
 * NOVOS PARADIGMAS · R6..R10 — PDF + 98% como dupla protagonista
 * ============================================================ */

const PdfSheet: React.FC<{ height?: number; width?: number | string; scale?: number }> = ({ height = 460, width = "100%", scale = 1 }) => (
  <div style={{ width, height, background: "#E2E2E2", border: `1px solid ${T.border}`, borderRadius: 4, padding: 18, display: "flex", justifyContent: "center", alignItems: "flex-start", position: "relative", overflow: "hidden" }}>
    <div style={{ width: "92%", height: "100%", background: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,.18), 0 2px 4px rgba(0,0,0,.08)", padding: 22 * scale, fontFamily: "Georgia, serif", color: "#222", display: "flex", flexDirection: "column", gap: 10 * scale, overflow: "hidden" }}>
      <div style={{ textAlign: "center", fontSize: 10 * scale, letterSpacing: ".24em", color: "#7a1f2b", fontWeight: 700 }}>REPÚBLICA FEDERATIVA DO BRASIL · POLÍCIA FEDERAL</div>
      <div style={{ textAlign: "center", fontSize: 13 * scale, fontWeight: 700, marginTop: 4 * scale, lineHeight: 1.3 }}>COMPROVANTE DE CAPACIDADE TÉCNICA<br />PARA O MANUSEIO DE ARMA DE FOGO</div>
      <div style={{ height: 1, background: "#333", margin: "4px 0" }} />
      <div style={{ fontSize: 10 * scale, lineHeight: 1.55 }}>Certificamos que <b>WILLIAN RODRIGUES DA SILVA</b>, CPF 377.995.388-99, foi avaliado em <b>19/03/2025</b> e demonstrou aptidão técnica para o manuseio de arma de fogo, conforme exigências da Lei nº 10.826/2003 e Decreto nº 9.847/2019.</div>
      <div style={{ fontSize: 10 * scale, lineHeight: 1.55, marginTop: 2 * scale }}>Avaliação prática realizada em estande credenciado, com supervisão do instrutor abaixo identificado. Validade: <b>19/03/2026</b>.</div>
      <div style={{ marginTop: "auto", display: "flex", gap: 14 * scale, fontSize: 9 * scale }}>
        <div style={{ flex: 1 }}><div style={{ borderTop: "1px solid #333", paddingTop: 4, textAlign: "center" }}>INSTRUTOR CREDENCIADO PF</div></div>
        <div style={{ flex: 1 }}><div style={{ borderTop: "1px solid #333", paddingTop: 4, textAlign: "center" }}>AVALIADO</div></div>
      </div>
      <div style={{ fontSize: 8 * scale, color: "#666", textAlign: "right" }}>Nº 0005/2025 · pg. 1/1</div>
    </div>
    <div style={{ position: "absolute", bottom: 6, left: 8, fontFamily: OSWALD, fontSize: 9, letterSpacing: ".22em", color: "#7a7a7a" }}>{COPY.fileName} · {COPY.fileSize}</div>
  </div>
);

const R6: React.FC = () => (
  <Paper>
    <HeaderBar />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.05fr", background: T.soft }}>
      <div style={{ padding: 28, borderRight: `1px solid ${T.border}` }}>
        <Lab spacing=".24em">ARQUIVO ENVIADO</Lab>
        <div style={{ marginTop: 12 }}><PdfSheet height={520} /></div>
      </div>
      <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 14 }}>
        <Lab color={T.bordo} spacing=".28em">{COPY.iaEyebrow}</Lab>
        <div style={{ fontFamily: OSWALD, fontWeight: 700, color: T.ink, fontSize: 168, lineHeight: 0.85, letterSpacing: "-.03em" }}>{COPY.iaConfRaw}<span style={{ color: T.bordo, fontSize: 96 }}>%</span></div>
        <div style={{ fontFamily: OSWALD, fontSize: 11, letterSpacing: ".22em", color: T.ink3 }}>CONFIANÇA DA IA · ACIMA DO LIMIAR 85%</div>
        <div style={{ height: 1, background: T.border, margin: "6px 0" }} />
        <div style={{ fontFamily: OSWALD, fontSize: 22, letterSpacing: ".06em", color: T.ink, fontWeight: 700 }}>{COPY.iaTipo}</div>
        <p style={{ fontSize: 12.5, lineHeight: 1.55, color: T.ink2, margin: 0 }}>{COPY.iaJust}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 6 }}>
          <FieldZ6 label={COPY.fNumLab} value={COPY.fNumVal} badge={<ConfirmBadge />} />
          <FieldZ6 label={COPY.fValLab} value={COPY.fValVal} badge={<ConfirmBadge />} />
        </div>
      </div>
    </div>
    <FooterBar />
  </Paper>
);

const R7: React.FC = () => (
  <Paper>
    <HeaderBar />
    <div style={{ background: "#EEE9E1", padding: 28 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr", gap: 18, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Lab spacing=".24em">DOSSIÊ</Lab>
          <div style={{ fontFamily: OSWALD, fontSize: 14, letterSpacing: ".06em", color: T.ink, fontWeight: 700, lineHeight: 1.2 }}>{COPY.iaTipo}</div>
          <FileBlock compact />
          <SelectField label={COPY.categoriaLab} value={COPY.categoriaVal} />
          <SelectField label={COPY.tipoLab} value={COPY.tipoVal} />
        </div>
        <div style={{ position: "relative" }}>
          <PdfSheet height={540} />
          <div style={{ position: "absolute", top: 30, right: -10, transform: "rotate(-8deg)", border: `5px solid ${T.bordo}`, padding: "10px 18px 6px", background: "rgba(255,255,255,.9)", borderRadius: 4, color: T.bordo, fontFamily: OSWALD, boxShadow: "0 6px 18px rgba(122,31,43,.25)" }}>
            <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 0.9, letterSpacing: "-.02em" }}>{COPY.iaConfRaw}%</div>
            <div style={{ fontSize: 10, letterSpacing: ".3em", textAlign: "center", marginTop: 2 }}>IA · APROVADO</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FieldZ6 label={COPY.fNumLab} value={COPY.fNumVal} badge={<ConfirmBadge />} />
          <FieldZ6 label={COPY.fOrgaoLab} value={COPY.fOrgaoVal} />
          <FieldZ6 label={COPY.fEmissLab} value={COPY.fEmissVal} />
          <FieldZ6 label={COPY.fValLab} value={COPY.fValVal} badge={<ConfirmBadge />} />
          <EscopoBlock />
        </div>
      </div>
    </div>
    <FooterBar />
  </Paper>
);

const R8: React.FC = () => (
  <Paper>
    <HeaderBar />
    <div style={{ padding: 28, background: T.soft }}>
      <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden", display: "grid", gridTemplateColumns: "260px 1fr 260px", boxShadow: "0 4px 16px rgba(0,0,0,.06)" }}>
        <div style={{ padding: 18, borderRight: `2px dashed ${T.border}`, background: T.bordoSoft }}>
          <Lab color={T.bordo} spacing=".24em">ARQUIVO</Lab>
          <div style={{ marginTop: 10 }}><PdfSheet height={380} scale={0.85} /></div>
        </div>
        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
          <Lab spacing=".24em">{COPY.iaEyebrow}</Lab>
          <div style={{ fontFamily: OSWALD, fontSize: 22, letterSpacing: ".06em", color: T.ink, fontWeight: 700, lineHeight: 1.2 }}>{COPY.iaTipo}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FieldZ6 label={COPY.fNumLab} value={COPY.fNumVal} badge={<ConfirmBadge />} />
            <FieldZ6 label={COPY.fOrgaoLab} value={COPY.fOrgaoVal} />
            <FieldZ6 label={COPY.fEmissLab} value={COPY.fEmissVal} />
            <FieldZ6 label={COPY.fValLab} value={COPY.fValVal} badge={<ConfirmBadge />} />
          </div>
          <AlertVencido />
        </div>
        <div style={{ borderLeft: `2px dashed ${T.border}`, background: T.ink, color: T.amber, padding: 22, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", textAlign: "center" }}>
          <Lab color={T.amber} spacing=".26em">CONFIANÇA</Lab>
          <div>
            <div style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 132, lineHeight: 0.85, color: T.amber, letterSpacing: "-.02em" }}>{COPY.iaConfRaw}%</div>
            <div style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: ".26em", color: "#cfcfcf", marginTop: 8 }}>LIMIAR 85% ✓</div>
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: ".2em", color: "#9a9a9a" }}>‖‖‖‖ {COPY.fNumVal} ‖‖‖</div>
        </div>
      </div>
    </div>
    <FooterBar />
  </Paper>
);

const R9: React.FC = () => {
  const Tile: React.FC<React.PropsWithChildren<{ span?: string; rows?: string; pad?: number; bg?: string; border?: string }>> = ({ children, span = "span 4", rows = "span 1", pad = 16, bg = "#fff", border = T.border }) => (
    <div style={{ gridColumn: span, gridRow: rows, background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: pad, minWidth: 0, overflow: "hidden" }}>{children}</div>
  );
  return (
    <Paper>
      <HeaderBar />
      <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gridAutoRows: "minmax(80px, auto)", gap: 12 }}>
        <Tile span="span 6" rows="span 3" pad={14}>
          <Lab spacing=".24em">PDF ENVIADO</Lab>
          <div style={{ marginTop: 10 }}><PdfSheet height={520} /></div>
        </Tile>
        <Tile span="span 6" rows="span 2" bg={T.ink} border={T.ink} pad={22}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Lab color={T.amber} spacing=".26em">{COPY.iaEyebrow}</Lab>
            <span style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: ".22em", color: "#9a9a9a" }}>LIMIAR 85%</span>
          </div>
          <div style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 200, lineHeight: 0.85, color: T.amber, letterSpacing: "-.03em", marginTop: 6 }}>{COPY.iaConfRaw}<span style={{ fontSize: 96 }}>%</span></div>
          <div style={{ fontFamily: OSWALD, fontSize: 18, letterSpacing: ".06em", color: "#fff", fontWeight: 700, marginTop: 8 }}>{COPY.iaTipo}</div>
        </Tile>
        <Tile span="span 3"><FieldZ6 label={COPY.fNumLab} value={COPY.fNumVal} badge={<ConfirmBadge />} /></Tile>
        <Tile span="span 3"><FieldZ6 label={COPY.fValLab} value={COPY.fValVal} badge={<ConfirmBadge />} /></Tile>
        <Tile span="span 6" pad={12}><AlertVencido /></Tile>
        <Tile span="span 6" pad={6}><ConformidadeTable dense /></Tile>
      </div>
      <FooterBar />
    </Paper>
  );
};

const R10: React.FC = () => (
  <Paper>
    <HeaderBar />
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", background: T.soft }}>
      <div style={{ padding: 26, borderRight: `1px solid ${T.border}` }}>
        <Lab spacing=".24em">ARQUIVO ENVIADO</Lab>
        <div style={{ marginTop: 10 }}><PdfSheet height={560} /></div>
      </div>
      <div style={{ background: "#fff", borderLeft: `1px solid ${T.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "22px 26px 14px", background: T.greenBg, borderBottom: `1px solid ${T.greenBorder}`, textAlign: "center" }}>
          <Lab color={T.greenInk} spacing=".26em">CONFIANÇA DA IA</Lab>
          <div style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 156, lineHeight: 0.85, color: T.greenInk, letterSpacing: "-.02em", marginTop: 6 }}>{COPY.iaConfRaw}<span style={{ fontSize: 72 }}>%</span></div>
          <div style={{ fontFamily: OSWALD, fontSize: 10.5, letterSpacing: ".24em", color: T.greenInk, marginTop: 4 }}>✓ ACIMA DO LIMIAR 85%</div>
        </div>
        <div style={{ padding: 22, fontFamily: "monospace", fontSize: 12 }}>
          <div style={{ textAlign: "center", letterSpacing: ".2em", color: T.ink3, fontSize: 10 }}>— RECIBO DA IA —</div>
          <div style={{ borderBottom: `1px dashed ${T.border}`, margin: "10px 0" }} />
          {[["TIPO", COPY.iaTipo], ["Nº", COPY.fNumVal], ["ÓRGÃO", COPY.fOrgaoVal], ["AVAL.", COPY.fEmissVal], ["VALIDADE", `${COPY.fValVal}  ⚠`], ["CATEGORIA", COPY.categoriaVal], ["TIPO DOC", COPY.tipoVal]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", borderBottom: `1px dotted ${T.line}` }}>
              <span style={{ color: T.ink3, letterSpacing: ".1em" }}>{k}</span>
              <span style={{ color: T.ink, fontWeight: 700, textAlign: "right" }}>{v}</span>
            </div>
          ))}
          <div style={{ borderBottom: `1px dashed ${T.border}`, margin: "12px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", color: T.greenInk, fontWeight: 700 }}>
            <span>CAMPOS CONFIRMADOS</span><span>2 / 2 ✓</span>
          </div>
          <div style={{ marginTop: 12, fontSize: 9.5, color: T.ink3, textAlign: "center", letterSpacing: ".14em" }}>{COPY.fileName} · {COPY.fileSize}</div>
        </div>
      </div>
    </div>
    <FooterBar />
  </Paper>
);

/* ───────── Launcher de variantes ───────── */
const VariantLauncher: React.FC<{ current?: number }> = ({ current }) => (
  <div style={{ position: "sticky", top: 0, zIndex: 100, background: T.ink, padding: "10px 14px", marginBottom: 24, borderRadius: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
    <Lab color={T.amber} size={9.5} spacing=".26em">REDESIGN Z6 · 10 PARADIGMAS</Lab>
    <span style={{ width: 1, height: 16, background: "#2a2a2a", margin: "0 4px" }} />
    <a href="?" style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: ".18em", padding: "6px 10px", borderRadius: 2, textDecoration: "none", background: !current ? T.amber : "transparent", color: !current ? T.ink : "#cfcfcf", border: `1px solid ${!current ? T.amber : "#2a2a2a"}` }}>
      TODAS
    </a>
    {VARIANTS.map((v) => {
      const active = current === v.id;
      return (
        <a
          key={v.id}
          href={`?v=${v.id}`}
          style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: ".18em", padding: "6px 10px", borderRadius: 2, textDecoration: "none", background: active ? T.amber : "transparent", color: active ? T.ink : "#cfcfcf", border: `1px solid ${active ? T.amber : "#2a2a2a"}` }}
        >
          R{v.id}
        </a>
      );
    })}
  </div>
);

const VARIANTS: { id: number; nome: string; subtitulo: string; render: () => React.ReactNode }[] = [
  { id: 1, nome: "R1 · Timeline Narrativa", subtitulo: "FEED VERTICAL · IA NARRA EM 5 PASSOS", render: () => <R1 /> },
  { id: 2, nome: "R2 · Bento Assimétrico", subtitulo: "MOSAICO DE TILES · HIERARQUIA POR TAMANHO", render: () => <R2 /> },
  { id: 3, nome: "R3 · Worksheet Horizontal", subtitulo: "FICHA ROW-BY-ROW · TABELA EDITÁVEL DENSA", render: () => <R3 /> },
  { id: 4, nome: "R4 · Cockpit Dark + Worksheet Light", subtitulo: "DOSSIÊ PRETO ESQ · CAMPOS LIGHT DIR", render: () => <R4 /> },
  { id: 5, nome: "R5 · Hero Confiança + Tabs", subtitulo: "BANNER 98% FULL-WIDTH · ABAS NO CORPO", render: () => <R5 /> },
  { id: 6, nome: "R6 · Magazine Cover", subtitulo: "PDF CAPA ESQ · MANCHETE 98% DIR", render: () => <R6 /> },
  { id: 7, nome: "R7 · Evidence Board", subtitulo: "PDF CENTRAL · CARIMBO 98% ROTACIONADO", render: () => <R7 /> },
  { id: 8, nome: "R8 · Boarding Pass", subtitulo: "STUB PDF · DADOS · PORTÃO 98% DARK", render: () => <R8 /> },
  { id: 9, nome: "R9 · Bento PDF + 98% Hero", subtitulo: "TILE PDF GIGANTE + TILE 98% DARK GIGANTE", render: () => <R9 /> },
  { id: 10, nome: "R10 · Document Receipt", subtitulo: "PDF + RECIBO IA · 98% VERDE NO TOPO", render: () => <R10 /> },
];

export default function MockupsHubDoc() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const vRaw = params.get("v");
  const v = vRaw ? Math.max(1, Math.min(VARIANTS.length, Number(vRaw))) : null;

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
        <VariantLauncher current={v} />
        <div id="mockup-shot" style={{ maxWidth: 1320, margin: "0 auto" }}>
          {variant.render()}
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <VariantLauncher />
      <div style={{ maxWidth: 1320, margin: "0 auto", marginBottom: 24 }}>
        <Lab>MOCKUPS · STACK COCKPIT Z6 LIGHT</Lab>
        <div style={{ fontFamily: OSWALD, fontSize: 26, letterSpacing: ".06em", color: T.ink, fontWeight: 700, marginTop: 2 }}>
          ADICIONAR DOCUMENTO · REDESIGN ZERO · 5 PARADIGMAS
        </div>
        <p style={{ marginTop: 8, fontSize: 12.5, color: T.ink2, maxWidth: 800 }}>
          Cinco abordagens estruturalmente diferentes — sem repetir "PDF esquerda + form direita". Mesma stack (React), mesmas fontes (Oswald + Inter), mesma paleta canônica Z6 (#7A1F2B · #D6A64B · #0A0A0A · #2F8F4A · #D9342B). Todo o conteúdo real do modal preservado.
        </p>
      </div>
      <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 40 }}>
        {VARIANTS.map((variant) => (
          <section key={variant.id} id={`v${variant.id}`}>
            <div style={{ marginBottom: 10, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <div>
                <Lab>{variant.subtitulo}</Lab>
                <div style={{ fontFamily: OSWALD, fontSize: 16, letterSpacing: ".06em", color: T.ink, marginTop: 2 }}>{variant.nome}</div>
              </div>
              <a href={`?v=${variant.id}`} style={{ fontFamily: OSWALD, fontSize: 10, letterSpacing: ".18em", color: T.bordo, textDecoration: "none" }}>
                VER ISOLADO →
              </a>
            </div>
            {variant.render()}
          </section>
        ))}
      </div>
    </div>
  );
}
