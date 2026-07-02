-- Alimenta imagens reais da Taurus TX22 no catálogo de armamentos.
-- Base legal de referência do sistema Quero Armas: Lei 10.826/2003,
-- Decreto 11.615/2023, Decreto 12.345/2024, IN DG/PF 201 e IN DG/PF 311.

UPDATE public.qa_armamentos_catalogo
SET
  imagem = '/armas/tx22/tx22-01.png',
  imagens = ARRAY[
    '/armas/tx22/tx22-01.png',
    '/armas/tx22/tx22-02.png',
    '/armas/tx22/tx22-03.png',
    '/armas/tx22/tx22-04.png',
    '/armas/tx22/tx22-05.png',
    '/armas/tx22/tx22-06.png',
    '/armas/tx22/tx22-07.png',
    '/armas/tx22/tx22-08.png',
    '/armas/tx22/tx22-09.png',
    '/armas/tx22/tx22-10.png'
  ]::text[],
  imagem_fonte = 'Taurus USA, EveryGunPart e American Rifleman',
  fonte_url = COALESCE(fonte_url, 'https://www.taurususa.com/product/pistols/taurustx-22/taurustx-22/'),
  imagem_status = 'pronta',
  imagem_aprovada = true,
  imagem_validada_em = COALESCE(imagem_validada_em, now())
WHERE upper(marca) = 'TAURUS'
  AND regexp_replace(upper(modelo), '[^A-Z0-9]+', '', 'g') = 'TX22';
