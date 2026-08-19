-- ============================================================================
-- AUDITORIA DAS EXIGÊNCIAS DO GILSON — 20/08/2026
--
-- Pergunta a responder: ele está mesmo na etapa de EFETIVA NECESSIDADE, ou o
-- processo passou por cima de alguma exigência anterior?
--
-- Contexto que torna a pergunta relevante: a fila do cliente é ordenada por
-- grupo, e "Ocupação lícita" (ordem 50) vem ANTES de "Efetiva necessidade"
-- (ordem 80). A nota fiscal do Gilson — que é do grupo de ocupação lícita —
-- vinha sendo recusada desde 18/08.
--
-- NENHUMA destas consultas altera dado. São sete SELECTs.
--
-- Identificação usada, tirada do XML da nota dele:
--   CPF   299.341.138-13   (embutido no nome empresarial do MEI)
--   CNPJ  31.837.713/0001-38
-- ============================================================================

-- ─── 1) QUEM É O GILSON ─────────────────────────────────────────────────
-- Confirma o cadastro e devolve o `id` que amarra todo o resto.
select id, nome_completo, cpf, email, celular, customer_id,
       profissao, ocupacao_licita_cnpj, ocupacao_licita_razao_social,
       created_at
  from qa_clientes
 where regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = '29934113813'
    or regexp_replace(coalesce(ocupacao_licita_cnpj, ''), '\D', '', 'g') = '31837713000138'
    or nome_completo ilike '%GILSON DO NASCIMENTO%';


-- ─── 2) PROCESSOS E SERVIÇOS DELE ───────────────────────────────────────
-- Mostra em que etapa o processo diz que está (`etapa_liberada_ate`) e o
-- status que o cliente enxerga na aba Serviços.
with cli as (
  select id from qa_clientes
   where regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = '29934113813'
      or regexp_replace(coalesce(ocupacao_licita_cnpj, ''), '\D', '', 'g') = '31837713000138'
      or nome_completo ilike '%GILSON DO NASCIMENTO%'
)
select p.id                as processo_id,
       p.servico_nome,
       p.servico_id,
       p.status            as status_processo,
       p.etapa_liberada_ate,
       p.modalidade,
       p.condicao_profissional,
       p.pagamento_status,
       p.protocolo_numero,
       p.protocolo_data,
       p.data_criacao,
       s.status_servico,
       s.status_processo   as status_na_solicitacao,
       s.service_name
  from qa_processos p
  join cli on cli.id = p.cliente_id
  left join qa_solicitacoes_servico s on s.processo_id = p.id
 order by p.data_criacao desc;


-- ─── 3) O CHECKLIST INTEIRO, NA ORDEM ───────────────────────────────────
-- Esta é a consulta central da auditoria: toda exigência do processo, o que
-- está entregue, o que falta, e em que posição da fila cada uma está.
with cli as (
  select id from qa_clientes
   where regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = '29934113813'
      or regexp_replace(coalesce(ocupacao_licita_cnpj, ''), '\D', '', 'g') = '31837713000138'
      or nome_completo ilike '%GILSON DO NASCIMENTO%'
)
select pd.ordem,
       pd.etapa,
       pd.grupo_calculado,
       pd.tipo_documento,
       pd.nome_documento,
       pd.status,
       pd.obrigatorio,
       pd.escopo,
       pd.data_envio,
       pd.data_validacao,
       pd.data_validade,
       pd.motivo_rejeicao,
       pd.processo_id
  from (
    select pd.*,
           case
             when pd.tipo_documento ilike '%efetiva_necessidade%' then '80 efetiva_necessidade'
             when pd.tipo_documento ~ '^(renda_|nota_fiscal)'     then '50 ocupacao'
             when pd.tipo_documento ~ 'antecedent|certidao'       then '60 idoneidade'
             when pd.tipo_documento ~ 'residenc|endereco'         then '40 endereco'
             when pd.tipo_documento ~ '^(cin|rg_|cnh|foto)'       then '30 identificacao'
             when pd.tipo_documento ~ 'laudo'                     then '90 laudos'
             when pd.tipo_documento ~ 'requerimento'              then '95 requerimento'
             else 'outro'
           end as grupo_calculado
      from qa_processo_documentos pd
      join cli on cli.id = pd.cliente_id
  ) pd
 order by pd.processo_id, pd.ordem nulls last, pd.tipo_documento;


-- ─── 4) O QUE ELE JÁ ENTREGOU NO HUB ────────────────────────────────────
-- O acervo do cliente, independente de processo. Serve para ver se algum
-- documento existe aprovado no Hub sem estar amarrado à exigência.
with cli as (
  select id, customer_id from qa_clientes
   where regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = '29934113813'
      or regexp_replace(coalesce(ocupacao_licita_cnpj, ''), '\D', '', 'g') = '31837713000138'
      or nome_completo ilike '%GILSON DO NASCIMENTO%'
)
select d.created_at,
       d.tipo_documento,
       d.nome_documento,
       d.status,
       d.origem,
       d.categoria_hub,
       d.data_emissao,
       d.data_validade,
       d.motivo_reprovacao,
       d.aprovado_em,
       d.reprovado_em,
       d.arquivo_nome,
       d.arquivo_mime
  from qa_documentos_cliente d
  join cli on cli.id = d.qa_cliente_id or cli.customer_id = d.customer_id
 order by d.created_at desc;


-- ─── 5) A EFETIVA NECESSIDADE DELE ──────────────────────────────────────
-- Em que pé está o dossiê de efetiva necessidade e quando ele começou.
with cli as (
  select id from qa_clientes
   where regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = '29934113813'
      or regexp_replace(coalesce(ocupacao_licita_cnpj, ''), '\D', '', 'g') = '31837713000138'
      or nome_completo ilike '%GILSON DO NASCIMENTO%'
)
select e.created_at,
       e.processo_id,
       e.status,
       e.aprovado_cliente,
       e.aprovado_cliente_em,
       e.aprovado_em,
       e.enviado_equipe_em,
       e.teses_geradas_em,
       e.narrativa_gerada_em,
       e.dossie_gerado_em,
       e.exames_liberados_em,
       e.tem_bo,
       e.bo_pendente_registro,
       e.devolucao_motivo
  from qa_efetiva_necessidade e
  join cli on cli.id = e.cliente_id
 order by e.created_at desc;


-- ─── 6) A ORDEM CANÔNICA DO SERVIÇO ─────────────────────────────────────
-- O que o catálogo do serviço manda pedir, e em que ordem. Comparar com a
-- consulta 3 mostra se o checklist do processo saiu do catálogo torto.
with cli as (
  select id from qa_clientes
   where regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = '29934113813'
      or regexp_replace(coalesce(ocupacao_licita_cnpj, ''), '\D', '', 'g') = '31837713000138'
      or nome_completo ilike '%GILSON DO NASCIMENTO%'
),
serv as (
  select distinct p.servico_id
    from qa_processos p join cli on cli.id = p.cliente_id
   where p.servico_id is not null
)
select sd.servico_id,
       sd.ordem,
       sd.etapa,
       sd.grupo_id,
       sd.tipo_documento,
       sd.nome_documento,
       sd.obrigatorio,
       sd.escopo,
       sd.ativo,
       sd.condicao_profissional,
       sd.condicao_modalidade
  from qa_servicos_documentos sd
  join serv on serv.servico_id = sd.servico_id
 order by sd.servico_id, sd.ordem;


-- ─── 7) TUDO O QUE FOI RECUSADO NA PORTA ────────────────────────────────
-- A trilha das tentativas bloqueadas — inclusive as recusas de anexo, que
-- passaram a ser registradas em 19/08. Mostra nome e tipo do arquivo.
with cli as (
  select id, customer_id from qa_clientes
   where regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = '29934113813'
      or regexp_replace(coalesce(ocupacao_licita_cnpj, ''), '\D', '', 'g') = '31837713000138'
      or nome_completo ilike '%GILSON DO NASCIMENTO%'
)
select e.created_at,
       e.acao,
       e.ator_tipo,
       e.detalhes->>'codigo'          as codigo,
       e.detalhes->>'tipo_pretendido' as tipo_pretendido,
       e.detalhes->>'tipo_lido'       as tipo_lido,
       e.detalhes->>'exigencia_alvo'  as exigencia_alvo,
       e.detalhes->>'arquivo_nome'    as arquivo_nome,
       e.detalhes->>'arquivo_mime'    as arquivo_mime,
       e.detalhes->>'arquivo_tamanho' as arquivo_tamanho,
       e.detalhes->>'motivo'          as motivo
  from qa_documentos_cliente_eventos e
  join cli on cli.id = e.qa_cliente_id or cli.customer_id = e.customer_id
 order by e.created_at desc
 limit 200;
