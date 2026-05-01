/**
 * Templates de e-mail premium do Quero Armas — Arsenal Tactical Light.
 * Identidade visual baseada na UI do Arsenal (detalhes do cliente):
 *   - Fundo gelo / papel (#f6f5f1)
 *   - Card branco com bordas slate finas
 *   - Header tático preto absoluto (#0A0A0A) com logo PRETA da marca
 *   - Acento âmbar tático (#d97706 / #92400e)
 *   - Tipografia mono uppercase com tracking 3px em labels
 *   - Blocos técnicos KEY → VALUE estilo "diagnóstico de campo"
 *   - Copy agressiva, técnica, direta — zero gordura.
 *
 * Remetente padrão: Quero Armas <naoresponda@euqueroarmas.com.br>
 */

const LOGO_URL = "https://ogkltfqvzweeqkfmrzts.supabase.co/storage/v1/object/public/contract-assets/quero-armas-logo.png";
const PORTAL_URL = "https://www.euqueroarmas.com.br/quero-armas/cliente/login";
const SITE_URL = "https://www.euqueroarmas.com.br";
const SUPPORT_EMAIL = "naoresponda@euqueroarmas.com.br";

// ─── Arsenal Tactical Light tokens ────────────────────────────────────
const PAPER       = "#f6f5f1"; // fundo gelo (body)
const SURFACE     = "#ffffff"; // card
const INK         = "#0A0A0A"; // texto principal / header
const INK_SOFT    = "#1E1E1E"; // ink secundário (Arsenal)
const STEEL       = "#334155"; // texto de leitura
const MUTED       = "#64748b"; // labels secundárias
const HAIRLINE    = "#e5e3dc"; // bordas em fundo papel
const BORDER      = "#e5e7eb"; // bordas padrão
const SOFT_BG     = "#fafaf7"; // bg de blocos info dentro do card
const AMBER       = "#d97706"; // acento primário (Arsenal)
const AMBER_DARK  = "#92400e";
const AMBER_SOFT  = "#fef3c7";
const DANGER      = "#dc2626";
const DANGER_DARK = "#991b1b";
const SUCCESS     = "#16a34a";
const SUCCESS_DK  = "#166534";

// Compat (algum chamador externo pode importar)
const PRIMARY      = AMBER;
const PRIMARY_DARK = AMBER_DARK;

export interface QAEmailFrame {
  preheader?: string;
  title: string;
  body: string;
  /** Etiqueta mono no topo do card (ex.: "OPERAÇÃO · COBRANÇA"). */
  opTag?: string;
  /** Subtítulo curto sob o título (ex.: serviço afetado, cliente). */
  subtitle?: string;
}

export function qaWrap({ preheader = "", title, body, opTag, subtitle }: QAEmailFrame): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#ffffff;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;">

      <!-- BARRA DE MARCA TÁTICA (preto absoluto) -->
      <tr><td style="background:${INK};border-radius:14px 14px 0 0;padding:18px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="middle" style="vertical-align:middle;">
              <div style="font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:${AMBER};font-weight:700;">QUERO · ARMAS</div>
              <div style="margin-top:4px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#94a3b8;">PLATAFORMA TÁTICA · ARSENAL DIGITAL</div>
            </td>
            <td align="right" valign="middle" style="vertical-align:middle;">
              <div style="display:inline-block;background:#ffffff;border-radius:8px;padding:6px 10px;">
                <img src="${LOGO_URL}" alt="Quero Armas" width="36" height="36" style="display:block;width:36px;height:36px;object-fit:contain;border:0;outline:0;">
              </div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- CARD PRINCIPAL (branco premium) -->
      <tr><td style="background:${SURFACE};border-left:1px solid ${HAIRLINE};border-right:1px solid ${HAIRLINE};">

        <!-- TÍTULO + OPTAG -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:32px 40px 0;">
            ${opTag ? `<div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${AMBER_DARK};font-weight:700;margin:0 0 10px;">${opTag}</div>` : ""}
            <h1 style="margin:0;font-size:26px;line-height:1.2;font-weight:800;color:${INK};letter-spacing:-0.5px;">${title}</h1>
            ${subtitle ? `<p style="margin:8px 0 0;font-size:13px;color:${MUTED};line-height:1.5;">${subtitle}</p>` : ""}
            <div style="height:3px;width:48px;background:${AMBER};margin:18px 0 0;border-radius:2px;"></div>
          </td></tr>
        </table>

        <!-- CONTEÚDO -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:28px 40px 36px;">
            ${body}
          </td></tr>
        </table>
      </td></tr>

      <!-- FOOTER -->
      <tr><td style="background:${SURFACE};border:1px solid ${HAIRLINE};border-top:1px solid ${HAIRLINE};border-radius:0 0 14px 14px;padding:22px 40px 26px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${MUTED};font-weight:700;">PROTOCOLO AUTOMATIZADO</td>
            <td align="right" style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${MUTED};">NOREPLY · NÃO RESPONDA</td>
          </tr>
        </table>
        <div style="height:1px;background:${HAIRLINE};margin:14px 0 14px;"></div>
        <p style="margin:0;font-size:12px;color:${STEEL};line-height:1.6;">
          Este e-mail é gerado automaticamente pela infraestrutura da plataforma. Para suporte humano, acesse
          <a href="${SITE_URL}" style="color:${AMBER_DARK};text-decoration:none;font-weight:700;">euqueroarmas.com.br</a>
          ou fale com o time pelo seu portal.
        </p>
        <p style="margin:10px 0 0;font-size:10px;color:#94a3b8;letter-spacing:0.3px;">
          © ${new Date().getFullYear()} QUERO ARMAS · Operação regida por LGPD e pela Lei 10.826/03.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ─── Primitivos visuais ───────────────────────────────────────────────

function btn(href: string, label: string, color: "primary" | "danger" | "success" | "ghost" = "primary"): string {
  const bg = color === "danger" ? DANGER : color === "success" ? SUCCESS : color === "ghost" ? "#ffffff" : INK;
  const fg = color === "ghost" ? INK : "#ffffff";
  const bd = color === "ghost" ? `2px solid ${INK}` : `2px solid ${bg}`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 4px;">
    <tr><td align="center" style="border-radius:10px;background:${bg};border:${bd};">
      <a href="${href}" style="display:inline-block;padding:14px 30px;font-size:13px;font-weight:800;color:${fg};text-decoration:none;border-radius:8px;letter-spacing:1.5px;text-transform:uppercase;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">${label} →</a>
    </td></tr>
  </table>`;
}

/** Linha técnica KEY → VALUE estilo "diagnóstico" do Arsenal. */
function diagRow(label: string, value: string, opts: { mono?: boolean; tone?: "default" | "danger" | "success" | "warn"; last?: boolean } = {}): string {
  const toneColor = opts.tone === "danger" ? DANGER : opts.tone === "success" ? SUCCESS : opts.tone === "warn" ? AMBER_DARK : INK;
  const fontFamily = opts.mono ? "'SF Mono',Menlo,Consolas,monospace" : "-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
  return `<tr>
    <td style="padding:14px 18px;${opts.last ? "" : `border-bottom:1px solid ${HAIRLINE};`}vertical-align:middle;width:42%;">
      <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${MUTED};font-weight:700;">${label}</div>
    </td>
    <td style="padding:14px 18px;${opts.last ? "" : `border-bottom:1px solid ${HAIRLINE};`}vertical-align:middle;text-align:right;">
      <div style="font-family:${fontFamily};font-size:14px;color:${toneColor};font-weight:700;">${value}</div>
    </td>
  </tr>`;
}

/** Bloco diagnóstico KEY/VALUE em fundo gelo, borda âmbar à esquerda. */
function diagBlock(rows: Array<{ k: string; v: string; mono?: boolean; tone?: "default" | "danger" | "success" | "warn" }>, accent: string = AMBER): string {
  const trs = rows.map((r, i) => diagRow(r.k, r.v, { mono: r.mono, tone: r.tone, last: i === rows.length - 1 })).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SOFT_BG};border:1px solid ${HAIRLINE};border-left:3px solid ${accent};border-radius:10px;margin:0 0 24px;">
    ${trs}
  </table>`;
}

function notice(kind: "info" | "warn" | "success" | "danger", title: string, body: string): string {
  const themes = {
    info:    { bg: "#f1f5f9", bd: "#cbd5e1", fg: "#1e293b", icon: "ℹ" },
    warn:    { bg: AMBER_SOFT, bd: "#fcd34d", fg: AMBER_DARK, icon: "⚠" },
    success: { bg: "#dcfce7", bd: "#86efac", fg: SUCCESS_DK, icon: "✓" },
    danger:  { bg: "#fee2e2", bd: "#fca5a5", fg: DANGER_DARK, icon: "✕" },
  };
  const t = themes[kind];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${t.bg};border:1px solid ${t.bd};border-radius:10px;margin:0 0 22px;">
    <tr>
      <td width="36" valign="top" style="padding:14px 0 14px 16px;">
        <div style="width:24px;height:24px;border-radius:6px;background:${t.fg};color:#ffffff;font-weight:800;font-size:13px;text-align:center;line-height:24px;font-family:'SF Mono',monospace;">${t.icon}</div>
      </td>
      <td valign="top" style="padding:14px 18px 14px 12px;">
        <p style="margin:0 0 4px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;font-weight:700;color:${t.fg};letter-spacing:2px;text-transform:uppercase;">${title}</p>
        <p style="margin:0;font-size:13px;color:${t.fg};line-height:1.6;">${body}</p>
      </td>
    </tr>
  </table>`;
}

/** Sequência numerada estilo "ROE" — passos técnicos de operação. */
function steps(items: Array<{ titulo: string; desc: string }>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;">
    ${items.map((it, idx) => `
      <tr>
        <td width="44" valign="top" style="padding:0 14px 16px 0;">
          <div style="width:32px;height:32px;border-radius:8px;background:${INK};color:${AMBER};font-weight:800;font-size:13px;text-align:center;line-height:32px;font-family:'SF Mono',Menlo,Consolas,monospace;">${String(idx + 1).padStart(2, "0")}</div>
        </td>
        <td valign="top" style="padding:0 0 16px 0;">
          <p style="margin:0 0 4px;font-size:14px;font-weight:800;color:${INK};line-height:1.3;letter-spacing:-0.2px;">${it.titulo}</p>
          <p style="margin:0;font-size:13px;color:${STEEL};line-height:1.6;">${it.desc}</p>
        </td>
      </tr>
    `).join("")}
  </table>`;
}

const greeting = (name?: string) =>
  `<p style="margin:0 0 14px;font-size:15px;font-weight:700;color:${INK};letter-spacing:-0.2px;">${name ? `${name},` : "Operador,"}</p>`;

const para = (txt: string) =>
  `<p style="margin:0 0 18px;font-size:14px;color:${STEEL};line-height:1.7;">${txt}</p>`;

const hr = `<div style="height:1px;background:${HAIRLINE};margin:28px 0;"></div>`;

/** Selo mono inline tipo chip do Arsenal. */
const chip = (txt: string, color: string = AMBER_DARK, bg: string = AMBER_SOFT) =>
  `<span style="display:inline-block;background:${bg};color:${color};font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:3px 8px;border-radius:5px;">${txt}</span>`;

// ════════════════════════════════════════════════════════════════════
// 1. BOAS-VINDAS / PRIMEIRO ACESSO (com credenciais provisórias)
// ════════════════════════════════════════════════════════════════════
export function qaWelcomeHtml(opts: { name: string; email: string; tempPassword: string; portalUrl?: string }) {
  const url = opts.portalUrl || PORTAL_URL;
  return qaWrap({
    preheader: "Seu acesso ao Portal Quero Armas foi criado.",
    title: "Bem-vindo ao Quero Armas",
    body: `
      ${greeting(opts.name)}
      ${para("Seu acesso ao <strong>Portal Quero Armas</strong> foi criado com sucesso. Utilize as credenciais abaixo para realizar seu primeiro acesso:")}
      ${infoCard([
        ["E-mail", opts.email],
        ["Senha provisória", `<span style="font-family:'SF Mono',Menlo,Consolas,monospace;background:#fff;padding:4px 10px;border-radius:6px;border:1px solid ${BORDER};color:${PRIMARY};">${opts.tempPassword}</span>`],
      ])}
      ${btn(url, "Acessar o Portal")}
      ${hr}
      ${notice("warn", "Importante", "No primeiro acesso, você será solicitado a definir uma nova senha pessoal. Não compartilhe essas credenciais com terceiros.")}
    `,
  });
}
export const qaWelcomeText = (o: { name: string; email: string; tempPassword: string; portalUrl?: string }) =>
  `Quero Armas\n\nOlá, ${o.name}!\n\nSeu acesso ao Portal Quero Armas foi criado.\n\nE-mail: ${o.email}\nSenha provisória: ${o.tempPassword}\n\nAcesse: ${o.portalUrl || PORTAL_URL}\n\nNo primeiro acesso, você será solicitado a definir uma nova senha.`;

// ════════════════════════════════════════════════════════════════════
// 2. CÓDIGO OTP DE PRIMEIRO ACESSO / ATIVAÇÃO
// ════════════════════════════════════════════════════════════════════
export function qaOtpHtml(opts: { name?: string; code: string; minutes?: number }) {
  const min = opts.minutes ?? 10;
  return qaWrap({
    preheader: `Seu código de verificação: ${opts.code}`,
    title: "Código de verificação",
    body: `
      ${greeting(opts.name)}
      ${para("Use o código abaixo para concluir a ativação do seu acesso ao Portal Quero Armas:")}
      <div style="text-align:center;margin:0 0 24px;">
        <div style="display:inline-block;background:${SOFT_BG};border:2px solid ${PRIMARY};border-radius:14px;padding:20px 32px;">
          <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:36px;font-weight:700;letter-spacing:10px;color:${PRIMARY};">${opts.code}</div>
        </div>
      </div>
      ${notice("info", "Validade do código", `Este código expira em <strong>${min} minutos</strong>. Se você não solicitou este acesso, ignore este e-mail com segurança.`)}
    `,
  });
}
export const qaOtpText = (o: { name?: string; code: string; minutes?: number }) =>
  `Quero Armas — Código de verificação\n\nOlá${o.name ? `, ${o.name}` : ""}!\n\nSeu código: ${o.code}\nVálido por ${o.minutes ?? 10} minutos.\n\nSe você não solicitou este acesso, ignore este e-mail.`;

// ════════════════════════════════════════════════════════════════════
// 3. RECUPERAÇÃO DE SENHA
// ════════════════════════════════════════════════════════════════════
export function qaPasswordResetHtml(opts: { name?: string; resetUrl: string; minutes?: number }) {
  const min = opts.minutes ?? 30;
  return qaWrap({
    preheader: "Solicitação de redefinição de senha.",
    title: "Redefinir senha",
    body: `
      ${greeting(opts.name)}
      ${para("Recebemos uma solicitação para redefinir a senha da sua conta no Portal Quero Armas. Clique no botão abaixo para escolher uma nova senha:")}
      ${btn(opts.resetUrl, "Redefinir minha senha")}
      <p style="margin:20px 0 0;font-size:12px;color:${MUTED};text-align:center;">Este link expira em <strong>${min} minutos</strong>.</p>
      ${hr}
      ${notice("warn", "Não foi você?", "Se você não solicitou esta redefinição, ignore este e-mail. Sua senha atual permanece inalterada.")}
    `,
  });
}
export const qaPasswordResetText = (o: { name?: string; resetUrl: string; minutes?: number }) =>
  `Quero Armas — Redefinir senha\n\nAcesse o link a seguir para redefinir sua senha (válido por ${o.minutes ?? 30} minutos):\n\n${o.resetUrl}\n\nSe não foi você, ignore este e-mail.`;

// ════════════════════════════════════════════════════════════════════
// 4. CONFIRMAÇÃO DE SENHA ALTERADA
// ════════════════════════════════════════════════════════════════════
export function qaPasswordChangedHtml(opts: { email: string; name?: string }) {
  return qaWrap({
    preheader: "Sua senha foi alterada com sucesso.",
    title: "Senha alterada",
    body: `
      ${greeting(opts.name)}
      ${para(`A senha da sua conta <strong>${opts.email}</strong> foi alterada com sucesso.`)}
      ${notice("success", "Tudo certo", "Sua nova senha já está ativa. Você pode acessar o portal normalmente.")}
      ${notice("danger", "Não reconhece esta alteração?", "Entre em contato imediatamente conosco para proteger sua conta.")}
    `,
  });
}
export const qaPasswordChangedText = (o: { email: string }) =>
  `Quero Armas — Senha alterada\n\nA senha da conta ${o.email} foi alterada com sucesso.\n\nSe não foi você, entre em contato imediatamente.`;

// ════════════════════════════════════════════════════════════════════
// 5. PAGAMENTO PENDENTE (boleto/PIX gerado)
// ════════════════════════════════════════════════════════════════════
export function qaPaymentPendingHtml(opts: { name: string; value: string; dueDate: string; billingType: string; invoiceUrl?: string }) {
  return qaWrap({
    preheader: `Cobrança gerada — ${opts.value} com vencimento em ${opts.dueDate}`,
    title: "Nova cobrança disponível",
    body: `
      ${greeting(opts.name)}
      ${para("Uma nova cobrança foi gerada para o seu serviço Quero Armas:")}
      ${infoCard([
        ["Valor", `<span style="color:${PRIMARY};">${opts.value}</span>`],
        ["Vencimento", opts.dueDate],
        ["Forma", opts.billingType],
      ])}
      ${opts.invoiceUrl ? btn(opts.invoiceUrl, "Visualizar cobrança") : ""}
      ${opts.invoiceUrl ? "" : para(`<em>Acesse o portal para visualizar e quitar sua cobrança.</em>`)}
      ${hr}
      ${para("Se já efetuou o pagamento, desconsidere este aviso.")}
    `,
  });
}
export const qaPaymentPendingText = (o: { name: string; value: string; dueDate: string; billingType: string; invoiceUrl?: string }) =>
  `Quero Armas — Nova cobrança\n\nOlá, ${o.name}!\n\nValor: ${o.value}\nVencimento: ${o.dueDate}\nForma: ${o.billingType}\n${o.invoiceUrl ? `\nLink: ${o.invoiceUrl}\n` : ""}`;

// ════════════════════════════════════════════════════════════════════
// 6. PAGAMENTO VENCIDO
// ════════════════════════════════════════════════════════════════════
export function qaPaymentOverdueHtml(opts: { name: string; value: string; dueDate: string; invoiceUrl?: string }) {
  return qaWrap({
    preheader: `Cobrança vencida — ${opts.value}`,
    title: "Cobrança vencida",
    body: `
      ${greeting(opts.name)}
      ${notice("danger", "Atenção: cobrança vencida", "Identificamos que a cobrança abaixo está em atraso. Para evitar a suspensão dos serviços, regularize o pagamento o quanto antes.")}
      ${infoCard([
        ["Valor", `<span style="color:${PRIMARY};">${opts.value}</span>`],
        ["Venceu em", `<span style="color:${PRIMARY};font-weight:700;">${opts.dueDate}</span>`],
      ], PRIMARY)}
      ${opts.invoiceUrl ? btn(opts.invoiceUrl, "Regularizar agora", "danger") : ""}
      ${hr}
      ${para("Se já efetuou o pagamento, desconsidere este aviso.")}
    `,
  });
}
export const qaPaymentOverdueText = (o: { name: string; value: string; dueDate: string; invoiceUrl?: string }) =>
  `Quero Armas — Cobrança vencida\n\nOlá, ${o.name}!\n\nValor: ${o.value}\nVenceu em: ${o.dueDate}\n${o.invoiceUrl ? `\nRegularize: ${o.invoiceUrl}\n` : ""}`;

// ════════════════════════════════════════════════════════════════════
// 7. PAGAMENTO CONFIRMADO
// ════════════════════════════════════════════════════════════════════
export function qaPaymentConfirmedHtml(opts: { name: string; value: string; paidAt: string; invoiceUrl?: string }) {
  return qaWrap({
    preheader: `Pagamento de ${opts.value} confirmado.`,
    title: "Pagamento confirmado",
    body: `
      ${greeting(opts.name)}
      ${para("Recebemos a confirmação do seu pagamento. Obrigado pela confiança!")}
      ${infoCard([
        ["Valor pago", `<span style="color:#16a34a;">${opts.value}</span>`],
        ["Confirmado em", opts.paidAt],
      ], "#16a34a")}
      ${opts.invoiceUrl ? btn(opts.invoiceUrl, "Ver comprovante", "success") : ""}
    `,
  });
}
export const qaPaymentConfirmedText = (o: { name: string; value: string; paidAt: string }) =>
  `Quero Armas — Pagamento confirmado\n\nOlá, ${o.name}!\n\nRecebemos seu pagamento de ${o.value} em ${o.paidAt}. Obrigado!`;

// ════════════════════════════════════════════════════════════════════
// 8. ATUALIZAÇÃO DE CASO/PROCESSO
// ════════════════════════════════════════════════════════════════════
export function qaCaseUpdateHtml(opts: { name: string; caseTitle: string; status: string; message?: string; portalUrl?: string }) {
  const url = opts.portalUrl || PORTAL_URL;
  return qaWrap({
    preheader: `Atualização do caso: ${opts.caseTitle}`,
    title: "Atualização no seu caso",
    body: `
      ${greeting(opts.name)}
      ${para("Há uma nova atualização no seu caso junto à nossa equipe:")}
      ${infoCard([
        ["Caso", opts.caseTitle],
        ["Novo status", `<span style="color:${PRIMARY};text-transform:uppercase;letter-spacing:0.5px;">${opts.status}</span>`],
      ])}
      ${opts.message ? `<div style="background:${SOFT_BG};border-left:3px solid ${PRIMARY};border-radius:8px;padding:16px 20px;margin:0 0 24px;font-size:14px;color:${INK};line-height:1.7;">${opts.message}</div>` : ""}
      ${btn(url, "Acessar o portal")}
    `,
  });
}
export const qaCaseUpdateText = (o: { name: string; caseTitle: string; status: string; message?: string }) =>
  `Quero Armas — Atualização de caso\n\nOlá, ${o.name}!\n\nCaso: ${o.caseTitle}\nNovo status: ${o.status}\n${o.message ? `\n${o.message}\n` : ""}`;

// ════════════════════════════════════════════════════════════════════
// 9. DOCUMENTO PRONTO
// ════════════════════════════════════════════════════════════════════
export function qaDocumentReadyHtml(opts: { name: string; documentName: string; portalUrl?: string }) {
  const url = opts.portalUrl || PORTAL_URL;
  return qaWrap({
    preheader: `Documento pronto: ${opts.documentName}`,
    title: "Seu documento está pronto",
    body: `
      ${greeting(opts.name)}
      ${para(`O documento <strong>${opts.documentName}</strong> foi finalizado e está disponível no seu portal.`)}
      ${notice("success", "Pronto para download", "Acesse o portal para visualizar, baixar e assinar (quando aplicável) seu documento.")}
      ${btn(url, "Acessar documento")}
    `,
  });
}
export const qaDocumentReadyText = (o: { name: string; documentName: string }) =>
  `Quero Armas — Documento pronto\n\nOlá, ${o.name}!\n\nO documento "${o.documentName}" está disponível no seu portal.`;

// ════════════════════════════════════════════════════════════════════
// 10. NOTIFICAÇÃO GENÉRICA (mensagem livre, mantendo identidade visual)
// ════════════════════════════════════════════════════════════════════
export function qaGenericHtml(opts: { name?: string; subject: string; message: string; ctaUrl?: string; ctaLabel?: string }) {
  return qaWrap({
    preheader: opts.subject,
    title: opts.subject,
    body: `
      ${greeting(opts.name)}
      <div style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;">${opts.message}</div>
      ${opts.ctaUrl && opts.ctaLabel ? btn(opts.ctaUrl, opts.ctaLabel) : ""}
    `,
  });
}
export const qaGenericText = (o: { name?: string; subject: string; message: string; ctaUrl?: string; ctaLabel?: string }) =>
  `Quero Armas — ${o.subject}\n\nOlá${o.name ? `, ${o.name}` : ""}!\n\n${o.message.replace(/<[^>]+>/g, "")}\n${o.ctaUrl ? `\n${o.ctaLabel || "Acessar"}: ${o.ctaUrl}\n` : ""}`;

// ════════════════════════════════════════════════════════════════════
// 11. BEM-VINDO AO ARSENAL (conta gratuita pública — pós-cadastro)
//    Identidade: Arsenal UI (papel + âmbar + header escuro #1E1E1E)
// ════════════════════════════════════════════════════════════════════
const ARSENAL_URL = "https://www.euqueroarmas.com.br/area-do-cliente/arsenal";
const AMBER = "#d97706";
const AMBER_DARK = "#92400e";
const PAPER = "#f6f5f1";
const ARSENAL_INK = "#1E1E1E";

export function qaArsenalWelcomeHtml(opts: {
  name: string;
  email: string;
  servicoInteresse?: string | null;
  arsenalUrl?: string;
}) {
  const url = opts.arsenalUrl || ARSENAL_URL;
  const firstName = (opts.name || "").trim().split(/\s+/)[0] || "Cliente";
  const servico = (opts.servicoInteresse || "").trim();

  const proximosPassos = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
      ${[
        ["1", "Acesse o Arsenal", "Use seu e-mail e a senha que você acabou de criar para entrar."],
        ["2", "Cadastre suas armas", "Registre seus armamentos, CRAFs e documentos no seu acervo digital seguro."],
        ["3", "Acompanhe vencimentos", "O Arsenal monitora prazos de CRAF, porte e psicotécnico — você é avisado antes de vencer."],
        ["4", servico ? "Avance com seu serviço" : "Solicite serviços quando quiser", servico
          ? `Quando estiver pronto, contrate <strong>${servico}</strong> direto pelo Arsenal — nossa equipe assume o processo.`
          : "Concessão, transferência, porte, CR — contrate qualquer serviço pelo próprio Arsenal."],
      ].map(([n, titulo, desc]) => `
        <tr>
          <td width="40" valign="top" style="padding:0 14px 18px 0;">
            <div style="width:32px;height:32px;border-radius:8px;background:${AMBER};color:#ffffff;font-weight:800;font-size:14px;text-align:center;line-height:32px;font-family:'SF Mono',Menlo,Consolas,monospace;">${n}</div>
          </td>
          <td valign="top" style="padding:0 0 18px 0;">
            <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${ARSENAL_INK};line-height:1.3;">${titulo}</p>
            <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">${desc}</p>
          </td>
        </tr>
      `).join("")}
    </table>`;

  return qaWrap({
    preheader: `Sua conta gratuita no Arsenal está ativa, ${firstName}.`,
    title: "Bem-vindo ao Arsenal",
    body: `
      <!-- Faixa Arsenal (papel + âmbar + mono) -->
      <div style="background:${PAPER};border:1px solid ${BORDER};border-left:3px solid ${AMBER};border-radius:12px;padding:18px 22px;margin:0 0 24px;">
        <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${AMBER_DARK};font-weight:700;">ARSENAL · CONTA GRATUITA</div>
        <p style="margin:6px 0 0;font-size:15px;color:${ARSENAL_INK};line-height:1.5;">Acesso liberado para <strong>${opts.email}</strong></p>
      </div>

      ${greeting(firstName)}
      ${para("Seu cadastro foi concluído. O <strong>Arsenal</strong> é o seu acervo digital — armas, documentos, vencimentos e processos, tudo em um único lugar, gratuito para sempre.")}

      ${btn(url, "Entrar no Arsenal")}

      ${hr}

      <p style="margin:0 0 16px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${MUTED};">Próximos passos</p>
      ${proximosPassos}

      ${servico ? notice("info", "Seu serviço de interesse", `Você indicou interesse em <strong>${servico}</strong>. Nossa equipe entrará em contato em até 1 dia útil para orientar o próximo passo. Você também pode iniciar a contratação direto pelo Arsenal a qualquer momento.`) : ""}

      ${notice("warn", "Guarde seu acesso", `Use sempre o e-mail <strong>${opts.email}</strong> e a senha que você definiu. Em caso de esquecimento, use a opção “Esqueci minha senha” na tela de login.`)}
    `,
  });
}

export const qaArsenalWelcomeText = (o: { name: string; email: string; servicoInteresse?: string | null; arsenalUrl?: string }) => {
  const firstName = (o.name || "").trim().split(/\s+/)[0] || "Cliente";
  return `Quero Armas — Bem-vindo ao Arsenal\n\nOlá, ${firstName}!\n\nSua conta gratuita no Arsenal foi criada com sucesso.\nE-mail de acesso: ${o.email}\n\nAcesse: ${o.arsenalUrl || ARSENAL_URL}\n\nPróximos passos:\n1. Acesse o Arsenal com seu e-mail e senha\n2. Cadastre suas armas, CRAFs e documentos\n3. Acompanhe vencimentos automaticamente\n4. ${o.servicoInteresse ? `Avance com ${o.servicoInteresse} quando estiver pronto` : "Solicite serviços quando precisar"}\n\nEm caso de esquecimento, use \"Esqueci minha senha\" na tela de login.`;
};
