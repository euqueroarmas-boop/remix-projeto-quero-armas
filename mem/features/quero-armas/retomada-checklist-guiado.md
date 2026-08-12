---
name: Retomada do checklist guiado — voltar sem perder o lugar
description: Sair da tela de progresso ou fechar o navegador não faz o cliente perder o lugar; ao voltar, o portal devolve a mesma seção, a mesma pendência e a mesma rolagem.
type: feature
---

# Retomada do checklist guiado — voltar sem perder o lugar

## Regra

O cliente pode sair da tela de progresso (trocar de seção, fechar a aba, fechar o
navegador) e, ao voltar, tem de encontrar **a mesma tela**: mesma seção do
portal, mesma pendência do checklist e a leitura no mesmo ponto.

## O que é guardado (e o que NÃO é)

Só a **posição**. Nada de conteúdo do processo sai para o aparelho:

- `pendenciaId` — item da fila em que ele parou (`doc:123`,
  `efetiva:<processo>:<passo>`, `sig:...`);
- `scrollTop` — rolagem do corpo do checklist naquele item;
- `secao` — seção do portal (`checklist_guiado`, `documentos`, `financeiro`, …).

O **conteúdo** já é persistido por quem o produz e continua assim:
Efetiva Necessidade autossalva relato/respostas/provas em
`qa_efetiva_necessidade` (debounce de 800 ms + flush ao desmontar) e os
documentos vivem no Hub. A retomada não duplica nada disso.

## Comportamento

- Chave `qa_checklist_retomada:<clienteId>` no **localStorage** (sobrevive a
  fechar o navegador, ao contrário do `sessionStorage`), **por cliente** — dois
  logins no mesmo aparelho não se misturam.
- Validade de **7 dias**; registro vencido ou corrompido é descartado sem erro.
- A posição é **sempre revalidada contra a fila real**: pendência já resolvida
  (inclusive em outro aparelho) nunca é retomada — a fila manda e o cliente cai
  no primeiro item.
- A **trava de ordem por grupo** continua valendo: a retomada não pula para um
  grupo bloqueado.
- Assinatura pendente e `pinnedId` continuam tendo **prioridade** sobre a
  memória (contrato/procuração primeiro é regra inegociável).
- Navegação manual (**Anterior**) desliga a retomada pelo resto da sessão do
  pop-up e passa a valer como novo ponto salvo.
- A seção `checklist_guiado` (página mobile/granada) só é restaurada se ainda
  houver pendência — senão o cliente volta ao Resumo.
- Deep link (`?secao=` ou rota específica) vence a memória.
- A dispensa do pop-up (`qa:pendencias-dismissed`, `sessionStorage`) **não
  muda**: continua valendo só na sessão. Ver
  mem://features/quero-armas/popup-pendencias-dismissivel.

## Implementação

- Persistência: `src/lib/quero-armas/documentAssistantProgress.ts`
  (`loadChecklistRetomada` / `saveChecklistRetomada` — grava por MESCLA —
  `clearChecklistRetomada`, `resolveRetomadaIndex`).
- Fila e rolagem: `PendenciasGuiadasPopup` via prop `retomadaClienteId`
  (ausente = sem memória, como no simulador da equipe).
- Seção do portal: `QAClientePortalPage` (`secaoRestauradaRef` — restaura antes
  de começar a gravar, senão o "resumo" do primeiro render apaga a memória).
- Testes: `src/lib/quero-armas/__tests__/checklistRetomada.test.ts`.
