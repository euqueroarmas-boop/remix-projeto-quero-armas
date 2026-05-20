import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function classifyDoc(d: Record<string, unknown>) {
  const validade = d.data_validade ? new Date(String(d.data_validade)) : null;
  const hoje = new Date();
  const status = String(d.status || "");
  if (validade && validade.getTime() < hoje.getTime()) return "vencido";
  if (status === "pendente_aprovacao" || status === "em_analise") return "pendente";
  if (status === "aprovado" || d.validado_admin === true) return "valido";
  return "valido";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.replace("Bearer ", "");

  // Cliente com JWT do usuário (RLS aplicado)
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return json({ error: "Unauthorized" }, 401);
  }
  const userId = claimsData.claims.sub as string;

  // Service role para resolver vínculo qa_clientes / qa_documentos_cliente
  // (RLS dessas tabelas é admin-only; depois de validar JWT, leitura
  // estrita do PRÓPRIO cliente é segura.)
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Resolve cliente_id pelo vínculo
    const { data: link } = await supabaseAdmin
      .from("cliente_auth_links")
      .select("qa_cliente_id, customer_id, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("activated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let qaClienteId: number | null = link?.qa_cliente_id ?? null;

    if (!qaClienteId) {
      // fallback: qa_clientes vinculado ao user_id
      const { data: cli } = await supabaseAdmin
        .from("qa_clientes")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      qaClienteId = cli?.id ?? null;
    }

    if (!qaClienteId) {
      return json({
        cliente: null,
        documentos_validos: [],
        documentos_vencidos: [],
        documentos_pendentes: [],
        servicos_anteriores: [],
        processos_ativos: [],
        contratos_existentes: [],
        arsenal_resumo: null,
      });
    }

    const [
      clienteRes,
      docsRes,
      vendasRes,
      processosRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("qa_clientes")
        .select(
          "id, nome_completo, cpf, rg, email, celular, data_nascimento, endereco, numero, complemento, bairro, cidade, estado, cep, cadastro_publico_id",
        )
        .eq("id", qaClienteId)
        .maybeSingle(),
      supabaseAdmin
        .from("qa_documentos_cliente")
        .select(
          "id, tipo_documento, arquivo_nome, data_validade, status, validado_admin, arma_numero_serie, created_at",
        )
        .eq("qa_cliente_id", qaClienteId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("qa_vendas")
        .select("id, status, valor_a_pagar, data_cadastro, numero_processo")
        .eq("cliente_id", qaClienteId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("qa_processos")
        .select("id, servico_nome, status, pagamento_status, data_criacao")
        .eq("cliente_id", qaClienteId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const docs = docsRes.data || [];
    const validos: unknown[] = [];
    const vencidos: unknown[] = [];
    const pendentes: unknown[] = [];
    for (const d of docs) {
      const cls = classifyDoc(d as Record<string, unknown>);
      const entry = {
        id: d.id,
        tipo_documento: d.tipo_documento,
        arquivo_nome: d.arquivo_nome,
        data_validade: d.data_validade,
        status: d.status,
        validado_admin: d.validado_admin,
      };
      if (cls === "vencido") vencidos.push(entry);
      else if (cls === "pendente") pendentes.push(entry);
      else validos.push(entry);
    }

    // --- Reaproveitamento a partir de qa_cadastro_publico ---
    // Resolve a linha pública vinculada: prioriza qa_clientes.cadastro_publico_id;
    // fallback por cliente_id_vinculado (mais recente).
    try {
      const cadastroPublicoId = (clienteRes.data as any)?.cadastro_publico_id ?? null;
      let pub: any = null;
      if (cadastroPublicoId) {
        const { data } = await supabaseAdmin
          .from("qa_cadastro_publico")
          .select("id, documento_identidade_path, comprovante_endereco_path, selfie_path, created_at")
          .eq("id", cadastroPublicoId)
          .maybeSingle();
        pub = data;
      }
      if (!pub) {
        const { data } = await supabaseAdmin
          .from("qa_cadastro_publico")
          .select("id, documento_identidade_path, comprovante_endereco_path, selfie_path, created_at")
          .eq("cliente_id_vinculado", qaClienteId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        pub = data;
      }
      if (pub) {
        const fileNameFromPath = (p: string | null | undefined) =>
          (p ? String(p).split("/").pop() || String(p) : "");
        const pushPub = (tipo: string, path: string | null | undefined) => {
          if (!path) return;
          validos.push({
            id: `pub_${pub.id}_${tipo.toLowerCase()}`,
            tipo_documento: tipo,
            arquivo_nome: fileNameFromPath(path),
            data_validade: null,
            status: "aprovado",
            validado_admin: true,
            origem: "qa_cadastro_publico",
            storage_path: path,
          });
        };
        pushPub("DOC_IDENTIDADE", pub.documento_identidade_path);
        pushPub("COMPROVANTE_RESIDENCIA", pub.comprovante_endereco_path);
        pushPub("SELFIE", pub.selfie_path);
      }
    } catch (pubErr) {
      console.warn("[qa-cadastro-carregar-cliente] qa_cadastro_publico lookup falhou", pubErr);
    }

    const servicos_anteriores = (vendasRes.data || []).map((v) => ({
      id: v.id,
      servico_nome: null,
      status: v.status,
      data: v.data_cadastro,
    }));

    const processos_ativos = (processosRes.data || []).filter((p) =>
      p.status !== "concluido"
    );

    // Resumo Arsenal: extrai do conjunto de documentos
    const cr = docs.find((d) =>
      String(d.tipo_documento || "").toUpperCase().includes("CR")
    );
    const craf = docs.find((d) => {
      const t = String(d.tipo_documento || "").toUpperCase();
      return t.includes("CRAF") || t.includes("SIGMA");
    });
    const armas = docs.filter((d) => d.arma_numero_serie).length;

    return json({
      cliente: clienteRes.data || null,
      documentos_validos: validos,
      documentos_vencidos: vencidos,
      documentos_pendentes: pendentes,
      servicos_anteriores,
      processos_ativos,
      contratos_existentes: [],
      arsenal_resumo: {
        cr: cr ? `válido até ${cr.data_validade || "?"}` : null,
        craf: craf ? `válido até ${craf.data_validade || "?"}` : null,
        armas,
        laudos: [],
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[qa-cadastro-carregar-cliente] fatal", msg);
    return json({ error: msg }, 500);
  }
});
