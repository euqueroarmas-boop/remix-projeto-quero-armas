# Correção definitiva da falsa rejeição “tipo” em certidões

## Diagnóstico confirmado

- A certidão STM foi reconhecida no tipo canônico `antecedentes_militar`.
- O processo do cliente possui separadamente as exigências STM (`antecedentes_militar`) e TJM (`antecedentes_militar_estadual`).
- A rejeição não veio da conferência dos dados da certidão. Ela foi produzida pela comparação entre o tipo lido e o estado/lista de pendências do slot aberto.
- Quando essa comparação falha, a tela envia `motivo_rejeicao: "tipo"`; a função de notificação também usa `"tipo"` como fallback. Por isso o administrador recebeu uma chave técnica sem explicação.

## Área do cliente

1. Normalizar todos os tipos de pendência para o vocabulário canônico do Hub antes de comparar o documento com o checklist.
2. Manter STM e TJM como certidões diferentes, sem permitir que uma seja confundida com a outra.
3. Só rejeitar por documento incorreto quando houver comprovação de que:
   - o parser identificou um tipo diferente do slot; e
   - esse tipo não corresponde a nenhuma exigência pendente do processo.
4. Quando a certidão corresponder a outra pendência válida, salvá-la no tipo correto e manter apenas a exigência original em aberto.
5. Exibir sempre o motivo completo, com “documento identificado” e “documento exigido”; nunca mostrar códigos como `tipo` ao cliente.

## Área administrativa e notificações

1. Enviar separadamente um código interno e uma mensagem descritiva de rejeição.
2. Remover `"tipo"` como fallback da função de notificações.
3. Exibir na notificação o tipo identificado, o slot esperado e o motivo objetivo da recusa.
4. Preservar os detalhes estruturados produzidos pela conferência de certidões (`problemas[]`) para rejeições por titular, resultado positivo, campo ausente ou divergente.

## Regressão automatizada

- Testar aliases legados e tipos canônicos de STM/TJM.
- Testar certidão STM enviada no slot STM: aceita.
- Testar certidão TJM enviada no slot STM com TJM pendente: reclassificada e aceita.
- Testar certidão TJM enviada no slot STM sem TJM pendente: bloqueada com motivo descritivo.
- Testar que nenhuma notificação persiste ou exibe apenas `tipo`.

## Validação final

- Reproduzir o fluxo do cliente Pedro com a certidão STM.
- Confirmar que o documento é conferido pelos campos e pelo resultado “nada consta”, sem falso bloqueio de slot.
- Confirmar no painel administrativo que a notificação mostra uma explicação completa.