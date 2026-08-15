-- ============================================================================
-- OCUPAÇÃO LÍCITA — CLT passa a exigir o extrato CNIS (INSS)
-- ----------------------------------------------------------------------------
-- CAUSA RAIZ: o botão de condição profissional promete, para CLT, "Holerite +
-- CTPS Digital + Extrato INSS", e a lista embutida em qa-processo-set-condicao
-- traz os três. Só que o CATÁLOGO manda: a lista embutida só é usada quando o
-- serviço não tem NENHUMA exigência cadastrada para a condição. Como os
-- serviços de defesa pessoal já têm holerite + CTPS para `clt`, nenhum cliente
-- CLT recebia o pedido do CNIS.
--
-- Aqui o catálogo passa a pedir o extrato, na mesma etapa e logo depois do
-- holerite do próprio serviço — sem tocar em nenhuma outra condição: o item
-- nasce com `condicao_profissional = 'clt'` mesmo quando o holerite do serviço
-- atende várias condições ao mesmo tempo (ex.: 'clt,funcionario_publico').
--
-- Idempotente: só insere em serviço que ainda não tem `renda_extrato_inss`,
-- e uma única linha por serviço (DISTINCT ON) mesmo com holerite duplicado.
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
