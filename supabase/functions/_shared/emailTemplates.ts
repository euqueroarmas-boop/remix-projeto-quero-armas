/**
 * Shared WMTi branded email templates.
 * All templates follow the corporate identity:
 *   Sender: WMTi <naoresponda@wmti.com.br>
 *   Colors: #FF5A1F (primary), #ffffff (bg)
 */

function wrapTemplate(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
<tr><td style="background:#FF5A1F;padding:30px 40px;text-align:center;">
<h1 style="color:#ffffff;font-size:22px;margin:0;">${title}</h1>
</td></tr>
<tr><td style="padding:40px;">
${bodyContent}
</td></tr>
<tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
<p style="font-size:11px;color:#999;margin:0;">WMTi Tecnologia da Informação LTDA — CNPJ 13.366.668/0001-07</p>
<p style="font-size:11px;color:#999;margin:4px 0 0;">Rua José Benedito Duarte, 140 — Parque Itamarati — Jacareí/SP</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── 1. Pagamento Pendente (Boleto gerado) ──
export function buildPaymentPendingHtml(opts: {
  customerName: string;
  value: string;
  dueDate: string;
  billingType: string;
  invoiceUrl?: string;
}) {
  const actionBtn = opts.invoiceUrl
    ? `<div style="text-align:center;margin:0 0 24px;">
        <a href="${opts.invoiceUrl}" style="display:inline-block;background:#FF5A1F;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-size:14px;font-weight:bold;">
          Visualizar Boleto / Fatura
        </a>
       </div>`
    : "";

  return wrapTemplate("WMTi Tecnologia da Informação", `
<p style="font-size:16px;color:#1a1a1a;margin:0 0 8px;">Olá, ${opts.customerName}!</p>
<p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 16px;">
  Uma nova cobrança foi gerada para o seu contrato de serviços WMTi.
</p>
<table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin:0 0 24px;">
  <tr><td style="font-size:13px;color:#888;border-bottom:1px solid #f3f4f6;">Valor</td>
      <td style="font-size:14px;color:#1a1a1a;font-weight:bold;border-bottom:1px solid #f3f4f6;text-align:right;">${opts.value}</td></tr>
  <tr><td style="font-size:13px;color:#888;border-bottom:1px solid #f3f4f6;">Vencimento</td>
      <td style="font-size:14px;color:#1a1a1a;border-bottom:1px solid #f3f4f6;text-align:right;">${opts.dueDate}</td></tr>
  <tr><td style="font-size:13px;color:#888;">Forma</td>
      <td style="font-size:14px;color:#1a1a1a;text-align:right;">${opts.billingType}</td></tr>
</table>
${actionBtn}
<p style="font-size:13px;color:#666;line-height:1.6;margin:0;">
  Se já efetuou o pagamento, desconsidere este aviso. Em caso de dúvidas, entre em contato com nossa equipe.
</p>`);
}

export function buildPaymentPendingText(opts: { customerName: string; value: string; dueDate: string; billingType: string; invoiceUrl?: string }) {
  return `WMTi Tecnologia da Informação\n\nOlá, ${opts.customerName}!\n\nUma nova cobrança foi gerada:\nValor: ${opts.value}\nVencimento: ${opts.dueDate}\nForma: ${opts.billingType}\n${opts.invoiceUrl ? `Link: ${opts.invoiceUrl}\n` : ""}\nSe já efetuou o pagamento, desconsidere este aviso.`;
}

// ── 2. Pagamento Vencido ──
export function buildPaymentOverdueHtml(opts: {
  customerName: string;
  value: string;
  dueDate: string;
  invoiceUrl?: string;
}) {
  const actionBtn = opts.invoiceUrl
    ? `<div style="text-align:center;margin:0 0 24px;">
        <a href="${opts.invoiceUrl}" style="display:inline-block;background:#DC2626;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-size:14px;font-weight:bold;">
          Regularizar Pagamento
        </a>
       </div>`
    : "";

  return wrapTemplate("WMTi Tecnologia da Informação", `
<p style="font-size:16px;color:#1a1a1a;margin:0 0 8px;">Olá, ${opts.customerName}!</p>
<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
  <p style="font-size:14px;color:#991B1B;font-weight:bold;margin:0 0 8px;">⚠️ Cobrança vencida</p>
  <p style="font-size:13px;color:#991B1B;margin:0;line-height:1.6;">
    Identificamos que a cobrança abaixo encontra-se vencida. Para evitar a suspensão dos serviços, regularize o pagamento o mais breve possível.
  </p>
</div>
<table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin:0 0 24px;">
  <tr><td style="font-size:13px;color:#888;border-bottom:1px solid #f3f4f6;">Valor</td>
      <td style="font-size:14px;color:#1a1a1a;font-weight:bold;border-bottom:1px solid #f3f4f6;text-align:right;">${opts.value}</td></tr>
  <tr><td style="font-size:13px;color:#888;">Vencimento</td>
      <td style="font-size:14px;color:#DC2626;font-weight:bold;text-align:right;">${opts.dueDate}</td></tr>
</table>
${actionBtn}
<p style="font-size:13px;color:#666;line-height:1.6;margin:0;">
  Se já efetuou o pagamento, desconsidere este aviso. Em caso de dúvidas, entre em contato com nossa equipe.
</p>`);
}

export function buildPaymentOverdueText(opts: { customerName: string; value: string; dueDate: string }) {
  return `WMTi Tecnologia da Informação\n\n⚠️ Cobrança vencida\n\nOlá, ${opts.customerName}!\n\nIdentificamos que a cobrança abaixo encontra-se vencida:\nValor: ${opts.value}\nVencimento: ${opts.dueDate}\n\nPara evitar a suspensão dos serviços, regularize o pagamento o mais breve possível.`;
}

// ── 3. Convite/Cadastro de novo usuário ──
export function buildUserInviteHtml(opts: {
  customerName: string;
  email: string;
  tempPassword: string;
  portalUrl: string;
}) {
  return wrapTemplate("WMTi Tecnologia da Informação", `
<p style="font-size:16px;color:#1a1a1a;margin:0 0 8px;">Olá, ${opts.customerName}!</p>
<p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 24px;">
  Seu acesso ao <strong>Portal do Cliente WMTi</strong> foi criado. Utilize as credenciais abaixo para acessar:
</p>
<table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin:0 0 24px;background:#f9fafb;">
  <tr><td style="font-size:13px;color:#888;border-bottom:1px solid #e5e7eb;">E-mail</td>
      <td style="font-size:14px;color:#1a1a1a;font-weight:bold;border-bottom:1px solid #e5e7eb;text-align:right;">${opts.email}</td></tr>
  <tr><td style="font-size:13px;color:#888;">Senha provisória</td>
      <td style="font-size:14px;color:#FF5A1F;font-weight:bold;text-align:right;font-family:monospace;">${opts.tempPassword}</td></tr>
</table>
<div style="text-align:center;margin:0 0 24px;">
  <a href="${opts.portalUrl}" style="display:inline-block;background:#FF5A1F;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-size:14px;font-weight:bold;">
    Acessar o Portal
  </a>
</div>
<div style="background:#FFF7ED;border:1px solid #FDBA74;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
  <p style="font-size:13px;font-weight:bold;color:#9A3412;margin:0 0 8px;">Importante:</p>
  <ul style="font-size:13px;color:#9A3412;margin:0;padding:0 0 0 20px;line-height:1.8;">
    <li>No primeiro acesso, você será solicitado a alterar a senha.</li>
    <li>Não compartilhe essas credenciais com terceiros.</li>
  </ul>
</div>`);
}

export function buildUserInviteText(opts: { customerName: string; email: string; tempPassword: string; portalUrl: string }) {
  return `WMTi Tecnologia da Informação\n\nOlá, ${opts.customerName}!\n\nSeu acesso ao Portal do Cliente WMTi foi criado.\n\nE-mail: ${opts.email}\nSenha provisória: ${opts.tempPassword}\n\nAcesse: ${opts.portalUrl}\n\nNo primeiro acesso, você será solicitado a alterar a senha.`;
}

// ── 4. Confirmação de alteração de senha ──
export function buildPasswordChangedHtml(opts: { email: string }) {
  return wrapTemplate("WMTi Tecnologia da Informação", `
<p style="font-size:16px;color:#1a1a1a;margin:0 0 8px;">Olá!</p>
<p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 24px;">
  Informamos que a senha da sua conta <strong>${opts.email}</strong> no Portal do Cliente WMTi foi alterada com sucesso.
</p>
<div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
  <p style="font-size:14px;color:#166534;margin:0;">✅ Senha atualizada com sucesso</p>
</div>
<div style="background:#FFF7ED;border:1px solid #FDBA74;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
  <p style="font-size:13px;font-weight:bold;color:#9A3412;margin:0 0 8px;">Não reconhece esta alteração?</p>
  <p style="font-size:13px;color:#9A3412;margin:0;line-height:1.6;">
    Se você não realizou esta alteração, entre em contato imediatamente com a equipe WMTi pelo telefone (12) 3955-3978.
  </p>
</div>`);
}

export function buildPasswordChangedText(opts: { email: string }) {
  return `WMTi Tecnologia da Informação\n\nA senha da sua conta ${opts.email} no Portal do Cliente WMTi foi alterada com sucesso.\n\nSe você não realizou esta alteração, entre em contato imediatamente com a equipe WMTi pelo telefone (12) 3955-3978.`;
}
