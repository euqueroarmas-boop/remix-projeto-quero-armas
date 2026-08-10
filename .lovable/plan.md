# Corrigir grupos do checklist guiado (Idoneidade caindo em "Fechamento")

## O que está errado

O checklist de **AUTORIZAÇÃO DE COMPRA / POSSE DE ARMA DE FOGO** (serviço 60) usa tipos de documento com o prefixo `antecedentes_` — por exemplo:

- `antecedentes_eleitoral` (TSE)
- `antecedentes_militar` (STM) e `antecedentes_militar_estadual` (TJM)
- `antecedentes_federal_trf3_regional`
- `antecedentes_estadual_distribuicao` / `antecedentes_estadual_execucoes`
- `antecedentes_criminais` (Polícia Civil/SSP)

O classificador de grupos (`src/lib/quero-armas/pendenciasGrupos.ts`) só reconhece certidões pelo prefixo `certidao_...`. Nenhuma regra cobre `antecedentes_...`, então todas essas certidões caem no grupo de sobra **`outros`, cujo rótulo é "Fechamento"** e cuja ordem é 99 (última). Daí o print do Pedro: "FECHAMENTO · GRUPO 8 DE 8" exibindo a certidão do STM.

Outros itens do mesmo serviço também caem em lugar errado pela mesma lógica:

- `declaracao_sem_inquerito_processo_criminal` → hoje vai para "Declarações do processo"; pertence a **Idoneidade**.
- `procuracao_assinada`, `dsa_declaracao_seguranca_acervo`, `declaracao_endereco_acervo`, `declaracao_guarda_responsavel`, `declaracao_nao_possuir_segundo_endereco`, `pergunta_segundo_endereco_acervo` → precisam de grupo explícito em vez de cair em "outros".
- `ctps`, `exames_instituicao_definir`, `atestado_aptidao_psicologica_instituicao` → conferir se batem nas regras atuais de Ocupação/Laudos.

O contador "8 de 8" não está quebrado: ele conta os grupos derivados dessa classificação. Corrigida a classificação, a contagem passa a refletir a sequência real.

## O que será feito

1. **Regras de grupo por prefixo `antecedentes_`** em `pendenciasGrupos.ts`: qualquer `antecedentes_*` vai para **Idoneidade** (ordem 60), junto com os `certidao_*` já existentes.
2. **Mover a declaração de não responder inquérito/processo criminal** para Idoneidade.
3. **Fechar os buracos de "outros"**: procuração e declarações contratuais → Contratos; DSA, DEGA, guarda responsável e 2º endereço → grupo correto (acervo/endereço); `exames_instituicao_definir` e atestados da instituição → Laudos.
4. **Sequência canônica única** para todo processo de autorização de compra/posse, válida para todos os clientes (é lógica de apresentação, não dado por cliente):
   Contratos → Cadastros → Identificação civil → Identificação residencial → Ocupação lícita → Idoneidade → Efetiva necessidade → Laudos → Requerimento → Fechamento (só o que realmente sobrar).
5. **Teste de regressão**: teste que percorre todos os `tipo_documento` ativos do serviço de autorização de compra e falha se algum cair em `outros`, impedindo que checklists futuros voltem a exibir "Fechamento" indevidamente.

## Detalhes técnicos

- Arquivo central: `src/lib/quero-armas/pendenciasGrupos.ts` (`grupoDaPendencia`). É a fonte única usada por `PendenciasGuiadasPopup`, `QAClientePortalPage`, `simuladorChecklist` e o Kanban de exigências do admin — a correção vale para cliente e admin ao mesmo tempo.
- Sem migração de banco: `qa_servicos_documentos.grupo_id` está nulo nesse serviço, então o agrupamento é 100% derivado do tipo. Nada precisa ser reescrito por cliente.
- Nenhuma mudança em ordem de exigências, regras de visibilidade ou status de documento — apenas rotulagem e ordenação de grupos.