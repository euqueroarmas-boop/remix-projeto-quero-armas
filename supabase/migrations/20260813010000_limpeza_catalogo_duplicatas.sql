-- =============================================================================
-- LIMPEZA DO CATALOGO — duplicatas mortas + consertos de cobertura
--
-- O catalogo acumulou linhas desativadas do mesmo tipo_documento no mesmo
-- servico. Elas nao eram inertes: como varias leituras nao filtravam `ativo`,
-- a linha morta ditava ordem da fila, instrucoes, link de emissao e ate regra
-- de validacao — de forma instavel, porque sem ORDER BY o banco devolve as
-- linhas em ordem arbitraria e o Map do frontend ficava com a ultima lida.
--
-- Levantamento: 93 linhas inativas no total.
--   22 -> duplicata pura, sem conteudo proprio, com versao ativa do mesmo tipo
--   68 -> unica linha do tipo no servico (exigencia desativada, NAO e lixo)
--    3 -> duplicata COM conteudo que a versao ativa nao tinha
--
-- Apagamos apenas as 22. As 68 nao sao lixo: apagar seria decisao de produto.
-- As 3 revelaram algo mais grave que conteudo — a linha morta cobria uma
-- CONDICAO PROFISSIONAL que a viva nao cobre. Corrigimos a cobertura em vez
-- de apagar.
-- =============================================================================

BEGIN;

-- ── 1) Remocao das 22 duplicatas sem conteudo proprio ───────────────────────
-- IDs explicitos, nunca faixa de `ordem`. As tres condicoes finais fazem o
-- comando se recusar a apagar qualquer linha que tenha voltado a ser ativa,
-- ganhado conteudo, ou cujo tipo tenha perdido a versao viva.
DELETE FROM public.qa_servicos_documentos sd
 WHERE sd.id IN (
   'e96499ab-51b5-4020-85a3-48c8dd4231cd','4994ded8-4739-4855-9a67-7a0ee5727036',
   'be024960-848c-4c89-a1bc-bd5cd8cb80bd','7978dbb2-0f6e-4516-8a37-f5f5726deb4e',
   '852edb42-e916-44b9-afb0-63b13bacf3cb','444e68b3-25c8-4f51-a077-af9698dbe360',
   'e9392df0-7514-42a2-baa7-d0bdff8dd68d','72d732d7-2c0d-4b8b-b4b2-d55ccd7a1e87',
   'f5405890-8482-47a5-96ee-2c4cea658be9','3410a78b-f727-490e-b77a-40838e38a1de',
   '46c751ae-4d65-4ab3-b834-7487cfa08ac2','d1450be7-c40a-4aa4-9054-bf58e66f8f96',
   '2256d0b2-8faf-41b7-9ebe-3f3424639b54','721e5966-23f5-4bf6-9d3b-826fd116906e',
   '7d2fb990-9c1f-44bd-b3da-528d49f9583e','1efaf3bf-67b0-4300-8db5-a8f8b02703a3',
   '7dc2b0f0-7d4c-4fe9-9051-02b87cdc2e94','5fea8059-cdcd-4d8e-be7b-841a71a0c0c1',
   '042adeb0-c4a4-4825-8e3e-ec6adfad8b17','91a2ac6a-5e54-457f-9791-a16a9c2a30d5',
   'be0183b6-a0a8-4c9b-8042-7600db26e081','3445d981-e7c7-48a1-888b-1533c6d1e5cc'
 )
   AND sd.ativo = false
   AND sd.instrucoes IS NULL
   AND sd.link_emissao IS NULL
   AND sd.observacoes_cliente IS NULL
   AND EXISTS (
     SELECT 1 FROM public.qa_servicos_documentos a
      WHERE a.servico_id = sd.servico_id
        AND a.tipo_documento = sd.tipo_documento
        AND a.ativo = true
   );

-- ── 2) Conteudo que so existia na linha morta passa para a viva ─────────────
-- O portal tem um fallback global que pesca instrucoes/link de QUALQUER
-- servico, inclusive de linha desativada. Sem copiar, apagar a morta deixaria
-- o cliente sem o passo a passo.
UPDATE public.qa_servicos_documentos viva
   SET instrucoes          = COALESCE(viva.instrucoes, morta.instrucoes),
       link_emissao        = COALESCE(viva.link_emissao, morta.link_emissao),
       observacoes_cliente = COALESCE(viva.observacoes_cliente, morta.observacoes_cliente),
       updated_at = now()
  FROM public.qa_servicos_documentos morta
 WHERE viva.servico_id     = morta.servico_id
   AND viva.tipo_documento = morta.tipo_documento
   AND viva.ativo = true
   AND morta.ativo = false
   AND viva.instrucoes IS NULL
   AND morta.instrucoes IS NOT NULL
   AND (viva.servico_id, viva.tipo_documento) IN (
         (2,  'renda_carteira_funcional'),
         (60, 'renda_contra_cheque_mes_atual')
       );

-- ── 3) COBERTURA: funcionario publico precisa de carteira funcional ─────────
-- A linha viva do servico 2 atendia so seguranca publica; a do funcionario
-- publico estava desativada. Uma linha com as DUAS condicoes, em vez de
-- reativar a morta — evita recriar a duplicata que acabamos de limpar. So
-- funciona porque a virgula agora e lida corretamente por
-- qa_explodir_checklist_processo, qa_sincronizar_checklist_processos_servico
-- e qa_servico_divergencia_catalogo.
UPDATE public.qa_servicos_documentos
   SET condicao_profissional = 'seguranca_publica,funcionario_publico',
       updated_at = now()
 WHERE servico_id = 2
   AND tipo_documento = 'renda_carteira_funcional'
   AND ativo = true;

-- ── 4) COBERTURA: CLT precisa de extrato INSS — mas do documento CERTO ──────
-- Aqui NAO se juntam as condicoes: para o assalariado o documento e o CNIS
-- (extrato de CONTRIBUICOES); para o aposentado e o extrato de pagamento de
-- BENEFICIO. Sao documentos diferentes, entao continuam em linhas separadas.
-- O texto que estava na linha do CLT era o do aposentado, copiado por engano —
-- provavelmente foi por isso que alguem a desativou em vez de corrigir.
UPDATE public.qa_servicos_documentos
   SET ativo = true,
       nome_documento = 'Extrato completo de contribuições do INSS (CNIS)',
       instrucoes = '1) Acesse Meu INSS com login gov.br.' || E'\n' ||
                    '2) Menu "Extrato de Contribuição (CNIS)" > Baixar PDF.' || E'\n' ||
                    '3) Envie o PDF completo, sem cortar páginas.',
       link_emissao = 'https://meu.inss.gov.br/',
       orgao_emissor = 'INSS',
       updated_at = now()
 WHERE servico_id = 2
   AND tipo_documento = 'renda_extrato_inss'
   AND condicao_profissional = 'clt'
   AND ativo = false;

-- ── 5) Processos ja criados recebem as exigencias que passaram a valer ──────
-- A funcao e aditiva: so insere tipo que ainda nao existe no processo.
DO $bf$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.id FROM public.qa_processos p
     WHERE p.servico_id = 2
       AND lower(COALESCE(p.condicao_profissional,'')) IN
           ('clt','funcionario_publico','seguranca_publica')
       AND COALESCE(p.status,'ativo') NOT IN
           ('finalizado','deferido','indeferido','cancelado','arquivado')
  LOOP
    PERFORM public.qa_explodir_checklist_processo(r.id);
  END LOOP;
END
$bf$;

COMMIT;

-- =============================================================================
-- FICA EM ABERTO (decisao de produto, nao aplicada aqui):
--
-- 1. A chave de unicidade do upsert do admin e
--    (servico_id, tipo_documento, condicao_profissional). Enquanto for essa,
--    mudar a marcacao de condicao de um documento CRIA linha nova em vez de
--    atualizar — ou seja, a duplicata se reproduz a cada ajuste de catalogo.
--
-- 2. No servico 2, a linha de `renda_extrato_inss` do aposentado tem
--    nome_documento de CNIS ("extrato de contribuicoes") mas instrucoes de
--    extrato de pagamento de BENEFICIO. Sao documentos diferentes; falta
--    decidir qual o aposentado deve entregar.
--
-- 3. As 68 linhas inativas que sao a unica do seu tipo no servico continuam
--    la. Nao sao duplicatas — sao exigencias desligadas. Apagar cada uma e
--    decisao de produto, uma a uma.
-- =============================================================================
