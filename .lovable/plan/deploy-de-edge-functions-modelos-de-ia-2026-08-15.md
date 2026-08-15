# Deploy de Edge Functions — Modelos de IA

## Objetivo
Publicar no backend as edge functions já corrigidas no repositório, sem nenhuma alteração de código ou lógica.

## Funções a publicar
- `qa-modelo-aprovado-criar`
- `qa-modelo-biblioteca-treinar`
- `qa-processo-doc-validar-ia`

## Arquivo compartilhado a acompanhar
- `supabase/functions/_shared/embedding.ts` (novo módulo de embedding local via `Supabase.ai.Session` / `gte-small`, 384 dimensões)

## Contexto
Essas três funções passaram a usar o modelo de embedding embutido no runtime do Supabase, substituindo chamadas ao endpoint inexistente `https://ai.gateway.lovable.dev/v1/embeddings`. O deploy deve subir exatamente o código que veio da branch `main`.

## Passos
1. Executar deploy das três edge functions via `supabase--deploy_edge_functions`.
2. Aguardar conclusão e confirmar quais funções foram efetivamente publicadas.

## Não será feito
- Nenhuma edição, correção ou reescrita do código das funções.
- Nenhuma alteração em `supabase/config.toml`.
- Nenhuma mudança de schema ou migration.
