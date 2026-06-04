import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
} from "npm:docx@9.5.1";

const corsH = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sanitize text: remove invalid XML control chars, normalize line endings
function sanitize(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Remove control chars except \n and \t
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Remove zero-width / BOM
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

// Parse inline markdown bold (**text**) into TextRun[] with bold formatting
function parseInlineRuns(text: string, baseOpts: any = {}): TextRun[] {
  const runs: TextRun[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      runs.push(new TextRun({ ...baseOpts, text: text.slice(last, m.index) }));
    }
    runs.push(new TextRun({ ...baseOpts, text: m[1], bold: true }));
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    runs.push(new TextRun({ ...baseOpts, text: text.slice(last) }));
  }
  if (runs.length === 0) runs.push(new TextRun({ ...baseOpts, text }));
  return runs;
}

async function generateDocx(content: string, variables: Record<string, string>): Promise<Uint8Array> {
  // Replace template variables
  let text = sanitize(content);
  for (const [key, val] of Object.entries(variables)) {
    text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), sanitize(String(val ?? "")));
  }

  const baseFont = { font: "Times New Roman", size: 24 }; // 12pt
  const lines = text.split("\n");
  const paragraphs: Paragraph[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      paragraphs.push(new Paragraph({ children: [new TextRun("")] }));
      continue;
    }

    // Strip surrounding ** for heading detection
    const cleaned = line.replace(/\*\*/g, "").trim();

    const isEnderecamento = /^A\s+DOUTA/i.test(cleaned) || /SUPERINTEND[ÊE]NCIA/i.test(cleaned);
    const isRequerimento = /^Requerimento:\s/i.test(cleaned);
    const isRomanSection = /^[IVXLCDM]+\s*[—–\-\.]\s*/i.test(cleaned);
    const isAllCapsHeading = /^[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ0-9\s\-–—:\.]{5,}$/.test(cleaned) && cleaned.length < 120;
    const isFechamento = /^nestes\s+termos/i.test(cleaned);

    if (isEnderecamento) {
      paragraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 360, after: 360 },
        children: parseInlineRuns(cleaned, { ...baseFont, bold: true, size: 26 }),
      }));
      continue;
    }
    if (isRequerimento) {
      paragraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 240 },
        children: parseInlineRuns(cleaned, { ...baseFont, bold: true }),
      }));
      continue;
    }
    if (isRomanSection || isAllCapsHeading) {
      paragraphs.push(new Paragraph({
        spacing: { before: 320, after: 160 },
        children: parseInlineRuns(cleaned, { ...baseFont, bold: true, size: 26 }),
      }));
      continue;
    }
    if (isFechamento) {
      paragraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 360, after: 240 },
        children: parseInlineRuns(cleaned, { ...baseFont, italics: true }),
      }));
      continue;
    }

    paragraphs.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 120, line: 360 },
      children: parseInlineRuns(line, baseFont),
    }));
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Times New Roman", size: 24 } },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: paragraphs,
    }],
  });

  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    // Auth: require active QA staff
    const { requireQAStaff } = await import("../_shared/qaAuth.ts");
    const guard = await requireQAStaff(req);
    if (!guard.ok) return guard.response;

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

    // Build variables map with real data
    const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const now = new Date();
    const dataExtenso = `${now.getDate()} de ${meses[now.getMonth()]} de ${now.getFullYear()}`;
    const cidadeVar = variables?.cidade || "";
    const dataAtualDefault = cidadeVar ? `${cidadeVar}, ${dataExtenso}.` : `${dataExtenso}.`;

    const vars: Record<string, string> = {
      titulo: geracao.titulo_geracao || variables?.titulo || "Sem título",
      cliente_nome: variables?.cliente_nome || "[NOME DO REQUERENTE]",
      cidade: (cidadeVar || "").toUpperCase(),
      estado: (variables?.estado || "").toUpperCase(),
      resumo_fatico: variables?.resumo_fatico || "",
      fundamentacao: "",
      jurisprudencia: "",
      pedidos: variables?.pedidos || "",
      fechamento: variables?.fechamento || "",
      data_atual: variables?.data_atual || dataAtualDefault,
      assinatura: variables?.assinatura || variables?.cliente_nome || "[NOME DO REQUERENTE]",
      ...variables,
    };

    let content = geracao.minuta_gerada || "";

    // Post-process: remove advogado/OAB references from closing
    content = content.replace(/\n[^\n]*advogad[oa][^\n]*OAB[^\n]*/gi, "");
    content = content.replace(/\n[^\n]*OAB[\s\/]*[A-Z]{2}[\s]*[\d.]+[^\n]*/gi, "");
    // Remove leftover placeholders
    content = content.replace(/\[DATA\]/gi, vars.data_atual);
    content = content.replace(/\[CIDADE\]/gi, vars.cidade);
    content = content.replace(/\[NOME[^\]]*\]/gi, vars.cliente_nome);
    content = content.replace(/\[ASSINATURA[^\]]*\]/gi, vars.assinatura);
    content = content.replace(/\[ADVOGAD[OA][^\]]*\]/gi, "");
    content = content.replace(/\[OAB[^\]]*\]/gi, "");
    content = content.replace(/\[NUMERO[_\s]*REQUERIMENTO[^\]]*\]/gi, vars.numero_requerimento || "");
    content = content.replace(/\[PREAMBULO[^\]]*\]/gi, "");
    // Remove orphan "Requerimento:" line if number was not provided
    if (!vars.numero_requerimento) {
      content = content.replace(/\n\s*Requerimento:\s*\n/gi, "\n");
    }

    // Ensure closing block has real date and requester name
    if (!content.includes(vars.data_atual) && vars.data_atual) {
      content = content.trimEnd() + "\n\n" + vars.data_atual + "\n\n" + vars.assinatura;
    }

    // Generate DOCX
    const docxBytes = await generateDocx(content, vars);

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
    return new Response(docxBytes as BodyInit, {
      headers: {
        ...corsH,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${vars.titulo.replace(/[^a-zA-Z0-9_-]/g, "_")}.docx"`,
      },
    });

  } catch (err: any) {
    console.error("qa-export-docx error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsH, "Content-Type": "application/json" },
    });
  }
});
