-- ============================================================================
-- A REGRA DE VALIDADE ALCANÇA A CONCESSÃO DE CR?
--
-- A regra não é por serviço, é por DOCUMENTO: `qa_preencher_validade_por_prazo_catalogo`
-- varre todo processo aberto, de qualquer serviço. Mas ela só age onde o
-- CATÁLOGO diz que o documento tem prazo (`validade_dias`). Onde o catálogo
-- está em branco, não há de onde tirar a conta — e o documento envelhece em
-- silêncio, exatamente como o cartão CNPJ do Gilson envelhecia.
--
-- Some-se a isso: `qa_processo_documentos.validade_dias` é uma CÓPIA tirada do
-- catálogo no dia em que o processo nasceu. Consertar o catálogo hoje NÃO
-- conserta processo que já existe — é o mesmo padrão que exigiu o
-- `qa_realinhar_ordem_checklist` para a ordem.
--
--   A) O catálogo da CONCESSÃO DE CR, exigência por exigência.
--   B) Onde o prazo FALTA no catálogo, em qualquer serviço, para documento que
--      claramente tem prazo (do mês, certidão, antecedentes, CNPJ/QSA,
--      comprovante de residência).
--   C) Processos JÁ ABERTOS cuja cópia está sem prazo — o que o conserto do
--      catálogo, sozinho, não alcança.
-- ============================================================================

SELECT 'A · CATÁLOGO DA CONCESSÃO DE CR' AS bloco,
       1 AS ord,
       sd.nome_documento AS origem,
       jsonb_build_object(
         'tipo',          sd.tipo_documento,
         'prazo_dias',    sd.validade_dias,
         'e_do_mes',      public.qa_documento_do_mes(sd.tipo_documento, sd.nome_documento),
         'obrigatorio',   sd.obrigatorio,
         'condicao_prof', sd.condicao_profissional,
         'ordem',         sd.ordem,
         'ativo',         sd.ativo
       ) AS dados
  FROM public.qa_servicos_documentos sd
  JOIN public.qa_servicos s ON s.id = sd.servico_id
 WHERE s.nome_servico ILIKE '%CONCESS%CR%'
   AND sd.ativo = true

UNION ALL

SELECT 'B · PRAZO FALTANDO NO CATÁLOGO' AS bloco,
       2 AS ord,
       s.nome_servico || ' · ' || sd.nome_documento AS origem,
       jsonb_build_object(
         'tipo',       sd.tipo_documento,
         'prazo_dias', sd.validade_dias,
         'e_do_mes',   public.qa_documento_do_mes(sd.tipo_documento, sd.nome_documento),
         'por_que_deveria_ter_prazo',
           CASE
             WHEN public.qa_documento_do_mes(sd.tipo_documento, sd.nome_documento)
               THEN 'documento do mês'
             WHEN lower(sd.tipo_documento) LIKE '%antecedentes%'
               OR lower(sd.tipo_documento) LIKE 'certidao%'
               THEN 'certidão de antecedentes'
             WHEN lower(sd.tipo_documento) IN ('renda_cartao_cnpj', 'renda_qsa')
               THEN 'emitido nos últimos 30 dias'
             ELSE 'comprovante de residência'
           END
       ) AS dados
  FROM public.qa_servicos_documentos sd
  JOIN public.qa_servicos s ON s.id = sd.servico_id
 WHERE sd.ativo = true
   AND sd.validade_dias IS NULL
   AND (
     public.qa_documento_do_mes(sd.tipo_documento, sd.nome_documento)
     OR lower(sd.tipo_documento) LIKE '%antecedentes%'
     OR lower(sd.tipo_documento) LIKE 'certidao%'
     OR lower(sd.tipo_documento) IN ('renda_cartao_cnpj', 'renda_qsa')
     OR lower(sd.tipo_documento) LIKE 'comprovante_residencia%'
   )

UNION ALL

SELECT 'C · PROCESSO ABERTO COM A CÓPIA SEM PRAZO' AS bloco,
       3 AS ord,
       c.nome_completo || ' · ' || p.servico_nome AS origem,
       jsonb_build_object(
         'exigencia',        pd.tipo_documento,
         'nome_documento',   pd.nome_documento,
         'status_slot',      pd.status,
         'prazo_no_processo', pd.validade_dias,
         'prazo_no_catalogo', sd.validade_dias,
         'e_do_mes',         public.qa_documento_do_mes(pd.tipo_documento, pd.nome_documento)
       ) AS dados
  FROM public.qa_processo_documentos pd
  JOIN public.qa_processos p ON p.id = pd.processo_id
  JOIN public.qa_clientes  c ON c.id = p.cliente_id
  LEFT JOIN public.qa_servicos_documentos sd
    ON sd.servico_id = p.servico_id
   AND sd.tipo_documento = pd.tipo_documento
   AND sd.ativo = true
 WHERE public.qa_processo_em_aberto(p.status)
   AND pd.validade_dias IS NULL
   AND (
     public.qa_documento_do_mes(pd.tipo_documento, pd.nome_documento)
     OR lower(pd.tipo_documento) LIKE '%antecedentes%'
     OR lower(pd.tipo_documento) LIKE 'certidao%'
     OR lower(pd.tipo_documento) IN ('renda_cartao_cnpj', 'renda_qsa')
     OR lower(pd.tipo_documento) LIKE 'comprovante_residencia%'
   )

 ORDER BY ord, origem;
