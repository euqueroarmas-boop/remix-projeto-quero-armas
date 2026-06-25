-- Limpa coordenadas dos IATs onde o mesmo instrutor tem múltiplos clubes com a MESMA coord
-- (sintoma do bug de chave de preservação). Force re-geocode endereço-a-endereço.
WITH dup AS (
  SELECT nome, portaria, uf, lat, lng
  FROM qa_iat_credenciados
  WHERE lat IS NOT NULL
  GROUP BY nome, portaria, uf, lat, lng
  HAVING COUNT(*) > 1
)
UPDATE qa_iat_credenciados c
SET lat = NULL, lng = NULL, geocode_falhou = false
FROM dup
WHERE c.nome = dup.nome AND COALESCE(c.portaria,'') = COALESCE(dup.portaria,'')
  AND c.uf = dup.uf;