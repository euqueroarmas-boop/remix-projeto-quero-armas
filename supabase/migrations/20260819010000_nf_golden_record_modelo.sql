-- =============================================================================
-- GOLDEN RECORD DA NOTA FISCAL — separar NFS-e (serviço) de NF-e (mercadoria)
--
-- MOTIVO (19/08/2026).
--
-- `qa_nf_golden_records` nasceu para a NFS-e do padrão nacional: as colunas
-- falam de DPS, ISSQN, tributação municipal, prestador e tomador de SERVIÇO.
-- Toda linha que já existe na tabela é NFS-e, gravada pelo parser da DANFSe.
--
-- A importação de XML passou a aceitar também a NF-e modelo 55 (mercadoria).
-- Ela cai na MESMA tabela — e sem uma marca de modelo as duas ficam
-- indistinguíveis: quem consultar a tabela lê tudo como NFS-e e conclui que
-- uma venda de sucata é prestação de serviço, com ISSQN que não existe.
--
-- Esta migration NÃO joga dado fora e NÃO reinterpreta linha nenhuma:
--
--   1) cria `modelo` e as colunas genéricas que a NF-e precisa e a NFS-e não
--      tinha onde guardar (número, série, natureza da operação, protocolo de
--      autorização, valor dos produtos);
--   2) preenche `modelo` pelo ÚNICO critério determinístico que existe no dado
--      já gravado: chave de acesso com 44 dígitos é NF-e/NFC-e; qualquer outro
--      tamanho é NFS-e (a chave do padrão nacional tem 50). É a mesma regra que
--      `modeloPelaChave` aplica no código — SQL e TypeScript não podem divergir;
--   3) copia `numero_nfse` para `numero_documento`, para a coluna genérica já
--      nascer preenchida nas linhas antigas. `numero_nfse` continua onde está.
--
-- Idempotente: pode rodar de novo sem efeito.
-- =============================================================================

BEGIN;

-- ─── 1) Colunas novas ────────────────────────────────────────────────────
ALTER TABLE public.qa_nf_golden_records
  ADD COLUMN IF NOT EXISTS modelo                TEXT,
  ADD COLUMN IF NOT EXISTS numero_documento      TEXT,
  ADD COLUMN IF NOT EXISTS serie                 TEXT,
  ADD COLUMN IF NOT EXISTS natureza_operacao     TEXT,
  ADD COLUMN IF NOT EXISTS protocolo_autorizacao TEXT,
  ADD COLUMN IF NOT EXISTS valor_produtos        NUMERIC(14,2);

COMMENT ON COLUMN public.qa_nf_golden_records.modelo IS
  'nfse = nota de serviço (padrão nacional); nfe/nfce = nota de mercadoria (SEFAZ).';
COMMENT ON COLUMN public.qa_nf_golden_records.numero_documento IS
  'Número da nota, qualquer que seja o modelo. Em NFS-e repete numero_nfse.';

-- ─── 2) Backfill do modelo, pelo tamanho da chave ────────────────────────
UPDATE public.qa_nf_golden_records
   SET modelo = CASE
         WHEN length(regexp_replace(COALESCE(chave_acesso, ''), '\D', '', 'g')) = 44
           THEN 'nfe'
         ELSE 'nfse'
       END
 WHERE modelo IS NULL;

-- ─── 3) Número genérico herda o número da NFS-e ──────────────────────────
UPDATE public.qa_nf_golden_records
   SET numero_documento = numero_nfse
 WHERE numero_documento IS NULL
   AND numero_nfse IS NOT NULL;

-- ─── 4) Trava: modelo é obrigatório e só aceita os três valores ──────────
ALTER TABLE public.qa_nf_golden_records
  ALTER COLUMN modelo SET DEFAULT 'nfse';

ALTER TABLE public.qa_nf_golden_records
  DROP CONSTRAINT IF EXISTS qa_nf_golden_records_modelo_check;

ALTER TABLE public.qa_nf_golden_records
  ADD CONSTRAINT qa_nf_golden_records_modelo_check
  CHECK (modelo IN ('nfe', 'nfce', 'nfse'));

ALTER TABLE public.qa_nf_golden_records
  ALTER COLUMN modelo SET NOT NULL;

CREATE INDEX IF NOT EXISTS qa_nf_golden_records_modelo_idx
  ON public.qa_nf_golden_records (modelo);

COMMIT;
