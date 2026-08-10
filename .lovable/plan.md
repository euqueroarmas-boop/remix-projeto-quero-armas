# Por que o Pedro não consegue entregar a certidão do STM

## O que os dados mostram

No Hub do Pedro (cliente 222) existem 8 documentos aprovados. Entre eles há **um único documento militar**: `antecedentes_militar_estadual` (TJM-SP), aprovado em 10/08 às 16:11 — o parser leu "Tribunal de Justiça Militar do Estado de São Paulo". **Não existe nenhum documento `antecedentes_militar` (STM) enviado**, nem aprovado, nem reprovado.

A exigência aberta no checklist (grupo Idoneidade, tela "Justiça Militar da União — STM") é a certidão do **STM**, que é outro documento. O arquivo que ele reenviou é o mesmo PDF da TJM.

## O que de fato trava a entrega

Quando o arquivo enviado é classificado como um tipo que **já está aprovado no Hub**, o modal do Hub marca "duplicidade" e, em vez de explicar, mostra o carimbo **verde "TJM já aprovado no Hub · exigência atendida"** e ainda dispara a revisão de exigências. Ou seja:

- o sistema diz "exigência atendida", mas a exigência atendida é a da TJM — a do STM continua aberta;
- o cliente volta para a mesma tela do STM e conclui que o sistema está travado;
- em outra tentativa o mesmo envio cai na rejeição de tipo e o admin recebe "Documento diferente do exigido no envio aberto".

Resumo: nada está bloqueando tecnicamente o envio do STM. Ele nunca enviou a certidão do STM — está reenviando a TJM, e a mensagem verde de "exigência atendida" esconde isso dele.

## Correção proposta

1. **Duplicidade deixa de ser sucesso quando o tipo não é o exigido.** Se o slot aberto pede STM e o arquivo é TJM (ou qualquer outro tipo já aprovado), o carimbo passa a ser de atenção, com texto explícito: "Este é a Certidão Criminal Militar — TJM, que já está aprovada. A pendência aberta é a Certidão Criminal Militar — STM (Justiça Militar da União). São documentos diferentes e a PF exige os dois."
2. **Carimbo verde "exigência atendida" só quando o tipo duplicado é exatamente o tipo exigido** (aí sim a pendência é dispensada e `qa_processo_rever_exigencias` é chamado).
3. **Ação clara na tela de rejeição**: botão "Acessar site pra emissão" apontando para o portal do STM, para o cliente emitir o documento certo sem sair do fluxo.
4. **Notificação ao admin com motivo legível** nesse caso: "Enviou TJM no slot do STM — documentos distintos", em vez de "Documento diferente do exigido".

Nenhuma mudança de dados do Pedro é necessária: assim que ele anexar a certidão do STM, a pendência fecha normalmente.

## Detalhes técnicos

- `src/components/quero-armas/clientes/ClienteDocsHubModal.tsx`: no efeito que trata `motivoRejeicao === "duplicidade"` (~linha 1920), condicionar o caminho de sucesso a `form.tipo_documento === expectedTipoMeta?.value`; caso contrário emitir carimbo de rejeição com a mensagem comparativa e sem chamar `qa_processo_rever_exigencias`.
- Reaproveitar `getTipoDocumentoMeta` para montar o texto "enviou X / falta Y" e `certidoesAbrangencia.ts` para o link de emissão do STM.
- Cobrir o par STM x TJM com teste, ao lado de `__tests__/hubTipoMapMilitar.test.ts`.
