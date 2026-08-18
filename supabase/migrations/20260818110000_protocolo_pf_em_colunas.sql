-- ============================================================================
-- O PROTOCOLO DA POLÍCIA FEDERAL SAI DO JSON E VIRA COLUNA
-- ----------------------------------------------------------------------------
-- Achado da auditoria de ponta a ponta, 18/08/2026.
--
-- O número do protocolo — o dado pelo qual o cliente acompanha o processo dele
-- no site da PF — era gravado dentro de `qa_processos.respostas_questionario_json`,
-- na chave `protocolo`. Esse mesmo JSON é reescrito inteiro (ler → alterar →
-- gravar, sem trava de concorrência) por, no mínimo, dez lugares:
--
--   qa-processo-responder-pergunta · qa-processo-doc-validar-ia (2×) ·
--   qa-processo-template-data-salvar · qa-clube-sugerir ·
--   qa-processo-alteracao-nome-iniciar (2×) · reconciliarNomeAprovada ·
--   qa-processo-checar-conclusao-checklist · ProcessoDetalheDrawer (2×)
--
-- Duas perdas possíveis, as duas silenciosas:
--   • uma validação de IA terminando no mesmo minuto em que a operadora salva
--     o protocolo apaga o protocolo;
--   • o inverso apaga as respostas do checklist — e resposta apagada
--     RESSUSCITA pendência (`exige_quando`/`depende_de` voltam a valer) num
--     processo que já está na delegacia.
--
-- Pior ainda no lado da tela: `confirmarMarcarProtocolado` lia o JSON do estado
-- do componente, carregado quando a gaveta abriu. Gaveta aberta por dez minutos
-- gravava dados de dez minutos atrás por cima dos novos.
--
-- Coluna própria resolve os dois: escrita atômica, sem ler nada antes.
--
-- O backfill preserva o histórico. A chave `protocolo` do JSON NÃO é apagada —
-- fica como espelho de leitura para qualquer tela ainda não migrada (regra de
-- extensão sobre substituição). Ela deixa de ser a fonte da verdade.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

-- ── 1) Colunas ──────────────────────────────────────────────────────────────
ALTER TABLE public.qa_processos
  ADD COLUMN IF NOT EXISTS protocolo_numero        text,
  ADD COLUMN IF NOT EXISTS protocolo_orgao         text,
  ADD COLUMN IF NOT EXISTS protocolo_data          date,
  ADD COLUMN IF NOT EXISTS protocolo_observacao    text,
  ADD COLUMN IF NOT EXISTS protocolo_registrado_em timestamptz,
  ADD COLUMN IF NOT EXISTS protocolo_registrado_por uuid;

COMMENT ON COLUMN public.qa_processos.protocolo_numero IS
  'Numero do protocolo no orgao (PF/Exercito). FONTE DA VERDADE — substitui respostas_questionario_json->protocolo->numero_protocolo, que sofria lost update.';
COMMENT ON COLUMN public.qa_processos.protocolo_orgao IS
  'POLICIA_FEDERAL | EXERCITO | SIGMA | OUTRO.';
COMMENT ON COLUMN public.qa_processos.protocolo_data IS
  'Data em que o processo foi protocolado no orgao (nao e a data do registro no sistema).';

-- ── 2) Backfill a partir do JSON ────────────────────────────────────────────
-- Só preenche o que ainda está vazio: reexecutar não sobrescreve correção
-- feita depois pela equipe.
UPDATE public.qa_processos p
   SET protocolo_numero = COALESCE(
         p.protocolo_numero,
         NULLIF(btrim(p.respostas_questionario_json #>> '{protocolo,numero_protocolo}'), ''),
         NULLIF(btrim(p.respostas_questionario_json #>> '{protocolo,numero}'), '')
       ),
       protocolo_orgao = COALESCE(
         p.protocolo_orgao,
         NULLIF(btrim(p.respostas_questionario_json #>> '{protocolo,orgao}'), '')
       ),
       protocolo_data = COALESCE(
         p.protocolo_data,
         CASE
           WHEN p.respostas_questionario_json #>> '{protocolo,data_protocolo}' ~ '^\d{4}-\d{2}-\d{2}$'
             THEN (p.respostas_questionario_json #>> '{protocolo,data_protocolo}')::date
           ELSE NULL
         END
       ),
       protocolo_observacao = COALESCE(
         p.protocolo_observacao,
         NULLIF(btrim(p.respostas_questionario_json #>> '{protocolo,observacao}'), '')
       ),
       protocolo_registrado_em = COALESCE(
         p.protocolo_registrado_em,
         CASE
           WHEN (p.respostas_questionario_json #>> '{protocolo,registrado_em}') IS NOT NULL
             THEN (p.respostas_questionario_json #>> '{protocolo,registrado_em}')::timestamptz
           ELSE NULL
         END
       )
 WHERE p.respostas_questionario_json ? 'protocolo';

-- ── 3) Índice de consulta ───────────────────────────────────────────────────
-- A equipe procura processo pelo número que o cliente manda no WhatsApp.
CREATE INDEX IF NOT EXISTS idx_qa_processos_protocolo_numero
  ON public.qa_processos (protocolo_numero)
  WHERE protocolo_numero IS NOT NULL;

COMMIT;

-- ── CONFERÊNCIA ─────────────────────────────────────────────────────────────
-- (a) As seis colunas existem. Esperado: 6 linhas.
--
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'qa_processos'
--    AND column_name LIKE 'protocolo\_%'
--  ORDER BY column_name;
--
-- (b) Backfill sem sobra: todo processo que tinha número no JSON tem número na
--     coluna. Esperado: 0 linhas.
--
-- SELECT id,
--        respostas_questionario_json #>> '{protocolo,numero_protocolo}' AS no_json,
--        protocolo_numero                                              AS na_coluna
--   FROM public.qa_processos
--  WHERE NULLIF(btrim(respostas_questionario_json #>> '{protocolo,numero_protocolo}'), '') IS NOT NULL
--    AND protocolo_numero IS NULL;
--
-- (c) Panorama: processos protocolados e quantos estão sem número.
--
-- SELECT status,
--        count(*)                                        AS processos,
--        count(*) FILTER (WHERE protocolo_numero IS NULL) AS sem_numero
--   FROM public.qa_processos
--  WHERE status IN ('protocolado','em_analise_orgao','notificado',
--                   'recurso_administrativo','deferido','indeferido')
--  GROUP BY status
--  ORDER BY status;
