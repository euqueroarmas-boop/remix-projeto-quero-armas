-- ============================================================================
-- CONFERÊNCIA — serviços de Autorização de Compra (50), Compra/Posse Defesa
-- Pessoal (60) e Concessão de CR (44)
-- ----------------------------------------------------------------------------
-- Cola tudo de uma vez no SQL Editor e devolve os SETE resultados. Cada bloco
-- responde uma pergunta que o repositório não consegue responder sozinho
-- (migration só entra em produção colada à mão).
--
-- A consulta 5 (processos abertos do serviço 50) JÁ FOI respondida em
-- 21/08/2026: voltaram 2 processos — Rivelino (13 exigências, deferido) e
-- LEO DA SILVA SOUZA (34 exigências, aguardando_documentos). As demais
-- continuam pendentes.
-- ============================================================================

-- ── 1) Leva 11 aplicada? Erro de coluna inexistente = migration
--       20260820120000_gru_espera_peca_aprovada NÃO aplicada.
SELECT servico_id, slug, nome, exige_peca_defesa
  FROM public.qa_servicos_catalogo
 WHERE gera_processo
 ORDER BY servico_id;

-- ── 1b) Trigger que barra protocolo sem peça de defesa. 0 linhas = não aplicado.
SELECT tgname FROM pg_trigger WHERE tgname = 'qa_trg_trava_protocolo_sem_defesa';

-- ── 2) Perguntas do serviço 50 nasceram com chave? Esperado: 6 linhas, TODAS
--       com chave preenchida. Chave NULL = pergunta quebrada no portal.
SELECT tipo_documento,
       regra_validacao ->> 'chave'  AS chave,
       regra_validacao -> 'opcoes'  AS opcoes
  FROM public.qa_servicos_documentos
 WHERE servico_id = 50 AND ativo AND tipo_documento LIKE 'pergunta\_%' ESCAPE '\'
 ORDER BY ordem;

-- ── 3) Validade da certidão da Justiça Militar (STM) nos três serviços.
--       Esperado 90 nos três. Se o 50 vier 30, é o defeito relatado.
SELECT servico_id, tipo_documento, nome_documento, validade_dias
  FROM public.qa_servicos_documentos
 WHERE ativo AND tipo_documento = 'antecedentes_militar'
   AND servico_id IN (44, 50, 60)
 ORDER BY servico_id;

-- ── 4) Família de migrations de prazo de 19/08 chegou ao banco?
--       0 linhas = não aplicada.
SELECT p.proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('qa_realinhar_validade_dias_checklist',
                     'qa_manutencao_validade_documentos');

-- ── 4b) Tabela única de validade de certidões. NULL = 20260819140000 não aplicada.
SELECT to_regclass('public.qa_prazo_certidao') AS tabela_prazo_certidao;

-- ── 6) NOVA (por causa do resultado da 5): o catálogo do serviço 50 hoje.
--       Preciso dela para saber se as 34 exigências do LEO batem com o
--       catálogo novo ou se sobrou item duplicado/errado.
SELECT ordem, etapa, tipo_documento, nome_documento, obrigatorio,
       validade_dias, regra_validacao ->> 'grupo_checklist' AS grupo,
       condicao_profissional, condicao_uf
  FROM public.qa_servicos_documentos
 WHERE servico_id = 50 AND ativo
 ORDER BY ordem;

-- ── 7) NOVA: quando cada processo do serviço 50 nasceu, para separar o que é
--       processo novo (checklist novo) do que é legado.
SELECT p.id, cl.nome_completo, p.status, p.created_at, p.protocolo_data,
       p.protocolo_numero, p.protocolo_orgao,
       (SELECT count(*) FROM public.qa_processo_documentos pd
         WHERE pd.processo_id = p.id) AS exigencias
  FROM public.qa_processos p
  JOIN public.qa_clientes cl ON cl.id = p.cliente_id
 WHERE p.servico_id = 50
 ORDER BY p.created_at;
