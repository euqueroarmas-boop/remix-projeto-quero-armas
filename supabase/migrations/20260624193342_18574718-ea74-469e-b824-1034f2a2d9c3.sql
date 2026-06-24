
alter table public.qa_iat_credenciados
  drop constraint if exists qa_iat_credenciados_uf_nome_portaria_key;

create unique index if not exists qa_iat_credenciados_dedupe_idx
  on public.qa_iat_credenciados (uf, nome, coalesce(portaria, ''), coalesce(endereco, ''));
