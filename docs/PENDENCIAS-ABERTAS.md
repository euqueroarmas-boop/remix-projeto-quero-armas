# Pendências abertas — auditoria do fluxo de posse/autorização

Índice único do que ficou em aberto. Atualizado em 18/08/2026.
**Escopo de ataque CONCLUÍDO: F1–F11.**

---

## 🔴 Deploy da leva 2 — pendente

**9 funções ainda não publicadas.** Lista, comando e ordem em
`docs/DEPLOY-FUNCOES-PENDENTES.md`. Não há SQL pendente: as 5 migrations da
sessão estão aplicadas e conferidas.

Enquanto não subir: o front já está na `main` e já chama as quatro funções novas
(`qa-peca-enviar-cliente`, `qa-peca-aprovar-cliente`, `qa-recurso-protocolar`,
`qa-processo-deferir`). Os botões existem no painel e devolvem erro de função não
encontrada.

---

## 🔴 Conferência dos templates de e-mail — CINCO, numa tela só

**Como conferir:** abrir o painel de preview de e-mails e procurar os cinco.

| Template | Leva | Quem recebe |
|---|---|---|
| Exigência da PF respondida (equipe) | 1 (publicada) | equipe |
| Petição pronta para aprovação (cliente) | 2 (pendente) | cliente |
| Petição decidida pelo cliente (equipe) | 2 (pendente) | equipe |
| Recurso protocolado (cliente) | 2 (pendente) | cliente |
| Processo deferido — documento entregue (cliente) | 2 (pendente) | cliente |

O primeiro dá para conferir agora. Os outros quatro só depois do deploy da leva 2
— mas é a mesma tela, uma olhada só.

**Por que importa:** é o item que quebra em SILÊNCIO. Os templates vivem no
registry, que é embutido no bundle de `send-transactional-email`. Se o registry
não pegou, o envio falha em runtime por template inexistente — sem erro visível
para quem clicou. Só se descobre no disparo real: quando a PF notifica um
cliente, quando a equipe devolve uma petição, quando um processo é deferido.

**Se algum não estiver lá:** republicar `send-transactional-email`,
`preview-transactional-email`, `qa-enviar-email-template` e
`qa-send-all-templates-preview`.

---

## 🔴 O prazo do recurso parou de alarmar de verdade?

A consulta de conferência (`supabase/_conferencia_pos_deploy.sql`, seção A)
devolveu **"PRAZO FECHADO (correto)"** para Edmar Souza Zeferino (indeferido
25/05, recurso 03/06). Mas aquela consulta é a regra **reescrita em SQL**: ela
prova que o dado está na forma em que a correção se aplica, **não** que o código
publicado está calculando assim.

**Prova definitiva — qualquer uma das duas:**

- Abrir o painel de prazos no dashboard e ver o processo do Edmar sair do
  vermelho.
- Invocar `qa-processo-prazo-alertas` com `{"dry_run": true}`. Ele devolve o que
  enviaria, sem mandar e-mail nenhum. Se o Edmar não aparecer na lista, está
  resolvido.

**Contexto:** desde 04/06 o painel mostrava o processo dele como vencido e saiu
alarme para ele e para a equipe, num processo que estava correto — o recurso foi
protocolado um dia antes do fim do prazo.

---

## 🟡 Sem caso real para testar (não é falha)

Na conferência de 18/08 as seções B, C e D voltaram vazias:

- **Nenhum processo em `pronto_para_protocolar`.** A juntada não pôde ser
  testada ponta a ponta. Do lado bom: a trava nova do protocolo não está
  travando ninguém.
- **Nenhuma exigência da PF viva no sistema.** A F8 (reabertura de exigência
  repetida + avisos à equipe) se prova na próxima notificação que a equipe colar.

Repetir a conferência quando qualquer um dos dois aparecer:
`supabase/_conferencia_pos_deploy.sql`.

**Passivo do deferimento:** os 3 processos já deferidos estão sem documento
entregue — são exatamente os dois clientes legados da pendência abaixo. Não é
caso novo: some junto com a exclusão.

---

## 🟡 Excluir os serviços de dois clientes legados

Levantamento completo — inventário, mapa de chaves estrangeiras, gatilhos de
DELETE e a ordem correta do script — em
**`docs/PENDENCIA-EXCLUSAO-SERVICOS-LEGADOS.md`**.

Aguarda três decisões: exames (4), procuração (1), CR + assinaturas do Arsenal
(3). E uma quarta sobre auditoria (8 eventos de status, 3 acessos à senha GOV,
1 documento-modelo da IA) — a recomendação é manter tudo.

---

## ✅ Escopo de ataque — concluído

As 11 frentes foram entregues entre 17 e 18/08/2026. O que resta neste arquivo
são conferências e uma decisão do usuário, não desenvolvimento.

---

## Regras firmadas durante a auditoria

- **Pop-up guiado é o canal do cliente.** Toda comunicação e toda exigência
  passa por ele. Ver mem://constraints/quero-armas-popup-guiado-canal-do-cliente.
- **Deploy de edge function não sai no push.** Lista e comando em
  `docs/DEPLOY-FUNCOES-PENDENTES.md`. Mudança em `_shared` obriga a republicar
  todas as funções que importam o arquivo.
