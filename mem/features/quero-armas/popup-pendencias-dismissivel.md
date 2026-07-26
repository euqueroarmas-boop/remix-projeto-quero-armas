---
name: Popup de pendências guiadas — dispensável na sessão
description: Ao fechar o popup de pendências guiadas (X ou fora), ele não reabre automaticamente na mesma sessão, permitindo outras atividades.
type: feature
---

# Popup de pendências guiadas — dispensável na sessão

## Regra

O popup unificado de pendências guiadas (`PendenciasGuiadasPopup`) pode ser fechado pelo usuário a qualquer momento para que ele possa realizar outras atividades no portal.

## Comportamento

- Fechar pelo botão **X** ou clicando **fora do modal** grava a chave `qa:pendencias-dismissed` no `sessionStorage`.
- O efeito de auto-reabertura (`"se houver pendências, deve rodar o tempo todo"`) respeita essa chave: **não reabre** enquanto a sessão estiver marcada como dispensada.
- Ações manuais (clique em card de pendência, botão "Enviar", evento `qa:abrir-assinaturas-pendentes`, evento `onAbrirChecklistGuiado`) **limpam** a chave de dispensa e reabrem o popup normalmente.
- Fluxos de conclusão automática (ex.: envio de contrato/procuração assinada) continuam fechando o popup sem marcar a dispensa, para que o próximo item pendente possa ser apresentado automaticamente.

## Implementação

- Estado: `pendenciasGuiadasDismissed` em `QAClientePortalPage.tsx`.
- Helpers: `abrirPendenciasGuiadas(opts)` e `dismissPendenciasGuiadas()`.
- Chave de sessão: `qa:pendencias-dismissed`.
