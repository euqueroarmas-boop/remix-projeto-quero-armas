import { supabase } from "@/integrations/supabase/client";

/**
 * Download canônico da Declaração do Responsável pelo Imóvel — mesmo motor do
 * contrato e da procuração: o PDF sai do servidor com o carimbo de sessão e é
 * baixado como blob (nada de window.open, que o navegador bloqueia).
 */
function filenameFromContentDisposition(header: string | null, fallback: string) {
  if (!header) return fallback;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8) return decodeURIComponent(utf8.replace(/\+/g, "%20"));
  const quoted = header.match(/filename="([^"]+)"/i)?.[1];
  return quoted || fallback;
}

export async function baixarDeclaracaoResidencia(declaracaoId: string, fallbackFilename = "declaracao-responsavel-imovel.pdf") {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-declaracao-residencia`,
    { method: "POST", headers, body: JSON.stringify({ acao: "baixar", declaracao_id: declaracaoId }) },
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as any)?.error || `HTTP ${resp.status}`);
  }

  const blob = await resp.blob();
  if (!blob || blob.size === 0) throw new Error("Declaração retornou vazia.");

  const filename = filenameFromContentDisposition(resp.headers.get("content-disposition"), fallbackFilename);
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}
