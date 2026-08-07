---
name: Sensor de movimento dos processos
description: Regra global de cor (verde/amarelo/vermelho) dos processos na área do cliente, baseada em dias sem movimentação
type: feature
---
Sensor dos cards de PROCESSOS na área do cliente (não é prazo de vencimento):
- 0 a 6 dias sem movimentação → VERDE (processo andando normalmente)
- 7 a 14 dias sem movimentação → AMARELO
- 15 dias ou mais → VERMELHO
Qualquer documento entregue pelo cliente zera o contador e devolve o sensor ao VERDE.
Persistido em `public.qa_config`: `processo_sensor_amarelo_dias` = 7, `processo_sensor_vermelho_dias` = 15.
Implementado em `ClienteResumoKanban.tsx` (`sensorMovimento`).

Rótulo de prazo dos documentos: sem a palavra "FALTAM" e sem bolinha antes do numeral; fonte do numeral igual à do texto do documento (11px). A leitura das cores vem da legenda no rodapé do card.
