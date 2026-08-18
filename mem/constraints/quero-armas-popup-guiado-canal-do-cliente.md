---
name: QA - Pop-up guiado é o canal do cliente
description: Toda comunicação e toda exigência dirigida ao cliente passa pelo PendenciasGuiadasPopup. Nada de segundo pop-up por cima, nada de tela solta, nada de e-mail como único canal. O e-mail avisa; o guiado é onde ele age.
type: constraint
---
**Regra do usuário (18/08/2026).** Toda comunicação e toda exigência dirigida ao
cliente acontece DENTRO do pop-up guiado (`PendenciasGuiadasPopup`), na área do
cliente. Ele é o canal, não uma das telas.

## O que isso proíbe

- ❌ Abrir um segundo pop-up/modal por cima do guiado (regra de 09/08/2026, já
  valia para a Efetiva Necessidade e continua valendo para tudo).
- ❌ Criar página ou aba solta para o cliente cumprir uma exigência.
- ❌ Tratar e-mail como o único canal. E-mail **avisa**; o guiado é onde ele
  **age**. Os dois coexistem (a regra "tudo é comunicado por e-mail", de
  16/08/2026, continua valendo — ela não substitui esta).
- ❌ Deixar exigência sem representação no guiado. Se o cliente precisa fazer
  algo, existe um item na fila. Se não existe item, ele não vai fazer.

## Como se entrega conteúdo no guiado

Cada passo é um `PendenciaItem`. Para fluxos com tela própria, use `corpo:
React.ReactNode` — ele renderiza DENTRO do guiado e substitui o passo a passo
padrão e os botões do rodapé. Padrões já implementados, use-os como molde:

| Fluxo | Componente |
|---|---|
| Efetiva necessidade | `EfetivaNecessidadeModal` (`embedded`) |
| Acesso ao gov.br | `AcessoGovBrPanel` |
| Requerimento do SINARM | `RequerimentoSinarmRoteiro` |
| Assinatura da juntada | `JuntadaAssinaturaPanel` |

Campos de apoio do `PendenciaItem`:

- `avisoTopo` — tarja de contexto ANTES do título (ex.: `AvisoExigenciaPF`, que
  diz quem pediu, o prazo e o risco). Fica fora de `corpo` de propósito.
- `grupoProprio` / `ordemGrupoPropria` — grupo gravado na própria linha do
  checklist. Vence o catálogo do serviço, que vence a classificação por tipo.
  É o que mantém a exigência da PF (`exigencias_pf`, ordem 5) no topo da fila.
- `instrucoesCatalogo`, `linkEmissao`, `observacoesCatalogo` — texto que a
  Equipe cadastra em `qa_servicos_documentos`, exibido no lugar do estático.
- `dispensa` + `onDispensaAvancar` — passo dispensado por lei aparece cumprido,
  com base legal, em vez de sumir.

## Regras de comportamento já firmadas

- Fechar o guiado (X ou clique fora) o mantém fechado na sessão; ação manual
  reabre. Ver mem://features/quero-armas/popup-pendencias-dismissivel.
- Exigências de etapa final (`credencial_gov_br`, `juntada_assinada`) só entram
  na fila quando o processo vira `pronto_para_protocolar` — antes disso são
  ruído, e o código de duas etapas expira em minutos.
- Grupo `exigencias_pf` é **não filtrável** por serviço. Ver
  `GRUPOS_NAO_FILTRAVEIS` em `pendenciasGrupos.ts`.

**Why:** o cliente não navega o sistema procurando o que fazer — ele abre a área
do cliente e segue a fila. Exigência que vive fora do guiado é exigência que não
é cumprida, e no fluxo da Polícia Federal isso custa prazo fatal de 10 dias.
