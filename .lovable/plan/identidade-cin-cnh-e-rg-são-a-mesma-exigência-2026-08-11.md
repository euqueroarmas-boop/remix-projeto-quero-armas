# Identidade: CIN, CNH e RG são a MESMA exigência

## O que está acontecendo com o Fábio

O envio foi aberto a partir do item do checklist "CIN — Carteira de Identidade Nacional".
Ele anexou a CNH. A leitura automática classificou corretamente como CNH, e o modal do
Hub comparou o tipo lido com o tipo do slot: como `cnh` ≠ `cin`, marcou como
"documento incorreto" e carimbou REPROVADO antes de gravar qualquer coisa.

Confirmado no código: em `ClienteDocsHubModal.tsx` a checagem `tipoDivergenteExigencia`
é uma comparação literal de strings (`form.tipo_documento !== expectedTipoMeta.value`),
sem nenhuma noção de equivalência. Já existe a regra de identidade única
(`src/lib/quero-armas/identidadeUnica.ts`), usada só para esconder itens redundantes no
checklist — ela nunca foi aplicada na trava de aceite do upload. Também já existe o
padrão de "pares equivalentes" para laudos (`paresEquivalentes.ts`); a identidade
precisa do mesmo tratamento.

## O que será feito

1. **Motor de equivalência de identidade** (novo helper, ao lado de `identidadeUnica.ts`):
   `mesmaExigenciaIdentidade(a, b)` → verdadeiro quando os dois tipos são documentos
   civis de identidade (CIN, RG, RG com CPF, CNH e variantes). Reaproveita
   `ehDocumentoIdentidade`, mantendo `identidade_funcional` de fora.

2. **Trava de tipo no Hub** (`ClienteDocsHubModal.tsx`): `tipoDivergenteExigencia` deixa
   de disparar quando slot e documento lido pertencem à mesma exigência de identidade.
   CNH enviada num slot de CIN passa a ser aceita, sem carimbo REPROVADO.

3. **Cumprimento do slot**: ao salvar, o documento é gravado com o tipo REAL lido (cnh)
   e a exigência de identidade do processo é marcada como cumprida pelo caminho já
   existente (`qa_processo_rever_exigencias` + identidade única), para o checklist não
   continuar pedindo CIN.

4. **Texto na tela**: o slot passa a se apresentar como "Documento oficial de identidade
   (CIN, CNH ou RG com CPF)" em vez de exigir um único deles.

5. **Backend em espelho**: mesma equivalência no checker de conclusão
   (`supabase/functions/_shared/checklistVisibility.ts`, que já tem
   `ehDocumentoIdentidade`), para o item não voltar a ficar pendente após a aprovação.

Nada muda para os demais documentos: certidões, laudos e comprovantes mantêm a trava de
tipo atual. A trava do PDF com QR Code do gov.br continua valendo para identidade.

## Verificação

- Reenviar a CNH do Fábio pelo slot de CIN: deve aceitar e carimbar APROVADO.
- Conferir que o checklist dele avança e não reexibe a exigência de identidade.
- Teste unitário do helper: CIN×CNH×RG aceita; `identidade_funcional` não aceita.