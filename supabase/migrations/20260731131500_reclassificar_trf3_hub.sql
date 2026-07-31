-- Reclassifica certidoes TRF3 que entraram como tipo/categoria genericos.
-- Base operacional do fluxo documental: Lei 10.826/2003, Decreto 11.615/2023,
-- Decreto 12.345/2024, IN DG/PF 201 e IN DG/PF 311.

update qa_documentos_cliente
set
  tipo_documento = 'antecedentes_federal_trf3_regional',
  categoria_hub = 'antecedentes_regularidade',
  subcategoria_hub = 'antecedentes_federal_trf3_regional',
  escopo_documental = 'permanente',
  reaproveitavel_global = true,
  nome_documento = case
    when nome_documento is null
      or trim(nome_documento) = ''
      or lower(nome_documento) in ('trf', 'outro documento')
      or nome_documento ilike 'Tribunal Regional Federal%Trf%'
    then 'Certidão de Distribuição Criminal — Tribunal Regional Federal da 3ª Região'
    else nome_documento
  end,
  orgao_emissor = case
    when orgao_emissor is null or trim(orgao_emissor) = ''
    then 'Tribunal Regional Federal da 3ª Região'
    else orgao_emissor
  end,
  data_validade = case
    when data_validade is null and data_emissao is not null
    then (data_emissao::date + interval '90 days')::date
    else data_validade
  end,
  updated_at = now()
where coalesce(status, '') <> 'excluido'
  and (
    lower(coalesce(tipo_documento, '')) in (
      'trf3',
      'certidao_federal_trf3',
      'certidao_federal_trf3_regional',
      'antecedentes_federal_trf3',
      'antecedentes_federal_trf3_regional'
    )
    or (
      (
        coalesce(nome_documento, '') ilike '%TRF3%'
        or coalesce(arquivo_nome, '') ilike '%TRF3%'
        or coalesce(orgao_emissor, '') ilike '%TRF3%'
        or coalesce(ia_dados_extraidos::text, '') ilike '%TRF3%'
        or coalesce(nome_documento, '') ilike '%3ª Região%'
        or coalesce(arquivo_nome, '') ilike '%3ª Região%'
        or coalesce(orgao_emissor, '') ilike '%3ª Região%'
        or coalesce(ia_dados_extraidos::text, '') ilike '%3ª Região%'
        or coalesce(nome_documento, '') ilike '%3a Regiao%'
        or coalesce(arquivo_nome, '') ilike '%3a Regiao%'
        or coalesce(orgao_emissor, '') ilike '%3a Regiao%'
        or coalesce(ia_dados_extraidos::text, '') ilike '%3a Regiao%'
      )
      and (
        coalesce(nome_documento, '') ilike '%Tribunal Regional Federal%'
        or coalesce(arquivo_nome, '') ilike '%Tribunal Regional Federal%'
        or coalesce(orgao_emissor, '') ilike '%Tribunal Regional Federal%'
        or coalesce(ia_dados_extraidos::text, '') ilike '%Tribunal Regional Federal%'
        or coalesce(nome_documento, '') ilike '%TRF%'
        or coalesce(arquivo_nome, '') ilike '%TRF%'
        or coalesce(orgao_emissor, '') ilike '%TRF%'
        or coalesce(ia_dados_extraidos::text, '') ilike '%TRF%'
      )
    )
  );
