# Efetiva Necessidade em etapas, no padrão do pop-up guiado

Hoje o modal de Efetiva Necessidade entrega tudo numa página só: quatro perguntas, os anexos, o relato longo e o campo de rotina, empilhados num scroll gigante no celular. O cliente se perde, pula campo e clica em "Gerar meu relato" antes da hora.

A mudança: cada bloco vira **uma etapa**, uma por tela, exatamente como o cliente já navega nos outros grupos do pop-up guiado (chip de grupo, contador "Passo X de N", trilha numerada, Anterior/Próximo no rodapé).

## As etapas

1. Boletim de ocorrência — pergunta Sim/Não + anexo dos BOs
2. Inquérito policial — pergunta Sim/Não + anexo
3. Ação criminal — pergunta Sim/Não + anexo
4. Ameaça atual — pergunta Sim/Não
5. Conte o que está acontecendo — relato do cliente
6. O que na sua rotina aumenta o risco — contexto
7. Revisão e geração — "Gerar meu relato" e, depois, relato + texto do BO + passo a passo da delegacia (tela que já existe hoje)

O painel verde "Provas recebidas" deixa de ser um bloco solto: aparece dentro da etapa que originou cada prova e é resumido de novo na etapa 7.

## Comportamento

- **Cabeçalho:** chip "EFETIVA NECESSIDADE · PASSO 3 DE 7", título da etapa atual e o texto de apoio dela — sem repetir o parágrafo institucional em toda tela.
- **Trilha:** lista compacta das etapas com a linha vertical e o marcador numerado do pop-up guiado; etapa concluída ganha o check.
- **Rodapé fixo:** "Anterior" à esquerda; à direita "Próximo" nas etapas 1 a 6 e "Gerar meu relato" na 7. O aviso de salvamento automático continua no rodapé, em uma linha só.
- **Avanço:** a etapa de pergunta só libera o "Próximo" depois da resposta Sim/Não; se respondeu "sim" e não anexou nada, avisamos uma vez e deixamos seguir. A etapa 5 exige o mínimo de caracteres apenas quando não há nenhuma prova anexada — mesma regra de hoje.
- **Retomada:** ao reabrir, o modal cai na primeira etapa incompleta; se o relato já foi gerado, abre direto na etapa 7, como hoje.
- **Salvamento:** inalterado — respostas gravam no ato, textos por debounce/blur.
- **Navegação livre:** tocar numa etapa já visitada na trilha volta para ela.

Nenhuma regra de negócio, prompt de IA, geração de dossiê ou tabela muda. É reorganização de interface.

## Detalhes técnicos

- `src/components/quero-armas/portal/EfetivaNecessidadeModal.tsx`: o estado `etapa` (`"provas" | "narrativa"`) passa a `passoIndex: number` sobre uma lista declarativa `PASSOS` (id, título, subtítulo, tipo `pergunta | texto | revisao`, campo, `tipoProva`, validador). O corpo renderiza só o passo corrente; a etapa de revisão reaproveita, sem alteração, o JSX atual do bloco `etapa === "narrativa"`.
- Cabeçalho, trilha numerada e rodapé copiam as classes já usadas em `PendenciasGuiadasPopup.tsx` (chip bordô `#7A1F2B`, marcador circular com linha, botões `ChevronLeft`/`ChevronRight`), mantendo o X bordô e o padding-right reservado.
- `podeConcluir`, `semProvaNenhuma`, `receberArquivo`, `responder`, `salvarTexto`, `gerarNarrativa` e `aprovar` permanecem como estão; entram apenas `passoValido(i)` e `primeiroPassoIncompleto()`.
- Nada muda em `qa-efetiva-narrativa`, `qa-efetiva-aprovar`, `ClienteEfetivaNecessidade.tsx` ou no banco.