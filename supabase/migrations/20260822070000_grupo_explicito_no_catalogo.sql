-- =============================================================================
-- GRUPO EXPLÍCITO NO CATÁLOGO (22/08/2026) — autorizado pelo titular.
--
-- Cerca de 240 linhas ativas do catálogo (qa_servicos_documentos) estão sem
-- `regra_validacao.grupo_checklist`. Sem esse campo, cada tela adivinha o grupo
-- pelo nome do tipo — e as três telas adivinham por regras diferentes (o painel
-- em SQL, o checklist em TypeScript, o pop-up de pendências em outro lugar).
-- Foi assim que o extrato do INSS do Igor ficou fora da Ocupação Lícita.
--
-- Aqui o grupo passa a ficar GRAVADO na linha. A regra base é a mesma que o
-- painel já usa hoje, mais sete correções onde a adivinhação erra:
--   ctps                                     -> ocupacao      (Carteira de Trabalho)
--   nota_fiscal_da_arma                      -> arma          (o "%nota_fiscal%" jogava em ocupação)
--   autorizacao                              -> arma
--   comprovante_filiacao_entidade_tiro       -> habitualidade
--   dsa_declaracao_seguranca_acervo          -> declaracoes
--   declaracao_endereco_acervo               -> declaracoes
--   declaracao_sem_inquerito_processo_criminal -> declaracoes
--
-- Só toca linha ATIVA e SEM grupo. Nenhum documento já entregue é alterado,
-- nenhum checklist é remontado.
-- =============================================================================

WITH alvo AS (
  SELECT sd.id,
         CASE
           -- correções explícitas (a adivinhação erra nestes)
           WHEN lower(sd.tipo_documento) = 'ctps'                                       THEN 'ocupacao'
           WHEN lower(sd.tipo_documento) = 'nota_fiscal_da_arma'                        THEN 'arma'
           WHEN lower(sd.tipo_documento) = 'autorizacao'                                THEN 'arma'
           WHEN lower(sd.tipo_documento) = 'comprovante_filiacao_entidade_tiro'         THEN 'habitualidade'
           WHEN lower(sd.tipo_documento) = 'dsa_declaracao_seguranca_acervo'            THEN 'declaracoes'
           WHEN lower(sd.tipo_documento) = 'declaracao_endereco_acervo'                 THEN 'declaracoes'
           WHEN lower(sd.tipo_documento) = 'declaracao_sem_inquerito_processo_criminal' THEN 'declaracoes'
           -- regra base: idêntica à do painel
           WHEN lower(sd.tipo_documento) IN ('declaracao_necessidade_efetiva','comprovante_efetiva_necessidade')
             OR lower(sd.tipo_documento) LIKE '%efetiva_necessidade%'                   THEN 'efetiva_necessidade'
           WHEN lower(sd.tipo_documento) LIKE 'renda%'
             OR lower(sd.tipo_documento) LIKE '%ocupacao%'
             OR lower(sd.tipo_documento) LIKE '%contracheque%'
             OR lower(sd.tipo_documento) LIKE '%cnpj%'
             OR lower(sd.tipo_documento) LIKE '%nota_fiscal%'
             OR lower(sd.tipo_documento) LIKE '%identidade_funcional%'                  THEN 'ocupacao'
           WHEN lower(sd.tipo_documento) LIKE 'certidao%'
             OR lower(sd.tipo_documento) LIKE 'antecedentes%'                           THEN 'antecedentes'
           WHEN lower(sd.tipo_documento) LIKE '%laudo%'
             OR lower(sd.tipo_documento) LIKE '%psicologic%'
             OR lower(sd.tipo_documento) LIKE '%capacidade_tecnica%'
             OR lower(sd.tipo_documento) LIKE 'exame%'                                  THEN 'laudos'
           WHEN lower(sd.tipo_documento) LIKE 'requerimento%'                           THEN 'requerimento'
           WHEN lower(sd.tipo_documento) LIKE 'pergunta%'                               THEN 'perguntas'
           WHEN lower(sd.tipo_documento) LIKE '%endereco%'
             OR lower(sd.tipo_documento) LIKE '%residencia%'
             OR lower(sd.tipo_documento) LIKE '%titular_comprovante%'
             OR lower(sd.tipo_documento) = 'documento_identificacao_terceiro'           THEN 'endereco'
           WHEN lower(sd.tipo_documento) IN ('cin','rg','rg_com_cpf','cnh','cpf','passaporte','foto','foto_3x4')
                                                                                        THEN 'identificacao'
           ELSE 'outros'
         END AS grupo
    FROM public.qa_servicos_documentos sd
   WHERE sd.ativo
     AND (sd.regra_validacao ->> 'grupo_checklist') IS NULL
)
UPDATE public.qa_servicos_documentos sd
   SET regra_validacao = jsonb_set(
         COALESCE(sd.regra_validacao, '{}'::jsonb), '{grupo_checklist}', to_jsonb(a.grupo), true)
  FROM alvo a
 WHERE sd.id = a.id;
