# Correção definitiva do CCMEI e dados empresariais

## Diagnóstico confirmado

O PDF enviado contém claramente o título **“Certificado da Condição de Microempreendedor Individual”** e os campos necessários: nome civil, CPF, CNPJ, nome empresarial, situação cadastral **ATIVA** e CNAE principal.

Há dois furos no fluxo atual:

1. O parser local reconhece o CCMEI e preenche a tela, mas encerra a leitura sem criar uma classificação/conferência persistível. Assim, os campos do parser não chegam corretamente a `ia_dados_extraidos` nem ao mecanismo automático de aprovação.
2. Na função de classificação, a regra determinística pode corrigir um resultado da biblioteca para `CCMEI`, mas a resposta do caminho da biblioteca ainda devolve o tipo original do modelo. Isso permite que um certificado válido volte como Cartão CNPJ.

Também foi confirmado que `qa_clientes` já possui os campos necessários para CNPJ, razão social e atividade, mas a sincronização atual de documentos aprovados não grava os dados empresariais extraídos do CCMEI.

## Implementação

### 1. Classificação canônica e prioritária
- Dar precedência absoluta ao título oficial **Certificado da Condição de Microempreendedor Individual**, aos marcadores de enquadramento MEI e à URL oficial de autenticação.
- Corrigir o retorno do classificador para devolver o tipo determinístico final, nunca o tipo antigo encontrado pela biblioteca.
- Manter Cartão CNPJ comum separado, sem ampliar a regra a ponto de gerar falsos CCMEI.

### 2. Parser local com decisão completa
- Transformar o resultado de `parseCcmei` em uma classificação completa compatível com o Hub:
  - tipo `CCMEI` / `renda_ccmei`;
  - confiança alta;
  - recomendação `aceitar` somente quando nome e CPF conferirem com o cadastro e a situação for `ATIVA`/`ATIVO`;
  - reprovação quando nome ou CPF divergirem, ou quando a situação declarada não estiver ativa;
  - ausência de um campo obrigatório segue como falha de leitura clara, sem inventar valor.
- Não exigir nem salvar emissão/validade para o CCMEI.
- Remover a opção de qualquer classificação posterior sobrescrever o CCMEI já confirmado pelo parser.

### 3. Extração e persistência dos dados empresariais
Salvar no próprio documento aprovado, em `ia_dados_extraidos.camposExtraidos`:
- nome civil;
- CPF;
- situação cadastral;
- CNPJ;
- razão social/nome empresarial;
- CNAE principal completo (código e descrição);
- ocupação principal, quando presente.

Após a aprovação, sincronizar de forma segura em `qa_clientes`:
- `ocupacao_licita_cnpj` ← CNPJ;
- `ocupacao_licita_razao_social` ← nome empresarial;
- `ocupacao_licita_atividade` ← CNAE principal.

A sincronização só preencherá/atualizará esses campos a partir de um CCMEI aprovado e pertencente ao mesmo cliente; documentos rejeitados ou pendentes não alteram o cadastro.

### 4. Confronto com QSA e nota fiscal
- Usar o CCMEI aprovado como referência empresarial para os envios seguintes.
- No QSA, confrontar CNPJ e razão social e exigir que o nome do cliente conste entre os sócios, sem reprovar por sócios adicionais.
- Na nota fiscal, confrontar somente o emitente/prestador: aprovar quando CNPJ ou razão social corresponderem à referência empresarial; manter as regras já existentes do tomador sem alterá-las.
- Persistir a referência também no cadastro para que o confronto continue funcionando mesmo quando a lista local de documentos ainda não estiver carregada.

## Proteção contra regressões

- Preservar todas as regras atuais de identidade, certidões, Cartão CNPJ, QSA, notas fiscais e duplicidade.
- Adicionar testes para:
  - o PDF real ser classificado como CCMEI;
  - nome + CPF iguais e situação ATIVA aprovarem;
  - CPF/nome divergente ou situação BAIXADA reprovarem;
  - Cartão CNPJ comum continuar classificado separadamente;
  - o caminho da biblioteca devolver o tipo determinístico final;
  - CNPJ, razão social e CNAE serem persistidos e usados no confronto de QSA/NF.
- Validar a função publicada e repetir o envio no Hub do cliente Fábio, confirmando carimbo de aprovado e os dados empresariais gravados no banco.

## Detalhes técnicos

- Ajustes focados em `parserCcmei.ts`, `ClienteDocsHubModal.tsx`, `qa-classificar-documento-arma` e na função de sincronização do documento aprovado para `qa_clientes`.
- Nenhuma nova tabela é necessária; os campos e o JSON de extração já existem.
- A função de classificação será republicada somente após testes locais e de regressão passarem.
