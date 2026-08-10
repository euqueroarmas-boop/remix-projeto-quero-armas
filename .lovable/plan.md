# Correção do painel de progresso do admin (mismatch semântico)

Sim, há mismatch. Conferi o cadastro do João Luiz (cliente 219) direto no banco e o painel está descrevendo uma realidade que não existe.

## O que o painel mostra x o que é verdade

| Painel | Realidade no banco |
|---|---|
| 6 de 32 entregues | João **nunca entregou nenhum documento**. Os 6 são 5 itens dispensados (comprovante de residência reaproveitado + 4 do grupo "imóvel de terceiro") e 1 passo da efetiva contado como pré-cumprido |
| Fase: EFETIVA NECESSIDADE | Não existe **nenhum** registro de efetiva necessidade para ele. O bloqueio real são as perguntas de cadastro (estado civil, profissão, condição de renda) e os documentos base (CIN, foto 3x4) |
| Próximo: Declaração de efetiva necessidade | O próximo passo real é responder as perguntas do cadastro |
| Parado há 5 dias | Houve movimentação de checklist em 07/08 (o contador só olha data de envio de arquivo) |
| Um único processo | Ele tem **dois** processos abertos: Autorização de Compra e CRAF/GT. O de CRAF/GT está vazio (0/0) e nem deveria estar aberto ainda pela regra-mãe |

## Correções

1. **"Entregues" volta a significar entregue.** Itens dispensados saem da contagem de entregues e também do total — o denominador passa a ser só o que o cliente precisa mesmo fazer. Exibir, ao lado, quantos foram dispensados (ex.: "1 de 27 · 5 dispensados"), sem inflar o progresso.
2. **Fase e próxima pendência respeitam a ordem real do fluxo.** Nova prioridade: perguntas/dados de cadastro → documentos base (identidade, foto) → ocupação lícita → efetiva necessidade → exames → certidões → peças internas. A efetiva necessidade deixa de ser prioridade 1 automática; ela só sobe quando o cliente já respondeu o cadastro ou já iniciou o questionário da efetiva. Nova fase **CADASTRO** para as perguntas pendentes.
3. **Grupo em andamento continua tendo precedência** (regra já aplicada para o Gilson), agora combinada com a ordem acima.
4. **Processos vazios não poluem o painel.** Processo sem nenhum documento obrigatório e com serviço dependente (CRAF/GT antes da autorização concluída) fica oculto da lista principal, ou aparece marcado como "AGUARDANDO ETAPA ANTERIOR" — a decidir na implementação; a proposta é ocultar.
5. **"Parado há X dias" passa a considerar movimentação real:** último envio de arquivo, última mudança de status do checklist, última resposta do questionário e última ciência registrada — o maior entre eles.
6. **CERTIDOES → CERTIDÕES** (acentuação, alinhando com as demais fases).

## Detalhe técnico

Toda a mudança fica na função SQL `public.qa_painel_progresso_clientes()`:
- CTE `docs`: separar `ok` (só `aprovado`) de `dispensados`; `total` exclui dispensados e `nao_aplicavel`.
- CTE `pend`: nova escala de prioridade com `pergunta_%` e `renda_definir_condicao` em prioridade 0.5, efetiva rebaixada e condicionada a `EXISTS qa_efetiva_necessidade` ou cadastro respondido.
- CTE `base`: `ultima_atividade` = `GREATEST` de `data_envio`, `qa_processo_documentos.updated_at`, `qa_efetiva_necessidade.updated_at` e `qa_cliente_ciencias.created_at`.
- Filtro final: descartar processos com `total_docs = 0`.
- `DashboardProgressoClientes.tsx`: exibir a coluna de dispensados e a nova fase CADASTRO; nenhuma outra mudança de layout.
