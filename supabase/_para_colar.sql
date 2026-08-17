-- ############################################################################
-- PARA COLAR NO SQL EDITOR DO SUPABASE — Bloco 10 (17/08/2026)
-- ----------------------------------------------------------------------------
-- Certidoes da JUSTICA FEDERAL valem 90 dias. Os seis TRFs regionais estavam
-- cadastrados com 30, e desde que o catalogo passou a mandar na regua de cores
-- eles viraram "ciclo curto" (verde ate 10 dias) — errado.
-- Reexecutavel.
-- ############################################################################

-- 1) TRFs regionais (1 a 6): 30 -> 90 dias.
UPDATE public.qa_validade_documentos
   SET validade_dias = 90, unidade = 'dias'
 WHERE tipo_documento IN (
   'antecedentes_federal_trf1_regional',
   'antecedentes_federal_trf2_regional',
   'antecedentes_federal_trf3_regional',
   'antecedentes_federal_trf4_regional',
   'antecedentes_federal_trf5_regional',
   'antecedentes_federal_trf6_regional'
 );

-- 2) Distribuicao criminal da Justica Federal (generica, sem regiao no codigo).
--    E emitida pela MESMA Justica Federal dos TRFs, entao deve ser 90 tambem —
--    e o resto do catalogo ja concorda: certidao_antecedente_federal,
--    certidao_justica_federal e certidao_negativa_jf estao todas com 90.
--    Se na sua operacao esta especifica for de 30 dias, NAO rode este comando.
UPDATE public.qa_validade_documentos
   SET validade_dias = 90, unidade = 'dias'
 WHERE tipo_documento = 'antecedentes_federal';

-- ############################################################################
-- CONFERENCIA — as 8 linhas devem sair com 90 dias / regua padrao.
-- ############################################################################
SELECT tipo_documento,
       validade_dias,
       unidade,
       CASE
         WHEN perpetuo OR validade_dias <= 0 THEN 'sem vencimento'
         WHEN (CASE WHEN unidade = 'meses' THEN validade_dias * 30 ELSE validade_dias END) <= 31
           THEN 'CICLO CURTO (30/9/4)  <-- ERRADO PARA FEDERAL'
         ELSE 'regua padrao (30/10)'
       END AS regua_aplicada
FROM public.qa_validade_documentos
WHERE tipo_documento LIKE 'antecedentes_federal%'
ORDER BY tipo_documento;
