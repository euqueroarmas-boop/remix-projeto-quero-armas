// ============================================================================
// qa-fill-template-cliente
// ----------------------------------------------------------------------------
// Versão da função qa-fill-template SEGURA para o portal do cliente.
// Em vez de exigir perfil staff, valida que o usuário autenticado é o DONO do
// processo informado (qa_clientes.user_id == auth.uid). Recebe processo_id +
// template_key (ou doc_id, do qual extrai o template). Reaproveita 100% da
// lógica de preenchimento de placeholders da função staff.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
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

  return {
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
}

function replaceInXml(xml: string, replacements: Record<string, string>): string {
  let result = xml;
  for (const [placeholder, value] of Object.entries(replacements)) {
    const safeValue = value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    result = result.split(placeholder).join(safeValue);
  }

  result = result.replace(
    /(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>)/g,
    (_match, pOpen: string, pContent: string, pClose: string) => {
      let fullText = "";
      const textParts: Array<{ text: string; start: number; end: number }> = [];
      const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
      let m;
      while ((m = tRegex.exec(pContent)) !== null) {
        textParts.push({ text: m[1], start: m.index, end: m.index + m[0].length });
        fullText += m[1];
      }
      let hasUnreplaced = false;
      for (const [placeholder] of Object.entries(replacements)) {
        if (fullText.includes(placeholder)) { hasUnreplaced = true; break; }
      }
      if (!hasUnreplaced) return pOpen + pContent + pClose;

      let newText = fullText;
      for (const [placeholder, value] of Object.entries(replacements)) {
        const safeValue = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        newText = newText.split(placeholder).join(safeValue);
      }
      if (textParts.length === 0) return pOpen + pContent + pClose;

      let newContent = pContent;
      for (let i = textParts.length - 1; i >= 0; i--) {
        const part = textParts[i];
        if (i === 0) {
          newContent = newContent.substring(0, part.start) + `<w:t xml:space="preserve">${newText}</w:t>` + newContent.substring(part.end);
        } else {
          newContent = newContent.substring(0, part.start) + `<w:t></w:t>` + newContent.substring(part.end);
        }
      }
      return pOpen + newContent + pClose;
    }
  );

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) Autenticação: precisa de Bearer token de cliente logado
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7).trim();

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authUserId = userData.user.id;

    // 2) Body
    const { template_key, processo_id } = await req.json();
    if (!template_key || !processo_id) {
      return new Response(JSON.stringify({ error: "template_key e processo_id são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Service role para acessar dados (bypass RLS, mas com checagem manual de ownership)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: processo, error: pErr } = await admin
      .from("qa_processos")
      .select("id, cliente_id")
      .eq("id", processo_id)
      .maybeSingle();
    if (pErr || !processo) {
      return new Response(JSON.stringify({ error: "Processo não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cliente, error: cErr } = await admin
      .from("qa_clientes")
      .select("*")
      .eq("id", processo.cliente_id)
      .maybeSingle();
    if (cErr || !cliente) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) AUTORIZAÇÃO: o usuário autenticado tem que ser o dono do cliente
    //    OU ser staff QA (administrativo, suporte etc).
    const isOwner = cliente.user_id === authUserId;

    let isStaff = false;
    if (!isOwner) {
      const { data: perfilRow } = await admin
        .from("qa_usuarios_perfis")
        .select("perfil, ativo")
        .eq("user_id", authUserId)
        .eq("ativo", true)
        .maybeSingle();
      isStaff = !!perfilRow;
    }

    if (!isOwner && !isStaff) {
      return new Response(JSON.stringify({ error: "Forbidden: você não tem acesso a este processo" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5) Baixa o template
    const templatePath = `declaracoes/${template_key}.docx`;
    const { data: fileData, error: dlErr } = await admin.storage.from("qa-templates").download(templatePath);
    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: `Template não encontrado: ${templatePath}` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6) Preenche placeholders
    const replacements = buildReplacements(cliente);
    const zip = await JSZip.loadAsync(await fileData.arrayBuffer());
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (!docXml) {
      return new Response(JSON.stringify({ error: "Template DOCX inválido" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    zip.file("word/document.xml", replaceInXml(docXml, replacements));

    for (const filename of Object.keys(zip.files)) {
      if ((filename.startsWith("word/header") || filename.startsWith("word/footer")) && filename.endsWith(".xml")) {
        const content = await zip.file(filename)?.async("string");
        if (content) zip.file(filename, replaceInXml(content, replacements));
      }
    }

    const outputBuffer = await zip.generateAsync({ type: "uint8array" });
    const filename = `${template_key}_${(cliente.nome_completo || "cliente").replace(/\s+/g, "_")}.docx`;

    return new Response(outputBuffer as BodyInit, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("[qa-fill-template-cliente] erro:", err);
    return new Response(JSON.stringify({ error: err?.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});