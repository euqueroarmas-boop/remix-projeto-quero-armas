# Ocupação lícita — validade e conferência dos documentos de empresa

## Problema confirmado

O catálogo de validade no banco (`qa_validade_documentos`) manda em cima das regras do código. Hoje ele diz:

| tipo | validade hoje | correto |
|---|---|---|
| `renda_ccmei` | 30 dias | sem vencimento |
| `renda_contrato_social` | perpétuo (já correto) | sem vencimento |
| `renda_ficha_cadastral_jucesp` (requerimento de empresário) | 30 dias | sem vencimento |
| `renda_cartao_cnpj` | 30 dias | mantém 30 dias |
| `renda_qsa` | 30 dias | mantém 30 dias, herdando a emissão do Cartão CNPJ |
| `renda_nf_empresa` | perpétuo | mantém |

O código já trata CCMEI/contrato social como perpétuos (`isDocumentoConstitutivoPerpetuo`), mas o catálogo do banco é consultado primeiro e reintroduz os 30 dias — por isso o Hub exige emissão e validade do CCMEI.

## O que muda

### 1. Validade
- Migração ajustando `renda_ccmei` e `renda_ficha_cadastral_jucesp` para perpétuos (e desativando a linha órfã `ccmei`).
- No Hub, para CCMEI / contrato social / requerimento de empresário: os campos **Emissão** e **Validade** deixam de ser pedidos e de ser exibidos, e nenhum cálculo de prazo é aplicado.
- Cartão CNPJ continua com emissão obrigatória e validade = emissão + 30 dias (comportamento atual).
- QSA continua 30 dias, com emissão herdada do Cartão CNPJ aprovado; se as duas datas divergirem, o QSA é reprovado com explicação ("QSA deve ser da mesma consulta do Cartão CNPJ").

### 2. Conferência (o que cada documento confronta)
- **CCMEI / Contrato social / Requerimento de empresário:** confronta somente **nome do titular**, **CPF** e **situação cadastral**. Situação diferente de ATIVA/ATIVO → reprova com carimbo explicando a situação lida.
- Além disso, o **CNPJ e a razão social** extraídos desses documentos são confrontados com o **Cartão CNPJ** e o **QSA** já aprovados e com os campos de cadastro do cliente (`ocupacao_licita_cnpj`, `ocupacao_licita_razao_social`). Divergência de CNPJ reprova; razão social usa a comparação fuzzy já existente.
- **QSA:** exige que **pelo menos** o nome do cliente cadastrado apareça no quadro de sócios. Nomes adicionais não reprovam.
- **Nota fiscal:** confere apenas o **emitente/prestador** — aprova se o CNPJ **ou** a razão social baterem com os dados de empresa do cadastro (ou do Cartão CNPJ aprovado). A regra atual de parentesco do tomador continua valendo.

### 3. Onde isso vale
As mesmas regras passam a valer no Hub Documental do admin, no pop-up guiado do cliente e na validação por IA das Edge Functions — a lógica fica em um único módulo compartilhado, sem duplicar regra.

## Detalhes técnicos

- Migração em `qa_validade_documentos` (perpetuo=true, validade_dias=0) para `renda_ccmei` e `renda_ficha_cadastral_jucesp`.
- Novo módulo `src/lib/quero-armas/ocupacaoLicitaConferencia.ts` com: `exigeDatasOcupacao(tipo)`, `situacaoCadastralAprovada(valor)`, `conferirQsaContemCliente(...)`, `conferirEmitenteNotaFiscal(...)` e o confronto de CNPJ/razão contra cadastro.
- `ClienteDocsHubModal.tsx`: usa o módulo no bloco `TIPOS_EMPRESARIAIS` de `calcularConformidade`, injeta `ocupacao_licita_cnpj`/`ocupacao_licita_razao_social` do cadastro como referência de empresa, e esconde/dispensa Emissão e Validade para os tipos constitutivos.
- `validadeDocumento.ts`: `isDocumentoConstitutivoPerpetuo` passa a curto-circuitar **antes** do catálogo, para que uma linha errada no banco nunca reintroduza prazo.
- Espelho da regra em `supabase/functions/_shared/` para `qa-processo-doc-validar-ia` e `qa-classificar-documento-arma` (prompts atualizados para não exigir data de emissão/validade de CCMEI/contrato social/requerimento).
- Atualização de `mem/features/quero-armas/ocupacao-licita-matriz.md` com as regras finais.

## Verificação
- Reenviar o CCMEI de exemplo: salva sem pedir emissão/validade, carimbo mostra nome/CPF/situação conferidos.
- CCMEI com situação BAIXADA → reprovado.
- QSA com data diferente do Cartão CNPJ → reprovado; QSA com sócios extras contendo o cliente → aprovado.
- Nota fiscal emitida pelo CNPJ do cadastro → aprovada.
