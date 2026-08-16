-- ============================================================================
-- Efetiva necessidade — persistir o "Já registrei o boletim".
--
-- Furo real (15/08/2026): o botão "Já registrei o boletim" só mexia em estado
-- local do componente. O checklist nunca ficava sabendo, então o passo
-- "Registrar o boletim na delegacia" continuava pendente para sempre.
-- ============================================================================
ALTER TABLE public.qa_efetiva_necessidade
  ADD COLUMN IF NOT EXISTS bo_registro_confirmado_em timestamptz;

COMMENT ON COLUMN public.qa_efetiva_necessidade.bo_registro_confirmado_em IS
  'Quando o cliente declarou no portal que já registrou o boletim na delegacia. Não substitui o documento: o passo "Enviar o boletim" continua exigindo o PDF.';
