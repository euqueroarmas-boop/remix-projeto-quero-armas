-- =============================================================================
-- Busca do credenciado pela credencial lida no laudo
--
-- Para conferir se o psicólogo ou o instrutor que assinou o laudo existe no
-- cadastro da Polícia Federal. Quando não existe, o cliente AVANÇA e quem é
-- avisado é a equipe (regra do usuário, 01/08/2026).
--
-- ── Por que comparar por DÍGITOS ─────────────────────────────────────────
--
-- Os dois lados escrevem a mesma credencial de formas diferentes:
--
--   Psicólogo   tabela: 'CRP 10/03363'            laudo: '06/60.138'
--   Instrutor   tabela: '041/2025'                laudo: '002/2021-DREX/SR/PF/SP'
--
-- Removendo tudo que não é dígito, os dois viram a mesma estrutura — o
-- prefixo 'CRP', o ponto e o sufixo da unidade da PF desaparecem, e sobra o
-- número da credencial. Verificado contra dados reais das duas tabelas.
--
-- A comparação é por IGUALDADE dos dígitos, não por `LIKE`: portaria '041/2025'
-- e '1041/2025' são profissionais diferentes, e um `contains` casaria as duas.
-- =============================================================================

BEGIN;

-- Só os dígitos da credencial. IMMUTABLE para poder virar índice.
CREATE OR REPLACE FUNCTION public.qa_credencial_digitos(p_valor text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn_dig$
  SELECT regexp_replace(coalesce(p_valor, ''), '\D', '', 'g');
$fn_dig$;

COMMENT ON FUNCTION public.qa_credencial_digitos(text) IS
  'Normaliza CRP ou portaria para comparação: mantém só os dígitos. CRP 10/03363 e 10/03.363 viram 1003363.';

-- Índices de expressão: sem eles a busca varre a tabela inteira a cada laudo.
CREATE INDEX IF NOT EXISTS idx_psico_credencial_digitos
  ON public.qa_psico_credenciados (public.qa_credencial_digitos(registro));

CREATE INDEX IF NOT EXISTS idx_iat_credencial_digitos
  ON public.qa_iat_credenciados (public.qa_credencial_digitos(portaria));

-- ─── A busca ─────────────────────────────────────────────────────────────
-- Devolve no máximo uma linha. Vazio significa "não encontrado", e é isso que
-- dispara o alerta para a equipe — nunca para o cliente.
CREATE OR REPLACE FUNCTION public.qa_credenciado_por_credencial(
  p_tipo       text,   -- 'psico' | 'iat'
  p_credencial text
)
RETURNS TABLE (
  nome      text,
  uf        text,
  validade  text,
  fonte_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn_busca$
DECLARE
  v_dig text := public.qa_credencial_digitos(p_credencial);
BEGIN
  -- Credencial curta demais não identifica ninguém. Devolver vazio aqui seria
  -- pior: viraria "não encontrado" e alarmaria a equipe à toa. Quem chama
  -- distingue os dois casos pelo próprio comprimento antes de perguntar.
  IF v_dig IS NULL OR length(v_dig) < 5 THEN
    RETURN;
  END IF;

  IF p_tipo = 'psico' THEN
    RETURN QUERY
      SELECT c.nome, c.uf, c.validade::text, c.source_url
        FROM public.qa_psico_credenciados c
       WHERE public.qa_credencial_digitos(c.registro) = v_dig
       LIMIT 1;
  ELSIF p_tipo = 'iat' THEN
    RETURN QUERY
      SELECT c.nome, c.uf, c.validade::text, c.fonte_url
        FROM public.qa_iat_credenciados c
       WHERE public.qa_credencial_digitos(c.portaria) = v_dig
       LIMIT 1;
  END IF;
END;
$fn_busca$;

-- A equipe consulta pelo painel; o portal do cliente consulta ao enviar o
-- laudo. Ambos autenticados — a lista de credenciados é pública na PF, não há
-- dado sensível aqui.
REVOKE ALL ON FUNCTION public.qa_credenciado_por_credencial(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_credenciado_por_credencial(text, text) TO authenticated, service_role;

COMMIT;
