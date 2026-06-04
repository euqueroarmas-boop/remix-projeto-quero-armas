CREATE OR REPLACE FUNCTION public._qa_diag_release_token()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token text;
  v_err text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_token
      FROM vault.decrypted_secrets
     WHERE name = 'QA_CONTRACT_RELEASE_TOKEN'
     LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  RETURN jsonb_build_object(
    'has_token', v_token IS NOT NULL,
    'len', COALESCE(length(v_token), 0),
    'error', v_err
  );
END;
$$;
REVOKE ALL ON FUNCTION public._qa_diag_release_token() FROM PUBLIC;