# Pendências abertas — auditoria do fluxo de posse/autorização

Índice único do que ficou em aberto. Atualizado em 18/08/2026.
Fases entregues: F1–F9. Restam F10, F11.

---

## 🔴 Conferências pendentes do deploy de 18/08/2026 (00:08 BRT)

As 13 edge functions foram publicadas em lote. Duas verificações não puderam ser
fechadas por SQL e continuam abertas.

### 1. Template `exigencia-pf-respondida` está no ar?

**Como conferir:** abrir o painel de preview de e-mails e procurar
**"Exigência da PF respondida (equipe)"**.

**Por que importa:** é o único item que pode ter quebrado no deploy sem dar
sinal nenhum. O template é novo e vive no registry, que é embutido no bundle de
`send-transactional-email`. Se o registry não pegou, todo aviso de exigência da
PF falha em runtime por template inexistente — e isso só apareceria no momento
em que a Polícia Federal notificasse um cliente, que é justamente quando o
prazo de 10 dias começa a correr.

**Se não estiver lá:** republicar `send-transactional-email`,
`preview-transactional-email`, `qa-enviar-email-template` e
`qa-send-all-templates-preview`.

### 2. O prazo do recurso parou de alarmar de verdade?

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

---

## 🟡 Excluir os serviços de dois clientes legados

Levantamento completo — inventário, mapa de chaves estrangeiras, gatilhos de
DELETE e a ordem correta do script — em
**`docs/PENDENCIA-EXCLUSAO-SERVICOS-LEGADOS.md`**.

Aguarda três decisões: exames (4), procuração (1), CR + assinaturas do Arsenal
(3). E uma quarta sobre auditoria (8 eventos de status, 3 acessos à senha GOV,
1 documento-modelo da IA) — a recomendação é manter tudo.

---

## ⬜ Escopo de ataque — o que falta

| Frente | O quê |
|---|---|
| **F10** | Registro do protocolo do recurso: nenhum código grava `qa_processo_recursos.numero_protocolo` nem `protocolado_em`. O cliente vê "aprovado" para sempre. |
| **F11** | Deferimento e entrega da autorização. Hoje "deferido" é só uma etiqueta: sem e-mail, sem passo para entregar o documento ao cliente, sem baixa do serviço, sem registro no Arsenal. Para um serviço chamado "Autorização de Compra", o produto final não tem lugar no sistema. |

---

## Regras firmadas durante a auditoria

- **A aprovação do RECURSO ainda vive fora do guiado.** `RecursoAprovacaoPanel`
  é renderizado dentro de `LinhaDoTempoProcessoPF`, não na fila do pop-up. É um
  desvio anterior à regra de 18/08 — funciona, mas deveria migrar para o guiado
  como a petição (F9) já nasceu. Trabalho pequeno, sem urgência.

- **Pop-up guiado é o canal do cliente.** Toda comunicação e toda exigência
  passa por ele. Ver mem://constraints/quero-armas-popup-guiado-canal-do-cliente.
- **Deploy de edge function não sai no push.** Lista e comando em
  `docs/DEPLOY-FUNCOES-PENDENTES.md`. Mudança em `_shared` obriga a republicar
  todas as funções que importam o arquivo.
