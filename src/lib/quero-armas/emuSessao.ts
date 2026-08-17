/**
 * MODO ESPELHO — estado da janela de emulação, no escopo da ABA.
 *
 * Guardamos em `sessionStorage` de propósito: sessionStorage é por aba, então
 * a aba do admin continua sendo o admin e a aba aberta em espelho é a única que
 * renderiza a Área do Cliente como o cliente. Nada de token de cliente, nada de
 * troca de sessão — o operador segue logado na conta dele nas duas abas.
 */

const KEY = "qa_emu_sessao";

export interface EmuSessao {
  sessaoId: string;
  clienteId: number;
  clienteNome: string;
  operadorNome: string;
  operadorEmail: string;
  /** ISO. Passou disso, o banco para de reconhecer a janela. */
  expiraEm: string;
}

function parse(raw: string | null): EmuSessao | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as EmuSessao;
    if (!v?.sessaoId || !v?.clienteId) return null;
    return v;
  } catch {
    return null;
  }
}

/** Sessão de espelho desta aba, já descartada se expirou. */
export function getEmuSessao(): EmuSessao | null {
  let s: EmuSessao | null = null;
  try {
    s = parse(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
  if (!s) return null;
  if (new Date(s.expiraEm).getTime() <= Date.now()) {
    clearEmuSessao();
    return null;
  }
  return s;
}

export function setEmuSessao(s: EmuSessao): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage indisponível — o espelho simplesmente não abre */
  }
}

export function clearEmuSessao(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

export function isEmuAtivo(): boolean {
  return getEmuSessao() !== null;
}

/** Segundos restantes da janela (0 quando não há espelho ativo). */
export function segundosRestantes(s: EmuSessao | null = getEmuSessao()): number {
  if (!s) return 0;
  return Math.max(0, Math.round((new Date(s.expiraEm).getTime() - Date.now()) / 1000));
}

export function formatarRestante(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const ss = segundos % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/**
 * A aba de espelho é aberta com `?emu=<json base64>` na URL. Lemos uma única
 * vez, gravamos no sessionStorage da aba e limpamos a query — o parâmetro não
 * fica no histórico do navegador nem em link copiado.
 */
export function adotarSessaoDaUrl(): EmuSessao | null {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("emu");
    if (!raw) return null;
    const s = parse(decodeURIComponent(escape(atob(raw))));
    url.searchParams.delete("emu");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    if (!s) return null;
    setEmuSessao(s);
    return s;
  } catch {
    return null;
  }
}

/** Codifica a sessão para viajar na URL da nova aba. */
export function codificarParaUrl(s: EmuSessao): string {
  return encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(s)))));
}

/** Mensagem única para tudo que o espelho não faz. */
export const EMU_BLOQUEIO_COMPRA =
  "Modo espelho: contratação, pagamento e assinatura de contrato só podem ser feitos pelo próprio cliente.";
