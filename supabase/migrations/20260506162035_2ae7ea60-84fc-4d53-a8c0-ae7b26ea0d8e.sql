-- Tabela de declarações persistentes "Não possuo mais a GT".
-- A GT (guia de tráfego inicial/retirada) é informativa: a ausência não bloqueia
-- nada, mas a declaração explícita do cliente precisa ficar registrada para a
-- Equipe Quero Armas, com auditoria real (não pode viver em localStorage).
CREATE TABLE IF NOT EXISTS public.qa_arma_gt_declaracoes (
  id              bigserial PRIMARY KEY,
  qa_cliente_id   integer  NOT NULL REFERENCES public.qa_clientes(id) ON DELETE CASCADE,
  weapon_key      text     NOT NULL, -- "{source}-{id}" estável do Arsenal
  arma_manual_id  bigint   REFERENCES public.qa_cliente_armas_manual(id) ON DELETE SET NULL,
  -- Snapshot identificador da arma (caso o link mude no futuro)
  numero_serie    text,
  numero_sigma    text,
  numero_sinarm   text,
  marca           text,
  modelo          text,
  calibre         text,
  status          text NOT NULL DEFAULT 'nao_possuo'
                  CHECK (status IN ('nao_possuo','revertida')),
  declarado_em    timestamptz NOT NULL DEFAULT now(),
  declarado_por   uuid,
  revertido_em    timestamptz,
  revertido_por   uuid,
  origem          text NOT NULL DEFAULT 'area_cliente',
  metadados_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_qa_arma_gt_decl_cliente_weapon UNIQUE (qa_cliente_id, weapon_key)
);

CREATE INDEX IF NOT EXISTS idx_qa_arma_gt_decl_cliente
  ON public.qa_arma_gt_declaracoes (qa_cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_arma_gt_decl_arma_manual
  ON public.qa_arma_gt_declaracoes (arma_manual_id);

-- Trigger updated_at (reaproveita helper já existente no schema).
DROP TRIGGER IF EXISTS trg_qa_arma_gt_decl_updated ON public.qa_arma_gt_declaracoes;
CREATE TRIGGER trg_qa_arma_gt_decl_updated
  BEFORE UPDATE ON public.qa_arma_gt_declaracoes
  FOR EACH ROW EXECUTE FUNCTION public.lp_set_updated_at();

ALTER TABLE public.qa_arma_gt_declaracoes ENABLE ROW LEVEL SECURITY;

-- SELECT: cliente lê as próprias declarações; staff lê tudo.
CREATE POLICY "qa_gt_decl_select"
  ON public.qa_arma_gt_declaracoes
  FOR SELECT
  TO authenticated
  USING (
    qa_cliente_id = public.qa_current_cliente_id(auth.uid())
    OR public.qa_is_active_staff(auth.uid())
  );

-- INSERT: cliente declara para a própria arma; staff também.
CREATE POLICY "qa_gt_decl_insert"
  ON public.qa_arma_gt_declaracoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    qa_cliente_id = public.qa_current_cliente_id(auth.uid())
    OR public.qa_is_active_staff(auth.uid())
  );

-- UPDATE: permitir reverter (mudar status/revertido_em) — cliente próprio e staff.
CREATE POLICY "qa_gt_decl_update"
  ON public.qa_arma_gt_declaracoes
  FOR UPDATE
  TO authenticated
  USING (
    qa_cliente_id = public.qa_current_cliente_id(auth.uid())
    OR public.qa_is_active_staff(auth.uid())
  )
  WITH CHECK (
    qa_cliente_id = public.qa_current_cliente_id(auth.uid())
    OR public.qa_is_active_staff(auth.uid())
  );

-- DELETE bloqueado — registro histórico/auditável.
CREATE POLICY "qa_gt_decl_no_delete"
  ON public.qa_arma_gt_declaracoes
  FOR DELETE
  TO authenticated
  USING (false);
