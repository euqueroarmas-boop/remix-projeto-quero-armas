import { supabase } from "@/integrations/supabase/client";

interface ContractVariables {
  cliente_razao_social: string;
  cliente_cnpj: string;
  cliente_endereco_completo: string;
  representante_nome_completo: string;
  representante_cpf: string;
  representante_email: string;
  representante_telefone: string;
  prazo_meses: string;
  data_contratacao: string;
  ip_contratante: string;
  geo_contratante: string;
  aceite_checkbox: string;
  testemunha1_nome: string;
  testemunha1_cpf: string;
  testemunha2_nome: string;
  testemunha2_cpf: string;
}

/**
 * Fetches the active contract template from the database by ID.
 */
export async function fetchContractTemplate(templateId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("contract_templates" as any)
    .select("template_text")
    .eq("id", templateId)
    .eq("ativo", true)
    .single();

  if (error || !data) {
    console.error("[contractTemplate] Erro ao buscar template:", error);
    return null;
  }
  return (data as any).template_text;
}

/**
 * Replaces all {{placeholder}} variables in the template text with actual values.
 */
export function hydrateTemplate(template: string, variables: Partial<ContractVariables>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, value || "");
  }
  return result;
}

/**
 * Converts plain-text contract (with line breaks) to styled HTML for rendering/signing.
 */
export function templateToHtml(text: string): string {
  const lines = text.split("\n");
  const htmlLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      htmlLines.push("<br/>");
      continue;
    }

    // Section dividers
    if (trimmed === "⸻" || trimmed === "---") {
      htmlLines.push('<hr style="border: none; border-top: 1px solid #ccc; margin: 24px 0;"/>');
      continue;
    }

    // Main title (first line or all-caps long line)
    if (trimmed.startsWith("CONTRATO DE PRESTAÇÃO") || trimmed.startsWith("CONTRATO DE LOCAÇÃO")) {
      htmlLines.push(`<h1 style="font-size: 14pt; font-weight: bold; text-align: center; margin: 16px 0; text-transform: uppercase;">${trimmed}</h1>`);
      continue;
    }

    // Clause headers (CLÁUSULA X –)
    if (/^CLÁUSULA\s+\d/.test(trimmed)) {
      htmlLines.push(`<h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">${trimmed}</h2>`);
      continue;
    }

    // Sub-section headers (all caps lines like ASSINATURA DA CONTRATANTE)
    if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s()–—,]{10,}$/.test(trimmed) && !trimmed.includes(":")) {
      htmlLines.push(`<h2 style="font-size: 12pt; font-weight: bold; margin-top: 24px;">${trimmed}</h2>`);
      continue;
    }

    // Numbered sub-items (e.g., 1.1., 4.5.1.)
    if (/^\d+\.\d+/.test(trimmed)) {
      htmlLines.push(`<p style="margin: 8px 0; text-indent: 24px;">${trimmed}</p>`);
      continue;
    }

    // Roman numeral items
    if (/^(I|II|III|IV|V|VI)\s*[–—]/.test(trimmed)) {
      htmlLines.push(`<p style="margin: 4px 0; padding-left: 48px;">${trimmed}</p>`);
      continue;
    }

    // Lettered items (a), b), etc.)
    if (/^[a-g]\)/.test(trimmed)) {
      htmlLines.push(`<p style="margin: 4px 0; padding-left: 48px;">${trimmed}</p>`);
      continue;
    }

    // Label: value lines (Nome do representante: xxx)
    if (/^[A-ZÁ-Ú][a-záéíóúâêôãõç\s]+:/.test(trimmed)) {
      htmlLines.push(`<p style="margin: 4px 0;"><strong>${trimmed.split(":")[0]}:</strong>${trimmed.substring(trimmed.indexOf(":") + 1)}</p>`);
      continue;
    }

    // Default paragraph
    htmlLines.push(`<p style="margin: 8px 0;">${trimmed}</p>`);
  }

  return `<div style="font-family: 'Times New Roman', Times, serif; max-width: 800px; margin: 0 auto; color: #000; line-height: 1.8; font-size: 12pt; text-align: justify;">${htmlLines.join("\n")}</div>`;
}

/**
 * Full pipeline: fetch template → hydrate → convert to HTML.
 */
export async function generateContractFromTemplate(
  templateId: string,
  variables: Partial<ContractVariables>
): Promise<string | null> {
  const template = await fetchContractTemplate(templateId);
  if (!template) return null;
  const hydrated = hydrateTemplate(template, variables);
  return templateToHtml(hydrated);
}
