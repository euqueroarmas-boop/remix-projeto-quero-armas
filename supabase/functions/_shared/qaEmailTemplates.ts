/**
 * Templates de e-mail premium do Quero Armas.
 * Identidade visual: fundo branco, acento vermelho tático (#dc2626),
 * tipografia limpa, layout responsivo, marca em destaque.
 *
 * Remetente padrão: Quero Armas <naoresponda@euqueroarmas.com.br>
 */

const LOGO_URL = "https://ogkltfqvzweeqkfmrzts.supabase.co/storage/v1/object/public/contract-assets/quero-armas-logo.png";
const PORTAL_URL = "https://www.euqueroarmas.com.br/quero-armas/cliente/login";
const SITE_URL = "https://www.euqueroarmas.com.br";
const SUPPORT_EMAIL = "naoresponda@euqueroarmas.com.br";
const PRIMARY = "#dc2626";
const PRIMARY_DARK = "#991b1b";
const INK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e5e7eb";
const SOFT_BG = "#f8fafc";

export interface QAEmailFrame {
  preheader?: string;
  title: string;
  body: string;
}

export function qaWrap({ preheader = "", title, body }: QAEmailFrame): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#ffffff;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
      <!-- HEADER -->
      <tr><td style="padding:32px 40px 24px;border-bottom:1px solid ${BORDER};text-align:center;background:#ffffff;">
        <img src="${LOGO_URL}" alt="Quero Armas" width="64" height="64" style="display:inline-block;width:64px;height:64px;object-fit:contain;border:0;outline:0;text-decoration:none;">
        <div style="margin-top:12px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${MUTED};font-weight:600;">Plataforma Quero Armas</div>
      </td></tr>
      <!-- CONTENT -->
      <tr><td style="padding:40px;background:#ffffff;">
        ${body}
      </td></tr>
      <!-- FOOTER -->
      <tr><td style="padding:24px 40px 32px;background:${SOFT_BG};border-top:1px solid ${BORDER};text-align:center;">
        <p style="margin:0 0 8px;font-size:12px;color:${MUTED};line-height:1.6;">
          Este é um e-mail automático. Por favor, não responda.<br>
          Para falar com nossa equipe, acesse <a href="${SITE_URL}" style="color:${PRIMARY};text-decoration:none;font-weight:600;">euqueroarmas.com.br</a>
        </p>
        <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;">
          © ${new Date().getFullYear()} Quero Armas — Todos os direitos reservados.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function btn(href: string, label: string, color: "primary" | "danger" | "success" = "primary"): string {
  const bg = color === "danger" ? "#dc2626" : color === "success" ? "#16a34a" : PRIMARY;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr><td align="center" style="border-radius:10px;background:${bg};">
      <a href="${href}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.3px;">${label}</a>
    </td></tr>
  </table>`;
}

function infoCard(rows: Array<[string, string]>, accent = PRIMARY): string {
  const trs = rows.map(([k, v], i) => `
    <tr>
      <td style="padding:12px 16px;font-size:13px;color:${MUTED};${i < rows.length - 1 ? `border-bottom:1px solid ${BORDER};` : ""}">${k}</td>
      <td style="padding:12px 16px;font-size:14px;color:${INK};font-weight:600;text-align:right;${i < rows.length - 1 ? `border-bottom:1px solid ${BORDER};` : ""}">${v}</td>
    </tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SOFT_BG};border:1px solid ${BORDER};border-radius:12px;border-left:3px solid ${accent};margin:0 0 28px;">
    ${trs}
  </table>`;
}

function notice(kind: "info" | "warn" | "success" | "danger", title: string, body: string): string {
  const themes = {
    info: { bg: "#eff6ff", bd: "#bfdbfe", fg: "#1e40af" },
    warn: { bg: "#fffbeb", bd: "#fcd34d", fg: "#92400e" },
    success: { bg: "#f0fdf4", bd: "#86efac", fg: "#166534" },
    danger: { bg: "#fef2f2", bd: "#fecaca", fg: PRIMARY_DARK },
  };
  const t = themes[kind];
  return `<div style="background:${t.bg};border:1px solid ${t.bd};border-radius:10px;padding:16px 20px;margin:0 0 24px;">
    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${t.fg};">${title}</p>
    <p style="margin:0;font-size:13px;color:${t.fg};line-height:1.6;">${body}</p>
  </div>`;
}

const greeting = (name?: string) =>
  `<p style="margin:0 0 8px;font-size:18px;font-weight:600;color:${INK};">Olá${name ? `, ${name}` : ""}!</p>`;

const para = (txt: string) =>
  `<p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.7;">${txt}</p>`;

const hr = `<div style="height:1px;background:${BORDER};margin:32px 0;"></div>`;

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
