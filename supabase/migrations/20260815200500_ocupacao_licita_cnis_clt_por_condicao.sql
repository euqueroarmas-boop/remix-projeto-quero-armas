-- ============================================================================
-- OCUPAÇÃO LÍCITA — CNIS para CLT: corrige o alcance da migration anterior
-- ----------------------------------------------------------------------------
-- ERRO da 20260815194500: o NOT EXISTS olhava só (servico_id, tipo_documento),
-- sem a condição profissional. Só que `renda_extrato_inss` é usado por DUAS
-- condições com documentos diferentes:
--
--   clt        -> Extrato completo de contribuições do INSS (CNIS)
--   aposentado -> Extrato de benefício do INSS (Meu INSS)
--
-- Nos serviços que já tinham a linha de APOSENTADO (2 parcialmente, 36, 37, 41,
-- 48 e 60 — este último o de AUTORIZAÇÃO DE COMPRA), o NOT EXISTS bloqueou a
-- inserção e o CLT continuou sem CNIS. Pior: quem explode o checklist casa por
-- tipo_documento, então o processo CLT recebia o texto do aposentado.
--
-- Aqui a checagem passa a ser por CONDIÇÃO: insere a linha de CLT onde ela
-- falta, convivendo com a linha de aposentado do mesmo tipo (a explosão filtra
-- por condição antes de escolher, então cada processo recebe a sua).
--
-- Idempotente: nos serviços onde a 20260815194500 já criou a linha CLT (32, 35)
-- nada é inserido.
-- ============================================================================

WITH base AS (
  SELECT DISTINCT ON (h.servico_id)
         h.servico_id,
         h.etapa,
         h.ordem,
         h.prazo_recomendado_dias,
         h.formato_aceito
    FROM public.qa_servicos_documentos h
   WHERE h.tipo_documento = 'renda_holerite_mes_atual'
     AND h.ativo
     AND 'clt' = ANY (
           string_to_array(
             lower(replace(COALESCE(h.condicao_profissional, ''), ' ', '')), ','
           )
         )
     AND NOT EXISTS (
           SELECT 1
             FROM public.qa_servicos_documentos x
            WHERE x.servico_id = h.servico_id
              AND x.tipo_documento = 'renda_extrato_inss'
              AND 'clt' = ANY (
                    string_to_array(
                      lower(replace(COALESCE(x.condicao_profissional, ''), ' ', '')), ','
                    )
                  )
         )
   ORDER BY h.servico_id, h.ordem
)
INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo,
  condicao_profissional, link_emissao, orgao_emissor, instrucoes,
  observacoes_cliente, prazo_recomendado_dias, formato_aceito, regra_validacao
)
SELECT b.servico_id,
       'renda_extrato_inss',
       'Extrato completo de contribuições do INSS (CNIS)',
       b.etapa,
       true,
       b.ordem + 1,
       true,
       'clt',
       'https://meu.inss.gov.br/',
       'INSS',
       E'1) Acesse Meu INSS com login gov.br.\n2) Menu "Extrato de Contribuição (CNIS)" > Baixar PDF.\n3) Envie o PDF completo, sem cortar páginas.',
       'Envie o PDF gerado pelo próprio Meu INSS — print de tela não é aceito.',
       b.prazo_recomendado_dias,
       COALESCE(b.formato_aceito, ARRAY['pdf','jpg','jpeg','png']),
       jsonb_build_object(
         'label_botao', 'Emitir Extrato INSS',
         'objetivo_documental', 'comprovar_ocupacao_licita',
         'checklist_operador', jsonb_build_array(
           'Verificar se é o CNIS oficial',
           'Conferir CPF e nome completo',
           'Confirmar vínculo ativo recente'
         )
       )
  FROM base b;

-- ----------------------------------------------------------------------------
-- REGRA: CNIS é OBRIGATÓRIO quando a condição é CLT.
-- Vale para as linhas que já existiam no catálogo, não só para as criadas
-- acima — CLT sem CNIS é dossiê incompleto, não item opcional.
-- Não toca nas linhas de outras condições (aposentado segue como está).
-- ----------------------------------------------------------------------------
UPDATE public.qa_servicos_documentos
   SET obrigatorio = true,
       updated_at = now()
 WHERE tipo_documento = 'renda_extrato_inss'
   AND obrigatorio IS DISTINCT FROM true
   AND 'clt' = ANY (
         string_to_array(
           lower(replace(COALESCE(condicao_profissional, ''), ' ', '')), ','
         )
       );

-- Processos CLT em andamento: o item já criado também passa a ser obrigatório.
UPDATE public.qa_processo_documentos d
   SET obrigatorio = true,
       updated_at = now()
  FROM public.qa_processos p
 WHERE p.id = d.processo_id
   AND lower(COALESCE(p.condicao_profissional, '')) = 'clt'
   AND d.tipo_documento = 'renda_extrato_inss'
   AND d.obrigatorio IS DISTINCT FROM true;
