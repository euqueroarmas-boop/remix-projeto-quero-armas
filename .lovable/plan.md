# Correção definitiva do parser de certidões

## Diagnóstico confirmado

- O erro do Pedro ocorreu na **Certidão de Crimes Eleitorais do TSE**. Às 12:53, o parser capturou o nome junto com o campo seguinte (`OCUPAÇÃO DECLARADA...`); nas duas tentativas seguintes, deixou o nome vazio.
- A causa estrutural começa antes dos regex: a extração atual junta todos os itens do PDF com espaço e descarta a posição, a linha e o `hasEOL` fornecidos pelo PDF. Depois, parsers que dependem de `^`, `$` e `\n` tentam interpretar um texto cuja estrutura já foi perdida.
- O problema não está restrito ao TSE: nos últimos 30 dias há **26 recusas por nome supostamente ausente** e ocorrências equivalentes em certidões eleitorais, estaduais e criminais. Os registros também mostram campos de colunas vizinhas engolidos por nome, naturalidade e filiação.
- A conferência está correta ao exigir identificação do titular; o falso negativo nasce na leitura/parsing. A correção não deve flexibilizar comparação de identidade nem aprovar documento incompleto.

## Área do cliente — extração e conferência

1. **Preservar o layout lógico do PDF**
   - Reconstruir linhas com `hasEOL` e coordenadas dos itens do PDF, em vez de inserir espaço entre todos os fragmentos.
   - Manter, além do texto estruturado, uma versão corrida para buscas que não dependem de linha.
   - Continuar usando IA somente como fallback para PDF sem texto útil ou layout não reconhecido.

2. **Criar um leitor canônico de campos rotulados**
   - Ler valor na mesma linha, na linha seguinte e em layouts de duas colunas.
   - Encerrar o valor em rótulos conhecidos, títulos de seção ou deslocamento de coluna; nunca capturar o restante do documento.
   - Validar semanticamente nomes (sem rótulos, frases institucionais ou campos vizinhos), CPF e datas antes de devolvê-los.

3. **Migrar todos os parsers de certidão para o leitor canônico**
   - TSE, STM, IIRGD, TJSP distribuição, TJSP execuções, TRF regional/SJSP e TJM.
   - No TSE, aceitar `Eleitor(a)`, `Nome do eleitor`, variações de quebra/coluna e limitar o nome antes de ocupação, inscrição, nascimento, filiação ou resultado.
   - Ampliar a detecção determinística de resultado para as redações oficiais equivalentes a “NADA CONSTA”, sem transformar a simples palavra “consta” em certidão positiva.

4. **Fallback seguro antes da recusa**
   - Se o órgão for reconhecido, mas um campo obrigatório não for extraído, procurar o nome/CPF exatos do cadastro no texto normalizado do documento como prova determinística de identidade.
   - Esse fallback apenas recupera valor literalmente presente; não usa semelhança, não inventa campo e não converte resultado desconhecido em aprovação.
   - Se ainda faltar campo obrigatório, encaminhar ao fallback de leitura existente/revisão em vez de emitir uma recusa falsa como se o documento não trouxesse o dado.

5. **Unificar os dois extratores locais**
   - Fazer `extracaoLocalPdf.ts` e `parsersCertidoes.ts` consumirem a mesma reconstrução de texto e as mesmas regras de campo, eliminando comportamentos divergentes entre pré-leitura e conferência final.

## Admin e auditoria

1. Registrar no diagnóstico técnico a fonte de cada campo: `parser_rotulo`, `parser_layout`, `literal_cadastro_no_pdf` ou fallback.
2. Diferenciar “campo realmente ausente no documento” de “layout ainda não reconhecido”, para não orientar o cliente a reemitir uma certidão válida.
3. Manter as recusas já registradas como trilha histórica; não aprovar registros antigos automaticamente.

## Testes e validação

- Criar testes unitários com variações reais de texto: linha única, quebra após rótulo, fragmentos de coluna, nome seguido de ocupação, filiação em bloco e texto totalmente achatado.
- Cobrir cada órgão suportado e testar explicitamente que campos vizinhos não entram no nome/naturalidade/filiação.
- Adicionar regressão do caso TSE do Pedro usando dados anonimizados: o nome deve ser exatamente o titular e o resultado deve ser reconhecido quando estiver expresso no PDF.
- Validar que divergências reais de nome, CPF, nascimento e resultado continuam sendo recusadas.
- Executar os testes direcionados e verificar no fluxo de upload que uma certidão válida chega à conferência sem o falso “Nome ausente”.

## Tratamento dos documentos já afetados

- Levantar somente os documentos recusados por `nome ausente`/campo contaminado dentro da janela afetada.
- Após a correção, reprocessá-los para **revisão humana**, preservando status anterior e registrando evento de auditoria; não promover nenhum documento diretamente a aprovado.