import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple DOCX generator — creates a valid .docx (Office Open XML) from text
function generateDocx(content: string, variables: Record<string, string>): Uint8Array {
  // Replace template variables
  let text = content;
  for (const [key, val] of Object.entries(variables)) {
    text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
  }

  // Escape XML
  const escXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Convert text paragraphs to OOXML
  const paragraphs = text.split("\n").map(line => {
    const trimmed = line.trim();
    if (!trimmed) return `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`;

    // Detect headings (lines in ALL CAPS or starting with roman numerals)
    const isHeading = /^[IVXLCDM]+\.\s/.test(trimmed) || /^[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s\-–]{5,}$/.test(trimmed);

    if (isHeading) {
      return `<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:spacing w:before="240" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">${escXml(trimmed)}</w:t></w:r></w:p>`;
    }

    return `<w:p><w:pPr><w:jc w:val="both"/><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${escXml(trimmed)}</w:t></w:r></w:p>`;
  }).join("");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14">
  <w:body>
    ${paragraphs}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

  // Build ZIP manually (minimal implementation)
  return buildZip({
    "[Content_Types].xml": new TextEncoder().encode(contentTypesXml),
    "_rels/.rels": new TextEncoder().encode(relsXml),
    "word/_rels/document.xml.rels": new TextEncoder().encode(wordRelsXml),
    "word/document.xml": new TextEncoder().encode(documentXml),
  });
}

// Minimal ZIP builder for DOCX
function buildZip(files: Record<string, Uint8Array>): Uint8Array {
  const entries: { name: Uint8Array; data: Uint8Array; offset: number }[] = [];
  const parts: Uint8Array[] = [];
  let offset = 0;

  for (const [name, data] of Object.entries(files)) {
    const nameBytes = new TextEncoder().encode(name);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(localHeader.buffer);

    dv.setUint32(0, 0x04034b50, true); // signature
    dv.setUint16(4, 20, true); // version
    dv.setUint16(6, 0, true); // flags
    dv.setUint16(8, 0, true); // compression (store)
    dv.setUint16(10, 0, true); // mod time
    dv.setUint16(12, 0, true); // mod date
    dv.setUint32(14, crc32(data), true); // crc32
    dv.setUint32(18, data.length, true); // compressed size
    dv.setUint32(22, data.length, true); // uncompressed size
    dv.setUint16(26, nameBytes.length, true); // name length
    dv.setUint16(28, 0, true); // extra length
    localHeader.set(nameBytes, 30);

    entries.push({ name: nameBytes, data, offset });
    parts.push(localHeader, data);
    offset += localHeader.length + data.length;
  }

  // Central directory
  const centralParts: Uint8Array[] = [];
  const centralStart = offset;

  for (const entry of entries) {
    const centralHeader = new Uint8Array(46 + entry.name.length);
    const dv = new DataView(centralHeader.buffer);

    dv.setUint32(0, 0x02014b50, true); // signature
    dv.setUint16(4, 20, true); // version made by
    dv.setUint16(6, 20, true); // version needed
    dv.setUint16(8, 0, true); // flags
    dv.setUint16(10, 0, true); // compression
    dv.setUint16(12, 0, true); // mod time
    dv.setUint16(14, 0, true); // mod date
    dv.setUint32(16, crc32(entry.data), true);
    dv.setUint32(20, entry.data.length, true);
    dv.setUint32(24, entry.data.length, true);
    dv.setUint16(28, entry.name.length, true);
    dv.setUint16(30, 0, true); // extra length
    dv.setUint16(32, 0, true); // comment length
    dv.setUint16(34, 0, true); // disk start
    dv.setUint16(36, 0, true); // internal attributes
    dv.setUint32(38, 0, true); // external attributes
    dv.setUint32(42, entry.offset, true); // local header offset
    centralHeader.set(entry.name, 46);

    centralParts.push(centralHeader);
    offset += centralHeader.length;
  }

  const centralSize = offset - centralStart;

  // End of central directory
  const eocd = new Uint8Array(22);
  const eocdDv = new DataView(eocd.buffer);
  eocdDv.setUint32(0, 0x06054b50, true);
  eocdDv.setUint16(4, 0, true);
  eocdDv.setUint16(6, 0, true);
  eocdDv.setUint16(8, entries.length, true);
  eocdDv.setUint16(10, entries.length, true);
  eocdDv.setUint32(12, centralSize, true);
  eocdDv.setUint32(16, centralStart, true);
  eocdDv.setUint16(20, 0, true);

  const allParts = [...parts, ...centralParts, eocd];
  const totalLen = allParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of allParts) { result.set(p, pos); pos += p.length; }
  return result;
}

// CRC32 lookup table
const crc32Table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  crc32Table[i] = c;
}
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) crc = crc32Table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const { geracao_id, variables } = await req.json();
    if (!geracao_id) throw new Error("geracao_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get generation
    const { data: geracao, error: gErr } = await supabase
      .from("qa_geracoes_pecas")
      .select("*")
      .eq("id", geracao_id)
      .single();

    if (gErr || !geracao) throw new Error("Geração não encontrada");

    // Build variables map
    const vars: Record<string, string> = {
      titulo: geracao.titulo_geracao || "Sem título",
      cliente_nome: variables?.cliente_nome || "[NOME DO CLIENTE]",
      resumo_fatico: variables?.resumo_fatico || "",
      fundamentacao: "",
      jurisprudencia: "",
      pedidos: variables?.pedidos || "",
      fechamento: variables?.fechamento || "",
      data_atual: new Date().toLocaleDateString("pt-BR"),
      assinatura: variables?.assinatura || "[ASSINATURA]",
      ...variables,
    };

    const content = geracao.minuta_gerada || "";

    // Generate DOCX
    const docxBytes = generateDocx(content, vars);

    // Save to storage
    const fileName = `${geracao.usuario_id || "system"}/${Date.now()}_${geracao.titulo_geracao?.replace(/[^a-zA-Z0-9]/g, "_") || "peca"}.docx`;
    const { error: uploadErr } = await supabase.storage
      .from("qa-geracoes")
      .upload(fileName, docxBytes, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      throw new Error("Erro ao salvar DOCX");
    }

    // Update generation record
    await supabase.from("qa_geracoes_pecas")
      .update({ docx_path: fileName, updated_at: new Date().toISOString() })
      .eq("id", geracao_id);

    // Audit
    await supabase.from("qa_logs_auditoria").insert({
      usuario_id: geracao.usuario_id || null,
      entidade: "qa_geracoes_pecas",
      entidade_id: geracao_id,
      acao: "exportar_docx",
      detalhes_json: { docx_path: fileName, tamanho: docxBytes.length },
    });

    // Return the file as download
    return new Response(docxBytes, {
      headers: {
        ...corsH,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${vars.titulo.replace(/[^a-zA-Z0-9_-]/g, "_")}.docx"`,
      },
    });

  } catch (err) {
    console.error("qa-export-docx error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  }
});
