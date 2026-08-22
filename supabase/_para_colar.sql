-- =============================================================================
-- POR QUE A CTPS DO IGOR FOI RECUSADA COMO "CERTIDÃO CÍVEL" (cliente 235)
-- Somente leitura. A recusa acontece na LEITURA do arquivo, antes do upload:
-- o que interessa é o que a IA leu (tipo_lido) contra o que o slot pedia
-- (exigencia_alvo).
-- =============================================================================

SELECT '01_tentativas_recusadas_hoje' AS bloco, to_jsonb(x) AS dado FROM (
  SELECT de.created_at, de.acao, de.ator_email,
         de.detalhes ->> 'codigo'          AS codigo,
         de.detalhes ->> 'motivo'          AS motivo,
         de.detalhes ->> 'tipo_pretendido' AS tipo_pretendido,
         de.detalhes ->> 'tipo_lido'       AS tipo_lido,
         de.detalhes ->> 'exigencia_alvo'  AS exigencia_alvo,
         de.detalhes ->> 'arquivo_nome'    AS arquivo_nome,
         de.detalhes
    FROM public.qa_documentos_cliente_eventos de
   WHERE de.qa_cliente_id = 235
     AND de.created_at >= now() - interval '1 day'
   ORDER BY de.created_at DESC
   LIMIT 20
) x

UNION ALL
SELECT '02_o_que_a_ia_extraiu_dos_envios_de_hoje', to_jsonb(y) FROM (
  SELECT d.created_at, d.tipo_documento, d.nome_documento, d.status, d.ia_status,
         d.arquivo_nome, d.motivo_reprovacao,
         d.ia_dados_extraidos -> 'tipoDetectado'   AS tipo_detectado,
         d.ia_dados_extraidos -> 'tipo_detectado'  AS tipo_detectado_alt,
         d.ia_dados_extraidos -> 'confianca'       AS confianca,
         d.ia_dados_extraidos -> 'motivo'          AS motivo_ia
    FROM public.qa_documentos_cliente d
   WHERE d.qa_cliente_id = 235
     AND d.created_at >= now() - interval '1 day'
   ORDER BY d.created_at DESC
) y

UNION ALL
SELECT '03_slot_da_ctps_no_processo', to_jsonb(z) FROM (
  SELECT pd.tipo_documento, pd.nome_documento, pd.status, pd.ordem,
         pd.formato_aceito, pd.regra_validacao, pd.motivo_rejeicao, pd.updated_at
    FROM public.qa_processo_documentos pd
   WHERE pd.processo_id = '3c40ff08-5377-4090-9be2-894a8b04bb43'
     AND lower(pd.tipo_documento) IN ('ctps','renda_holerite_mes_atual','renda_extrato_inss')
) z

UNION ALL
SELECT '04_alias_do_tipo_ctps', to_jsonb(w) FROM (
  SELECT * FROM public.qa_tipo_documento_aliases
   WHERE lower(alias) LIKE '%ctps%'
      OR lower(alias) LIKE '%carteira%trabalho%'
      OR lower(tipo_canonico) = 'ctps'
) w

ORDER BY 1;
