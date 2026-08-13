-- =============================================================================
-- APOSENTADO nao entrega CNIS — remove cobranca duplicada no servico 2
--
-- A linha `renda_extrato_inss` do aposentado tinha nome de CNIS ("Extrato
-- completo de contribuicoes do INSS") e instrucao de extrato de pagamento de
-- BENEFICIO. Sao documentos diferentes, e a instrucao duplicava o que a
-- exigencia `renda_comprovante_beneficio` (ordem 230) ja pede.
--
-- Decisao do usuario: o aposentado comprova renda pelo comprovante de
-- beneficio; o CNIS (historico de contribuicoes) nao e exigido. Entao a linha
-- sai do catalogo em vez de ter a instrucao corrigida.
--
-- O CNIS continua exigido do CLT (linha propria, condicao 'clt'), onde ele faz
-- sentido: prova vinculo e tempo de contribuicao.
-- =============================================================================

BEGIN;

-- ── 1) Catalogo: desativa a exigencia para o aposentado ─────────────────────
UPDATE public.qa_servicos_documentos
   SET ativo = false, updated_at = now()
 WHERE servico_id = 2
   AND tipo_documento = 'renda_extrato_inss'
   AND condicao_profissional = 'aposentado'
   AND ativo = true;

-- ── 2) Processos que ja carregam a exigencia ────────────────────────────────
-- Marca como nao aplicavel SEM tocar no que o cliente ja entregou ou no que
-- esta em analise: se algum aposentado ja mandou o CNIS, a entrega dele fica
-- registrada. Mudanca de regra nao apaga trabalho de cliente.
--
-- Direcionado de proposito, em vez de chamar
-- qa_sincronizar_checklist_processos_servico: aquela funcao sincronizaria o
-- servico 2 inteiro, reescrevendo nome, ordem e instrucoes de todas as
-- exigencias de todos os processos. E a rotina certa para revisao geral de
-- catalogo, nao para retirar um documento.
UPDATE public.qa_processo_documentos pd
   SET status = 'nao_aplicavel',
       observacoes = COALESCE(pd.observacoes,'') ||
         CASE WHEN COALESCE(pd.observacoes,'')='' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Exigência removida do catálogo: aposentado comprova renda pelo comprovante de benefício, não pelo CNIS.',
       campos_complementares_json = COALESCE(pd.campos_complementares_json,'{}'::jsonb)
         || jsonb_build_object(
              'removido_do_catalogo', true,
              'removido_em', now(),
              'motivo', 'aposentado nao entrega CNIS',
              'status_anterior', pd.status
            ),
       updated_at = now()
  FROM public.qa_processos p
 WHERE p.id = pd.processo_id
   AND p.servico_id = 2
   AND lower(COALESCE(p.condicao_profissional,'')) = 'aposentado'
   AND pd.tipo_documento = 'renda_extrato_inss'
   AND pd.arquivo_storage_key IS NULL
   AND pd.status NOT IN ('aprovado','validado','dispensado','dispensado_grupo',
                         'dispensado_por_reaproveitamento','entregue_pelo_hub',
                         'nao_aplicavel','concluido','concluído');

COMMIT;
