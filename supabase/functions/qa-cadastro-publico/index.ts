import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const CadastroSchema = z.object({
  // Quando presente, indica que é uma ATUALIZAÇÃO de cadastro existente
  update_existing_id: z.string().uuid().optional().nullable(),

  // Dados pessoais
  nome_completo: z.string().min(3).max(200),
  cpf: z.string().min(11).max(18),
  rg: z.string().max(30).optional().nullable(),
  emissor_rg: z.string().max(30).optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  telefone_principal: z.string().min(8).max(20),
  telefone_secundario: z.string().max(20).optional().nullable(),
  email: z.string().email().max(255),
  nome_mae: z.string().max(200).optional().nullable(),
  nome_pai: z.string().max(200).optional().nullable(),
  estado_civil: z.string().max(30).optional().nullable(),
  nacionalidade: z.string().max(60).optional().nullable(),
  profissao: z.string().max(100).optional().nullable(),
  observacoes: z.string().max(2000).optional().nullable(),

  // Endereço 1
  end1_cep: z.string().max(10).optional().nullable(),
  end1_logradouro: z.string().max(300).optional().nullable(),
  end1_numero: z.string().max(20).optional().nullable(),
  end1_complemento: z.string().max(200).optional().nullable(),
  end1_bairro: z.string().max(100).optional().nullable(),
  end1_cidade: z.string().max(100).optional().nullable(),
  end1_estado: z.string().max(2).optional().nullable(),
  end1_latitude: z.string().max(30).optional().nullable(),
  end1_longitude: z.string().max(30).optional().nullable(),

  // Endereço 2
  tem_segundo_endereco: z.boolean().optional(),
  end2_tipo: z.string().max(30).optional().nullable(),
  end2_cep: z.string().max(10).optional().nullable(),
  end2_logradouro: z.string().max(300).optional().nullable(),
  end2_numero: z.string().max(20).optional().nullable(),
  end2_complemento: z.string().max(200).optional().nullable(),
  end2_bairro: z.string().max(100).optional().nullable(),
  end2_cidade: z.string().max(100).optional().nullable(),
  end2_estado: z.string().max(2).optional().nullable(),
  end2_latitude: z.string().max(30).optional().nullable(),
  end2_longitude: z.string().max(30).optional().nullable(),

  // Vínculo empresarial
  vinculo_tipo: z.string().max(30).optional().nullable(),

  // Empresa
  emp_cnpj: z.string().max(20).optional().nullable(),
  emp_razao_social: z.string().max(300).optional().nullable(),
  emp_nome_fantasia: z.string().max(300).optional().nullable(),
  emp_situacao_cadastral: z.string().max(50).optional().nullable(),
  emp_data_abertura: z.string().max(20).optional().nullable(),
  emp_cnae_principal: z.string().max(200).optional().nullable(),
  emp_natureza_juridica: z.string().max(200).optional().nullable(),
  emp_endereco: z.string().max(500).optional().nullable(),
  emp_telefone: z.string().max(30).optional().nullable(),
  emp_email: z.string().max(255).optional().nullable(),
  emp_cargo_funcao: z.string().max(100).optional().nullable(),
  emp_participacao_societaria: z.string().max(50).optional().nullable(),

  // Trabalho registrado
  trab_nome_empresa: z.string().max(300).optional().nullable(),
  trab_cnpj_empresa: z.string().max(20).optional().nullable(),
  trab_cargo_funcao: z.string().max(100).optional().nullable(),
  trab_data_admissao: z.string().max(20).optional().nullable(),
  trab_faixa_salarial: z.string().max(50).optional().nullable(),
  trab_endereco_empresa: z.string().max(500).optional().nullable(),
  trab_telefone_empresa: z.string().max(30).optional().nullable(),

  // Autônomo
  aut_atividade: z.string().max(200).optional().nullable(),
  aut_nome_profissional: z.string().max(200).optional().nullable(),
  aut_cnpj: z.string().max(20).optional().nullable(),
  aut_telefone: z.string().max(30).optional().nullable(),
  aut_endereco: z.string().max(500).optional().nullable(),

  // Consentimento
  consentimento_dados_verdadeiros: z.literal(true),
  consentimento_tratamento_dados: z.literal(true),
  consentimento_texto: z.string().max(2000).optional().nullable(),
  servico_interesse: z.string().max(200).optional().nullable(),
  selfie_path: z.string().max(500).optional().nullable(),
  documento_identidade_path: z.string().max(500).optional().nullable(),
  comprovante_endereco_path: z.string().max(500).optional().nullable(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();

    // ── CPF Lookup action ──
    if (body.action === "lookup-cpf") {
      const cpfDigits = (body.cpf || "").replace(/\D/g, "");
      if (cpfDigits.length !== 11) {
        return json({ error: "CPF inválido" }, 400);
      }

      // 1) Cadastro público existente (prioridade — evita duplicata)
      const { data: existingCadastro } = await supabase
        .from("qa_cadastro_publico")
        .select("id, nome_completo, status, servico_interesse, created_at, email, telefone_principal")
        .eq("cpf", cpfDigits)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2) Cliente legado (apenas para auto-preenchimento)
      const { data: cliente } = await supabase
        .from("qa_clientes")
        .select("nome_completo, cpf, data_nascimento, celular, email, nome_mae, nome_pai, estado_civil, nacionalidade, profissao, observacao, endereco, numero, complemento, bairro, cep, cidade, estado, geolocalizacao, endereco2, numero2, complemento2, bairro2, cep2, cidade2, estado2, geolocalizacao2")
        .eq("cpf", cpfDigits)
        .eq("excluido", false)
        .maybeSingle();

      // Se existe cadastro público, retorna com flag para o cliente decidir
      if (existingCadastro) {
        // Carrega o cadastro completo para auto-preenchimento caso o usuário escolha atualizar
        const { data: full } = await supabase
          .from("qa_cadastro_publico")
          .select("*")
          .eq("id", existingCadastro.id)
          .maybeSingle();

        return json({
          found: !!cliente,
          cliente: cliente || null,
          existing_cadastro: {
            id: existingCadastro.id,
            nome_completo: existingCadastro.nome_completo,
            status: existingCadastro.status,
            servico_interesse: existingCadastro.servico_interesse,
            created_at: existingCadastro.created_at,
            email: existingCadastro.email,
            telefone_principal: existingCadastro.telefone_principal,
            full,
          },
        });
      }

      if (!cliente) {
        return json({ found: false });
      }

      return json({ found: true, cliente });
    }

    const parsed = CadastroSchema.safeParse(body);

    if (!parsed.success) {
      return json({
        error: "Dados inválidos",
        details: parsed.error.flatten().fieldErrors,
      }, 400);
    }

    const data = parsed.data;
    const updateExistingId = data.update_existing_id || null;
    // Remove campo de controle do payload de persistência
    const { update_existing_id: _u, ...persistData } = data;

    // Capture audit metadata
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const now = new Date().toISOString();

    // Clean CPF
    const cpfDigits = data.cpf.replace(/\D/g, "");

    // ── Caminho UPDATE ──
    if (updateExistingId) {
      // Confirma que o registro existe e pertence ao mesmo CPF
      const { data: existing } = await supabase
        .from("qa_cadastro_publico")
        .select("id, cpf, servico_interesse, notas_processamento")
        .eq("id", updateExistingId)
        .maybeSingle();

      if (!existing) {
        return json({ error: "Cadastro existente não encontrado" }, 404);
      }
      if (existing.cpf !== cpfDigits) {
        return json({ error: "CPF não confere com o cadastro informado" }, 400);
      }

      const novoServico = persistData.servico_interesse || null;
      const servicoAnterior = existing.servico_interesse || null;
      const historicoNota = `[${now}] Cadastro atualizado pelo titular (formulário público)` +
        (novoServico && novoServico !== servicoAnterior
          ? `. Novo serviço solicitado: ${novoServico}` +
            (servicoAnterior ? ` (anterior: ${servicoAnterior})` : "")
          : "");
      const notasAtualizadas = [existing.notas_processamento, historicoNota]
        .filter(Boolean)
        .join("\n");

      const { error: updErr } = await supabase
        .from("qa_cadastro_publico")
        .update({
          ...persistData,
          cpf: cpfDigits,
          consentimento_timestamp: now,
          consentimento_ip: ip.substring(0, 45),
          consentimento_user_agent: userAgent.substring(0, 500),
          consentimento_texto:
            "Declaro que as informações prestadas são verdadeiras, completas e de minha responsabilidade, e autorizo seu uso para fins de cadastro, validação, análise e continuidade do atendimento, nos termos aplicáveis de privacidade e proteção de dados.",
          status: "pendente",
          notas_processamento: notasAtualizadas,
          updated_at: now,
        })
        .eq("id", updateExistingId);

      if (updErr) {
        console.error("[qa-cadastro-publico] Update error:", updErr);
        return json({ error: "Erro ao atualizar cadastro" }, 500);
      }

      await supabase.from("integration_logs").insert({
        integration_name: "qa_cadastro_publico",
        operation_name: "update",
        request_payload: {
          cpf: cpfDigits.slice(0, 3) + "***",
          id: updateExistingId,
          novo_servico: novoServico,
        },
        status: "success",
      }).then();

      return json({ success: true, id: updateExistingId, updated: true });
    }

    // ── Caminho INSERT — proteção contra duplicidade ──
    const { data: dup } = await supabase
      .from("qa_cadastro_publico")
      .select("id, status, created_at, nome_completo, cpf, rg, emissor_rg, data_nascimento, telefone_principal, email, end1_cep, end1_logradouro, end1_numero, end1_bairro, end1_cidade, end1_estado")
      .eq("cpf", cpfDigits)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dup) {
      // Bloqueia o INSERT — o frontend deve oferecer atualizar
      return json({
        error: "duplicate_cpf",
        message: "Já existe um cadastro com este CPF. Para atualizar seus dados, confirme a atualização do cadastro existente.",
        existing_id: dup.id,
        existing_status: dup.status,
        existing_created_at: dup.created_at,
        existing_data: dup,
      }, 409);
    }

    const { data: inserted, error } = await supabase
      .from("qa_cadastro_publico")
      .insert({
        ...persistData,
        cpf: cpfDigits,
        consentimento_timestamp: now,
        consentimento_ip: ip.substring(0, 45),
        consentimento_user_agent: userAgent.substring(0, 500),
        consentimento_texto:
          "Declaro que as informações prestadas são verdadeiras, completas e de minha responsabilidade, e autorizo seu uso para fins de cadastro, validação, análise e continuidade do atendimento, nos termos aplicáveis de privacidade e proteção de dados.",
        status: "pendente",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[qa-cadastro-publico] Insert error:", error);
      return json({ error: "Erro ao salvar cadastro" }, 500);
    }

    await supabase.from("integration_logs").insert({
      integration_name: "qa_cadastro_publico",
      operation_name: "submit",
      request_payload: { cpf: cpfDigits.slice(0, 3) + "***", nome: data.nome_completo.split(" ")[0] },
      status: "success",
    }).then();

    return json({ success: true, id: inserted.id });
  } catch (err) {
    console.error("[qa-cadastro-publico] Error:", err);
    return json({ error: "Erro interno ao processar cadastro" }, 500);
  }
});
