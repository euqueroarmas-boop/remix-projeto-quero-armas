-- Adiciona coluna de validade da filiação anual em qa_documentos_cliente.
-- Usada exclusivamente para comprovante_clube_tiro: data_emissao + 1 ano.
alter table public.qa_documentos_cliente
  add column if not exists validade_filiacao date;
