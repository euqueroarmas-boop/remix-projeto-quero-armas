/**
 * Resumo enxuto de user-agent para o carimbo de download do contrato.
 * Menos detalhe que o carimbo de assinatura: só dispositivo e navegador.
 */
export function resumirUserAgent(ua: string | null | undefined): { dispositivo: string; navegador: string } {
  const s = String(ua || "");
  if (!s) return { dispositivo: "—", navegador: "—" };

  let dispositivo = "Computador";
  if (/iPad/i.test(s)) dispositivo = "iPad";
  else if (/iPhone/i.test(s)) dispositivo = "iPhone";
  else if (/Android/i.test(s)) dispositivo = /Mobile/i.test(s) ? "Android (celular)" : "Android (tablet)";
  else if (/Macintosh|Mac OS X/i.test(s)) dispositivo = "Mac";
  else if (/Windows/i.test(s)) dispositivo = "Windows";
  else if (/Linux/i.test(s)) dispositivo = "Linux";

  let navegador = "Navegador";
  if (/Edg\//i.test(s)) navegador = "Edge";
  else if (/OPR\/|Opera/i.test(s)) navegador = "Opera";
  else if (/SamsungBrowser/i.test(s)) navegador = "Samsung Internet";
  else if (/Firefox\//i.test(s)) navegador = "Firefox";
  else if (/Chrome\/|CriOS/i.test(s)) navegador = "Chrome";
  else if (/Safari\//i.test(s)) navegador = "Safari";

  return { dispositivo, navegador };
}
