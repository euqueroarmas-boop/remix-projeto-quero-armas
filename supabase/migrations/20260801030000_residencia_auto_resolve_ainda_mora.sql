-- Corrige a pergunta de residência no fluxo inicial.
--
-- Regra: quando o cliente acabou de anexar um comprovante de residência no
-- cadastro/processo, não perguntamos "ainda mora?" no mesmo ato. Essa pergunta
-- fica reservada para recadastro posterior ou para o caso futuro de endereço
-- digitado sem comprovante anexado.

update public.qa_servicos_documentos
   set nome_documento = 'Você ainda mora no endereço do comprovante?',
       instrucoes = 'Use apenas quando o endereço foi informado sem comprovante anexado ou em recadastro posterior. No cadastro inicial com comprovante já enviado, o sistema deve resolver essa pergunta automaticamente.',
       regra_validacao = jsonb_set(
         coalesce(regra_validacao, '{}'::jsonb),
         '{opcoes}',
         '[
           {"valor":"sim","label":"SIM, AINDA MORO"},
           {"valor":"nao","label":"NÃO, JÁ MUDEI"}
         ]'::jsonb,
         true
       )
 where tipo_documento = 'pergunta_ainda_reside_imovel';

update public.qa_processo_documentos
   set nome_documento = 'Você ainda mora no endereço do comprovante?',
       instrucoes = 'Use apenas quando o endereço foi informado sem comprovante anexado ou em recadastro posterior. No cadastro inicial com comprovante já enviado, o sistema deve resolver essa pergunta automaticamente.',
       regra_validacao = jsonb_set(
         coalesce(regra_validacao, '{}'::jsonb),
         '{opcoes}',
         '[
           {"valor":"sim","label":"SIM, AINDA MORO"},
           {"valor":"nao","label":"NÃO, JÁ MUDEI"}
         ]'::jsonb,
         true
       )
 where tipo_documento = 'pergunta_ainda_reside_imovel';

with processos_com_comprovante as (
  select distinct p.id as processo_id
    from public.qa_processos p
    join public.qa_processo_documentos c on c.processo_id = p.id
   where (
       lower(coalesce(c.tipo_documento, '')) = 'comprovante_residencia'
       or lower(coalesce(c.tipo_documento, '')) like 'comprovante_endereco%'
     )
     and (
       c.arquivo_storage_key is not null
       or lower(coalesce(c.status, '')) in (
         'aprovado',
         'validado',
         'dispensado_grupo',
         'dispensado_por_reaproveitamento',
         'em_analise',
         'enviado',
         'revisao_humana',
         'em_revisao_humana'
       )
     )
),
processos_atualizados as (
  update public.qa_processos p
     set respostas_questionario_json = jsonb_set(
       coalesce(p.respostas_questionario_json, '{}'::jsonb),
       '{ainda_reside_imovel}',
       '"sim"'::jsonb,
       true
     )
    from processos_com_comprovante pc
   where p.id = pc.processo_id
     and coalesce(p.respostas_questionario_json->>'ainda_reside_imovel', '') = ''
  returning p.id
),
perguntas_dispensadas as (
  update public.qa_processo_documentos d
     set status = 'dispensado_grupo',
         observacoes = 'Auto-resolvido como SIM: comprovante de residência já anexado no cadastro/processo inicial.'
    from processos_com_comprovante pc
   where d.processo_id = pc.processo_id
     and d.tipo_documento = 'pergunta_ainda_reside_imovel'
     and lower(coalesce(d.status, '')) in (
       'pendente',
       'nao_enviado',
       'em_analise',
       'revisao_humana',
       'em_revisao_humana'
     )
  returning d.processo_id, d.id as documento_id
)
insert into public.qa_processo_eventos (
  processo_id,
  documento_id,
  tipo_evento,
  descricao,
  ator,
  dados_json
)
select
  pd.processo_id,
  pd.documento_id,
  'pergunta_auto_respondida',
  'Pergunta "ainda mora no endereço do comprovante?" auto-respondida: SIM',
  'sistema',
  jsonb_build_object(
    'chave', 'ainda_reside_imovel',
    'valor', 'sim',
    'origem', 'migration:20260801030000_residencia_auto_resolve_ainda_mora'
  )
from perguntas_dispensadas pd;
