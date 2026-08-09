# Boletim antigo: serve como reiteração, não substitui o registro atual

Hoje o bloco "Boletim antigo não sustenta ameaça atual" diz, na prática, que BO velho não vale. Isso faz o cliente guardar os boletins antigos que ele tem — e nós queremos todos. A correção é de mensagem e de tratamento: boletim antigo **prova reiteração** (a ameaça vem se repetindo há tempo), só não sustenta sozinho o pedido.

## O que muda na tela "Entenda o boletim"

O bloco passa a dizer, em blocos curtos:

- **Envie todos os boletins que você tiver, mesmo os antigos.** Cada um mostra que isso não é episódio isolado: é sequência. Reiteração de ameaça pesa a favor do pedido.
- **Boletim com menos de 6 meses.** Está dentro do prazo legal de representação e sustenta a ameaça atual — usamos direto, sem exigir novo registro.
- **Boletim com mais de 6 meses.** Continua valendo como histórico. Sustenta o pedido quando há mais de um registro, ou quando o relato do cliente tem correlação com aquele boletim e inclui fato recente, próximo da data de hoje. Nesse caso o relato traz o fato atual e o boletim antigo comprova que já vem de antes.
- **Quando pedimos registro novo.** Só quando não há nada recente: um único boletim antigo e nenhum fato novo no relato. Aí o registro de hoje é o que prova que o risco continua.

O termo de ciência acompanha a mudança (nova versão do texto — aceites antigos continuam guardados com o texto lido na época).

## Como isso afeta o fluxo dos passos

- No passo "Você já registrou algum boletim?", reforço explícito: envie todos, inclusive antigos, um por um.
- O passo "Registrar o boletim na delegacia" deixa de ser sempre obrigatório. Só é exigido quando **nenhum** boletim enviado é recente (<= 6 meses) **e** não há mais de um boletim **e** o relato não traz fato recente. Caso contrário o passo já nasce concluído, com a explicação "seus boletins já sustentam o pedido".
- Quando a exigência cai, a fila do pop-up guiado reduz a contagem (nada de passo travado sem motivo).

## Como isso afeta o relato gerado pela IA

O prompt da narrativa passa a receber a idade de cada boletim e a instrução de:

- amarrar os boletins antigos como **reiteração** ("desde DD/MM/AAAA venho registrando...");
- destacar o **fato mais recente** narrado pelo cliente e correlacioná-lo aos boletins anteriores;
- nunca afirmar que um boletim antigo, sozinho, comprova ameaça atual.

O texto para registrar BO só é gerado quando o passo de registro continuar exigido.

## Detalhes técnicos

- `src/lib/quero-armas/boExplicacao.ts`: substituir o bloco "Boletim antigo não sustenta ameaça atual" pelos quatro blocos acima; subir `TERMO_BO_VERSAO` para `v2-2026-08-09` e ajustar `TERMO_BO_TEXTO` (ciência de que boletins antigos entram como histórico e de que o registro novo pode ser dispensado). O hash gravado em `qa_cliente_ciencias` muda junto — histórico nunca reescrito.
- Novo helper `avaliarSuficienciaBo()` em `src/lib/quero-armas/efetivaNecessidadePassos.ts`: recebe as provas de BO (com data) e o relato, devolve `{ exigeNovoBo, motivo }` pela regra dos 6 meses + quantidade de boletins + fato recente no relato. `calcularPassosEfetiva` usa o retorno para concluir `registrar_bo`/`enviar_bo` quando o novo registro não é exigido.
- `EfetivaNecessidadeModal.tsx`: consumir o helper no lugar do `bo_pendente_registro` puro; exibir o aviso de dispensa no passo de registro, mantendo botão secundário "quero registrar um novo boletim".
- `supabase/functions/qa-efetiva-narrativa/index.ts`: incluir no contexto a idade de cada boletim e as instruções de reiteração/correlação; condicionar a geração de `texto_bo` a `exigeNovoBo`.
- Sem migração de banco: a regra é derivada das provas já existentes em `qa_efetiva_necessidade_provas`.