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

## Correção proposta — trava de escopo CÍVEL para TODOS os órgãos

Sim, dá para generalizar. Em vez de resolver só o TJM, entra uma **trava única de escopo** aplicada antes de qualquer conferência de campos, válida para todas as certidões judiciais (TJM/SP, STM/JMU, TJSP e-SAJ distribuições e execuções, TRF das 6 regiões, TSE/TRE, Polícia Civil).

1. **Detector canônico de escopo cível** (novo `escopoCertidao.ts`), lido do texto do PDF:
   - marcadores cíveis: "CARTORIO CIVEL", "ACOES CIVEIS", "DISTRIBUICAO CIVEL", "AREA CIVEL", "reu/requerido", "CERTIDAO CIVEL", "FAMILIA E SUCESSOES", "FALENCIA/CONCORDATA/RECUPERACAO JUDICIAL", "EXECUCOES FISCAIS";
   - marcadores criminais: "CRIMINAL", "ANTECEDENTES CRIMINAIS", "AUDITORIAS CRIMINAIS", "EXECUCOES CRIMINAIS", "CRIMES ELEITORAIS", "FINS CRIMINAIS".
   - Regra: havendo marcador cível **e nenhum** marcador criminal → documento é CÍVEL → **rejeição imediata**. Havendo os dois (a criminal do TJSP cita "cível" em observações), vence o criminal — evita falso negativo.
2. **Rejeição com motivo legível e slot preservado**: o documento não ocupa o slot de antecedentes; a mensagem diz qual certidão o cliente enviou, qual é a correta e onde emitir (link por órgão já existente em `linksAntecedentesPorUf.ts`). Ex.: "Você enviou a certidão CÍVEL do TJM/SP. O processo exige a Certidão de Antecedentes Criminais do TJM/SP (Auditorias Criminais)."
3. **Discriminar criminal x cível no TJM/SP** em `identificarOrgao`, que hoje não distingue: cível → `tjm_sp_civel`; criminal → `tjm_sp`.
4. **Ler o nome no layout cível** (`réu/requerido:`) apenas para exibir na explicação da rejeição — nunca para aprovar.
5. **Restringir o fallback determinístico de nome** (`conferenciaCertidao.ts:309`): só roda depois que o documento passar na trava de escopo, para não "salvar" documento do tipo errado.
6. **Varredura retroativa**: listar em `qa_documentos_cliente` os documentos aprovados nos slots de antecedentes cujo texto extraído indique escopo cível, e marcá-los para reenvio (o do Pedro entra nessa lista).

## Detalhes técnicos

- Novo `src/lib/quero-armas/escopoCertidao.ts`: `detectarEscopo(texto): "criminal" | "civel" | "indefinido"` + mensagens por órgão.
- `src/lib/quero-armas/parsersCertidoes.ts`: novo valor `tjm_sp_civel` em `OrgaoCertidao`, teste cível-antes-de-criminal no `identificarOrgao`, parser mínimo do cível.
- `src/lib/quero-armas/conferenciaCertidao.ts`: novo achado `escopo_incorreto` avaliado antes do laço de `OBRIGATORIOS`; blindagem do bloco de recuperação (linha 309).
- `src/lib/quero-armas/hubTipoMap.ts`: escopo cível não mapeia para nenhum slot do Hub.
- `supabase/functions/qa-classificar-documento-arma`: mesma trava no caminho da IA, para o servidor não aprovar o que o cliente rejeitou.
- Consulta de auditoria retroativa nos documentos já aprovados.