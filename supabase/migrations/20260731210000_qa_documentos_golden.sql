-- =============================================================================
-- Golden record dos documentos que NÓS geramos
--
-- O que muda em relação a hoje:
--   `qa_contracts.original_sha256` já ancora o ARQUIVO. Isso pega adulteração
--   byte a byte, mas quebra quando o assinador do Gov.br re-lineariza o PDF —
--   mesmos dados, bytes diferentes.
--
--   Aqui guardamos o que a re-linearização NÃO muda: o texto e os campos do
--   carimbo como colunas. Com isso a validação deixa de depender do arquivo no
--   storage e passa a conferir conteúdo e carimbo valor a valor.
--
-- Por que o titular também é congelado: o cadastro do cliente muda com o
-- tempo. A conferência precisa comparar contra quem ele era QUANDO o documento
-- foi gerado — senão uma correção de cadastro legítima invalidaria um contrato
-- assinado meses antes.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.qa_documentos_golden (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  documento_tipo    text NOT NULL CHECK (documento_tipo IN ('contrato', 'procuracao')),
  documento_id      uuid NOT NULL,
  cliente_id        bigint,
  numero            text,

  -- Âncora do arquivo
  sha256            text NOT NULL,
  storage_path      text,
  tamanho_bytes     integer,

  -- Âncora do CONTEÚDO: sobrevive à re-linearização
  texto_normalizado text,
  texto_sha256      text,

  -- Carimbo de conexão, como DADO e não só desenhado no PDF
  carimbo_ip             text,
  carimbo_so             text,
  carimbo_navegador      text,
  carimbo_pais           text,
  carimbo_idioma         text,
  carimbo_referer        text,
  carimbo_registrado_em  timestamptz,

  -- Titular congelado no instante da geração
  titular_nome      text,
  titular_cpf       text,

  gerado_em         timestamptz NOT NULL DEFAULT now(),

  -- Um golden por documento. Regerar o PDF atualiza o registro.
  CONSTRAINT uq_golden_documento UNIQUE (documento_tipo, documento_id)
);

CREATE INDEX IF NOT EXISTS idx_golden_cliente
  ON public.qa_documentos_golden(cliente_id);
CREATE INDEX IF NOT EXISTS idx_golden_sha
  ON public.qa_documentos_golden(sha256);

ALTER TABLE public.qa_documentos_golden ENABLE ROW LEVEL SECURITY;

-- Só o backend escreve e lê. É prova: cliente não precisa ver, e não pode tocar.
REVOKE ALL ON public.qa_documentos_golden FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qa_documentos_golden TO service_role;

COMMIT;
