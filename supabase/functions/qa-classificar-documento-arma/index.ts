// Edge Function: qa-classificar-documento-arma
// Classifica automaticamente um documento enviado no Arsenal e o compara
// com o tipo escolhido manualmente pelo cliente.
//
// Tipos suportados:
//   CRAF · GT · GTE · GUIA_TRANSITO · NOTA_FISCAL · EXAME_LAUDO · DESCONHECIDO
//
// Entrada (POST JSON):
//   { imageDataUrl: string, tipoSelecionado: string }
//   ou
//   { storage_bucket: string, storage_path: string, tipoSelecionado: string }
//
// Saída:
//   {
//     tipoDetectado, confianca (0..1), camposExtraidos, justificativa,
//     divergenciaComSelecaoManual, recomendacao: "aceitar"|"confirmar"|"revisao_obrigatoria",
//     revisao_obrigatoria: boolean
//   }
//
// Diretrizes:
//  - service_role no servidor; valida JWT do chamador.
//  - Não escreve em tabelas (decisão de salvar fica com o caller).
//  - Modelo: google/gemini-3-flash-preview.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TIPOS = [
  "CR","CRAF","SINARM","GT","GTE","GUIA_TRANSITO","AUTORIZACAO_COMPRA","NOTA_FISCAL_ARMA",
  "RG_COM_CPF","CIN","CNH","CPF",
  "COMPROVANTE_RESIDENCIA","DECLARACAO_RESPONSAVEL_IMOVEL",
  "CTPS","HOLERITE","CARTAO_CNPJ","CONTRATO_SOCIAL","NOTA_FISCAL_AUTONOMO","COMPROVANTE_BENEFICIO","EXTRATO_INSS",
  "ANTECEDENTES_CRIMINAIS","ANTECEDENTES_FEDERAL","ANTECEDENTES_ESTADUAL","ANTECEDENTES_MILITAR","ANTECEDENTES_ELEITORAL",
  "DECLARACAO_NAO_INQUERITO","DECLARACAO_GUARDA_RESPONSAVEL","DECLARACAO_CORRELATA","DECLARACAO_GUARDA_ACERVO",
  "LAUDO_PSICOLOGICO","LAUDO_CAPACIDADE_TECNICA",
  "COMPROVANTE_EFETIVA_NECESSIDADE","DOCUMENTO_COMPLEMENTAR",
  "COMPROVANTE_HABITUALIDADE","COMPROVANTE_CLUBE","COMPROVANTE_COMPETICAO",
  "PROTOCOLO_PROCESSO","OFICIO","DESPACHO","EXIGENCIA","INDEFERIMENTO",
  "PROCURACAO","RECURSO_ADMINISTRATIVO","MANDADO_SEGURANCA",
  "DESCONHECIDO",
] as const;
type Tipo = typeof TIPOS[number];
