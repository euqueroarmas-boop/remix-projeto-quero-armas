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
- `procuracao_assinada` e as declarações contratuais → precisam de grupo explícito em vez de cair em "outros".
- Itens de **acervo CAC** (DSA, DEGA, guarda responsável, 2º endereço) não pertencem a defesa pessoal — ver seção própria abaixo: serão **removidos**, não reagrupados.
- `ctps`, `exames_instituicao_definir`, `atestado_aptidao_psicologica_instituicao` → conferir se batem nas regras atuais de Ocupação/Laudos.

O contador "8 de 8" não está quebrado: ele conta os grupos derivados dessa classificação. Corrigida a classificação, a contagem passa a refletir a sequência real.

## Achado adicional: falta a certidão da Seção Judiciária de SP / JEF

O tipo `antecedentes_federal_sjsp_jef` existe e é totalmente suportado (classificador de IA, parser de abrangência, mapa de tipos do Hub, textos de notificação) e **2 clientes já enviaram esse documento** — mas ele **não existe como exigência em nenhum serviço do checklist**: em todos os serviços, inclusive o 60, só há `antecedentes_federal_trf3_regional`. No serviço 60 há inclusive um buraco de ordem (350 = TRF3 regional, 360 vazio, 370 = TJSP), sinal de que a linha da SJSP/JEF foi removida.

Consequência: o cliente é orientado a tirar só a certidão de abrangência regional do TRF3, quando a Polícia Federal exige também a de abrangência da Seção Judiciária de SP e do Juizado Especial Federal. Quem envia a SJSP/JEF hoje tem o documento classificado corretamente, mas sem exigência correspondente ele fica fora do checklist.

Correção prevista: reinserir a exigência `antecedentes_federal_sjsp_jef` ("Certidão Federal — Seção Judiciária de SP e JEF") no serviço de autorização de compra/posse na ordem 360, logo após a TRF3 regional, no grupo Idoneidade, obrigatória, e vincular automaticamente os envios já existentes desse tipo.

## Achado adicional: itens de acervo CAC dentro de serviços de defesa pessoal

DSA, DEGA, declaração de guarda responsável e o bloco de 2º endereço são exigências do universo **CAC (CR/acervo)** e não se aplicam a defesa pessoal. Hoje eles aparecem nos seguintes serviços de defesa pessoal (todos ativos no checklist):

- **2 — Posse na Polícia Federal**: `declaracao_guarda_responsavel` (310), `pergunta_segundo_endereco_acervo` (350), `declaracao_endereco_acervo` (370), `dsa_declaracao_seguranca_acervo` (380), `declaracao_nao_possuir_segundo_endereco` (390), `comprovante_residencia_segundo_endereco` (400)
- **35, 48 (desativados)**, **36 — Renovação de Posse**, **37 — Renovação de Porte**, **41 — Porte de Arma de Fogo**: `declaracao_guarda_responsavel`

Permanecem intactos nos serviços CAC, onde são legítimos: 32 (Renovação de CR), 33 (Registro/Apostilamento CAC), 42 (Mudança Posse → CR), 45 (Apostilamento — atualização de acervo).

Os serviços 59 (CRAF/GT) e 60 (Autorização de Compra) já não têm esses itens.

Correção prevista: desativar essas exigências nos serviços de defesa pessoal (2, 35, 36, 37, 41, 48), com snapshot antes da alteração, e limpar as pendências abertas correspondentes nos clientes desses processos para que sumam do checklist guiado.

## O que será feito

1. **Regras de grupo por prefixo `antecedentes_`** em `pendenciasGrupos.ts`: qualquer `antecedentes_*` vai para **Idoneidade** (ordem 60), junto com os `certidao_*` já existentes.
2. **Mover a declaração de não responder inquérito/processo criminal** para Idoneidade.
3. **Fechar os buracos de "outros"**: procuração e declarações contratuais → Contratos; DSA, DEGA, guarda responsável e 2º endereço → grupo correto (acervo/endereço); `exames_instituicao_definir` e atestados da instituição → Laudos.
4. **Sequência canônica única** para todo processo de autorização de compra/posse, válida para todos os clientes (é lógica de apresentação, não dado por cliente):
   Contratos → Cadastros → Identificação civil → Identificação residencial → Ocupação lícita → Idoneidade → Efetiva necessidade → Laudos → Requerimento → Fechamento (só o que realmente sobrar).
5. **Teste de regressão**: teste que percorre todos os `tipo_documento` ativos do serviço de autorização de compra e falha se algum cair em `outros`, impedindo que checklists futuros voltem a exibir "Fechamento" indevidamente.
6. **Reinserir a exigência SJSP/JEF** no checklist (ordem 360) e conferir se os demais serviços que pedem certidão federal também deveriam ter as duas abrangências — se sim, aplicar o mesmo par a eles.
7. **Remover DSA/DEGA/guarda responsável/2º endereço dos serviços de defesa pessoal** (2, 35, 36, 37, 41, 48), preservando-os nos serviços CAC, e limpar as pendências já geradas para clientes nesses processos.

## Detalhes técnicos

### Abrangência: vale para todo mundo, inclusive quem contratar depois

Todas as correções são feitas no **catálogo do serviço**, não no cadastro de um cliente:

- O agrupamento (Idoneidade x Fechamento) é derivado do tipo de documento em `pendenciasGrupos.ts` — muda para todos os clientes, atuais e futuros, no mesmo instante.
- A exigência SJSP/JEF e a remoção dos itens de acervo são feitas em `qa_servicos_documentos` do serviço 60 (e demais afetados). Todo checklist é montado a partir dessa tabela, então quem contratar **Autorização de Compra / Posse de Arma de Fogo** de hoje em diante já recebe a lista corrigida automaticamente.
- Para quem **já tem o processo aberto**, aplicamos também o ajuste retroativo: gerar a pendência da SJSP/JEF e encerrar as pendências de acervo indevidas, para ninguém ficar com checklist antigo.

- Arquivo central: `src/lib/quero-armas/pendenciasGrupos.ts` (`grupoDaPendencia`). É a fonte única usada por `PendenciasGuiadasPopup`, `QAClientePortalPage`, `simuladorChecklist` e o Kanban de exigências do admin — a correção vale para cliente e admin ao mesmo tempo.
- Sem migração de banco: `qa_servicos_documentos.grupo_id` está nulo nesse serviço, então o agrupamento é 100% derivado do tipo. Nada precisa ser reescrito por cliente.
- Nenhuma mudança em ordem de exigências, regras de visibilidade ou status de documento — apenas rotulagem e ordenação de grupos.