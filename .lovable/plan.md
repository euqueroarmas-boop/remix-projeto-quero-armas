## Objetivo

Sistema consulta diariamente as listas oficiais da PF (psicólogos e instrutores de tiro credenciados) e mostra ao cliente os profissionais mais próximos do CEP cadastrado, com dados sempre atualizados.

## Fontes oficiais

- Psicólogos: `https://www.gov.br/pf/pt-br/assuntos/armas/psicologos/psicologos-crediciados/{uf-slug}`
- Instrutores: `https://www.gov.br/pf/pt-br/assuntos/armas/instrutores-de-armamento-e-tiro/credenciados/{uf-slug}`

Cada página agrupa por bairro/cidade em **negrito** e lista entradas: NOME — CRP/CR, End., Tel., E-mail, Validade.

## Entregáveis

### 1. Banco de dados — `qa_pf_credenciados`

Tabela única com:
- `tipo` enum (`psicologo` | `instrutor_tiro`)
- `uf`, `cidade`, `bairro`
- `nome`, `registro` (CRP/CR), `endereco`, `telefones[]`, `emails[]`, `validade`
- `latitude`, `longitude` (geocoding Nominatim, com cache em `cep_cache`-style)
- `source_url`, `raw_block`, `fetched_at`, `hash_conteudo` (dedup)
- Índice GIST para busca por distância (earthdistance/`ll_to_earth`) + índice por (tipo, uf)

RLS: `SELECT` aberto a `authenticated` (cliente logado lê via portal). Mutations apenas `service_role`.

### 2. Edge function `qa-pf-credenciados-sync` (cron diário 03:00)

- Itera 27 UFs × 2 tipos = 54 páginas.
- HTML scraping (fetch direto, User-Agent Chrome — padrão usado em outras integrações do projeto).
- Parser extrai: cabeçalho em negrito = bairro/cidade; bloco até próximo `<strong>` = entrada.
- Regex para nome+registro, endereço, telefones (vários), e-mails, validade.
- Geocoding incremental: endereços novos vão a Nominatim (com `cep_cache` reaproveitado / nova tabela `qa_endereco_geocache`) — respeitando 1 req/s.
- Upsert por hash; remove entradas que sumiram da fonte (flag `ativo=false`).
- Log em `qa_pf_credenciados_sync_log` (totais, erros por UF).
- Agendada via `pg_cron` + `pg_net`.

### 3. Edge function `qa-pf-credenciados-buscar` (consulta)

`POST { tipo, cep, raio_km?, limit? }` →
- Geocoda CEP (BrasilAPI → Nominatim, com cache).
- Retorna top N (default 20) por distância Haversine via `earth_distance`.
- Fallback: se nenhum em raio_km, expande para estado inteiro ordenado por distância.

### 4. UI Cliente

**(a) Modal `AgendarExameModal`** — abre a partir do botão "AGENDAR AGORA" no carrossel de pendências (`ClienteResumoKanban`):
- Tipo (psicólogo/instrutor) inferido do item urgente.
- Lista top 10 mais próximos do CEP do cliente: nome, registro, endereço, distância em km, telefones clicáveis (`tel:`), e-mail (`mailto:`), validade do credenciamento, link Google Maps.
- Badge "Fonte: PF — atualizado em DD/MM".
- Botão "Ver lista completa" → página dedicada.

**(b) Página `/area-do-cliente/agendar-exame`**:
- Aba Psicólogo / Aba Instrutor.
- Filtros: UF (default cliente), busca por nome/bairro, raio (5/10/25/50 km / Estado todo).
- Cards com mesmas infos do modal + ordenação distância/validade/nome.
- Estado vazio com link para o gov.br.

### 5. Integração no fluxo

- `ClienteResumoKanban.tsx`: botão "AGENDAR AGORA" dos itens `exame_psicologico` e `exame_tiro` abre modal em vez de navegar para Documentos.
- Card no Hub de Exames também ganha CTA "Buscar profissional credenciado".

## Detalhes técnicos

- Reaproveita padrão `mem://tech/quero-armas/api-lookup-resilience` (timeout 6s + fallback direto).
- Extensões Postgres: `cube`, `earthdistance` (habilitar na migration).
- Sanitização: telefones normalizados `(DD) NNNNN-NNNN`; emails lowercased; validade parseada DD/MM/AAAA → DATE.
- Quando validade expirada, esconder por padrão (toggle "incluir vencidos").
- Sem alteração no Hub de Documentos atual; apenas adiciona a rota de agendamento.

## Fora de escopo

- Agendamento online direto (PF não oferece API).
- Notificações push de novos credenciados.
- Mapa interativo (Leaflet) — fica como melhoria futura; v1 usa link Google Maps por item.
