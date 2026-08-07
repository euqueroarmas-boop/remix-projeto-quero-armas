-- =============================================================================
-- BLOCO 2D de 7 — CERTIDÕES: a certidão militar estadual passa a nomear o
--                            tribunal e o estado
--
-- Pedido do usuário (07/08/2026): "gostaria que em documentos aparecesse dessa
-- forma: Tribunal de Justiça Militar e o estado que pertence, no caso, São
-- Paulo."
--
-- Hoje o Hub exibe "Certidão Criminal Militar", com "TJM SP" apenas no
-- subtítulo. É genérico demais para um documento que só existe em TRÊS estados
-- (SP, MG e RS) e que não pode ser substituído pelo de outro estado.
--
-- O nome passa a seguir o padrão que o próprio Hub já usa nas federais
-- ("Certidão de Distribuição Criminal — Seção Judiciária de São Paulo e
-- JEF/SP"): o tipo da certidão, um travessão, e o órgão com o estado.
--
-- O estado é DERIVADO, não fixado em São Paulo: o sistema atende SP, MG e RS,
-- e chumbar SP faria o cliente mineiro ler o nome errado. A detecção olha o
-- órgão emissor, o nome do arquivo e o texto extraído pela IA; se nada disso
-- resolver, cai para o estado do cadastro do cliente.
--
-- O catálogo é dividido em três linhas, uma por estado — mesmo padrão que a
-- 20260730160000 usou para as seis regiões da Justiça Federal. O tipo continua
-- sendo UM só (`antecedentes_militar_estadual`): muda o tribunal que emite,
-- não a espécie do documento. Como cada linha carrega `condicao_uf`, só a do
-- estado do cliente entra no checklist dele.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── Mapa dos três tribunais ─────────────────────────────────────────────
CREATE TEMP TABLE _tjm (uf char(2) PRIMARY KEY, estado text, nome_doc text, orgao text) ON COMMIT DROP;

INSERT INTO _tjm (uf, estado, nome_doc, orgao) VALUES
  ('SP', 'São Paulo',
   'Certidão Criminal — Tribunal de Justiça Militar de São Paulo',
   'Tribunal de Justiça Militar do Estado de São Paulo'),
  ('MG', 'Minas Gerais',
   'Certidão Criminal — Tribunal de Justiça Militar de Minas Gerais',
   'Tribunal de Justiça Militar do Estado de Minas Gerais'),
  ('RS', 'Rio Grande do Sul',
   'Certidão Criminal — Tribunal de Justiça Militar do Rio Grande do Sul',
   'Tribunal de Justiça Militar do Estado do Rio Grande do Sul');

-- ─── 1) Documentos já no Hub ─────────────────────────────────────────────
-- A UF sai do que o documento diz sobre si mesmo; o cadastro é só o último
-- recurso, porque o cliente pode ter emitido a certidão em outro estado.
WITH docs AS (
  SELECT dc.id,
         COALESCE(
           (SELECT t.uf FROM _tjm t
             WHERE upper(unaccent(
                     COALESCE(dc.orgao_emissor,'') || ' ' ||
                     COALESCE(dc.arquivo_nome,'')  || ' ' ||
                     COALESCE(dc.ia_dados_extraidos::text,'')
                   )) ~ ('(TJM[ /-]*' || t.uf || '|MILITAR[A-Z ]*' || upper(unaccent(t.estado)) || ')')
             LIMIT 1),
           NULLIF(upper(btrim(cl.estado)), '')
         ) AS uf_detectada
    FROM public.qa_documentos_cliente dc
    LEFT JOIN public.qa_clientes cl ON cl.id = dc.qa_cliente_id
   WHERE dc.tipo_documento = 'antecedentes_militar_estadual'
)
UPDATE public.qa_documentos_cliente dc
   SET nome_documento = t.nome_doc,
       orgao_emissor  = t.orgao,
       updated_at     = now()
  FROM docs d
  JOIN _tjm t ON t.uf = d.uf_detectada
 WHERE dc.id = d.id
   AND dc.nome_documento IS DISTINCT FROM t.nome_doc;

-- ─── 2) Biblioteca ───────────────────────────────────────────────────────
-- Aqui o nome fica genérico de propósito: a biblioteca descreve a ESPÉCIE do
-- documento, e ela é a mesma nos três estados.
UPDATE public.qa_documentos_biblioteca
   SET nome = 'Certidão Criminal — Tribunal de Justiça Militar (TJM)',
       descricao_o_que_e = 'Certidão criminal do Tribunal de Justiça Militar do estado. '
                        || 'Existe apenas em São Paulo, Minas Gerais e Rio Grande do Sul.',
       observacao_cliente = 'Não substitui a certidão do STM, que é da Justiça Militar da União. '
                         || 'A certidão de um estado não vale para outro.',
       updated_at = now()
 WHERE codigo = 'antecedentes_militar_estadual';

-- ─── 3) Catálogo: uma linha por estado ───────────────────────────────────
-- Clona a linha existente para MG e RS antes de renomear a original para SP,
-- para que as três nasçam com a mesma etapa, ordem e obrigatoriedade.
INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, ordem, obrigatorio,
  obrigatorio_etapa02, emissor, escopo, formato_aceito, validade_dias,
  instrucoes, observacoes_cliente, orgao_emissor, prazo_recomendado_dias,
  condicao_profissional, condicao_uf, link_emissao, biblioteca_id, ativo
)
SELECT sd.servico_id, sd.tipo_documento, t.nome_doc, sd.etapa, sd.ordem, sd.obrigatorio,
       sd.obrigatorio_etapa02, sd.emissor, sd.escopo, sd.formato_aceito, sd.validade_dias,
       sd.instrucoes, sd.observacoes_cliente, t.orgao, sd.prazo_recomendado_dias,
       sd.condicao_profissional, ARRAY[t.uf]::text[], sd.link_emissao, sd.biblioteca_id, sd.ativo
  FROM public.qa_servicos_documentos sd
 CROSS JOIN _tjm t
 WHERE sd.tipo_documento = 'antecedentes_militar_estadual'
   AND t.uf <> 'SP'
   AND NOT EXISTS (
     SELECT 1 FROM public.qa_servicos_documentos x
      WHERE x.servico_id = sd.servico_id
        AND x.tipo_documento = 'antecedentes_militar_estadual'
        AND x.condicao_uf = ARRAY[t.uf]::text[]
        AND COALESCE(x.condicao_profissional,'') = COALESCE(sd.condicao_profissional,'')
   );

-- A linha original vira a de São Paulo.
UPDATE public.qa_servicos_documentos
   SET nome_documento = (SELECT nome_doc FROM _tjm WHERE uf = 'SP'),
       orgao_emissor  = (SELECT orgao    FROM _tjm WHERE uf = 'SP'),
       condicao_uf    = ARRAY['SP']::text[],
       updated_at     = now()
 WHERE tipo_documento = 'antecedentes_militar_estadual'
   AND (condicao_uf IS NULL OR condicao_uf @> ARRAY['SP']::text[])
   AND COALESCE(array_length(condicao_uf, 1), 0) <> 1;

-- ─── 4) Exigências já montadas ───────────────────────────────────────────
-- O checklist do cliente passa a dizer qual tribunal ele precisa procurar.
UPDATE public.qa_processo_documentos pd
   SET nome_documento = t.nome_doc,
       orgao_emissor  = t.orgao,
       updated_at     = now()
  FROM public.qa_processos p
  JOIN public.qa_clientes cl ON cl.id = p.cliente_id
  JOIN _tjm t ON t.uf = upper(btrim(COALESCE(cl.estado, '')))
 WHERE pd.processo_id = p.id
   AND pd.tipo_documento = 'antecedentes_militar_estadual'
   AND pd.nome_documento IS DISTINCT FROM t.nome_doc;

COMMIT;
