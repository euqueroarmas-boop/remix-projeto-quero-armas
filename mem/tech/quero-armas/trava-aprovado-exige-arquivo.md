---
name: Aprovado exige arquivo próprio
description: Trava de banco que impede documento aprovado sem arquivo ou reaproveitando arquivo de outro tipo de documento
type: feature
---
Triggers `trg_qa_trava_aprovado_exige_arquivo` (qa_processo_documentos) e
`trg_qa_trava_aprovado_exige_arquivo_hub` (qa_documentos_cliente) bloqueiam:

1. status aprovado/validado/conforme sem arquivo anexado;
2. no checklist, aprovação apontando para o MESMO arquivo já usado por outro
   `tipo_documento` no mesmo processo (falso positivo de tipo órfão do
   vocabulário antigo — caso da certidão militar STM x TJM do Anthony).

Status `pendente`, `em_analise` e as famílias de `dispensado` continuam válidos
sem arquivo.
