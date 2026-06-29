
-- Auto-vinculação de auth.users a qa_clientes para login social/telefone (Híbrido)
-- Vincula por email (case-insensitive) OU celular (apenas dígitos) OU CPF.

CREATE OR REPLACE FUNCTION public.qa_auto_link_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email        text;
  v_phone_digits text;
  v_cliente_id   integer;
  v_cliente_status text;
  v_existing     uuid;
BEGIN
  v_email := lower(coalesce(NEW.email, NEW.raw_user_meta_data->>'email', ''));
  v_phone_digits := regexp_replace(coalesce(NEW.phone, NEW.raw_user_meta_data->>'phone', ''), '\D', '', 'g');

  -- Se já existe vínculo ativo, nada a fazer
  SELECT id INTO v_existing
  FROM public.cliente_auth_links
  WHERE user_id = NEW.id AND status = 'active'
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Tenta achar qa_cliente por email
  IF v_email <> '' THEN
    SELECT id, status INTO v_cliente_id, v_cliente_status
    FROM public.qa_clientes
    WHERE lower(email) = v_email
      AND coalesce(status, '') <> 'excluido_lgpd'
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1;
  END IF;

  -- Se não achou, tenta por celular (apenas dígitos, sufixo 8+ chars)
  IF v_cliente_id IS NULL AND length(v_phone_digits) >= 10 THEN
    SELECT id, status INTO v_cliente_id, v_cliente_status
    FROM public.qa_clientes
    WHERE regexp_replace(coalesce(celular, ''), '\D', '', 'g') = v_phone_digits
      AND coalesce(status, '') <> 'excluido_lgpd'
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_cliente_id IS NOT NULL THEN
    INSERT INTO public.cliente_auth_links
      (qa_cliente_id, user_id, email, status, activated_at)
    VALUES
      (v_cliente_id, NEW.id, v_email, 'active', now())
    ON CONFLICT DO NOTHING;

    UPDATE public.qa_clientes
       SET user_id = NEW.id
     WHERE id = v_cliente_id AND user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Roda no insert (signup) e no update (quando email/phone confirmar)
DROP TRIGGER IF EXISTS qa_auto_link_on_user_created ON auth.users;
CREATE TRIGGER qa_auto_link_on_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.qa_auto_link_auth_user();

DROP TRIGGER IF EXISTS qa_auto_link_on_user_confirmed ON auth.users;
CREATE TRIGGER qa_auto_link_on_user_confirmed
AFTER UPDATE OF email_confirmed_at, phone_confirmed_at ON auth.users
FOR EACH ROW
WHEN (
  (old.email_confirmed_at IS NULL AND new.email_confirmed_at IS NOT NULL)
  OR (old.phone_confirmed_at IS NULL AND new.phone_confirmed_at IS NOT NULL)
)
EXECUTE FUNCTION public.qa_auto_link_auth_user();

-- RPC para o fallback por CPF (chamado pelo front quando o trigger não vinculou)
CREATE OR REPLACE FUNCTION public.qa_vincular_por_cpf(_cpf text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_email        text;
  v_phone_digits text;
  v_cpf_digits   text;
  v_cliente_id   integer;
  v_cliente_status text;
  v_cliente_email text;
  v_cliente_celular text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  v_cpf_digits := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  IF length(v_cpf_digits) <> 11 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cpf_invalido');
  END IF;

  SELECT u.email,
         regexp_replace(coalesce(u.phone,''), '\D', '', 'g')
    INTO v_email, v_phone_digits
  FROM auth.users u WHERE u.id = v_user_id;

  SELECT id, status, lower(coalesce(email,'')), regexp_replace(coalesce(celular,''),'\D','','g')
    INTO v_cliente_id, v_cliente_status, v_cliente_email, v_cliente_celular
  FROM public.qa_clientes
  WHERE regexp_replace(coalesce(cpf,''),'\D','','g') = v_cpf_digits
    AND coalesce(status,'') <> 'excluido_lgpd'
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cliente_nao_encontrado');
  END IF;

  -- Confere coerência mínima: ao menos um dos contatos deve bater (email OU celular)
  -- Senão é tentativa de hijack de cadastro alheio.
  IF NOT (
    (v_email IS NOT NULL AND v_email <> '' AND v_cliente_email = lower(v_email))
    OR (v_phone_digits <> '' AND v_cliente_celular = v_phone_digits)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'contato_divergente');
  END IF;

  INSERT INTO public.cliente_auth_links
    (qa_cliente_id, user_id, email, documento_normalizado, status, activated_at)
  VALUES
    (v_cliente_id, v_user_id, v_email, v_cpf_digits, 'active', now())
  ON CONFLICT DO NOTHING;

  UPDATE public.qa_clientes
     SET user_id = v_user_id
   WHERE id = v_cliente_id AND user_id IS NULL;

  RETURN jsonb_build_object('ok', true, 'qa_cliente_id', v_cliente_id);
END;
$$;

REVOKE ALL ON FUNCTION public.qa_vincular_por_cpf(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qa_vincular_por_cpf(text) TO authenticated;
