# Correção: quebra de linha do título e cadastro que não abre

## Problema 1 — quebra de linha feia no título do pop-up guiado

Hoje o título do checklist guiado tem uma quebra de linha forçada no meio da frase
("...está nos devendo" + quebra + "enviar este documento!"). Em telas estreitas o
texto ainda quebra sozinho antes disso, e o resultado é o que aparece no print:
"Fabio, você está nos / devendo / enviar este documento!".

Correção (somente no modo pop-up/modal — o modo página da granada continua travado
como aprovado em 03/08/2026):

- Remover a quebra de linha forçada do título.
- Deixar o navegador equilibrar as linhas (`text-wrap: balance`), sem hifenização.
- Manter o primeiro nome e a tipografia Oswald exatamente como estão.

## Problema 2 — cliente não consegue completar o cadastro

O que acontece hoje, confirmado no cadastro do Fábio (id 225, Profissão e
Escolaridade já gravadas no banco):

1. O portal carrega o registro do cliente uma única vez, no início da sessão.
2. O checklist cadastral salva cada resposta direto no banco pela função
   `qa-cliente-atualizar-cadastro` — e isso funciona.
3. O portal, porém, nunca recarrega o cliente depois desses saves. Para ele, os
   campos continuam em branco.
4. Resultado: ao concluir, o pop-up guiado é remontado com os dados antigos,
   mostra de novo "2 campos obrigatórios em branco" e volta para a mesma tela.
   Ao clicar em "Completar cadastro" outra vez, o wizard já considera as
   perguntas respondidas na sessão, não tem nada para exibir e fecha na hora —
   é o "clico e não vai" relatado pelo cliente.

Correção:

- Cada resposta salva no checklist cadastral passa a avisar o portal, que atualiza
  o cliente em memória com o valor recém-gravado.
- Ao concluir o cadastro, o portal recarrega o registro do cliente no banco antes
  de reabrir o checklist do processo, garantindo que a pendência cadastral saia
  da fila.
- Trava anti-loop: se o wizard abrir sem nenhuma pergunta pendente e o cadastro
  já estiver completo, ele conclui uma única vez e segue para o checklist do
  processo, em vez de devolver o cliente ao mesmo pop-up.

## Detalhes técnicos

- `src/components/quero-armas/portal/PendenciasGuiadasPopup.tsx`: título do modo
  modal sem `<br>`, com `textWrap: "balance"`.
- `src/components/quero-armas/portal/ClienteChecklistCadastralModal.tsx`: nova prop
  `onCampoSalvo(key, valor)` disparada após cada save bem-sucedido.
- `src/pages/quero-armas/QAClientePortalPage.tsx`: `setCliente` com merge do campo
  salvo; em `onConcluido`, refetch de `qa_clientes` (`select *` pelo id) antes de
  `abrirPendenciasGuiadas({ pularGateCadastral: true })`.
- Sem mudanças de banco de dados, RLS ou edge functions.
