---
name: Checklist lê validade do catálogo e respostas do cadastro
description: Regra estrutural — qa_processo_documentos não guarda cópia própria de validade, e cadastro do cliente vira resposta derivada do checklist
type: feature
---
Duas causas estruturais corrigidas:

1. **Validade** — `qa_processo_documentos` guardava cópia estática do prazo e ficava velha.
   Agora o trigger `trg_qa_proc_doc_sync_validade` recalcula `validade_dias` e `data_validade`
   a partir de `qa_validade_documentos` / `qa_calcular_validade` em todo INSERT e em UPDATE de
   `tipo_documento`, `data_emissao`, `extracao_ia_json` ou `status`.
   Prioridade: data declarada pelo documento (`extracao_ia_json.data_validade`) > catálogo > nada.
   Perpétuo (nota fiscal, BO) zera `data_validade`.

2. **Respostas derivadas do cadastro** — `respostasCadastro.ts` (espelhado em
   `supabase/functions/_shared/`) injeta `categoria_titular` e `titular_profissao` vindos de
   `qa_clientes` nas respostas do checklist, sem sobrescrever o que o cliente respondeu no
   processo e sem gravar isso em `respostas_questionario_json`.
   Consumido por `checklistGuiadoEngine.carregarProcessoGuia`,
   `qa-processo-checar-conclusao-checklist` e `qa-processo-etapa-auto-liberar`.
   Isso permite `exige_quando: { categoria_titular: "seguranca_publica" }` e fecha sozinha a
   pergunta de profissão já respondida no cadastro.
