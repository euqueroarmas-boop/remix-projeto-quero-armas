---
name: embedding-local-gte-small
description: Embeddings do Hub rodam LOCAL no runtime do Supabase (gte-small, 384 dim). Proibido chamar /v1/embeddings do gateway Lovable — não existe. Proibido pedir vetor a modelo de chat.
type: tech
---
**Fonte única de embedding:** `supabase/functions/_shared/embedding.ts` → `gerarEmbedding(texto)`.
Usa `Supabase.ai.Session("gte-small")`, que roda **dentro da edge function**: sem
chamada externa, sem chave, sem fatura. Saída: **384 dimensões**. Confirmado
funcionando em produção em 15/08/2026.

**PROIBIDO — dois erros já cometidos neste projeto:**

1. `https://ai.gateway.lovable.dev/v1/embeddings` **não existe**. Três funções
   chamavam esse endereço (`qa-modelo-aprovado-criar`, `qa-modelo-biblioteca-treinar`,
   `qa-processo-doc-validar-ia`), falhavam 100% das vezes e devolviam `null` em
   silêncio. Resultado: 20 modelos aprovados gravados sem embedding, tela
   dizendo "MODELO TREINADO — IA ATUALIZADA", e a comparação contra modelo em
   `qa-processo-doc-validar-ia` inerte por meses sem ninguém saber.

2. Pedir a um modelo de **chat** um "array de 1536 floats" (padrão ainda vivo em
   `qa-kb-embed`) não gera embedding — gera número inventado. Pior: aquele código
   aceita 100 números e completa o resto com **zeros** até fechar o tamanho. Passa
   na validação de formato e não significa nada. **Não copiar esse padrão.**

**Regra do módulo:** ou devolve vetor válido, ou devolve o MOTIVO da falha.
Nunca `null` mudo, nunca dimensão remendada com zero. Quem chama é obrigado a
mostrar a falha na tela (`com_embedding: false` + aviso).

**Dimensão é contrato triplo.** Mudou o modelo, muda nos três:
`qa_documentos_modelos_aprovados.embedding_texto` · RPC `match_qa_modelos_aprovados`
· constante `EMBEDDING_DIMENSOES`. Hoje: **384**.

**Backfill = `qa-modelo-aprovado-criar` com `{ backfill: true }`.** Mora nessa
função de propósito: função NOVA não sobe junto com o site no fluxo do Lovable
("Failed to send a request to the Edge Function"). Modo novo em função já
publicada viaja junto.

**Lote pequeno é obrigatório.** O modelo carrega na memória da função; mais de
~3 por invocação estoura `WORKER_RESOURCE_LIMIT`. O cliente
(`AvisoReferenciasIaPendentes`) repete de 3 em 3 com 5s de pausa, trata falta de
recurso como temporária (descansa e insiste) e manda em `excluir` os IDs que
falharam — sem isso os mesmos registros voltam para sempre e o laço nunca avança.

**Índice vetorial:** removido. `ivfflat` com 100 listas em tabela de 20 linhas
nunca foi usado (0 acessos em 128 dias) e o Postgres estava certo — varrer 20
linhas é mais rápido. Recriar só acima de ~1.000 modelos, com `lists = linhas/1000`.

**Pendente:** `qa_kb_artigos` (21 artigos, 15 com vetor) ainda usa o improviso do
chat com 1536 dimensões. Os vetores de lá são lixo e precisam ser refeitos com
este módulo — envolve mudar a coluna, a RPC e `qa_kb_search_hybrid`.
