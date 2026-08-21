-- ============================================================================
-- CONFERÊNCIA — serviços 50 (Autorização de Compra Atirador), 60 (Compra/Posse
-- Defesa Pessoal) e 44 (Concessão de CR)
-- ----------------------------------------------------------------------------
-- OITO consultas, UMA DE CADA VEZ. O Lovable/SQL Editor devolve só o último
-- resultado quando várias vão juntas — então rode e me mande uma por vez.
--
-- JÁ RESPONDIDA em 21/08/2026 (não precisa repetir): os processos abertos do
-- serviço 50 voltaram 2 linhas — Rivelino (13 exigências, deferido) e LEO DA
-- SILVA SOUZA (34 exigências, aguardando_documentos).
-- ============================================================================


-- ╔══ 1 ═══════════════════════════════════════════════════════════════════════
-- ║ Leva 11 aplicada? ERRO de coluna inexistente = migration
-- ║ 20260820120000_gru_espera_peca_aprovada NÃO foi aplicada.
-- ╚════════════════════════════════════════════════════════════════════════════
SELECT servico_id, slug, nome, exige_peca_defesa
  FROM public.qa_servicos_catalogo
 WHERE gera_processo
 ORDER BY servico_id;


-- ╔══ 2 ═══════════════════════════════════════════════════════════════════════
-- ║ Trigger que barra protocolo sem peça de defesa. 0 linhas = não aplicado.
-- ╚════════════════════════════════════════════════════════════════════════════
SELECT tgname FROM pg_trigger WHERE tgname = 'qa_trg_trava_protocolo_sem_defesa';


-- ╔══ 3 ═══════════════════════════════════════════════════════════════════════
-- ║ Perguntas do serviço 50 nasceram com chave? Esperado: 6 linhas, TODAS com
-- ║ chave preenchida. Chave NULL = pergunta quebrada no portal do cliente.
-- ╚════════════════════════════════════════════════════════════════════════════
SELECT tipo_documento,
       regra_validacao ->> 'chave'  AS chave,
       regra_validacao -> 'opcoes'  AS opcoes
  FROM public.qa_servicos_documentos
 WHERE servico_id = 50 AND ativo AND tipo_documento LIKE 'pergunta\_%' ESCAPE '\'
 ORDER BY ordem;


-- ╔══ 4 ═══════════════════════════════════════════════════════════════════════
-- ║ Validade da certidão da Justiça Militar (STM) nos três serviços.
-- ║ Esperado 90 nos três. Se o serviço 50 vier 30, é o defeito relatado.
-- ╚════════════════════════════════════════════════════════════════════════════
SELECT servico_id, tipo_documento, nome_documento, validade_dias
  FROM public.qa_servicos_documentos
 WHERE ativo AND tipo_documento = 'antecedentes_militar'
   AND servico_id IN (44, 50, 60)
 ORDER BY servico_id;


-- ╔══ 5 ═══════════════════════════════════════════════════════════════════════
-- ║ Migrations de prazo de 19/08 chegaram ao banco? 0 linhas = não aplicadas.
-- ╚════════════════════════════════════════════════════════════════════════════
SELECT p.proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('qa_realinhar_validade_dias_checklist',
                     'qa_manutencao_validade_documentos');


-- ╔══ 6 ═══════════════════════════════════════════════════════════════════════
-- ║ Tabela única de validade de certidões.
-- ║ NULL = migration 20260819140000 não aplicada.
-- ╚════════════════════════════════════════════════════════════════════════════
SELECT to_regclass('public.qa_prazo_certidao') AS tabela_prazo_certidao;


-- ╔══ 7 ═══════════════════════════════════════════════════════════════════════
-- ║ Catálogo vigente do serviço 50 — para saber se as 34 exigências do LEO
-- ║ batem com o catálogo novo ou se sobrou item duplicado/errado.
-- ╚════════════════════════════════════════════════════════════════════════════
SELECT ordem, etapa, tipo_documento, nome_documento, obrigatorio,
       validade_dias, regra_validacao ->> 'grupo_checklist' AS grupo,
       condicao_profissional, condicao_uf
  FROM public.qa_servicos_documentos
 WHERE servico_id = 50 AND ativo
 ORDER BY ordem;


-- ╔══ 8 ═══════════════════════════════════════════════════════════════════════
-- ║ Quando cada processo do serviço 50 nasceu — separa processo novo
-- ║ (checklist novo) de legado.
-- ╚════════════════════════════════════════════════════════════════════════════
SELECT p.id, cl.nome_completo, p.status, p.created_at, p.protocolo_data,
       p.protocolo_numero, p.protocolo_orgao,
       (SELECT count(*) FROM public.qa_processo_documentos pd
         WHERE pd.processo_id = p.id) AS exigencias
  FROM public.qa_processos p
  JOIN public.qa_clientes cl ON cl.id = p.cliente_id
 WHERE p.servico_id = 50
 ORDER BY p.created_at;
