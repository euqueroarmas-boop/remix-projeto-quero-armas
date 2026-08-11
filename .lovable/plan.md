# Card "E-MAILS DISPARADOS" no Progresso dos Clientes

Adicionar um décimo card na barra de KPIs, ao lado de "IAT S/ PF", somando todos os e-mails disparados aos clientes.

## O que aparece

- Número grande: total de e-mails únicos disparados (dedup por `message_id`) — hoje seriam 697.
- Rótulo: `E-MAILS DISPARADOS`.
- Duas linhas pequenas (mesmo padrão do card ONLINE AGORA):
  - `X ENVIADOS HOJE`
  - `Y FALHARAM` (status `dlq` / `bounced`, em vermelho bordô se maior que zero)
- Card informativo (não filtra a lista de clientes); clique abre nada por enquanto.

## Detalhes técnicos

- A tabela de log de e-mails só permite leitura por `service_role`, então o painel não consegue consultá-la direto do navegador.
- Criar uma função de banco `SECURITY DEFINER` `qa_email_disparos_resumo()` que retorna `total`, `hoje`, `falhas`, contando sempre **um registro por `message_id`** (último status), e conceder execução apenas a usuários autenticados com perfil admin (mesmo padrão já usado nos demais RPCs do painel).
- Em `DashboardProgressoClientes.tsx`: novo estado `emailContadores`, carregado junto com os demais contadores (e no mesmo auto-refresh), e o card renderizado no mesmo bloco dos cards de credenciados.
- Grid passa de `md:grid-cols-9` para `md:grid-cols-10` para manter tudo em uma linha.
- Tipografia idêntica aos cards atuais (18px bold no número, 9px bold uppercase no rótulo, 8.5px nas linhas auxiliares).
