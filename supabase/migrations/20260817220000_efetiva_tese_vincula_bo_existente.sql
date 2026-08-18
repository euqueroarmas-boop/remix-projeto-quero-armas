-- =============================================================================
-- Efetiva necessidade — amarra o boletim que JÁ estava anexado à frente 1
--
-- A migration das teses (20260817210000) converteu o texto único de cada
-- processo na "frente 1", mas deixou o boletim que o cliente já tinha enviado
-- sem vínculo nenhum. Resultado na tela da equipe: frente 1 "sem boletim
-- ainda", com o PDF ali do lado — e, para o cliente, um texto de delegacia
-- sendo oferecido para um registro que ele já fez.
--
-- Amarra só o caso inequívoco: UM boletim e UMA frente naquele processo. Onde
-- há mais de um documento ou mais de uma frente, quem decide o encaixe é o
-- cliente, na tela — regra do usuário (17/08/2026): o sistema propõe, ele lê e
-- confirma.
-- =============================================================================

BEGIN;

UPDATE public.qa_efetiva_teses t
   SET prova_id              = p.id,
       vinculo_confirmado_em = COALESCE(t.vinculo_confirmado_em, now()),
       vinculo_origem        = COALESCE(t.vinculo_origem, 'automatico'),
       updated_at            = now()
  FROM (
    SELECT efetiva_necessidade_id,
           MIN(id::text)::uuid AS id,
           COUNT(*)            AS qtd
      FROM public.qa_efetiva_necessidade_provas
     WHERE tipo = 'boletim_ocorrencia'
     GROUP BY efetiva_necessidade_id
  ) p
 WHERE p.efetiva_necessidade_id = t.efetiva_necessidade_id
   AND p.qtd = 1
   AND t.prova_id IS NULL
   -- Uma frente só naquele processo: sem ambiguidade sobre a qual ele pertence.
   AND (SELECT COUNT(*) FROM public.qa_efetiva_teses t2
         WHERE t2.efetiva_necessidade_id = t.efetiva_necessidade_id) = 1
   -- E o documento ainda não cobre nenhuma outra frente.
   AND NOT EXISTS (SELECT 1 FROM public.qa_efetiva_teses t3
                    WHERE t3.prova_id = p.id);

COMMIT;
