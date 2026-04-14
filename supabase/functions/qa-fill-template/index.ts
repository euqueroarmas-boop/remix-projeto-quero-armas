import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.39.3/cors";
import JSZip from "https://esm.sh/jszip@3.10.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function buildReplacements(cliente: any, extra: Record<string, string> = {}): Record<string, string> {
  const now = new Date();
  const endereco1Parts = [
    cliente.endereco,
    cliente.numero ? `nº ${cliente.numero}` : "",
    cliente.complemento || "",
    cliente.bairro || "",
    cliente.cidade ? `${cliente.cidade}` : "",
    cliente.estado || "",
    cliente.cep ? `CEP: ${cliente.cep}` : "",
  ].filter(Boolean);

  const endereco2Parts = [
    cliente.endereco2,
    cliente.numero2 ? `nº ${cliente.numero2}` : "",
    cliente.complemento2 || "",
    cliente.bairro2 || "",
    cliente.cidade2 ? `${cliente.cidade2}` : "",
    cliente.estado2 || "",
    cliente.cep2 ? `CEP: ${cliente.cep2}` : "",
  ].filter(Boolean);

  const map: Record<string, string> = {
    "[NOME COMPLETO]": cliente.nome_completo || "",
    "[NACIONALIDADE]": cliente.nacionalidade || "brasileiro(a)",
    "[NATURALIDADE]": cliente.naturalidade || "",
    "[DATA NASCIMENTO]": cliente.data_nascimento || "",
    "[PROFISSÃO]": cliente.profissao || "",
    "[ESTADO CIVIL]": cliente.estado_civil || "",
    "[CPF]": cliente.cpf || "",
    "[RG]": cliente.rg || "",
    "[EMISSOR]": cliente.emissor_rg || "",
    "[ENDEREÇO 1]": endereco1Parts.join(", "),
    "[ENDEREÇO 2]": endereco2Parts.join(", "),
    "[CIDADE]": cliente.cidade || "",
    "[DIA]": String(now.getDate()).padStart(2, "0"),
    "[MÊS]": MESES[now.getMonth()],
    "[ANO]": String(now.getFullYear()),
    ...extra,
  };

  return map;
}

function replaceInXml(xml: string, replacements: Record<string, string>): string {
  // DOCX splits placeholders across multiple XML runs (e.g. [NOME becomes <w:t>[NOME</w:t> <w:t>]</w:t>)
  // First, we need to normalize by finding bracket pairs across runs

  // Strategy: do replacements on the text content, handling split runs
  // Step 1: Replace simple cases where placeholder is in a single <w:t> tag
  let result = xml;
  for (const [placeholder, value] of Object.entries(replacements)) {
    // Escape for XML
    const safeValue = value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    
    // Direct replacement
    result = result.split(placeholder).join(safeValue);
  }

  // Step 2: Handle split placeholders across runs
  // Extract all text, find unreplaced brackets, and fix them
  // Pattern: find [TEXT] that spans multiple <w:t> tags within the same paragraph
  const bracketPattern = /\[([A-ZÀ-ÚÇ\s0-9]+)\]/g;
  
  // Merge adjacent runs in each paragraph to catch split placeholders
  result = result.replace(
    /(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>)/g,
    (_match, pOpen: string, pContent: string, pClose: string) => {
      // Extract all text from this paragraph
      let fullText = "";
      const textParts: Array<{ text: string; start: number; end: number }> = [];
      const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
      let m;
      while ((m = tRegex.exec(pContent)) !== null) {
        textParts.push({ text: m[1], start: m.index, end: m.index + m[0].length });
        fullText += m[1];
      }

      // Check if there are any unreplaced placeholders in the merged text
      let hasUnreplaced = false;
      for (const [placeholder] of Object.entries(replacements)) {
        if (fullText.includes(placeholder)) {
          hasUnreplaced = true;
          break;
        }
      }

      if (!hasUnreplaced) return pOpen + pContent + pClose;

      // Replace in full text
      let newText = fullText;
      for (const [placeholder, value] of Object.entries(replacements)) {
        const safeValue = value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
        newText = newText.split(placeholder).join(safeValue);
      }

      // Put text back into first <w:t>, clear the rest
      if (textParts.length === 0) return pOpen + pContent + pClose;

      let newContent = pContent;
      // Replace backwards to preserve indices
      for (let i = textParts.length - 1; i >= 0; i--) {
        const part = textParts[i];
        if (i === 0) {
          // Put all text in first run
          newContent =
            newContent.substring(0, part.start) +
            `<w:t xml:space="preserve">${newText}</w:t>` +
            newContent.substring(part.end);
        } else {
          // Empty out other runs
          newContent =
            newContent.substring(0, part.start) +
            `<w:t></w:t>` +
            newContent.substring(part.end);
        }
      }

      return pOpen + newContent + pClose;
    }
  );

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { template_key, cliente_id, extra_fields } = await req.json();

    if (!template_key || !cliente_id) {
      return new Response(
        JSON.stringify({ error: "template_key e cliente_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Fetch client data
    const { data: cliente, error: cErr } = await supabase
      .from("qa_clientes")
      .select("*")
      .eq("id", cliente_id)
      .single();

    if (cErr || !cliente) {
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download template from storage
    const templatePath = `declaracoes/${template_key}.docx`;
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("qa-templates")
      .download(templatePath);

    if (dlErr || !fileData) {
      return new Response(
        JSON.stringify({ error: `Template não encontrado: ${templatePath}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build replacements
    const replacements = buildReplacements(cliente, extra_fields || {});

    // Unzip DOCX
    const zip = await JSZip.loadAsync(await fileData.arrayBuffer());
    
    // Replace in document.xml
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (!docXml) {
      return new Response(
        JSON.stringify({ error: "Template DOCX inválido" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newDocXml = replaceInXml(docXml, replacements);
    zip.file("word/document.xml", newDocXml);

    // Also replace in headers/footers if they exist
    for (const filename of Object.keys(zip.files)) {
      if (
        (filename.startsWith("word/header") || filename.startsWith("word/footer")) &&
        filename.endsWith(".xml")
      ) {
        const content = await zip.file(filename)?.async("string");
        if (content) {
          zip.file(filename, replaceInXml(content, replacements));
        }
      }
    }

    // Generate output
    const outputBuffer = await zip.generateAsync({ type: "uint8array" });

    const filename = `${template_key}_${(cliente.nome_completo || "cliente").replace(/\s+/g, "_")}.docx`;

    return new Response(outputBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
