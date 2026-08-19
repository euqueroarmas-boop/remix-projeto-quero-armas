-- ============================================================================
-- AUDITORIA DAS EXIGÊNCIAS DO GILSON — 20/08/2026
--
-- Pergunta a responder: ele está mesmo na etapa de EFETIVA NECESSIDADE, ou o
-- processo passou por cima de alguma exigência anterior?
--
-- POR QUE É UMA CONSULTA SÓ, E NÃO SETE.
-- A primeira versão deste arquivo trazia sete SELECTs em sequência. O SQL
-- Editor do Supabase executa todos, mas EXIBE E EXPORTA apenas o resultado do
-- último — então o pedido voltou duas vezes com a mesma tabela, e as seis
-- primeiras respostas nunca chegaram. Aqui tudo vem num único resultado:
-- a coluna `bloco` diz de onde cada linha veio e `dados` traz a linha inteira
-- em JSON.
--
-- NÃO ALTERA DADO NENHUM. É um SELECT.
--
-- Identificação usada, tirada do XML da nota dele:
--   CPF   299.341.138-13   (embutido no nome empresarial do MEI)
--   CNPJ  31.837.713/0001-38
-- ============================================================================

with cli as (
  select id, customer_id
    from qa_clientes
   where regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = '29934113813'
      or regexp_replace(coalesce(ocupacao_licita_cnpj, ''), '\D', '', 'g') = '31837713000138'
      or nome_completo ilike '%GILSON DO NASCIMENTO%'
),
serv as (
  select distinct p.servico_id
    from qa_processos p
    join cli on cli.id = p.cliente_id
   where p.servico_id is not null
)

-- 1) QUEM É ELE
select 1 as bloco, 0 as ord, 'cliente' as origem, to_jsonb(t) as dados
  from (
    select c.id, c.nome_completo, c.cpf, c.email, c.celular, c.customer_id,
           c.profissao, c.ocupacao_licita_cnpj, c.ocupacao_licita_razao_social,
           c.created_at
      from qa_clientes c
      join cli on cli.id = c.id
  ) t

union all

-- 2) PROCESSOS: em que etapa o sistema diz que ele está
select 2, 0, 'processo', to_jsonb(t)
  from (
    select p.id as processo_id, p.servico_nome, p.servico_id,
           p.status as status_processo, p.etapa_liberada_ate,
           p.modalidade, p.condicao_profissional, p.pagamento_status,
           p.protocolo_numero, p.protocolo_data, p.data_criacao,
           s.status_servico, s.status_processo as status_solicitacao
      from qa_processos p
      join cli on cli.id = p.cliente_id
      left join qa_solicitacoes_servico s on s.processo_id = p.id
  ) t

union all

-- 3) O CHECKLIST INTEIRO, NA ORDEM — o coração da auditoria
select 3, coalesce(pd.ordem, 9999), 'exigencia', to_jsonb(pd)
  from (
    select pd.ordem, pd.etapa, pd.tipo_documento, pd.nome_documento,
           pd.status, pd.obrigatorio, pd.escopo,
           pd.data_envio, pd.data_validacao, pd.data_validade,
           pd.motivo_rejeicao, pd.processo_id
      from qa_processo_documentos pd
      join cli on cli.id = pd.cliente_id
  ) pd

union all

-- 4) O ACERVO DO HUB
select 4, 0, 'hub', to_jsonb(t)
  from (
    select d.created_at, d.tipo_documento, d.nome_documento, d.status,
           d.origem, d.categoria_hub, d.data_emissao, d.data_validade,
           d.motivo_reprovacao, d.aprovado_em, d.reprovado_em,
           d.arquivo_nome, d.arquivo_mime
      from qa_documentos_cliente d
      join cli on cli.id = d.qa_cliente_id or cli.customer_id = d.customer_id
  ) t

union all

-- 5) A EFETIVA NECESSIDADE
select 5, 0, 'efetiva', to_jsonb(t)
  from (
    select e.created_at, e.processo_id, e.status, e.aprovado_cliente,
           e.aprovado_cliente_em, e.aprovado_em, e.enviado_equipe_em,
           e.teses_geradas_em, e.narrativa_gerada_em, e.dossie_gerado_em,
           e.exames_liberados_em, e.tem_bo, e.bo_pendente_registro,
           e.devolucao_motivo
      from qa_efetiva_necessidade e
      join cli on cli.id = e.cliente_id
  ) t

union all

-- 6) A ORDEM CANÔNICA DO SERVIÇO — para comparar com o bloco 3
select 6, sd.ordem, 'catalogo', to_jsonb(sd)
  from (
    select sd.servico_id, sd.ordem, sd.etapa, sd.grupo_id, sd.tipo_documento,
           sd.nome_documento, sd.obrigatorio, sd.escopo, sd.ativo,
           sd.condicao_profissional, sd.condicao_modalidade
      from qa_servicos_documentos sd
      join serv on serv.servico_id = sd.servico_id
  ) sd

order by 1, 2;
