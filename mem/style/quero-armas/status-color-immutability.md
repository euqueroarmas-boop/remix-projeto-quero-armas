---
name: Status Color Immutability
description: Cores de status (verde=ativo, vermelho=erro/inativo, âmbar=alerta, azul=info) NUNCA podem ser trocadas durante restyling de UI
type: constraint
---
Botões/badges que comunicam STATUS (ativo/inativo, pago/pendente, sucesso/erro, alerta) têm cores semânticas fixas:
- Verde (emerald/green) = ATIVO, PAGO, SUCESSO, OK
- Vermelho/âmbar = ERRO, INATIVO, ALERTA
- Azul = INFO

Ao aplicar identidade visual Quero Armas (preto + vermelho bordo #7A1F2B), trocar APENAS botões de ação (CTAs, salvar, novo, etc). NUNCA trocar a cor de elementos de status — eles são leitura semântica e mudá-los quebra a comunicação visual.
