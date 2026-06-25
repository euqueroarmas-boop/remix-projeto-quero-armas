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

