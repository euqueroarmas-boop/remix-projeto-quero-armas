import { supabase } from "@/integrations/supabase/client";

/**
 * Download canônico da procuração: o PDF é gerado UMA vez no servidor
 * (qa-serve-procuracao-pdf), com carimbo de sessão do lado do servidor e
 * golden record. Downloads seguintes devolvem exatamente os mesmos bytes.
 */
function filenameFromContentDisposition(header: string | null, fallback: string) {
  if (!header) return fallback;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8) return decodeURIComponent(utf8.replace(/\+/g, "%20"));
  const quoted = header.match(/filename="([^"]+)"/i)?.[1];
  if (quoted) return quoted;
  const plain = header.match(/filename=([^;]+)/i)?.[1]?.trim();
  return plain || fallback;
}

export async function baixarProcuracaoCanonica(procuracaoId: string, fallbackFilename: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-serve-procuracao-pdf`,
    { method: "POST", headers, body: JSON.stringify({ procuracao_id: procuracaoId }) },
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.message || err?.error || `HTTP ${resp.status}`);
  }

  const blob = await resp.blob();
  if (!blob || blob.size === 0) throw new Error("Procuração retornou vazia.");

  const filename = filenameFromContentDisposition(
    resp.headers.get("content-disposition"),
    fallbackFilename,
  );
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}
