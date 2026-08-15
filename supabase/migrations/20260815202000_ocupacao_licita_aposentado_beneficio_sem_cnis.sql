-- ============================================================================
-- OCUPAÇÃO LÍCITA — INSS emite DOIS documentos, um por condição
-- ----------------------------------------------------------------------------
--   CLT        -> extrato de CONTRIBUIÇÃO (CNIS)          -> renda_extrato_inss
--   Aposentado -> extrato de PAGAMENTO do benefício        -> renda_comprovante_beneficio
--
-- Regra confirmada pelo Will em 15/08/2026:
--   - CNIS NÃO entra para aposentado;
--   - comprovante de benefício é OBRIGATÓRIO para aposentado.
--
-- O catálogo cadastrou o extrato de benefício do aposentado sob o tipo
-- `renda_extrato_inss` (tipo de contribuição com nome de benefício) em paralelo
-- à linha correta `renda_comprovante_beneficio`. Resultado no processo do
-- cliente PEDRO LOBATO (b86f3f43): duas exigências obrigatórias para o MESMO
-- documento, as duas entregues.
--
-- Ordem importa: primeiro garante o documento certo, depois desliga o errado —
-- nunca o inverso, para nenhum aposentado ficar sem comprovar renda.
-- ============================================================================

-- 1) Garante o comprovante de benefício onde o serviço só tinha a linha errada.
WITH base AS (
  SELECT DISTINCT ON (e.servico_id)
         e.servico_id, e.etapa, e.ordem, e.prazo_recomendado_dias, e.formato_aceito
    FROM public.qa_servicos_documentos e
   WHERE e.tipo_documento = 'renda_extrato_inss'
     AND e.ativo
     AND lower(btrim(COALESCE(e.condicao_profissional, ''))) = 'aposentado'
     AND NOT EXISTS (
           SELECT 1
             FROM public.qa_servicos_documentos x
            WHERE x.servico_id = e.servico_id
              AND x.tipo_documento = 'renda_comprovante_beneficio'
              AND 'aposentado' = ANY (
                    string_to_array(
                      lower(replace(COALESCE(x.condicao_profissional, ''), ' ', '')), ','
                    )
                  )
         )
   ORDER BY e.servico_id, e.ordem
)
INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo,
  condicao_profissional, link_emissao, orgao_emissor, instrucoes,
  observacoes_cliente, prazo_recomendado_dias, formato_aceito, regra_validacao
)
SELECT b.servico_id,
       'renda_comprovante_beneficio',
       'Comprovante de pagamento do benefício (último mês)',
       b.etapa,
       true,
       b.ordem,
       true,
       'aposentado',
       'https://meu.inss.gov.br/',
       'INSS',
       E'1) Acesse Meu INSS com login gov.br.\n2) Menu "Extrato de Pagamento de Benefício" > baixe o PDF do mês atual.\n3) Envie o PDF completo.',
       'É o extrato de PAGAMENTO do benefício — não confunda com o extrato de contribuições (CNIS), que é para quem trabalha com carteira assinada.',
       b.prazo_recomendado_dias,
       COALESCE(b.formato_aceito, ARRAY['pdf','jpg','jpeg','png']),
       jsonb_build_object(
         'label_botao', 'Emitir Comprovante',
         'objetivo_documental', 'comprovar_ocupacao_licita',
         'checklist_operador', jsonb_build_array(
           'Conferir nome e CPF',
           'Conferir número do benefício',
           'Verificar data do extrato'
         )
       )
  FROM base b;

-- 2) REGRA: comprovante de benefício é obrigatório para aposentado.
UPDATE public.qa_servicos_documentos
   SET obrigatorio = true,
       updated_at = now()
 WHERE tipo_documento = 'renda_comprovante_beneficio'
   AND obrigatorio IS DISTINCT FROM true
   AND 'aposentado' = ANY (
         string_to_array(
           lower(replace(COALESCE(condicao_profissional, ''), ' ', '')), ','
         )
       );

-- 3) REGRA: CNIS não entra para aposentado — desliga a linha do tipo errado.
--    Só as linhas exclusivas de aposentado; condição composta (ex.: 'clt,
--    aposentado') fica de fora e sai no diagnóstico para tratamento manual.
UPDATE public.qa_servicos_documentos
   SET ativo = false,
       updated_at = now()
 WHERE tipo_documento = 'renda_extrato_inss'
   AND ativo
   AND lower(btrim(COALESCE(condicao_profissional, ''))) = 'aposentado';

-- 4) Processos de aposentados em andamento: a exigência de CNIS deixa de valer.
--    `nao_aplicavel` em vez de DELETE — o item do Pedro já está entregue e o
--    vínculo com o arquivo do Hub tem que sobreviver à correção.
UPDATE public.qa_processo_documentos d
   SET status = 'nao_aplicavel',
       observacoes = COALESCE(d.observacoes || E'\n', '') ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI') ||
         '] CNIS não se aplica a aposentado — o documento de renda dele é o comprovante de pagamento do benefício.',
       updated_at = now()
  FROM public.qa_processos p
 WHERE p.id = d.processo_id
   AND lower(COALESCE(p.condicao_profissional, '')) = 'aposentado'
   AND d.tipo_documento = 'renda_extrato_inss'
   AND d.status <> 'nao_aplicavel';

-- 5) Processos de aposentados: comprovante de benefício obrigatório.
UPDATE public.qa_processo_documentos d
   SET obrigatorio = true,
       updated_at = now()
  FROM public.qa_processos p
 WHERE p.id = d.processo_id
   AND lower(COALESCE(p.condicao_profissional, '')) = 'aposentado'
   AND d.tipo_documento = 'renda_comprovante_beneficio'
   AND d.obrigatorio IS DISTINCT FROM true;
