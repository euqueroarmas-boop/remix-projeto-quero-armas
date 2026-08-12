# Correção definitiva da classificação do CCMEI

## Diagnóstico confirmado

O arquivo enviado é um CCMEI oficial válido. Executado com o mesmo extrator e parser usados no navegador, ele retorna:

- tipo: `renda_ccmei`;
- titular: FABIO CORREIA DE MELO;
- CPF: 343.170.468-90;
- CNPJ: 68.472.983/0001-00;
- situação cadastral: ATIVA;
- sem necessidade de emissão ou validade.

A imagem mostra que a execução caiu no classificador de contingência e foi identificada como Cartão CNPJ. O classificador de backend ainda não possui uma regra determinística que dê precedência ao título oficial do CCMEI. Como a página 2 contém a frase “comprova as inscrições [...] e a situação cadastral”, a classificação probabilística confundiu o certificado com o Comprovante de Inscrição e Situação Cadastral do CNPJ.

## Correção

1. **Trava determinística no classificador**
   - Detectar primeiro `CERTIFICADO DA CONDIÇÃO DE MICROEMPREENDEDOR INDIVIDUAL`, `CCMEI`, URL oficial de verificação ou a combinação “ENQUADRADO NA CONDIÇÃO DE MEI” + CNPJ.
   - Forçar `tipoDetectado = CCMEI`, confiança alta e recomendação de aceite antes de qualquer regra genérica de CNPJ.
   - Extrair nome civil, CPF, CNPJ, nome empresarial e situação cadastral do texto nativo.

2. **Proteção adicional no Hub Documental**
   - Se o texto local contiver os marcadores oficiais de CCMEI, impedir que uma resposta posterior da IA sobrescreva o tipo para Cartão CNPJ.
   - Manter o documento como `renda_ccmei`, sem emissão e sem validade.
   - Reprovar somente se nome ou CPF divergirem do cadastro, ou se a situação declarada não for ATIVA/ATIVO; campo ausente segue para revisão, não para falsa reprovação.

3. **Teste de regressão com o PDF real**
   - Usar o arquivo enviado como caso de teste local, sem incorporá-lo ao produto nem expor seus dados.
   - Confirmar que as duas páginas continuam classificadas como CCMEI, apesar da frase sobre “inscrições e situação cadastral” na página 2.
   - Confirmar que um Cartão CNPJ verdadeiro continua sendo classificado separadamente.

4. **Publicação e validação**
   - Publicar novamente a função de classificação.
   - Validar o fluxo no Hub: CCMEI reconhecido, situação ATIVA aprovada, campos de emissão/validade ausentes e nenhuma mensagem de tipo divergente.
