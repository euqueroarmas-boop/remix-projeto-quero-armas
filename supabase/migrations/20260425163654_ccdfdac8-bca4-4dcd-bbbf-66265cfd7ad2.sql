UPDATE public.qa_crafs
SET nome_arma = 'GLOCK G25'
WHERE id = 13
  AND cliente_id = 9
  AND upper(coalesce(nome_arma, '')) = 'GLOGK G25';

UPDATE public.qa_crafs
SET nome_arma = 'CBC PUMP MILITARY'
WHERE id = 16
  AND cliente_id = 9
  AND upper(coalesce(nome_arma, '')) = 'PUMP ACTION 3.0';

INSERT INTO public.qa_armamentos_catalogo (
  marca,
  modelo,
  apelido,
  tipo,
  calibre,
  capacidade_carregador,
  peso_gramas,
  comprimento_cano_mm,
  alcance_efetivo_m,
  velocidade_projetil_ms,
  origem,
  classificacao_legal,
  descricao,
  stat_dano,
  stat_precisao,
  stat_alcance,
  stat_cadencia,
  stat_mobilidade,
  stat_controle,
  search_tokens,
  ativo,
  status_revisao,
  fonte_dados,
  imagem_status
)
SELECT
  'Taurus',
  'TS9',
  NULL,
  'pistola',
  '9MM',
  17,
  800,
  102,
  50,
  NULL,
  'Brasil',
  'Uso Permitido',
  'Pistola semiautomática Taurus TS9, em calibre 9x19mm, com armação em polímero e operação por ação striker.',
  68,
  76,
  45,
  72,
  74,
  70,
  'TAURUS TS9 TS 9 9MM 9X19 9X19MM PARABELLUM',
  true,
  'verificado',
  'curado',
  'pendente'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.qa_armamentos_catalogo
  WHERE upper(marca) = 'TAURUS'
    AND regexp_replace(upper(modelo), '\s+', '', 'g') = 'TS9'
);