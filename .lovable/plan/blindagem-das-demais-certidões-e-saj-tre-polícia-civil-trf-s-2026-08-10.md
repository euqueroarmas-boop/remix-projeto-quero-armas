# Blindagem das demais certidões (e-SAJ, TRE, Polícia Civil, TRF, STM, TJM, CR)

A correção anterior resolveu o caso STM/TJM. As demais certidões ainda podem ser rejeitadas por falha de leitura, e não por defeito real do documento. Este plano fecha essa brecha para todos os órgãos.

## Situação atual verificada no código

- `parsersCertidoes.ts` reconhece 8 documentos de pessoa física: STM, TSE, IIRGD (SP), TJSP distribuição, TJSP execuções, TRF regional, TJM-SP e CR do Exército. Fora disso `identificarOrgao()` devolve `null`.
- Quando devolve `null`, o fluxo cai na IA e pode terminar em "documento não identificado" / "confiança insuficiente", mesmo com uma certidão legítima.
- A identificação está presa a cabeçalhos de SP e federais: e-SAJ de outros estados, TREs regionais e Polícia Civil fora de SP não têm regra.
- `conferenciaCertidao.ts` já exige apenas `nome_titular` + `resultado` nas certidões de antecedentes e já tem resgate literal pelo texto do PDF. A camada de comparação está correta; o elo fraco é a extração e a identificação.
- Cobertura de teste hoje: apenas TSE (colunas), leitura de campos e mapeamento militar. Nenhum arquivo-ouro para e-SAJ, TRF, IIRGD, CR ou TJM.

## O que será feito

### 1. Política única de falha segura na leitura
Leitura que falha nunca vira acusação contra o cliente.
- Rejeição só quando houver divergência real comprovada (valor lido diferente do cadastro), resultado `CONSTA` ou documento vencido.
- Campo que o parser não achou, mas cujo valor do cadastro aparece literalmente no PDF, é dado por conferido (hoje vale para nome, CPF e mãe; estender a RG, nascimento e pai).
- Campo não achado e ausente do texto vira **pendência de revisão humana**, não rejeição automática: o documento fica em "em conferência" com alerta no admin.

### 2. Identificação ampliada de órgão
- e-SAJ: reconhecer as certidões estaduais de distribuições criminais dos demais TJs, mantendo o desempate execuções x ações.
- Eleitoral: aceitar cabeçalhos de TRE além do TSE.
- Polícia Civil: aceitar certidões de antecedentes de SSPs de outros estados, além do IIRGD-SP.
- TRF: manter a leitura da região (1 a 6) e o desempate Regional x Seção Judiciária/JEF, sem assumir TRF3.
- Órgão não reconhecido deixa de ser recusa: vira classificação assistida por IA com confirmação, registrando o texto para ampliar as regras depois.

### 3. Extração por família, não por exemplar
Consolidar extratores comuns (nome, CPF, RG, nascimento, filiação, emissão, resultado) reutilizados por todos os parsers, com as travas já existentes: lista de termos que não são nome, validação semântica de nome de pessoa, corte no próximo rótulo e reconstrução estrutural de linhas do PDF.

### 4. Mensagem de rejeição sempre explicativa
Nenhuma recusa pode exibir código técnico. Toda rejeição informa o campo, o valor lido no documento, o valor do cadastro e o que fazer.

### 5. Testes de regressão por órgão
Arquivos-ouro (texto extraído, sem dados sensíveis reais) para cada órgão coberto, garantindo que corrigir um parser não quebre outro. Inclui os casos que já falharam: nome institucional capturado como nome, TSE em duas colunas, TJM sem data numérica, TRF sem "natural de".

### 6. Visibilidade no admin
Na aba de Auditoria de Leitura, listar por documento: órgão identificado, campos lidos, campos vazios, campos não aplicáveis e o motivo exato do veredicto.

## Detalhes técnicos

- `src/lib/quero-armas/parsersCertidoes.ts`: ampliar `identificarOrgao`, extrair helpers comuns, marcar `campos_nao_aplicaveis` por layout.
- `src/lib/quero-armas/conferenciaCertidao.ts`: novo veredicto `revisao_humana`; estender o resgate literal a RG/nascimento/pai.
- `src/lib/quero-armas/leituraCamposPdf.ts`: reutilizar a reconstrução estrutural de linhas em todos os órgãos.
- `src/components/quero-armas/clientes/ClienteDocsHubModal.tsx`: tratar `revisao_humana` (não rejeita, não aprova, sinaliza).
- `src/lib/quero-armas/__tests__/`: um arquivo de teste por órgão.
- Sem alteração de banco; o estado de revisão usa o vocabulário de status já existente.