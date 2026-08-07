/**
 * BLOCO 4 — Fonte única de validade.
 *
 * Carrega `public.qa_validade_documentos` uma vez por sessão e registra as
 * regras no motor `validadeDocumento.ts`. A partir daí, banco, Hub Documental,
 * checklist e portal do cliente usam exatamente o mesmo prazo por tipo.
 */
import { supabase } from "@/integrations/supabase/client";
import { setCatalogoValidade, catalogoValidadeCarregado, type RegraValidade } from "./validadeDocumento";

let promessa: Promise<void> | null = null;

export function carregarCatalogoValidade(): Promise<void> {
  if (promessa) return promessa;
  promessa = (async () => {
    try {
      const { data, error } = await supabase
        .from("qa_validade_documentos")
        .select("tipo_documento, validade_dias, unidade, perpetuo, alerta_dias")
        .eq("ativo", true);
      if (error) throw error;
      setCatalogoValidade((data ?? []) as unknown as RegraValidade[]);
    } catch (e) {
      // Silencioso de propósito: sem catálogo, o motor cai nas regras locais.
      console.warn("[validade] catálogo indisponível, usando regras locais", e);
      promessa = null;
    }
  })();
  return promessa;
}

export { catalogoValidadeCarregado };
