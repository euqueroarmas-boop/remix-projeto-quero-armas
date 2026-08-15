-- =============================================================================
-- Rastro de tentativas + bloqueio de arquivo repetido (eTag)
--
-- Implementa a regra canônica de docs/RASTRO-DOCUMENTAL.md e fecha o furo do
-- MESMO ARQUIVO entregue em exigências diferentes.
--
-- Decisões do usuário (15/08/2026):
--   • arquivo recusado é APAGADO na hora (a trilha guarda nome, tamanho e eTag)
--   • tentativas recusadas ficam SÓ no painel da equipe
--
-- Evidência do furo em produção (mesmo eTag, tipos diferentes):
--   a4967252e8… → 00000090-000156313600466.pdf gravado como 'antecedentes_militar'
--   às 19:41 e como 'comprovante_residencia' às 20:19 de 03/08.
--
-- Por que eTag e não hash próprio: storage.objects já guarda o eTag de 100% do
-- acervo (84/84 conferidos), e para upload de peça única ele é o MD5 do
-- conteúdo. Isso dispensa coluna nova, backfill e cálculo no navegador — e
-- elimina o risco de front e backfill divergirem de algoritmo.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) ESTRUTURA DA TRILHA
--    Hoje ela não aceita tentativa sem documento, e perde o histórico quando o
--    documento é apagado — as duas coisas que a regra proíbe.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.qa_documentos_cliente_eventos
  ALTER COLUMN documento_id DROP NOT NULL;

-- FK: de ON DELETE CASCADE para ON DELETE SET NULL. O nome é descoberto no
-- catálogo porque a constraint original nasceu sem nome explícito.
DO $fk$
DECLARE v_con text;
BEGIN
  SELECT c.conname INTO v_con
    FROM pg_constraint c
   WHERE c.conrelid = 'public.qa_documentos_cliente_eventos'::regclass
     AND c.contype = 'f'
     AND c.conkey = ARRAY[(
       SELECT a.attnum FROM pg_attribute a
        WHERE a.attrelid = 'public.qa_documentos_cliente_eventos'::regclass
          AND a.attname = 'documento_id'
     )];
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.qa_documentos_cliente_eventos DROP CONSTRAINT %I', v_con);
  END IF;
END
$fk$;

ALTER TABLE public.qa_documentos_cliente_eventos
  ADD CONSTRAINT qa_docs_eventos_documento_fk
  FOREIGN KEY (documento_id)
  REFERENCES public.qa_documentos_cliente(id)
  ON DELETE SET NULL;

-- CHECK de `acao`: acrescenta o valor das tentativas barradas.
DO $ck$
DECLARE v_con text;
BEGIN
  SELECT c.conname INTO v_con
    FROM pg_constraint c
   WHERE c.conrelid = 'public.qa_documentos_cliente_eventos'::regclass
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) ILIKE '%acao%';
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.qa_documentos_cliente_eventos DROP CONSTRAINT %I', v_con);
  END IF;
END
$ck$;

ALTER TABLE public.qa_documentos_cliente_eventos
  ADD CONSTRAINT qa_docs_eventos_acao_check
  CHECK (acao IN (
    'upload','visualizado','baixado','renovado','removido',
    'aprovado','reprovado','substituido','editado','expirou',
    'tentativa_bloqueada'
  ));

CREATE INDEX IF NOT EXISTS idx_qa_docs_eventos_tentativas
  ON public.qa_documentos_cliente_eventos (qa_cliente_id, created_at DESC)
  WHERE acao = 'tentativa_bloqueada';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) RLS
--    Decisão: tentativa recusada é visível só para a equipe. A policy do
--    cliente já falharia por exigir EXISTS no documento (que é nulo), mas a
--    exclusão fica EXPLÍCITA para não depender desse efeito colateral.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Cliente vê eventos dos próprios documentos"
  ON public.qa_documentos_cliente_eventos;
CREATE POLICY "Cliente vê eventos dos próprios documentos"
ON public.qa_documentos_cliente_eventos FOR SELECT
TO authenticated
USING (
  acao <> 'tentativa_bloqueada'
  AND EXISTS (
    SELECT 1 FROM public.qa_documentos_cliente d
     WHERE d.id = qa_documentos_cliente_eventos.documento_id
       AND (
         d.customer_id IN (SELECT customer_id FROM public.cliente_auth_links WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::lp_app_role)
       )
  )
);

DROP POLICY IF EXISTS "Equipe vê tentativas bloqueadas"
  ON public.qa_documentos_cliente_eventos;
CREATE POLICY "Equipe vê tentativas bloqueadas"
ON public.qa_documentos_cliente_eventos FOR SELECT
TO authenticated
USING (
  acao = 'tentativa_bloqueada'
  AND (
    public.qa_is_active_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::lp_app_role)
  )
);

-- INSERT: o registro é gravado pelo próprio cliente logado, no momento em que
-- a recusa acontece na tela dele. Sem esta policy a trilha da regra não existe:
-- a policy antiga exige EXISTS no documento, e tentativa barrada não tem um.
DROP POLICY IF EXISTS "Registra tentativa bloqueada própria"
  ON public.qa_documentos_cliente_eventos;
CREATE POLICY "Registra tentativa bloqueada própria"
ON public.qa_documentos_cliente_eventos FOR INSERT
TO authenticated
WITH CHECK (
  acao = 'tentativa_bloqueada'
  AND documento_id IS NULL
  AND (
    (qa_cliente_id IS NOT NULL AND qa_cliente_id = public.qa_current_cliente_id(auth.uid()))
    OR (customer_id IS NOT NULL AND customer_id IN (
          SELECT customer_id FROM public.cliente_auth_links WHERE user_id = auth.uid()))
    OR public.qa_is_active_staff(auth.uid())
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) RPC: este arquivo já existe no acervo deste cliente?
--    Chamada pelo modal do Hub logo após o upload e ANTES de gravar. Devolve o
--    documento anterior e o estado dele, que é o que define a mensagem exibida.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_documento_duplicado_por_arquivo(
  p_storage_path   text,
  p_qa_cliente_id  integer DEFAULT NULL,
  p_customer_id    uuid    DEFAULT NULL
)
RETURNS TABLE (
  documento_id       uuid,
  tipo_documento     text,
  nome_documento     text,
  status             text,
  motivo_reprovacao  text,
  arquivo_nome       text,
  aprovado_em        timestamptz,
  enviado_em         timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $dup$
DECLARE
  v_etag       text;
  v_staff      boolean := public.qa_is_active_staff(auth.uid());
  v_qa_cliente integer;
  v_customer   uuid;
BEGIN
  -- Escopo: cliente comum só compara contra o PRÓPRIO acervo, sempre — os
  -- parâmetros são ignorados para ele. Sem isso a função viraria sonda do
  -- acervo alheio para qualquer usuário autenticado.
  IF v_staff THEN
    v_qa_cliente := p_qa_cliente_id;
    v_customer   := p_customer_id;
  ELSE
    v_qa_cliente := public.qa_current_cliente_id(auth.uid());
    SELECT l.customer_id INTO v_customer
      FROM public.cliente_auth_links l
     WHERE l.user_id = auth.uid() AND l.customer_id IS NOT NULL
     LIMIT 1;
  END IF;

  IF v_qa_cliente IS NULL AND v_customer IS NULL THEN
    RETURN;
  END IF;

  SELECT replace(o.metadata->>'eTag', '"', '') INTO v_etag
    FROM storage.objects o
   WHERE o.bucket_id = 'qa-documentos' AND o.name = p_storage_path;

  -- Upload particionado gera eTag com sufixo (-N) e não é comparável entre
  -- envios. Nesse caso a função se cala e vale a trava por tipo, como hoje.
  IF v_etag IS NULL OR v_etag !~ '^[0-9a-f]{32}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT d.id, d.tipo_documento, d.nome_documento, d.status, d.motivo_reprovacao,
         d.arquivo_nome, d.aprovado_em, d.created_at
    FROM public.qa_documentos_cliente d
    JOIN storage.objects o2
      ON o2.bucket_id = 'qa-documentos' AND o2.name = d.arquivo_storage_path
   WHERE replace(o2.metadata->>'eTag', '"', '') = v_etag
     AND d.arquivo_storage_path <> p_storage_path
     -- Documento já descartado não impede reenvio: substituído e excluído
     -- saíram do acervo de propósito.
     AND d.status NOT IN ('excluido', 'substituido')
     AND (
       (v_qa_cliente IS NOT NULL AND d.qa_cliente_id = v_qa_cliente)
       OR (v_customer IS NOT NULL AND d.customer_id = v_customer)
     )
   ORDER BY d.created_at DESC
   LIMIT 1;
END;
$dup$;

REVOKE ALL ON FUNCTION public.qa_documento_duplicado_por_arquivo(text, integer, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_documento_duplicado_por_arquivo(text, integer, uuid)
  TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) REDE DE SEGURANÇA: trigger que barra a gravação do arquivo repetido
--    Protege os caminhos que não passam pelo modal — autoinsert do Arsenal,
--    lançamento interno e edge functions.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_doc_bloqueia_arquivo_repetido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $blk$
DECLARE
  v_etag text;
  v_dup  record;
BEGIN
  IF nullif(NEW.arquivo_storage_path, '') IS NULL THEN RETURN NEW; END IF;

  SELECT replace(o.metadata->>'eTag', '"', '') INTO v_etag
    FROM storage.objects o
   WHERE o.bucket_id = 'qa-documentos' AND o.name = NEW.arquivo_storage_path;

  IF v_etag IS NULL OR v_etag !~ '^[0-9a-f]{32}$' THEN RETURN NEW; END IF;

  SELECT d.id, d.tipo_documento, d.status INTO v_dup
    FROM public.qa_documentos_cliente d
    JOIN storage.objects o2
      ON o2.bucket_id = 'qa-documentos' AND o2.name = d.arquivo_storage_path
   WHERE replace(o2.metadata->>'eTag', '"', '') = v_etag
     AND d.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND d.status NOT IN ('excluido', 'substituido')
     -- Substituição declarada é legítima: o alvo só vira 'substituido' DEPOIS
     -- do insert do novo, então ele ainda está ativo neste momento.
     AND d.id IS DISTINCT FROM NEW.substitui_documento_id
     AND (
       (NEW.qa_cliente_id IS NOT NULL AND d.qa_cliente_id = NEW.qa_cliente_id)
       OR (NEW.customer_id IS NOT NULL AND d.customer_id = NEW.customer_id)
     )
   LIMIT 1;

  IF v_dup.id IS NOT NULL THEN
    RAISE EXCEPTION
      'Este arquivo já está no acervo deste cliente como "%" (status: %). Documento não gravado.',
      v_dup.tipo_documento, v_dup.status
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$blk$;

DROP TRIGGER IF EXISTS trg_qa_doc_bloqueia_arquivo_repetido ON public.qa_documentos_cliente;
CREATE TRIGGER trg_qa_doc_bloqueia_arquivo_repetido
  BEFORE INSERT ON public.qa_documentos_cliente
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_doc_bloqueia_arquivo_repetido();

COMMIT;
