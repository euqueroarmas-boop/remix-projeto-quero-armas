---
name: Profissão e estado civil são campos selecionáveis
description: Profissão nunca é digitada — vem do catálogo cruzado com qa_clientes.profissao, preservando variantes semanticamente duplicadas
type: feature
---
- Profissão e estado civil são SEMPRE `select`. Proibido input livre (admin, cadastro público, modal de residência de terceiro).
- Fonte única: `src/lib/quero-armas/profissoesCatalogo.ts`, gerado do cruzamento com valores já existentes em `public.qa_clientes.profissao`. **Nunca inventar profissão nova.**
- Mismatch semântica é PRESERVADA de propósito (EMPRESÁRIO / EMPRESARIO / EMPRESÁRIA, GUARDA MUNICIPAL / GUARDA CIVIL MUNICIPAL). Não fundir variantes.
- `profissaoOptionsCom(valorAtual)` mantém selecionável o valor legado de cadastro que não está no catálogo.
- Profissão NÃO define `categoria_titular`; a ramificação institucional (Portaria Conjunta 1/2024) continua vindo do campo `categoria_titular`.
