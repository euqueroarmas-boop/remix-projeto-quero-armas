-- Procuração canônica: PDF único gerado no servidor + carimbo de conexão.
--
-- Espelha o que qa_contracts já tem (original_pdf_path / original_sha256) e
-- acrescenta a sessão da geração, que é a origem do carimbo lateral.
--
-- Aditivo: colunas novas, nulas por padrão. Procurações existentes seguem
-- funcionando pelo caminho atual até serem geradas pela nova função.

ALTER TABLE public.qa_procuracoes
  ADD COLUMN IF NOT EXISTS original_pdf_path text,
  ADD COLUMN IF NOT EXISTS original_sha256   text,
  ADD COLUMN IF NOT EXISTS sessao_geracao    jsonb;

COMMENT ON COLUMN public.qa_procuracoes.original_pdf_path IS
  'Caminho no bucket paid-contracts do PDF canônico servido ao cliente. Byte-idêntico em toda leitura.';
COMMENT ON COLUMN public.qa_procuracoes.original_sha256 IS
  'SHA-256 do PDF canônico. Prefixo esperado da assinatura PAdES devolvida pelo Gov.br.';
COMMENT ON COLUMN public.qa_procuracoes.sessao_geracao IS
  'Carimbo de conexão do servidor no instante da geração: ip, so, browser, country, accept_language, referer, user_agent, registrado_em.';
