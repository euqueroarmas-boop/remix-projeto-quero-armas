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
    preheader: "Acesso provisionado · credenciais ativas no Portal Tático.",
    opTag: "OPERAÇÃO · PROVISIONAMENTO DE ACESSO",
    title: "Seu portal está armado.",
    subtitle: "Conta criada, credenciais geradas, perímetro liberado para o primeiro acesso.",
    body: `
      ${greeting(opts.name)}
      ${para("Sua conta no <strong>Portal Quero Armas</strong> acabou de ser provisionada. Use exatamente as credenciais abaixo no <strong>primeiro login</strong> — depois disso, o sistema vai forçar a troca por uma senha pessoal e descartar a provisória.")}
      ${diagBlock([
        { k: "Identificador", v: opts.email, mono: true },
        { k: "Senha provisória", v: opts.tempPassword, mono: true, tone: "warn" },
        { k: "Endpoint", v: "Portal do Cliente · /cliente/login", mono: true },
      ])}
      ${btn(url, "Entrar no Portal Tático")}
      ${hr}
      ${notice("warn", "REGRA DE ENGAJAMENTO", "A senha provisória é descartável e single-use. No primeiro login você será obrigado a definir a sua. Nunca compartilhe estas credenciais — elas dão acesso integral ao seu acervo de armas, documentos e processos.")}
      ${notice("danger", "NÃO ESPERAVA ESTE E-MAIL?", "Significa que alguém criou conta usando seu e-mail. Ignore este aviso — sem o primeiro login, o acesso permanece bloqueado.")}
    `,
  });
}
export const qaWelcomeText = (o: { name: string; email: string; tempPassword: string; portalUrl?: string }) =>
  `QUERO ARMAS — PROVISIONAMENTO DE ACESSO\n\n${o.name},\n\nSua conta no Portal Tático foi provisionada.\n\nIDENTIFICADOR: ${o.email}\nSENHA PROVISÓRIA: ${o.tempPassword}\nENDPOINT: ${o.portalUrl || PORTAL_URL}\n\nA senha acima é single-use. No primeiro login você será obrigado a trocá-la. Não compartilhe.`;

// ════════════════════════════════════════════════════════════════════
// 2. CÓDIGO OTP DE PRIMEIRO ACESSO / ATIVAÇÃO
// ════════════════════════════════════════════════════════════════════
export function qaOtpHtml(opts: { name?: string; code: string; minutes?: number }) {
  const min = opts.minutes ?? 10;
  return qaWrap({
    preheader: `OTP ${opts.code} · validade ${min} min · single-use`,
    opTag: "OPERAÇÃO · AUTENTICAÇÃO DE FATOR ÚNICO",
    title: "Código de verificação emitido.",
    subtitle: `Token de uso único. Janela operacional: ${min} minutos.`,
    body: `
      ${greeting(opts.name)}
      ${para("Para concluir a autenticação, digite o código abaixo no Portal. Cada caractere é parte de um <strong>token criptográfico de fator único</strong> — não compartilhe nem encaminhe.")}
      <div style="text-align:center;margin:0 0 22px;">
        <div style="display:inline-block;background:${INK};border-radius:14px;padding:24px 36px;">
          <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${AMBER};font-weight:700;margin:0 0 10px;">TOKEN OTP</div>
          <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:42px;font-weight:800;letter-spacing:14px;color:#ffffff;">${opts.code}</div>
          <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:9px;letter-spacing:2px;color:#94a3b8;margin-top:10px;">EXPIRA EM ${min} MIN · SINGLE-USE</div>
        </div>
      </div>
      ${notice("warn", "REGRA DE OURO", `Nossa equipe <strong>NUNCA</strong> vai te pedir este código — nem por telefone, nem por WhatsApp, nem por outro canal. Se alguém pedir, é fraude. Encerre o contato.`)}
      ${notice("info", "VALIDADE", `Token vence em <strong>${min} minutos</strong> a partir da emissão. Se não foi você, ignore — sem confirmação no portal o acesso não acontece.`)}
    `,
  });
}
export const qaOtpText = (o: { name?: string; code: string; minutes?: number }) =>
  `QUERO ARMAS — TOKEN OTP\n\n${o.name ? `${o.name},\n\n` : ""}TOKEN: ${o.code}\nVALIDADE: ${o.minutes ?? 10} MIN · SINGLE-USE\n\nA equipe NUNCA pede este código. Se alguém pediu, é fraude.`;

// ════════════════════════════════════════════════════════════════════
// 3. RECUPERAÇÃO DE SENHA
// ════════════════════════════════════════════════════════════════════
export function qaPasswordResetHtml(opts: { name?: string; resetUrl: string; minutes?: number }) {
  const min = opts.minutes ?? 30;
  return qaWrap({
    preheader: `Reset de senha solicitado · janela ${min} min.`,
    opTag: "OPERAÇÃO · REINICIALIZAÇÃO DE CREDENCIAL",
    title: "Redefinição de senha solicitada.",
    subtitle: `Link assinado e cifrado. Válido por ${min} minutos a partir da emissão.`,
    body: `
      ${greeting(opts.name)}
      ${para("Alguém — provavelmente você — disparou uma solicitação de <strong>reset de senha</strong> para a sua conta. Use o botão abaixo para escolher uma nova senha. O link é <strong>assinado, único e descartável</strong>: depois de usado ou expirado, deixa de funcionar.")}
      ${diagBlock([
        { k: "Tipo", v: "RESET DE SENHA", mono: true },
        { k: "Validade", v: `${min} MINUTOS`, mono: true, tone: "warn" },
        { k: "Uso", v: "SINGLE-USE", mono: true },
      ])}
      ${btn(opts.resetUrl, "Definir nova senha", "primary")}
      ${hr}
      ${notice("danger", "NÃO FOI VOCÊ?", "Ignore este e-mail e não clique no botão. Sua senha atual continua válida e ninguém consegue acessar sua conta sem confirmar este link. Se isso se repetir, fale com a gente — pode ser tentativa de invasão.")}
    `,
  });
}
export const qaPasswordResetText = (o: { name?: string; resetUrl: string; minutes?: number }) =>
  `QUERO ARMAS — RESET DE SENHA\n\nLink (single-use, ${o.minutes ?? 30} min):\n${o.resetUrl}\n\nSe não foi você, ignore. Sua senha atual permanece válida.`;

// ════════════════════════════════════════════════════════════════════
// 4. CONFIRMAÇÃO DE SENHA ALTERADA
// ════════════════════════════════════════════════════════════════════
export function qaPasswordChangedHtml(opts: { email: string; name?: string }) {
  return qaWrap({
    preheader: "Senha rotacionada · credencial anterior invalidada.",
    opTag: "EVENTO · ROTAÇÃO DE CREDENCIAL",
    title: "Senha alterada com sucesso.",
    subtitle: "A credencial anterior foi invalidada e revogada de todas as sessões ativas.",
    body: `
      ${greeting(opts.name)}
      ${para(`A senha da conta <strong>${opts.email}</strong> foi rotacionada agora. A credencial antiga foi <strong>imediatamente revogada</strong> — qualquer sessão aberta com a senha anterior precisa relogar.`)}
      ${diagBlock([
        { k: "Conta", v: opts.email, mono: true },
        { k: "Evento", v: "PASSWORD_ROTATED", mono: true, tone: "success" },
        { k: "Timestamp", v: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) + " (BRT)", mono: true },
      ], SUCCESS)}
      ${notice("success", "OPERAÇÃO CONCLUÍDA", "Sua nova senha já está ativa. O portal te trata como uma sessão limpa a partir do próximo login.")}
      ${notice("danger", "NÃO RECONHECE ESTA TROCA?", "Isso é vermelho-alerta: alguém pode ter comprometido seu e-mail. Acesse imediatamente <strong>/recuperar-senha</strong>, force outro reset e fale com a gente. Quanto antes, melhor.")}
    `,
  });
}
export const qaPasswordChangedText = (o: { email: string }) =>
  `QUERO ARMAS — SENHA ROTACIONADA\n\nConta: ${o.email}\nEvento: PASSWORD_ROTATED\n\nSe não foi você, force novo reset AGORA e nos avise.`;

// ════════════════════════════════════════════════════════════════════
// 5. PAGAMENTO PENDENTE (boleto/PIX gerado)
// ════════════════════════════════════════════════════════════════════
export function qaPaymentPendingHtml(opts: { name: string; value: string; dueDate: string; billingType: string; invoiceUrl?: string }) {
  return qaWrap({
    preheader: `Cobrança ${opts.value} · vence ${opts.dueDate} · ${opts.billingType}`,
    opTag: "OPERAÇÃO · COBRANÇA EMITIDA",
    title: "Nova cobrança disponível.",
    subtitle: "Liquidação manda no andamento do seu processo. Pague agora para não travar.",
    body: `
      ${greeting(opts.name)}
      ${para("Emitimos a cobrança abaixo para o seu serviço. Enquanto não houver liquidação, <strong>os documentos e movimentações relacionados ficam em standby</strong> — é regra de operação.")}
      ${diagBlock([
        { k: "Valor", v: opts.value, mono: true, tone: "warn" },
        { k: "Vencimento", v: opts.dueDate, mono: true },
        { k: "Forma", v: opts.billingType.toUpperCase(), mono: true },
        { k: "Status", v: "AGUARDANDO LIQUIDAÇÃO", mono: true, tone: "warn" },
      ])}
      ${opts.invoiceUrl ? btn(opts.invoiceUrl, "Pagar agora") : btn(PORTAL_URL, "Abrir cobrança no Portal")}
      ${hr}
      ${notice("info", "PRAZO E IMPACTO", "PIX cai em segundos. Boleto compensa em até 2 dias úteis. Se você precisa de prazo, gere PIX para destravar a operação imediatamente. Se já pagou, este aviso pode estar em trânsito — o sistema reconcilia sozinho em minutos.")}
    `,
  });
}
export const qaPaymentPendingText = (o: { name: string; value: string; dueDate: string; billingType: string; invoiceUrl?: string }) =>
  `QUERO ARMAS — COBRANÇA EMITIDA\n\n${o.name},\n\nVALOR: ${o.value}\nVENCIMENTO: ${o.dueDate}\nFORMA: ${o.billingType.toUpperCase()}\nSTATUS: AGUARDANDO LIQUIDAÇÃO\n${o.invoiceUrl ? `\nPAGAR: ${o.invoiceUrl}\n` : ""}\nEnquanto não liquidar, sua operação fica em standby.`;

// ════════════════════════════════════════════════════════════════════
// 6. PAGAMENTO VENCIDO
// ════════════════════════════════════════════════════════════════════
export function qaPaymentOverdueHtml(opts: { name: string; value: string; dueDate: string; invoiceUrl?: string }) {
  return qaWrap({
    preheader: `INADIMPLÊNCIA · ${opts.value} venceu em ${opts.dueDate}.`,
    opTag: "ALERTA · INADIMPLÊNCIA DETECTADA",
    title: "Cobrança vencida — operação em risco.",
    subtitle: "Sem regularização, processos em andamento são pausados e o acesso pode ser suspenso.",
    body: `
      ${greeting(opts.name)}
      ${notice("danger", "INADIMPLÊNCIA ATIVA", "Sua cobrança passou do vencimento. A partir de agora, qualquer movimentação operacional vinculada a este serviço (envio de documentos, geração de peças, sincronização com Polícia Federal) <strong>fica bloqueada</strong> até a liquidação.")}
      ${diagBlock([
        { k: "Valor em aberto", v: opts.value, mono: true, tone: "danger" },
        { k: "Venceu em", v: opts.dueDate, mono: true, tone: "danger" },
        { k: "Status", v: "OVERDUE · BLOQUEIO PARCIAL", mono: true, tone: "danger" },
        { k: "Próximo passo", v: "REGULARIZAR IMEDIATAMENTE", mono: true, tone: "warn" },
      ], DANGER)}
      ${opts.invoiceUrl ? btn(opts.invoiceUrl, "Regularizar agora", "danger") : btn(PORTAL_URL, "Abrir no Portal", "danger")}
      ${hr}
      ${notice("warn", "PIX RESOLVE NO ATO", "Quitação por PIX é reconciliada em segundos e libera sua operação automaticamente. Se já pagou nas últimas horas, aguarde a compensação — o sistema atualiza sozinho.")}
    `,
  });
}
export const qaPaymentOverdueText = (o: { name: string; value: string; dueDate: string; invoiceUrl?: string }) =>
  `QUERO ARMAS — INADIMPLÊNCIA\n\n${o.name},\n\nVALOR: ${o.value}\nVENCIDO EM: ${o.dueDate}\nSTATUS: OVERDUE · BLOQUEIO PARCIAL\n${o.invoiceUrl ? `\nREGULARIZAR: ${o.invoiceUrl}\n` : ""}\nSem liquidação, sua operação fica pausada.`;

// ════════════════════════════════════════════════════════════════════
// 7. PAGAMENTO CONFIRMADO
// ════════════════════════════════════════════════════════════════════
export function qaPaymentConfirmedHtml(opts: { name: string; value: string; paidAt: string; invoiceUrl?: string }) {
  return qaWrap({
    preheader: `Liquidação confirmada · ${opts.value} · operação destravada.`,
    opTag: "EVENTO · LIQUIDAÇÃO CONFIRMADA",
    title: "Pagamento confirmado. Operação liberada.",
    subtitle: "Reconciliação concluída. Bloqueios operacionais relacionados foram automaticamente removidos.",
    body: `
      ${greeting(opts.name)}
      ${para("A liquidação caiu e o sistema reconciliou na hora. Tudo que estava em standby aguardando este pagamento <strong>volta a andar agora mesmo</strong> — documentos podem ser enviados, peças geradas, processos continuam.")}
      ${diagBlock([
        { k: "Valor liquidado", v: opts.value, mono: true, tone: "success" },
        { k: "Confirmado em", v: opts.paidAt, mono: true },
        { k: "Status", v: "PAID · OPERAÇÃO LIBERADA", mono: true, tone: "success" },
      ], SUCCESS)}
      ${opts.invoiceUrl ? btn(opts.invoiceUrl, "Ver comprovante", "success") : btn(PORTAL_URL, "Acessar Portal", "success")}
      ${hr}
      ${notice("success", "PRÓXIMO MOVIMENTO", "Acompanhe o avanço do seu processo direto pelo Portal. Notificaremos cada mudança de status — você não precisa ficar checando manualmente.")}
    `,
  });
}
export const qaPaymentConfirmedText = (o: { name: string; value: string; paidAt: string }) =>
  `QUERO ARMAS — LIQUIDAÇÃO CONFIRMADA\n\n${o.name},\n\nVALOR: ${o.value}\nCONFIRMADO EM: ${o.paidAt}\nSTATUS: PAID · OPERAÇÃO LIBERADA\n\nProcessos em standby foram destravados automaticamente.`;

// ════════════════════════════════════════════════════════════════════
// 8. ATUALIZAÇÃO DE CASO/PROCESSO
// ════════════════════════════════════════════════════════════════════
export function qaCaseUpdateHtml(opts: { name: string; caseTitle: string; status: string; message?: string; portalUrl?: string }) {
  const url = opts.portalUrl || PORTAL_URL;
  return qaWrap({
    preheader: `Status atualizado · ${opts.caseTitle} → ${opts.status.toUpperCase()}`,
    opTag: "EVENTO · ATUALIZAÇÃO DE PROCESSO",
    title: "Há movimento no seu processo.",
    subtitle: `Status mudou. Detalhes técnicos abaixo — log completo no Portal.`,
    body: `
      ${greeting(opts.name)}
      ${para("Sua operação avançou. O time atualizou o status do processo abaixo. <strong>Cada transição é registrada com timestamp e responsável</strong> — você consegue auditar a linha do tempo inteira no Portal.")}
      ${diagBlock([
        { k: "Processo", v: opts.caseTitle.toUpperCase() },
        { k: "Novo status", v: opts.status.toUpperCase(), mono: true, tone: "warn" },
        { k: "Atualizado em", v: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) + " (BRT)", mono: true },
      ])}
      ${opts.message ? `
        <div style="background:${SOFT_BG};border-left:3px solid ${INK};border-radius:8px;padding:18px 22px;margin:0 0 24px;">
          <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${MUTED};font-weight:700;margin:0 0 8px;">NOTA DO OPERADOR</div>
          <div style="font-size:14px;color:${INK};line-height:1.7;">${opts.message}</div>
        </div>
      ` : ""}
      ${btn(url, "Abrir processo no Portal")}
      ${hr}
      ${notice("info", "VOCÊ SERÁ NOTIFICADO", "A cada novo status, validação ou pendência, este e-mail dispara automaticamente. Não precisa ficar atualizando o portal — o sistema te chama quando algo muda.")}
    `,
  });
}
export const qaCaseUpdateText = (o: { name: string; caseTitle: string; status: string; message?: string }) =>
  `QUERO ARMAS — ATUALIZAÇÃO DE PROCESSO\n\n${o.name},\n\nPROCESSO: ${o.caseTitle.toUpperCase()}\nNOVO STATUS: ${o.status.toUpperCase()}\n${o.message ? `\nNOTA: ${o.message}\n` : ""}\nAuditoria completa no Portal.`;

// ════════════════════════════════════════════════════════════════════
// 9. DOCUMENTO PRONTO
// ════════════════════════════════════════════════════════════════════
export function qaDocumentReadyHtml(opts: { name: string; documentName: string; portalUrl?: string }) {
  const url = opts.portalUrl || PORTAL_URL;
  return qaWrap({
    preheader: `Documento pronto: ${opts.documentName}`,
    opTag: "ENTREGA · DOCUMENTO ASSINADO E DISPONÍVEL",
    title: "Seu documento está pronto.",
    subtitle: "Gerado, validado e — quando aplicável — assinado digitalmente com certificado A1 (PAdES, ICP-Brasil).",
    body: `
      ${greeting(opts.name)}
      ${para(`O artefato <strong>${opts.documentName}</strong> passou por todas as etapas de geração, conferência e assinatura. Está disponível para download <strong>imediato</strong> no seu Portal.`)}
      ${diagBlock([
        { k: "Documento", v: opts.documentName.toUpperCase() },
        { k: "Formato", v: "PDF · ICP-BRASIL · PAdES", mono: true },
        { k: "Status", v: "READY · DOWNLOAD LIBERADO", mono: true, tone: "success" },
      ], SUCCESS)}
      ${btn(url, "Baixar documento", "success")}
      ${hr}
      ${notice("info", "VALIDADE JURÍDICA", "Documentos assinados digitalmente com certificado ICP-Brasil têm o mesmo valor legal de assinatura física, conforme MP 2.200-2/2001. Guarde o PDF — ele é a sua via oficial.")}
    `,
  });
}
export const qaDocumentReadyText = (o: { name: string; documentName: string }) =>
  `QUERO ARMAS — DOCUMENTO PRONTO\n\n${o.name},\n\nDOCUMENTO: ${o.documentName.toUpperCase()}\nFORMATO: PDF · ICP-BRASIL · PAdES\nSTATUS: READY\n\nBaixe direto pelo Portal.`;

// ════════════════════════════════════════════════════════════════════
// 10. NOTIFICAÇÃO GENÉRICA (mensagem livre, mantendo identidade visual)
// ════════════════════════════════════════════════════════════════════
export function qaGenericHtml(opts: { name?: string; subject: string; message: string; ctaUrl?: string; ctaLabel?: string }) {
  return qaWrap({
    preheader: opts.subject,
    opTag: "COMUNICADO · QUERO ARMAS",
    title: opts.subject,
    subtitle: "Mensagem oficial da equipe operacional.",
    body: `
      ${greeting(opts.name)}
      <div style="font-size:14px;color:${STEEL};line-height:1.75;margin:0 0 24px;">${opts.message}</div>
      ${opts.ctaUrl && opts.ctaLabel ? btn(opts.ctaUrl, opts.ctaLabel) : ""}
    `,
  });
}
export const qaGenericText = (o: { name?: string; subject: string; message: string; ctaUrl?: string; ctaLabel?: string }) =>
  `QUERO ARMAS — ${o.subject.toUpperCase()}\n\n${o.name ? `${o.name},\n\n` : ""}${o.message.replace(/<[^>]+>/g, "")}\n${o.ctaUrl ? `\n${o.ctaLabel || "ACESSAR"}: ${o.ctaUrl}\n` : ""}`;

// ════════════════════════════════════════════════════════════════════
// 11. BEM-VINDO AO ARSENAL (conta gratuita pública — pós-cadastro)
//    Identidade: Arsenal UI (papel + âmbar + header escuro)
// ════════════════════════════════════════════════════════════════════
const ARSENAL_URL = "https://www.euqueroarmas.com.br/area-do-cliente/arsenal";

export function qaArsenalWelcomeHtml(opts: {
  name: string;
  email: string;
  servicoInteresse?: string | null;
  arsenalUrl?: string;
}) {
  const url = opts.arsenalUrl || ARSENAL_URL;
  const firstName = (opts.name || "").trim().split(/\s+/)[0] || "Cliente";
  const servico = (opts.servicoInteresse || "").trim();

  return qaWrap({
    preheader: `Arsenal Digital ativo · acervo armado para ${firstName}.`,
    opTag: "ARSENAL · CONTA GRATUITA ATIVADA",
    title: "Seu Arsenal Digital está armado.",
    subtitle: "Acervo gratuito vitalício. Armas, CRAFs, vencimentos e processos em um único cofre digital.",
    body: `
      ${greeting(firstName)}
      ${para("O <strong>Arsenal</strong> é o cofre digital da sua coleção: cadastra armas, sobe CRAFs, monitora vencimentos de porte e psicotécnico, e dispara alerta antes de qualquer documento expirar. Operação 100% sua, criptografada, sem pegadinha.")}
      ${diagBlock([
        { k: "Identificador", v: opts.email, mono: true },
        { k: "Plano", v: "GRATUITO · VITALÍCIO", mono: true, tone: "success" },
        { k: "Capacidade", v: "ARMAS, CRAFs, GTEs, DOCUMENTOS", mono: true },
        { k: "Endpoint", v: "/area-do-cliente/arsenal", mono: true },
      ], AMBER)}
      ${btn(url, "Entrar no Arsenal")}
      ${hr}
      <p style="margin:0 0 16px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${AMBER_DARK};">PROTOCOLO DE INSTALAÇÃO</p>
      ${steps([
        { titulo: "Faça o primeiro login", desc: `Use ${opts.email} e a senha que você acabou de definir. O sistema reconhece o dispositivo e libera a sessão.` },
        { titulo: "Arme seu acervo", desc: "Cadastre cada arma com marca, modelo, número, calibre e CRAF. O Arsenal reconhece automaticamente da nossa base de catálogo." },
        { titulo: "Suba seus documentos", desc: "CRAF, GTE, porte, psicotécnico, exames. O Arsenal indexa, valida visualmente e alerta antes do vencimento." },
        { titulo: servico ? `Avance com ${servico}` : "Contrate serviços quando quiser", desc: servico ? `Você indicou interesse em <strong>${servico}</strong>. Nosso time entra em contato em até 1 dia útil. Pode também iniciar pelo Arsenal a qualquer momento.` : "Concessão, transferência, porte, CR — qualquer movimento da sua vida CAC, contratável direto pelo Arsenal." },
      ])}
      ${servico ? notice("info", "SERVIÇO DE INTERESSE REGISTRADO", `Marcamos <strong>${servico}</strong> no seu perfil. Em até 1 dia útil você recebe contato para o próximo passo. Sem pressão — anda no seu tempo.`) : ""}
      ${notice("warn", "GUARDE SUAS CREDENCIAIS", `Acesso fixo: <strong>${opts.email}</strong> + senha pessoal. Esqueceu? Use “Esqueci minha senha” no login. Não criamos contas paralelas — o Arsenal é único por e-mail.`)}
      ${notice("danger", "REGRA DE SEGURANÇA", "Não compartilhe a senha. O Arsenal contém dados sensíveis (números de série, fotos de armamento, documentos pessoais). Trate como acesso ao seu cofre.")}
    `,
  });
}

export const qaArsenalWelcomeText = (o: { name: string; email: string; servicoInteresse?: string | null; arsenalUrl?: string }) => {
  const firstName = (o.name || "").trim().split(/\s+/)[0] || "Cliente";
  return `QUERO ARMAS — ARSENAL DIGITAL ATIVADO\n\n${firstName},\n\nIDENTIFICADOR: ${o.email}\nPLANO: GRATUITO · VITALÍCIO\nENDPOINT: ${o.arsenalUrl || ARSENAL_URL}\n\nPROTOCOLO:\n01 — Faça o primeiro login\n02 — Cadastre armas, CRAFs, GTEs, documentos\n03 — Receba alertas de vencimento automaticamente\n04 — ${o.servicoInteresse ? `Avance com ${o.servicoInteresse}` : "Contrate serviços quando precisar"}\n\nNão compartilhe a senha. Acervo digital criptografado.`;
};
