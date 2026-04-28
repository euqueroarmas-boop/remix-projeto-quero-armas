-- Tabela aditiva: registra eventos críticos do cadastro público.
-- Sem PII bruta: hash de IP e UA; payload JSONB livre porém pequeno.
CREATE TABLE IF NOT EXISTS public.qa_cadastro_telemetria (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      text NOT NULL,
  categoria_titular text,
  sessao_id       text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_hash         text,
  user_agent_hash text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qa_cadastro_telemetria_event_type_chk
    CHECK (event_type IN (
      'cpf_rg_ambiguity_detected',
      'divergencia_confirmada',
      'circunscricao_nao_encontrada'
    ))
);

-- Índices para o painel admin
CREATE INDEX IF NOT EXISTS idx_qa_cadastro_telemetria_event_created
  ON public.qa_cadastro_telemetria (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_cadastro_telemetria_categoria_created
  ON public.qa_cadastro_telemetria (categoria_titular, created_at DESC);

-- RLS: anon não vê nem insere nada direto. Insert é exclusivo do service_role
-- (via Edge Function `qa-telemetria-evento`). Staff lê tudo.
ALTER TABLE public.qa_cadastro_telemetria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qa_cadastro_telemetria_staff_select"
  ON public.qa_cadastro_telemetria;
CREATE POLICY "qa_cadastro_telemetria_staff_select"
  ON public.qa_cadastro_telemetria
  FOR SELECT
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

-- Sem políticas de INSERT/UPDATE/DELETE: bloqueado para todos os papéis
-- a não ser service_role (que ignora RLS por design).
