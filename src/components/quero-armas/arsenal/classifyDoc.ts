/**
 * classifyDoc — chama a edge `qa-classificar-documento-arma` e devolve
 * a classificação normalizada para o DocClassReviewModal.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ClassificacaoIA, DocTipoArsenal } from "./DocClassReviewModal";

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Falha ao ler arquivo"));
    r.readAsDataURL(file);
  });

export async function classifyArsenalDoc(params: {
  file: File;
  tipoSelecionado: DocTipoArsenal;
}): Promise<ClassificacaoIA | null> {
  try {
    const imageDataUrl = await fileToDataUrl(params.file);
    const { data, error } = await supabase.functions.invoke("qa-classificar-documento-arma", {
      body: { imageDataUrl, tipoSelecionado: params.tipoSelecionado },
    });
    if (error) {
      console.warn("[classifyArsenalDoc] edge error:", error);
      return null;
    }
    if (!data?.tipoDetectado) return null;
    return data as ClassificacaoIA;
  } catch (e) {
    console.warn("[classifyArsenalDoc] failed:", e);
    return null;
  }
}
