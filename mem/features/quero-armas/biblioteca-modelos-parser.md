---
name: Modelos de parser na Biblioteca
description: Cada documento da Biblioteca aceita 2+ modelos de referência treinados (determinístico + IA) com selo visual de status
type: feature
---
Na Biblioteca de Documentos (Configurações) cada documento pode receber 2 ou mais arquivos-modelo.
Cada upload vai para `qa-processo-docs/biblioteca-modelos/<codigo>/` e é processado pela edge function
`qa-modelo-biblioteca-treinar`, que grava em `qa_documentos_modelos_aprovados` com `tipo_documento = codigo`:
- análise determinística → `texto_ocr_normalizado` + `palavras_chave_json`
- análise por IA → `embedding_texto`

UI: selo verde `FileCheck2` na linha do documento com contagem e ícones `ScanLine` (determinística) e
`Sparkles` (IA); "sem modelo" em cinza quando não há base de comparação. Painel interno lista cada modelo
com badges det/ia e permite remover (soft delete `ativo = false`).
