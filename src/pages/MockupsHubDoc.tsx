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
 * V1 · 3 COLUNAS REFINADAS — mesma estrutura do original, modernizada Z6
 * ============================================================ */
const V1: React.FC = () => (
  <Paper>
    <HeaderBar />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 0 }}>
      {/* Esquerda · Arquivo + IA */}
      <section style={{ padding: 20, borderRight: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Lab>{COPY.arquivoLab}</Lab>
          <span style={{ fontFamily: OSWALD, fontSize: 9.5, letterSpacing: ".18em", color: T.bordo, background: T.bordoSoft, padding: "2px 7px", borderRadius: 2 }}>
            {COPY.fileBadge}
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: T.ink3, marginBottom: 12 }}>{COPY.arquivoSub}</div>
        <FileBlock />
        <div style={{ marginTop: 14 }}>
          <IaBlock />
        </div>
      </section>

      {/* Centro · Dados do documento */}
      <section style={{ padding: 20, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ textAlign: "center" }}>
          <Lab spacing=".32em">— {COPY.dadosTitle} —</Lab>
        </div>
        <AlertRevise />
        <AlertVencido />
        <ConformidadeTable />
      </section>

      {/* Direita · Campos */}
      <section style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <SelectField label={COPY.categoriaLab} value={COPY.categoriaVal} />
          <SelectField label={COPY.tipoLab} value={COPY.tipoVal} />
        </div>
        <EscopoBlock />
        <FieldZ6 label={`# ${COPY.fNumLab.replace("Nº ", "")}`} value={COPY.fNumVal} badge={<ConfirmBadge />} full />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FieldZ6 label={COPY.fOrgaoLab} value={COPY.fOrgaoVal} />
          <FieldZ6 label={`▤ ${COPY.fEmissLab}`} value={COPY.fEmissVal} />
        </div>
        <FieldZ6 label={`▤ ${COPY.fValLab}`} value={COPY.fValVal} badge={<ConfirmBadge />} full />
      </section>
    </div>
    <FooterBar />
  </Paper>
);

/* ============================================================
 * V2 · INSPECTOR VERTICAL — sidebar fina de seções + canvas rolável
 * ============================================================ */
const V2: React.FC = () => {
  const sections = [
    { l: "ARQUIVO", c: 1, s: "done" },
    { l: "IA · CLASSIFICAÇÃO", c: 1, s: "done" },
    { l: "ALERTAS", c: 2, s: "current" },
    { l: "CONFORMIDADE", c: 2, s: "done" },
    { l: "DADOS & ESCOPO", c: 6, s: "current" },
  ];
  return (
    <Paper>
      <HeaderBar />
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr" }}>
        <aside style={{ background: T.ink, color: "#fff", padding: "20px 0", minHeight: 720 }}>
          <div style={{ padding: "0 18px 14px" }}>
            <Lab color={T.amber} size={9} spacing=".32em">
              SEÇÕES
            </Lab>
          </div>
          {sections.map((s, i) => {
            const cur = s.s === "current";
            return (
              <div
                key={s.l}
                style={{
                  padding: "11px 18px",
                  borderLeft: `3px solid ${cur ? T.amber : "transparent"}`,
                  background: cur ? "#161616" : "transparent",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: OSWALD, fontSize: 9.5, letterSpacing: ".18em", color: T.ink3 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ fontFamily: OSWALD, fontSize: 10.5, letterSpacing: ".18em", color: "#fff" }}>{s.l}</span>
                </span>
                <span style={{ fontFamily: OSWALD, fontSize: 9, letterSpacing: ".14em", color: s.s === "done" ? T.green : T.amber }}>
                  {s.s === "done" ? "✓ " + s.c : "● " + s.c}
                </span>
              </div>
            );
          })}
          <div style={{ padding: "20px 18px", marginTop: 14, borderTop: `1px solid #161616` }}>
            <Lab color={T.amber} size={9} spacing=".22em">
              CONFIANÇA IA
            </Lab>
            <div style={{ marginTop: 6, fontFamily: OSWALD, fontSize: 28, letterSpacing: ".04em", color: "#fff", fontWeight: 600 }}>
              {COPY.iaConfRaw}%
            </div>
            <div style={{ marginTop: 4, fontSize: 10.5, color: T.ink4 }}>{COPY.iaTipo}</div>
          </div>
        </aside>
        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 18 }}>
          <section>
            <Lab>01 · {COPY.arquivoLab}</Lab>
            <div style={{ marginTop: 10 }}>
              <FileBlock />
            </div>
          </section>
          <section>
            <Lab>02 · {COPY.iaEyebrow}</Lab>
            <div style={{ marginTop: 10 }}>
              <IaBlock />
            </div>
          </section>
          <section>
            <Lab>03 · ALERTAS</Lab>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              <AlertRevise />
              <AlertVencido />
            </div>
          </section>
          <section>
            <Lab>04 · CONFORMIDADE</Lab>
            <div style={{ marginTop: 10 }}>
              <ConformidadeTable />
            </div>
          </section>
          <section>
            <Lab>05 · DADOS & ESCOPO</Lab>
            <div
              style={{
                marginTop: 10,
                padding: 16,
                background: "#fff",
                border: `1px solid ${T.border}`,
                borderRadius: 3,
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
              }}
            >
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
          </section>
        </div>
      </div>
      <FooterBar />
    </Paper>
  );
};

/* ============================================================
 * V3 · DOCUMENTO CENTRADO — viewer do PDF à esquerda, painel direita
 * ============================================================ */
const V3: React.FC = () => (
  <Paper>
    <HeaderBar />
    <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", minHeight: 760 }}>
      <div style={{ background: "#E9E9E9", padding: 24, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Lab>{COPY.arquivoLab} · PRÉ-VISUALIZAÇÃO</Lab>
          <span style={{ fontFamily: OSWALD, fontSize: 9.5, letterSpacing: ".18em", color: T.bordo, background: T.bordoSoft, padding: "2px 7px", borderRadius: 2 }}>
            {COPY.fileBadge}
          </span>
        </div>
        <div
          style={{
            margin: "0 auto",
            width: "min(520px, 100%)",
            aspectRatio: "1 / 1.41",
            background: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,.08)",
            padding: "60px 56px",
            fontFamily: OSWALD,
            color: T.ink,
            position: "relative",
          }}
        >
          <div style={{ fontSize: 11, color: T.bordo, letterSpacing: ".22em" }}>POLÍCIA FEDERAL</div>
          <div style={{ fontSize: 10, color: T.ink3 }}>INSTRUTOR DE TIRO CREDENCIADO</div>
          <div style={{ marginTop: 28, fontSize: 17, letterSpacing: ".1em" }}>ATESTADO DE CAPACIDADE TÉCNICA</div>
          <div style={{ marginTop: 6, fontSize: 11, color: T.ink2, letterSpacing: ".1em" }}>Nº 0005/2025</div>
          <div style={{ marginTop: 24, fontSize: 11, color: T.ink3 }}>NOME</div>
          <div style={{ fontFamily: OSWALD, fontSize: 13, letterSpacing: ".06em", color: T.ink }}>
            WILLIAN RODRIGUES DA SILVA
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: T.ink3 }}>CPF</div>
          <div style={{ fontFamily: OSWALD, fontSize: 13, letterSpacing: ".06em", color: T.ink }}>377.995.388-99</div>
          <div style={{ marginTop: 12, fontSize: 11, color: T.ink3 }}>AVALIAÇÃO &nbsp;·&nbsp; VALIDADE</div>
          <div style={{ fontFamily: OSWALD, fontSize: 13, letterSpacing: ".06em", color: T.ink }}>
            19/03/2025 · 19/03/2026
          </div>
          <div style={{ marginTop: 30, fontSize: 12, color: T.green, letterSpacing: ".08em" }}>✓ APROVADO</div>
        </div>
        <FileBlock />
      </div>
      <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
        <IaBlock />
        <AlertRevise />
        <AlertVencido />
        <ConformidadeTable dense />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <SelectField label={COPY.categoriaLab} value={COPY.categoriaVal} />
          <SelectField label={COPY.tipoLab} value={COPY.tipoVal} />
        </div>
        <EscopoBlock />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FieldZ6 label={COPY.fNumLab} value={COPY.fNumVal} badge={<ConfirmBadge />} />
          <FieldZ6 label={COPY.fOrgaoLab} value={COPY.fOrgaoVal} />
          <FieldZ6 label={COPY.fEmissLab} value={COPY.fEmissVal} />
          <FieldZ6 label={COPY.fValLab} value={COPY.fValVal} badge={<ConfirmBadge />} />
        </div>
      </div>
    </div>
    <FooterBar />
  </Paper>
);

/* ============================================================
 * V4 · KPI STRIP + 2 COL — cockpit denso com 4 KPIs no topo
 * ============================================================ */
const Kpi: React.FC<{ label: string; value: string; sub: string; dot: string }> = ({ label, value, sub, dot }) => (
  <div style={{ padding: "12px 14px", borderRight: `1px solid ${T.border}`, flex: 1, minWidth: 0 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: dot }} />
      <Lab size={9.5} spacing=".18em">
        {label}
      </Lab>
    </div>
    <div style={{ marginTop: 6, fontFamily: OSWALD, fontSize: 22, letterSpacing: ".04em", color: T.ink, fontWeight: 600, lineHeight: 1 }}>
      {value}
    </div>
    <div style={{ marginTop: 4, fontSize: 10.5, color: T.ink3 }}>{sub}</div>
  </div>
);
const V4: React.FC = () => (
  <Paper>
    <HeaderBar />
    <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, background: T.soft }}>
      <Kpi label="CONFIANÇA IA" value={`${COPY.iaConfRaw}%`} sub="ACIMA DO LIMIAR 85%" dot={T.green} />
      <Kpi label="CONFORMIDADE" value="2/2" sub="DUPLA VERIFICAÇÃO" dot={T.green} />
      <Kpi label="VALIDADE" value={COPY.fValVal} sub="VENCIDO · ARQUIVO" dot={T.amber} />
      <div style={{ padding: "12px 14px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: T.green }} />
          <Lab size={9.5} spacing=".18em">
            CAMPOS PENDENTES
          </Lab>
        </div>
        <div style={{ marginTop: 6, fontFamily: OSWALD, fontSize: 22, letterSpacing: ".04em", color: T.ink, fontWeight: 600 }}>0</div>
        <div style={{ marginTop: 4, fontSize: 10.5, color: T.ink3 }}>PRONTO PARA SALVAR</div>
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 0 }}>
      <section style={{ padding: 22, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 14 }}>
        <Lab>01 · {COPY.arquivoLab}</Lab>
        <FileBlock />
        <IaBlock />
        <Lab>02 · ALERTAS</Lab>
        <AlertRevise />
        <AlertVencido />
      </section>
      <section style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        <Lab>03 · CONFORMIDADE</Lab>
        <ConformidadeTable />
        <Lab>04 · DADOS DO DOCUMENTO</Lab>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <SelectField label={COPY.categoriaLab} value={COPY.categoriaVal} />
          <SelectField label={COPY.tipoLab} value={COPY.tipoVal} />
          <FieldZ6 label={COPY.fNumLab} value={COPY.fNumVal} badge={<ConfirmBadge />} />
          <FieldZ6 label={COPY.fOrgaoLab} value={COPY.fOrgaoVal} />
          <FieldZ6 label={COPY.fEmissLab} value={COPY.fEmissVal} />
          <FieldZ6 label={COPY.fValLab} value={COPY.fValVal} badge={<ConfirmBadge />} />
        </div>
        <EscopoBlock />
      </section>
    </div>
    <FooterBar />
  </Paper>
);

/* ============================================================
 * V5 · WORKSHEET — ficha catalográfica alongada, uma seção por linha full-width
 * ============================================================ */
const Row: React.FC<React.PropsWithChildren<{ n: string; title: string; right?: React.ReactNode }>> = ({ n, title, right, children }) => (
  <section style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 0, borderBottom: `1px solid ${T.border}` }}>
    <div style={{ padding: "20px 22px", borderRight: `1px solid ${T.border}`, background: T.soft }}>
      <Lab size={9.5} spacing=".22em">
        {n}
      </Lab>
      <div style={{ marginTop: 6, fontFamily: OSWALD, fontSize: 13, letterSpacing: ".06em", color: T.ink, fontWeight: 600 }}>{title}</div>
      {right && <div style={{ marginTop: 10 }}>{right}</div>}
    </div>
    <div style={{ padding: 20 }}>{children}</div>
  </section>
);
const V5: React.FC = () => (
  <Paper>
    <HeaderBar />
    <Row
      n="01"
      title={COPY.arquivoLab}
      right={
        <span style={{ fontFamily: OSWALD, fontSize: 9.5, letterSpacing: ".18em", color: T.bordo, background: T.bordoSoft, padding: "2px 7px", borderRadius: 2, display: "inline-block" }}>
          {COPY.fileBadge}
        </span>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <FileBlock />
        <IaBlock compact />
      </div>
    </Row>
    <Row n="02" title="ALERTAS">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <AlertRevise />
        <AlertVencido />
      </div>
    </Row>
    <Row n="03" title="CONFORMIDADE">
      <ConformidadeTable />
    </Row>
    <Row n="04" title={COPY.categoriaLab.replace("CATEGORIA DO ", "TIPO & ")}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12 }}>
        <SelectField label={COPY.categoriaLab} value={COPY.categoriaVal} />
        <SelectField label={COPY.tipoLab} value={COPY.tipoVal} />
        <EscopoBlock />
      </div>
    </Row>
    <Row n="05" title="DADOS DO DOCUMENTO">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <FieldZ6 label={COPY.fNumLab} value={COPY.fNumVal} badge={<ConfirmBadge />} />
        <FieldZ6 label={COPY.fOrgaoLab} value={COPY.fOrgaoVal} />
        <FieldZ6 label={COPY.fEmissLab} value={COPY.fEmissVal} />
        <FieldZ6 label={COPY.fValLab} value={COPY.fValVal} badge={<ConfirmBadge />} />
      </div>
    </Row>
    <FooterBar />
  </Paper>
);

/* ───────── Index ───────── */
const VARIANTS: { id: number; nome: string; subtitulo: string; render: () => React.ReactNode }[] = [
  { id: 1, nome: "V1 · 3 Colunas Refinadas", subtitulo: "MESMA ARQUITETURA, MODERNIZADA Z6", render: () => <V1 /> },
  { id: 2, nome: "V2 · Inspector Vertical", subtitulo: "SIDEBAR PRETA DE SEÇÕES + CANVAS", render: () => <V2 /> },
  { id: 3, nome: "V3 · Documento Centrado", subtitulo: "VIEWER PDF ESQ · PAINEL DIR", render: () => <V3 /> },
  { id: 4, nome: "V4 · KPI Strip + 2 Colunas", subtitulo: "4 KPIs Z6 NO TOPO · COCKPIT DENSO", render: () => <V4 /> },
  { id: 5, nome: "V5 · Worksheet Linha por Linha", subtitulo: "FICHA CATALOGRÁFICA · 5 ROWS", render: () => <V5 /> },
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
        <div id="mockup-shot" style={{ maxWidth: 1320, margin: "0 auto" }}>
          {variant.render()}
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 1320, margin: "0 auto", marginBottom: 24 }}>
        <Lab>MOCKUPS · STACK COCKPIT Z6 LIGHT</Lab>
        <div style={{ fontFamily: OSWALD, fontSize: 26, letterSpacing: ".06em", color: T.ink, fontWeight: 700, marginTop: 2 }}>
          ADICIONAR DOCUMENTO · 5 REDESIGNS Z6
        </div>
        <p style={{ marginTop: 8, fontSize: 12.5, color: T.ink2, maxWidth: 800 }}>
          5 variantes do modal atual com todo o conteúdo real (alertas IA, vencimento, conformidade com dupla verificação, escopo, badges Confirmado por campo) reorganizado dentro dos tokens canônicos do Cockpit Z6 Light. Sem imagem gerada por IA, sem cópia inventada.
        </p>
      </div>
      <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
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