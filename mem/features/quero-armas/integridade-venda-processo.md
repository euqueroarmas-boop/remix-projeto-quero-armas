---
name: QA Integridade Venda↔Processo
description: Bloqueia divergência Posse/Porte entre item da venda e processo. qa-processo-criar valida servico_id contra qa_itens_venda.
type: feature
---

## Regra
Em `supabase/functions/qa-processo-criar/index.ts`, quando `venda_id` é fornecido:
- Carrega `qa_itens_venda` da venda.
- Se nenhum item tiver `servico_id` → 409 `VENDA_SEM_SERVICOS`.
- Se `servico_id` solicitado não está em algum item → 409 `INTEGRITY_VENDA_PROCESSO_MISMATCH`.
- Sempre loga em `logs_sistema` (tipo=erro/admin) com `venda_id`, `servico_id_solicitado`, `servico_ids_da_venda`.

## Proibições absolutas
- Nunca cair em fallback Posse (id=2) ou outro serviço default.
- Nunca comparar serviço por nome / `includes()` / similaridade.
- Nunca aceitar divergência "silenciosa" entre venda e processo.

## Catálogo canônico
- `posse-arma-fogo` → servico_id=2 → "Posse na Polícia Federal"
- `porte-arma-fogo` → servico_id=3 → "Porte na Polícia Federal"

## Testes
`src/lib/quero-armas/__tests__/integridadeVendaProcesso.test.ts` — 8 testes cobrindo Posse/Porte cruzados, venda sem serviço, multi-item, criação manual sem venda.
