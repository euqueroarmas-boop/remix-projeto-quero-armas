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
  objeto_servico_especifico: string;
  valor_mensal: string;
  valor_mensal_extenso: string;
  dia_vencimento: string;
  data_hora_contratacao: string;
  user_agent: string;
  session_id: string;
  // Rental-specific variables
  WMTI_LOC_TABELA_EQUIPAMENTOS: string;
  WMTI_SERVICOS_DESCRICAO: string;
}

/**
 * Fetches the active contract template from the database by ID.
 */
interface TemplateRecord {
  template_text: string;
  versao: string;
  editavel: boolean;
  id: string;
}

/**
 * Fetches the active contract template from the database by ID.
 * Returns null if template not found, inactive, or editable (immutable templates only).
 */
export async function fetchContractTemplate(templateId: string): Promise<TemplateRecord | null> {
  const { data, error } = await supabase
    .from("contract_templates" as any)
    .select("id, template_text, versao, editavel")
    .eq("id", templateId)
    .eq("ativo", true)
    .single();

  if (error || !data) {
    console.error("[contractTemplate] Erro ao buscar template:", error);
    return null;
  }

  const record = data as any as TemplateRecord;

  // Protection: immutable templates cannot be edited
  if (record.editavel) {
    console.warn("[contractTemplate] Template editável não pode ser usado como oficial:", templateId);
    return null;
  }

  return record;
}

/**
 * Replaces all {{placeholder}} variables in the template text with actual values.
 * Uses "Não capturado" as fallback for empty required fields.
 */
const REQUIRED_FIELDS = [
  "cliente_razao_social", "cliente_cnpj", "representante_nome_completo",
  "representante_cpf", "prazo_meses", "data_contratacao", "objeto_servico_especifico",
  "valor_mensal", "ip_contratante", "geo_contratante", "data_hora_contratacao",
  "user_agent", "session_id",
];

export function hydrateTemplate(template: string, variables: Partial<ContractVariables>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    const fallback = REQUIRED_FIELDS.includes(key) ? "Não capturado" : "";
    result = result.replace(regex, value || fallback);
  }
  // Replace any remaining unreplaced required placeholders with fallback
  for (const field of REQUIRED_FIELDS) {
    const regex = new RegExp(`\\{\\{${field}\\}\\}`, "g");
    result = result.replace(regex, "Não capturado");
  }
  return result;
}

function applyLegacyTemplateFixes(templateId: string, hydratedText: string): string {
  if (templateId !== "wmti_servicos_base_v1") return hydratedText;

  let fixed = hydratedText;

  fixed = fixed.replace(
    /CONTRATADA:\s*WMTI TECNOLOGIA DA INFORMAÇÃO LTDA,[\s\S]*?377\.995\.388-99\./i,
    "CONTRATADA: WMTI TECNOLOGIA DA INFORMAÇÃO LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob nº 13.366.668/0001-07, com sede na Rua José Benedito Duarte, 140, Parque Itamarati, Jacareí/SP.",
  );

  fixed = fixed.replace(
    /4\.2\.[\s\S]*?QRCODE disponibilizado no boleto\./i,
    "4.2. A primeira mensalidade vencerá no mesmo dia da assinatura deste contrato, no mês subsequente. As mensalidades seguintes observarão o mesmo dia de vencimento, por boleto bancário ou PIX (QR Code da própria cobrança).",
  );

  fixed = fixed.replace(
    /Parágrafo Único:\s*O único meio cabível de recebimento da CONTRATADA é o boleto bancário sendo disponibilizado o PIX somente através deste documento\./i,
    "Parágrafo Único: A CONTRATANTE reconhece que os meios oficiais de cobrança serão os disponibilizados no boleto/checkout da CONTRATADA.",
  );

  return fixed;
}

/**
 * Converts plain-text contract (with line breaks) to styled HTML for rendering/signing.
 */
export function templateToHtml(text: string, templateId?: string, versao?: string): string {
  const fontStack = `-apple-system, 'San Francisco', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
  const clauseStyle = `font-size: 12pt; font-weight: bold; text-transform: uppercase; margin-top: 32px; margin-bottom: 12px; letter-spacing: 0.3px;`;
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
      htmlLines.push(`<h1 style="font-size: 15pt; font-weight: bold; text-align: center; margin: 0 0 40px 0; text-transform: uppercase; letter-spacing: 0.5px;">${trimmed}</h1>`);
      continue;
    }

    // Clause headers (CLÁUSULA X –)
    if (/^CLÁUSULA\s+/i.test(trimmed)) {
      htmlLines.push(`<h2 style="${clauseStyle}">${trimmed}</h2>`);
      continue;
    }

    // Sub-section headers (all caps lines like ASSINATURA DA CONTRATANTE)
    if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s()–—,]{10,}$/.test(trimmed) && !trimmed.includes(":")) {
      htmlLines.push(`<h2 style="${clauseStyle}">${trimmed}</h2>`);
      continue;
    }

    // Numbered sub-items (e.g., 1.1., 4.5.1.)
    if (/^\d+\.\d+/.test(trimmed)) {
      htmlLines.push(`<p style="margin: 8px 0; text-indent: 24px; text-align: justify;">${trimmed}</p>`);
      continue;
    }

    // Roman numeral items
    if (/^(I|II|III|IV|V|VI)\s*[–—]/.test(trimmed)) {
      htmlLines.push(`<p style="margin: 4px 0; padding-left: 24px; text-align: justify;">${trimmed}</p>`);
      continue;
    }

    // Lettered items (a), b), etc.)
    if (/^[a-g]\)/.test(trimmed)) {
      htmlLines.push(`<p style="margin: 4px 0; padding-left: 24px; text-align: justify;">${trimmed}</p>`);
      continue;
    }

    // Label: value lines (Nome do representante: xxx)
    if (/^[A-ZÁ-Ú][a-záéíóúâêôãõç\s]+:/.test(trimmed)) {
      htmlLines.push(`<p style="margin: 4px 0; text-align: justify;"><strong>${trimmed.split(":")[0]}:</strong>${trimmed.substring(trimmed.indexOf(":") + 1)}</p>`);
      continue;
    }

    // Default paragraph
    htmlLines.push(`<p style="margin: 8px 0; text-align: justify;">${trimmed}</p>`);
  }

  // Traceability footer
  htmlLines.push(`<br/><br/><br/>`);
  htmlLines.push(`<div data-traceability="true" style="padding-top: 16px; border-top: 1px solid #999;">`);
  htmlLines.push(`<h2 style="font-size: 10pt; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; color: #333;">DADOS DE RASTREABILIDADE DA ASSINATURA ELETRÔNICA</h2>`);
  htmlLines.push(`<p style="font-size: 9pt; color: #444; margin: 4px 0;"><strong>IP de origem:</strong> <span data-proof="ip">{{SIGN_IP}}</span></p>`);
  htmlLines.push(`<p style="font-size: 9pt; color: #444; margin: 4px 0;"><strong>Data da confirmação:</strong> <span data-proof="date">{{SIGN_DATE}}</span></p>`);
  htmlLines.push(`<p style="font-size: 9pt; color: #444; margin: 4px 0;"><strong>Hora da confirmação:</strong> <span data-proof="time">{{SIGN_TIME}}</span></p>`);
  htmlLines.push(`<p style="font-size: 9pt; color: #444; margin: 4px 0;"><strong>Dispositivo/Navegador:</strong> <span data-proof="ua">{{SIGN_USER_AGENT}}</span></p>`);
  htmlLines.push(`<p style="font-size: 8pt; color: #888; margin-top: 12px; font-style: italic;">Este documento foi assinado eletronicamente nos termos do art. 10 da Medida Provisória nº 2.200-2/2001. Os dados acima constituem prova eletrônica da manifestação de vontade do signatário.</p>`);
  htmlLines.push(`</div>`);

  // Version footer
  if (templateId && versao) {
    htmlLines.push(`<hr style="border: none; border-top: 1px solid #ccc; margin: 32px 0 8px 0;"/>`);
    htmlLines.push(`<p style="font-size: 9pt; color: #888; text-align: center; margin: 0;">Contrato WMTi — Versão ${versao} — ID ${templateId}</p>`);
  }

  return `<div style="font-family: ${fontStack}; max-width: 800px; margin: 0 auto; color: #000; line-height: 1.8; font-size: 12pt; text-align: justify;">${htmlLines.join("\n")}</div>`;
}

/**
 * Full pipeline: fetch template → hydrate → convert to HTML.
 */
export async function generateContractFromTemplate(
  templateId: string,
  variables: Partial<ContractVariables>
): Promise<string | null> {
  const record = await fetchContractTemplate(templateId);
  if (!record) return null;
  const hydrated = hydrateTemplate(record.template_text, variables);
  const normalized = applyLegacyTemplateFixes(templateId, hydrated);
  return templateToHtml(normalized, record.id, record.versao);
}
