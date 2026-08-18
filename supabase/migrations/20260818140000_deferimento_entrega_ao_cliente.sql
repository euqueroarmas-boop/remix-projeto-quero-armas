-- ============================================================================
-- O DEFERIMENTO DEIXA DE SER UMA ETIQUETA
-- ----------------------------------------------------------------------------
-- Último furo do fim do fluxo, auditoria de 18/08/2026.
--
-- `deferido` era só um rótulo em `qa_processos.status`. Não existia e-mail de
-- deferimento, não existia passo para entregar o documento ao cliente, não
-- existia baixa do serviço, não existia registro no Arsenal.
--
-- Para um serviço chamado "AUTORIZAÇÃO DE COMPRA DE ARMA DE FOGO", o produto
-- final — a autorização — não tinha lugar nenhum no sistema. O cliente pagava,
-- entregava documento por documento durante meses, e no fim via a palavra
-- "Deferido" numa tela. O papel que ele comprou chegava por fora.
--
-- ── POR QUE COLUNA, E NÃO TABELA NOVA ───────────────────────────────────────
-- O documento em si NÃO nasce aqui: ele entra pelo Hub
-- (`qa_documentos_cliente`), com tipo `autorizacao_compra` / `cr` e data de
-- validade — que é o que o faz aparecer no Arsenal e entrar no monitoramento de
-- vencimento que já existe. `avisosVencimento` já tem o texto da autorização de
-- compra desde antes desta migration.
--
-- O que falta é o VÍNCULO: qual documento do Hub é o resultado deste processo.
-- Isso é um dado do processo, e mora nele.
--
-- `deferimento_visto_cliente_em` existe porque entrega sem confirmação de
-- recebimento não é entrega — e é ela que tira o passo da fila do pop-up
-- guiado quando o cliente confirma.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

ALTER TABLE public.qa_processos
  -- O documento do Hub que é o RESULTADO deste processo (a autorização, o CR).
  ADD COLUMN IF NOT EXISTS deferimento_documento_id uuid
    REFERENCES public.qa_documentos_cliente(id) ON DELETE SET NULL,

  -- Data em que o órgão deferiu — não a data em que a equipe registrou.
  ADD COLUMN IF NOT EXISTS deferimento_data date,
  ADD COLUMN IF NOT EXISTS deferimento_numero text,

  ADD COLUMN IF NOT EXISTS deferimento_registrado_em timestamptz,
  ADD COLUMN IF NOT EXISTS deferimento_registrado_por uuid,

  -- Prova de que o cliente recebeu. Enquanto for NULL, o passo fica na fila do
  -- guiado; preenchida, ele sai.
  ADD COLUMN IF NOT EXISTS deferimento_visto_cliente_em timestamptz;

COMMENT ON COLUMN public.qa_processos.deferimento_documento_id IS
  'Documento do Hub que e o RESULTADO deste processo (autorizacao de compra, CR). E por ele que a entrega chega ao cliente e o vencimento entra no Arsenal.';
COMMENT ON COLUMN public.qa_processos.deferimento_data IS
  'Data em que o orgao deferiu — nao a data em que a equipe registrou no sistema.';
COMMENT ON COLUMN public.qa_processos.deferimento_visto_cliente_em IS
  'Confirmacao de recebimento pelo cliente. Entrega sem confirmacao nao e entrega.';

-- A fila do guiado procura por aqui: deferido e ainda não confirmado.
CREATE INDEX IF NOT EXISTS idx_qa_processos_deferimento_pendente
  ON public.qa_processos (cliente_id)
  WHERE deferimento_documento_id IS NOT NULL
    AND deferimento_visto_cliente_em IS NULL;

COMMIT;

-- ── CONFERÊNCIA ─────────────────────────────────────────────────────────────
-- (a) As seis colunas existem. Esperado: 6 linhas.
--
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'qa_processos'
--    AND column_name LIKE 'deferimento\_%'
--  ORDER BY column_name;
--
-- (b) Os processos já deferidos, e quantos têm o documento entregue.
--     Todo deferimento anterior a hoje vai aparecer SEM documento — é o
--     passivo: são clientes cuja autorização nunca passou pelo sistema.
--
-- SELECT p.status,
--        count(*)                                                AS processos,
--        count(*) FILTER (WHERE p.deferimento_documento_id IS NULL) AS sem_documento,
--        count(*) FILTER (WHERE p.deferimento_visto_cliente_em IS NULL
--                          AND p.deferimento_documento_id IS NOT NULL) AS nao_confirmados
--   FROM public.qa_processos p
--  WHERE p.status IN ('deferido','concluido')
--  GROUP BY p.status;
