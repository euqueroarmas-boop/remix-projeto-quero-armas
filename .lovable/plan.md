# E-mails em falha: o que o número 65 realmente significa

## O que a verificação mostrou

- Os reenvios funcionaram: 30 e-mails foram reenviados às 01:17 e **todos saíram como `sent`**, sem nenhuma falha nova.
- O reenvio, porém, cria um **novo e-mail** (novo identificador). O registro antigo que falhou continua no histórico marcado como `dlq`.
- Por isso o card ainda mostra "65 FALHARAM": ele conta **todas as falhas desde o início** (64 `dlq` + 1 `bounced`), sem descontar as que já foram reenviadas com sucesso e sem respeitar período.
- Ainda restam falhas antigas não reprocessadas: 37 estão dentro dos últimos 7 dias (30 foram reenviadas, ~7 ficaram de fora pelo limite da rodada) e 27 são mais antigas que 7 dias.

Resumo: **não há erro novo**; o número é um acumulado histórico que nunca zera.

## O que será feito

1. **Marcar como resolvido** cada falha que já foi reenviada com sucesso, gravando a ligação entre o e-mail original e o reenvio. Assim o histórico continua auditável, mas a falha deixa de contar como pendente.
2. **Corrigir o card "E-MAILS DISPARADOS"**: o número em vermelho passa a mostrar apenas as **falhas pendentes** (não reenviadas), e passa a respeitar o período exibido. O total histórico continua disponível ao abrir o painel.
3. **Reprocessar as falhas restantes**: rodar novamente a rotina de reenvio para as ~7 recentes que sobraram, e decidir por descarte registrado das 27 antigas (avisos que já não fazem sentido reenviar).
4. **Painel de e-mails**: no filtro de status, separar "falha pendente" de "falha já reenviada", para leitura sem ambiguidade.

## Detalhes técnicos

- Nova coluna `resolvido_por_message_id` (ou tabela de ligação) em `email_send_log`, preenchida por `qa-email-dlq-reprocessar` no momento do reenvio bem-sucedido; backfill das 30 já reenviadas por correlação template + destinatário + janela de tempo.
- `qa_email_disparos_resumo()` e `qa_email_painel`: `falhas` passa a filtrar `status in ('dlq','failed','bounced') AND resolvido_por_message_id IS NULL`, com parâmetro de janela.
- `DashboardProgressoClientes.tsx`: rótulo do card ajustado para "X FALHAS PENDENTES", mantendo tipografia 12.5px bold uppercase / 10.5px medium.
