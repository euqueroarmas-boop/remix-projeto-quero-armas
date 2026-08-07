---
name: Certidão militar — União (STM) x Estadual (TJM)
description: Regra de classificação que impede a certidão do STM ser lida como Certidão Federal TRF3
type: feature
---
A Justiça Militar da União é ramo PRÓPRIO do Judiciário — não é Justiça Federal
comum e NUNCA é TRF. São dois documentos distintos, com slots distintos:

- `antecedentes_militar` — Justiça Militar da União (STM / Superior Tribunal Militar)
- `antecedentes_militar_estadual` — Tribunal de Justiça Militar estadual (TJM/TJME)

Travas ativas:
1. `qa-classificar-documento-arma`: `detectarCertidaoMilitar()` roda ANTES das
   regras de TJSP/TRF3 e usa SOMENTE o texto do PDF.
2. O modelo da Biblioteca é DESCARTADO quando conflita com o órgão lido no PDF.
   A Biblioteca ignora palavras genéricas (CERTIDAO, JUSTICA, PODER...) e exige
   60% de cobertura das palavras discriminantes.
3. Front (`ClienteDocsHubModal`): a justificativa escrita pela IA saiu do
   haystack — usar a prosa do modelo para confirmar o próprio modelo é
   raciocínio circular. `detectaSubtipoCertidaoFederal` retorna null em
   documento militar.
