-- =============================================================================
-- Separa a exigência militar ESTADUAL da exigência militar da UNIÃO
--
-- O checklist tem duas exigências militares:
--   certidao_crimes_militares_stm            → Justiça Militar da UNIÃO (STM)
--   certidao_antecedentes_criminais_militar  → Justiça Militar ESTADUAL (TJM)
-- (confirmado pelo usuário em 31/07/2026)
--
-- Só que AS DUAS apontavam, por apelido, para o mesmo tipo do Hub
-- (`antecedentes_militar`). Consequência real, observada no processo do cliente
-- 214: ele entregou UMA certidão militar e o sistema deu AS DUAS por cumpridas.
-- O processo iria a protocolo faltando um documento que a PF confere.
--
-- A tentativa anterior falhou porque eu procurei as linhas pelo slug canônico
-- `antecedentes_militar`, e o catálogo de serviços usa a família `certidao_*`.
-- Aqui a correção é no APELIDO, que é onde a colisão de fato acontece.
--
-- Pré-requisito: o tipo `antecedentes_militar_estadual` já deve existir no
-- CHECK de qa_documentos_cliente e na biblioteca.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── 1) O apelido que causava a colisão ──────────────────────────────────
DELETE FROM public.qa_tipo_documento_aliases
 WHERE processo_tipo = 'certidao_antecedentes_criminais_militar'
   AND hub_tipo = 'antecedentes_militar';

INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  ('certidao_antecedentes_criminais_militar', 'antecedentes_militar_estadual'),
  ('certidao_crimes_militares_stm',           'antecedentes_militar')
ON CONFLICT DO NOTHING;

-- ─── 2) Nome explícito, para ninguém confundir de novo ───────────────────
UPDATE public.qa_servicos_documentos
   SET nome_documento = 'Certidão Criminal — Justiça Militar Estadual (TJM)',
       biblioteca_id = COALESCE(
         (SELECT id FROM public.qa_documentos_biblioteca
           WHERE codigo = 'antecedentes_militar_estadual'),
         biblioteca_id
       ),
       updated_at = now()
 WHERE tipo_documento = 'certidao_antecedentes_criminais_militar';

UPDATE public.qa_servicos_documentos
   SET nome_documento = 'Certidão Criminal — Justiça Militar da União (STM)',
       updated_at = now()
 WHERE tipo_documento = 'certidao_crimes_militares_stm';

UPDATE public.qa_processo_documentos
   SET nome_documento = 'Certidão Criminal — Justiça Militar Estadual (TJM)',
       updated_at = now()
 WHERE tipo_documento = 'certidao_antecedentes_criminais_militar';

UPDATE public.qa_processo_documentos
   SET nome_documento = 'Certidão Criminal — Justiça Militar da União (STM)',
       updated_at = now()
 WHERE tipo_documento = 'certidao_crimes_militares_stm';

-- ─── 3) Desfaz as dispensas indevidas ────────────────────────────────────
-- Volta a exigir o TJM de quem foi dispensado sem ter entregue certidão
-- estadual nenhuma. Quem já entregou a certidão do TJM continua dispensado —
-- não se cobra duas vezes de quem cumpriu.
UPDATE public.qa_processo_documentos pd
   SET status = 'pendente',
       updated_at = now()
 WHERE pd.tipo_documento = 'certidao_antecedentes_criminais_militar'
   AND pd.status = 'dispensado_por_reaproveitamento'
   AND NOT EXISTS (
     SELECT 1 FROM public.qa_documentos_cliente dc
      WHERE dc.qa_cliente_id = pd.cliente_id
        AND dc.tipo_documento = 'antecedentes_militar_estadual'
        AND dc.status = 'aprovado'
   );

-- ─── 4) Reavalia com os apelidos corretos ────────────────────────────────
SELECT public.qa_processo_rever_exigencias(NULL);

COMMIT;
