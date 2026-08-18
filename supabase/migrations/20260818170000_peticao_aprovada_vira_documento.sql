-- ============================================================================
-- A PETIÇÃO APROVADA VIRA ARQUIVO — e o relato sai do dossiê
-- ----------------------------------------------------------------------------
-- Achado da TERCEIRA auditoria (18/08/2026).
--
-- O ciclo de aprovação da petição funcionava inteiro: a equipe enviava, o
-- cliente lia no pop-up guiado, corrigia e aprovava. E terminava ali. O texto
-- aprovado ficava numa coluna de `qa_geracoes_pecas`, e o PDF único que vai à
-- Polícia Federal (`qa-montar-juntada`) é montado a partir dos DOCUMENTOS do
-- processo. Texto em coluna não é documento — então a peça que o cliente
-- aprovou não entrava no dossiê. Ou alguém baixava o Word, convertia e subia à
-- mão, ou o processo era protocolado sem ela, depois de o cliente ter aprovado
-- uma peça que ninguém usou.
--
-- ── A DECISÃO DO TITULAR (18/08/2026) ───────────────────────────────────────
-- Duas vias, com destinos diferentes:
--
--   SIMPLES  → vai à delegacia. Só o texto da petição.
--   LACRADA  → fica arquivada. Mesmo texto + página de registro (data/hora
--              BRT, IP, navegador, idioma, SHA-256 do texto e a declaração que
--              o cliente marcou). Existe para o dia em que alguém disser que
--              não afirmou aquilo. NÃO vira documento do processo, logo nunca
--              entra na juntada.
--
-- E o RELATO DE EFETIVA NECESSIDADE (a narrativa que o cliente escreveu e
-- aprovou) sai do dossiê: é prova nossa de que ele afirmou aquilo, não peça
-- para o órgão. O que a PF recebe é a petição final dos advogados mais os
-- boletins, inquéritos e demais provas que ele juntou. Esse corte é feito em
-- código (`qa-montar-juntada`), pelo caminho do arquivo — e não por tipo,
-- porque `comprovante_efetiva_necessidade` também é o código de uma prova
-- legítima que o cliente envia no porte.
--
-- Esta migration só acrescenta colunas. Nada é removido, nada muda de nome.
-- Reexecutável.
-- ============================================================================

BEGIN;

-- Onde cada via foi arquivada. Guardar o endereço aqui é o que permite à tela
-- da equipe abrir o lacre sem adivinhar caminho de bucket.
ALTER TABLE public.qa_geracoes_pecas
  ADD COLUMN IF NOT EXISTS peticao_storage_path text,
  ADD COLUMN IF NOT EXISTS lacre_storage_path   text,
  -- A frase exata que o cliente marcou. Fica na linha, e não só no PDF, para
  -- que uma consulta responda "o que ele declarou?" sem abrir arquivo. Se um
  -- dia o texto da declaração mudar, cada aceite guarda a versão que valeu.
  ADD COLUMN IF NOT EXISTS aprovacao_declaracao text;

COMMENT ON COLUMN public.qa_geracoes_pecas.peticao_storage_path IS
  'Via SIMPLES da petição aprovada (qa-processo-docs). É a que vai ao órgão.';
COMMENT ON COLUMN public.qa_geracoes_pecas.lacre_storage_path IS
  'Via LACRADA (qa-processo-docs): texto + registro do aceite. Arquivo interno, nunca vai ao órgão.';
COMMENT ON COLUMN public.qa_geracoes_pecas.aprovacao_declaracao IS
  'Declaração de veracidade que o cliente marcou ao aprovar, no texto vigente naquele momento.';

COMMIT;

-- ── CONFERÊNCIA 1 — as colunas existem ──────────────────────────────────────
-- Esperado: 3 linhas.
--
-- SELECT column_name
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name   = 'qa_geracoes_pecas'
--    AND column_name IN ('peticao_storage_path','lacre_storage_path','aprovacao_declaracao')
--  ORDER BY column_name;

-- ── CONFERÊNCIA 2 — petição aprovada sem arquivo ────────────────────────────
-- Esperado: ZERO linhas depois do deploy. Cada linha aqui é um cliente que
-- aprovou a petição e cuja peça NÃO está no dossiê — exatamente o furo que
-- esta rodada fecha. As aprovações feitas ANTES do deploy aparecem aqui: são
-- o passivo, e se resolvem reenviando a peça ao cliente para nova aprovação.
--
-- SELECT g.id,
--        g.cliente_id,
--        g.processo_id,
--        g.aprovada_cliente_em,
--        g.peticao_storage_path
--   FROM public.qa_geracoes_pecas g
--  WHERE g.status_cliente = 'aprovada'
--    AND g.processo_id IS NOT NULL
--    AND g.peticao_storage_path IS NULL
--  ORDER BY g.aprovada_cliente_em DESC;

-- ── CONFERÊNCIA 3 — a petição entrou no checklist do processo ───────────────
-- Uma linha por processo com petição aprovada. `status` tem que ser 'aprovado'
-- e `arquivo_storage_key` não pode ser nulo — é o que faz a juntada levá-la.
--
-- SELECT d.processo_id,
--        d.status,
--        d.arquivo_storage_key IS NOT NULL AS tem_arquivo,
--        d.data_validacao
--   FROM public.qa_processo_documentos d
--  WHERE d.tipo_documento = 'peticao_efetiva_necessidade'
--  ORDER BY d.data_validacao DESC;
