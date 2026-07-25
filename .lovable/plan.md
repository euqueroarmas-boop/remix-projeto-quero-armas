
## Objetivo

Fazer o cérebro do Quero Armas ler o comprovante de endereço do cliente e, a partir do estado (UF) e da geolocalização, entregar automaticamente:

1. Os **links e explicações corretos** de antecedentes **estaduais** (Polícia Civil, TJ, TJM, TRF regional) — nunca mais links fixos de SP para clientes de outros estados.
2. **Psicólogos e instrutores credenciados num raio de 25 km** do endereço, apenas como **recomendação** — o cliente continua livre para escolher qualquer credenciado do Brasil.
3. A **circunscrição da PF** que deverá receber o pedido (já resolvida por `qa_circunscricoes_pf`, só falta amarrar ao fluxo).

## O que muda

### 1. Motor "endereço → estado" (nova função util)

Arquivo novo: `src/lib/quero-armas/localizacaoCliente.ts`

- Lê, em ordem: `cliente.estado` → endereço do comprovante mais recente aprovado → CEP.
- Retorna `{ uf, municipio, lat, lng, origem }`, com `origem = "cadastro" | "comprovante" | "cep"`.
- Cai para `null` só se nenhuma das fontes existir.

### 2. Catálogo de links por estado (novo)

Arquivo novo: `src/lib/quero-armas/linksAntecedentesPorUf.ts`

Tabela em memória com, para cada UF:

- `policiaCivil` (URL do atestado de antecedentes da PC)
- `tj` (portal de certidões do Tribunal de Justiça)
- `tjm` (quando existir — hoje só SP, MG, RS)
- `trfRegional` (TRF1..TRF6 conforme UF)

Fallback nacional para UFs sem entrada específica: STM / TSE / JF (federais são iguais em todo o Brasil).

### 3. `pendenciasExplicacoes.ts` — passa a receber contexto

Cada entrada de antecedente estadual (`certidao_antecedentes_criminais_estadual`, `certidao_antecedentes_policia_civil_sp`, `certidao_tjsp_distribuicao_criminal`, `certidao_tjsp_execucoes_criminais`, `certidao_federal_trf3_regional`, `certidao_federal_trf3_sjsp_jef`, `certidao_criminal_tjmsp`) vira uma função `(ctx: { uf, municipio }) => Explicacao` que:

- Reescreve o `titulo` com o estado ("Antecedentes criminais — TJ<UF>").
- Substitui o passo do portal pelo TJ/PC correto da UF do cliente.
- Devolve `linkEmissao` sobrescrito com o link do catálogo por UF.

`QAClientePortalPage.tsx` passa a passar `ctx` ao montar cada item do popup guiado; se o UF não existir, mantém o texto genérico atual (nada quebra).

### 4. Recomendação por raio de 25 km (psicólogos e instrutores)

Arquivo novo: `src/lib/quero-armas/credenciadosProximos.ts`

- Função `buscarCredenciadosProximos({ lat, lng, raioKm = 25 })`.
- Query em `qa_psico_credenciados` e `qa_iat_credenciados`: filtra `lat/lng` não nulos, calcula distância Haversine no cliente (as tabelas já têm as colunas), ordena por distância e devolve top 10 de cada com `{ id, nome, uf, cidade, endereco, telefone, distancia_km }`.
- **Não filtra por UF** — o raio pode cruzar fronteiras estaduais e o cliente pode escolher qualquer um.

### 5. UI — modal "Agendar exame" / seleção de credenciados

`src/pages/quero-armas/` (página existente `/area-do-cliente/agendar-exame`):

- Passa a abrir já com o resultado de `buscarCredenciadosProximos` do endereço do cliente.
- Cabeçalho: banner discreto "Recomendados até 25 km do seu endereço — você pode escolher qualquer credenciado do Brasil".
- Aba/toggle "Ver todos do Brasil" ou busca por CEP/cidade para trocar o centro do raio.
- Cada card mostra distância ("12 km"). Sem bloqueio por UF.

### 6. Circunscrição PF explícita no portal

`ClienteResumoKanban.tsx` (ou card equivalente do dossiê) ganha uma linha "Delegacia responsável: **DELEMAF/SP** — resolvida via `qa_circunscricoes_pf` a partir do município do comprovante". Só leitura, sem interação.

### 7. Registro em memória (`mem://`)

Nova memória `mem://features/quero-armas/localizacao-motor-endereco.md` documentando:
- Prioridade de fonte (cadastro > comprovante > CEP).
- Que links estaduais são derivados da UF, nunca hardcoded para SP.
- Raio de 25 km é sugestão, não trava.

## Detalhes técnicos

- Nenhuma migration: `qa_psico_credenciados` e `qa_iat_credenciados` já têm `lat/lng`; `qa_circunscricoes_pf` já mapeia UF/município → unidade.
- Haversine roda no cliente (poucas centenas de linhas). Se virar gargalo, migramos para RPC PostGIS depois — fora deste escopo.
- Nenhum comportamento existente quebra: se o UF do cliente for desconhecido, o popup guiado mantém o texto atual (SP como fallback dos que hoje já são SP-específicos vira "genérico com placeholder do estado").
- Sem mudança em RLS, edge functions ou schema.

## Fora do escopo

- Sincronizar credenciados novos (job de sync já existe).
- Agendamento automático com os credenciados.
- Cálculo de distância server-side (fica em backlog).
