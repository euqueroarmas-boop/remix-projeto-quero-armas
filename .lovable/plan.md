# Parser TJM/SP — os dois PDFs estão sendo aceitos (e um deles não deveria)

## O que os dois arquivos realmente são

1. `certidaocriminal.tjmsp.jus.br_...248.756.PDF` — **Certidão de Antecedentes CRIMINAIS** do TJM/SP (Coordenadoria de Distribuição de 1ª Instância, "nas três Auditorias Criminais", NADA CONSTA, 10/08/2026). É a certidão correta para o processo.
2. `fd90aa3e-...pdf` — **Certidão CÍVEL** do TJM/SP (Cartório Cível, "distribuição de AÇÕES CÍVEIS", Segunda e Sexta Auditorias). **Não é certidão criminal** e não instrui pedido de aquisição/posse.

## Situação atual do código (verificada)

- `identificarOrgao` (parsersCertidoes.ts:245) classifica como `tjm_sp` qualquer PDF com "TRIBUNAL DE JUSTICA MILITAR DO ESTADO" — **sem checar se é criminal ou cível**. Os dois caem no mesmo órgão.
- `parseTjmSp` busca o nome por `em nome de:`. O criminal tem esse rótulo; o cível escreve "(réu/requerido):", então `nome_titular` sai vazio.
- Em `conferirCertidao` (linha 309) o fallback determinístico acha "PEDRO LOBATO DE LIMA" literal no texto do cível e **dá o campo por atendido**.
- `resultado()` casa `NADA CONSTA` com o "NADA CONSTAR" do cível → `NADA_CONSTA`.

**Conclusão: os DOIS são aprovados hoje.** O criminal corretamente; o cível por falso positivo — ele ocupa o slot `antecedentes_militar_estadual` e o processo segue sem a certidão criminal exigida.

## Correção proposta

1. **Discriminar criminal x cível no TJM/SP** em `identificarOrgao`:
   - cível quando houver "CARTORIO CIVEL" / "ACOES CIVEIS" / "reu/requerido" → novo órgão `tjm_sp_civel`;
   - criminal quando houver "ANTECEDENTES CRIMINAIS" / "AUDITORIAS CRIMINAIS" / "FINS CRIMINAIS" → `tjm_sp` (como hoje).
2. **Rejeitar o cível com motivo legível**, sem ocupar o slot criminal: "Você enviou a certidão CÍVEL do TJM/SP. Para este processo é necessária a Certidão de Antecedentes Criminais do TJM/SP (Auditorias Criminais)."
3. **Ler o nome também no layout cível** (`réu/requerido:`) apenas para exibir na explicação da rejeição — nunca para aprovar.
4. **Restringir o fallback determinístico de nome**: só aplicar depois que o documento passar na checagem de escopo, para não "salvar" documento do tipo errado.
5. **Varredura retroativa**: listar em `qa_documentos_cliente` os arquivos aprovados como `antecedentes_militar_estadual` cujo texto indique cartório cível e marcá-los para reenvio.

## Detalhes técnicos

- `src/lib/quero-armas/parsersCertidoes.ts`: novo valor `tjm_sp_civel` em `OrgaoCertidao`, teste cível-antes-de-criminal no `identificarOrgao`, parser mínimo do cível.
- `src/lib/quero-armas/conferenciaCertidao.ts`: entrada em `OBRIGATORIOS` para `tjm_sp_civel` + achado fixo `escopo_incorreto` que sempre reprova; blindar o bloco de recuperação (linha 309).
- `src/lib/quero-armas/hubTipoMap.ts`: `tjm_sp_civel` não mapeia para nenhum slot do Hub.
- Consulta de auditoria retroativa nos documentos já aprovados desse tipo.