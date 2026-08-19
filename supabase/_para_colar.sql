-- ============================================================================
-- FUSÃO DOS DOIS CADASTROS DO BRUNO PEREIRA MACIEL (CPF 052.641.421-90)
--
-- O QUE O DIAGNÓSTICO MOSTROU (19/08/2026).
-- 132 — criado em 06/05/2026, CPF gravado só com dígitos, endereço antigo
--       (Rua Gonzaga, Vl Guilhermina). Tem 1 venda e 1 assinatura do Arsenal.
--       Não tem vínculo de login.
-- 230 — criado em 10/08/2026, CPF formatado, endereço atual (Canto do Forte).
--       Tem 1 venda, 1 contrato e o login ativo do cliente.
-- Os dois carregam o MESMO user_id, o que é risco: o portal pode abrir o
-- cadastro errado para a mesma pessoa.
--
-- DECISÃO: o 230 é o cadastro vivo. A venda antiga e a assinatura do Arsenal
-- passam para ele, e o 132 sai de circulação (arquivado + excluído) com o
-- user_id limpo, para nunca mais ser alcançado por login.
--
-- Roda tudo dentro de uma transação: ou vai inteiro, ou não vai nada.
-- ============================================================================

BEGIN;

-- A venda antiga passa para o cadastro vivo.
UPDATE public.qa_vendas
   SET cliente_id = 230
 WHERE cliente_id = 132;

-- A assinatura do Arsenal idem.
UPDATE public.qa_arsenal_assinaturas
   SET cliente_id = 230
 WHERE cliente_id = 132;

-- O cadastro duplicado sai de circulação e perde o vínculo de login.
UPDATE public.qa_clientes
   SET user_id = NULL,
       arquivado = true,
       excluido = true
 WHERE id = 132;

COMMIT;

-- ============================================================================
-- CONFERÊNCIA — rodar depois do COMMIT.
-- Esperado: o CPF não aparece mais na lista de duplicados; o 230 fica com as
-- 2 vendas e a 1 assinatura; o 132 volta como arquivado=true, excluido=true e
-- sem user_id.
-- ============================================================================

SELECT 'duplicados_restantes' AS bloco,
       regexp_replace(cpf, '\D', '', 'g') AS chave,
       format('registros=%s | ids=%s', count(*), array_agg(id ORDER BY id)) AS valor
FROM public.qa_clientes
WHERE excluido = false
  AND regexp_replace(cpf, '\D', '', 'g') <> ''
GROUP BY 2
HAVING count(*) > 1

UNION ALL

SELECT 'cadastro', id::text,
       concat_ws(' | ', nome_completo, cpf,
                 'user_id=' || coalesce(user_id::text, '-'),
                 'arquivado=' || coalesce(arquivado::text, '-'),
                 'excluido=' || coalesce(excluido::text, '-'))
FROM public.qa_clientes
WHERE id IN (132, 230)

UNION ALL

SELECT 'vendas', cliente_id::text, format('vendas=%s', count(*))
FROM public.qa_vendas
WHERE cliente_id IN (132, 230)
GROUP BY cliente_id

UNION ALL

SELECT 'arsenal', cliente_id::text, format('assinaturas=%s', count(*))
FROM public.qa_arsenal_assinaturas
WHERE cliente_id IN (132, 230)
GROUP BY cliente_id

ORDER BY 1, 2;
