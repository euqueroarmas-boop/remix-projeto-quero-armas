import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Downloads a DOCX for a given geracao_id.
 * 1. If docx_path exists in storage, downloads from there.
 * 2. Otherwise, calls qa-export-docx to generate on-the-fly.
 */
export async function downloadGeracaoDocx(
  geracaoId: string,
  opts?: { titulo?: string; tipoPeca?: string; nomeRequerente?: string }
): Promise<boolean> {
  try {
    // Try to fetch generation record to check if docx_path exists
    const { data: geracao } = await supabase
      .from("qa_geracoes_pecas" as any)
      .select("docx_path, titulo_geracao, tipo_peca")
      .eq("id", geracaoId)
      .maybeSingle();

    const titulo = opts?.titulo || (geracao as any)?.titulo_geracao || "peca";
    const tipo = opts?.tipoPeca || (geracao as any)?.tipo_peca || "peca";
    const safeTitle = titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").toLowerCase();
    const fileName = `${tipo.replace(/_/g, "-")}-${safeTitle}.docx`;

    const docxPath = (geracao as any)?.docx_path;

    // Strategy 1: Download from storage if path exists
    if (docxPath) {
      const { data: blob, error } = await supabase.storage
        .from("qa-geracoes")
        .download(docxPath);

      if (!error && blob && blob.size > 100) {
        triggerDownload(blob, fileName);
        return true;
      }
      // If storage download fails, fall through to Edge Function
      console.warn("[qaDocxDownload] Storage download failed, falling back to Edge Function");
    }

    // Strategy 2: Generate via Edge Function
    const { data, error } = await supabase.functions.invoke("qa-export-docx", {
      body: {
        geracao_id: geracaoId,
        variables: {
          cliente_nome: opts?.nomeRequerente || "",
          titulo: titulo,
        },
      },
    });

    if (error) throw new Error(error.message || "Falha ao gerar DOCX");

    const blob = data instanceof Blob
      ? data
      : new Blob([data], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    if (blob.size < 100) throw new Error("Arquivo DOCX gerado está vazio");

    triggerDownload(blob, fileName);
    return true;
  } catch (err: any) {
    console.error("[qaDocxDownload] Error:", err);
    toast.error(err.message || "Erro ao baixar DOCX");
    return false;
  }
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
