# Correção dos e-mails em DLQ (falha de envio)

## O que é "DLQ"
DLQ = "dead letter queue" (fila de mensagens mortas). Todo e-mail entra numa fila; se o envio falha, o sistema tenta de novo. Depois de 5 tentativas sem sucesso, o e-mail é retirado da fila e marcado como `dlq` — ou seja, **desistiu de enviar** e o cliente nunca recebeu. Por isso os 64 registros aparecem com "Max retries (5) exceeded".

## Causa raiz confirmada
O motivo real das 5 falhas está registrado nas tentativas anteriores (`status = failed`, 280 casos, 60 nos últimos 2 dias):

`Failed to construct 'Request': 'headers' is not a valid ByteString`

O assunto do e-mail viaja dentro de um cabeçalho HTTP, que só aceita caracteres ASCII. Os assuntos que falham têm travessão e/ou acento:

- "Sua certidão precisa ser emitida novamente — Arsenal Inteligente" (42 em DLQ)
- "Aproveitamos seu documento — mas ainda falta um" (8 em DLQ)
- "Seu cadastro foi atualizado — Arsenal Inteligente" (6 em DLQ)

Os assuntos 100% ASCII ("Novo acesso detectado") são enviados normalmente. Já existe uma limpeza de assunto no processador da fila, mas ela só troca travessões e mantém acentos (Latin-1) — e o acento continua quebrando a requisição.

## O que será feito

1. **Corrigir a limpeza do assunto** em `process-email-queue`: além de trocar travessões/aspas tipográficas, transliterar acentos para ASCII puro (ã→a, ç→c, é→e...) via normalização Unicode, removendo qualquer caractere restante fora de ASCII. O corpo do e-mail continua com acentuação normal — só o assunto é normalizado.
2. **Redeploy** da função `process-email-queue`.
3. **Teste controlado**: reenviar um e-mail do template `certidao-rejeitada` com chave de idempotência nova e confirmar `sent` no log.
4. **Reprocessar os 64 e-mails em DLQ**: rotina administrativa que reenfileira cada um com nova chave de idempotência (obrigatório — a API recusa a mesma chave após falha), pulando endereços suprimidos/bounce e e-mails obsoletos (avisos antigos que não fazem mais sentido; critério padrão: manter apenas os últimos 7 dias, o restante fica registrado como descartado).
5. **Visibilidade**: no painel de e-mails, o motivo mostrado para itens em DLQ passa a exibir o erro original da última tentativa (e não apenas "Max retries exceeded").

## Ponto adicional observado
Existem 656 registros `pending` acumulados desde junho. Parte é apenas o registro de entrada (o e-mail seguiu e virou `sent` em outra linha), mas há itens antigos que expiraram por TTL. Após a correção acima, farei uma verificação da saúde da fila e reporto se algo mais precisa de ação — sem alterar a infraestrutura de fila nesta etapa.

## Detalhes técnicos
- Arquivo: `supabase/functions/process-email-queue/index.ts`, função `toHeaderSafeSubject` — trocar o filtro `[^\u0009\u0020-\u00FF]` por normalização `NFD` + remoção de diacríticos + filtro ASCII `[^\u0020-\u007E]`.
- Reenvio via `send-transactional-email` com `idempotencyKey` novo (`retry-<message_id>-<timestamp>`), preservando `template_name`, destinatário e `template_data` de `email_content_log`.
