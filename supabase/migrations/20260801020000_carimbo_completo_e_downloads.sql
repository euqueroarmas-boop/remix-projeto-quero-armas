-- =============================================================================
-- Fecha o carimbo de conexão: idioma, referência e histórico de downloads
--
-- Duas lacunas que sobraram do carimbo:
--
-- 1. IDIOMA e REFERÊNCIA vinham sempre vazios. Eu os lia de
--    `aceite_eletronico_data`, supondo um objeto de sessão — mas é um
--    timestamp. Os dados nunca foram capturados. Passam a ter coluna própria,
--    gravada no momento do aceite.
--
-- 2. O carimbo mostra a hora do ACEITE, não a do download — e tem de continuar
--    assim: o contrato é UM arquivo canônico, byte-idêntico para sempre, e é
--    isso que permite provar que o PDF assinado no Gov.br é o que emitimos.
--    Carimbar o instante de cada download mudaria os bytes a cada clique.
--
--    O histórico de acessos, que o usuário quer, fica AO LADO do arquivo:
--    uma linha por download, sem tocar no PDF.
-- =============================================================================

BEGIN;

-- ─── 1) Sessão do aceite completa ────────────────────────────────────────
ALTER TABLE public.qa_contracts
  ADD COLUMN IF NOT EXISTS aceite_idioma  text,
  ADD COLUMN IF NOT EXISTS aceite_referer text;

COMMENT ON COLUMN public.qa_contracts.aceite_idioma IS
  'Accept-Language da requisição do aceite eletrônico. Aparece no carimbo de conexão.';
COMMENT ON COLUMN public.qa_contracts.aceite_referer IS
  'Referer da requisição do aceite eletrônico — de qual página o cliente chegou ao aceite.';

-- O log imutável do aceite acompanha, senão a prova fica menos completa que o
-- próprio contrato.
ALTER TABLE public.qa_contract_aceites_log
  ADD COLUMN IF NOT EXISTS aceite_idioma  text,
  ADD COLUMN IF NOT EXISTS aceite_referer text;

-- ─── 2) Histórico de downloads ───────────────────────────────────────────
-- Append-only: uma linha por acesso, nunca sobrescrita. É o que responde
-- "quem baixou, quando e de onde" sem alterar o documento assinado.
CREATE TABLE IF NOT EXISTS public.qa_documento_downloads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  documento_tipo  text NOT NULL CHECK (documento_tipo IN ('contrato', 'procuracao')),
  documento_id    uuid NOT NULL,
  numero          text,
  cliente_id      bigint,

  -- Quem pediu. `usuario_id` fica nulo quando o acesso é por link público
  -- (procuração), em que o UUID do link é a própria credencial.
  usuario_id      uuid,
  ip              text,
  user_agent      text,
  idioma          text,
  referer         text,
  pais            text,

  -- Confere com o golden record: se o hash servido mudar, dá para saber a
  -- partir de qual download.
  sha256          text,
  tamanho_bytes   integer,

  baixado_em      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_downloads_documento
  ON public.qa_documento_downloads(documento_tipo, documento_id, baixado_em DESC);
CREATE INDEX IF NOT EXISTS idx_downloads_cliente
  ON public.qa_documento_downloads(cliente_id, baixado_em DESC);

ALTER TABLE public.qa_documento_downloads ENABLE ROW LEVEL SECURITY;

-- É prova: só o backend escreve e lê. Cliente não precisa ver, e não pode
-- alterar. A equipe consulta pelo painel, via edge function.
REVOKE ALL ON public.qa_documento_downloads FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.qa_documento_downloads TO service_role;

COMMIT;
