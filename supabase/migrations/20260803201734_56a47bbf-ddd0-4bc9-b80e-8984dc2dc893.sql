
insert into public.qa_documentos_biblioteca (codigo, nome, categoria, descricao_o_que_e, descricao_como_enviar, formato_aceito, base_legal, ativo)
values
 ('atestado_aptidao_psicologica_instituicao','Atestado de Aptidão Psicológica da Instituição','laudos',
  'Documento emitido pela própria instituição de segurança pública (PM, PC, PF, PRF, Guarda, Bombeiros, Sistema Penitenciário) atestando a aptidão psicológica do servidor. Substitui o laudo de psicólogo credenciado pela Polícia Federal.',
  'Solicite ao setor de saúde/junta médica da sua instituição o atestado de aptidão psicológica vigente. Envie o PDF ORIGINAL emitido pela instituição, com identificação do órgão, nome completo, resultado (APTO) e data de emissão. Não aceitamos foto nem print.',
  array['pdf'], 'Portaria Conjunta COLOG/C EX e DPA/PF nº 1, de 29 de novembro de 2024, art. 3º, II', true),
 ('atestado_capacidade_tecnica_instituicao','Atestado de Capacidade Técnica / Tiro da Instituição','laudos',
  'Documento emitido pela própria instituição de segurança pública comprovando a capacidade técnica para o manuseio de arma de fogo (habilitação/estágio de tiro interno). Substitui o atestado de instrutor credenciado pela Polícia Federal.',
  'Solicite ao setor de instrução/armamento da sua instituição o atestado de capacidade técnica ou certificado de habilitação em tiro vigente. Envie o PDF ORIGINAL, com identificação do órgão, nome completo, resultado (APTO) e data de emissão.',
  array['pdf'], 'Portaria Conjunta COLOG/C EX e DPA/PF nº 1, de 29 de novembro de 2024, art. 3º, II', true)
on conflict (codigo) do update set
  descricao_o_que_e = excluded.descricao_o_que_e,
  descricao_como_enviar = excluded.descricao_como_enviar,
  base_legal = excluded.base_legal,
  ativo = true;

insert into public.qa_servicos_documentos
 (servico_id, tipo_documento, nome_documento, etapa, ordem, ativo, obrigatorio, condicao_profissional, regra_validacao)
select p.servico_id,
       'exames_instituicao_definir',
       'Você vai usar os exames psicológico e de tiro da sua instituição?',
       p.etapa,
       greatest(p.ordem - 5, 1),
       true, true, 'seguranca_publica',
       jsonb_build_object(
         'tipo','pergunta',
         'chave','exames_instituicao',
         'opcoes', jsonb_build_array(
           jsonb_build_object('label','SIM — VOU USAR OS EXAMES DA MINHA INSTITUIÇÃO','valor','sim'),
           jsonb_build_object('label','NÃO — VOU FAZER COM CREDENCIADOS DA POLÍCIA FEDERAL','valor','nao')
         ),
         'ajuda','Portaria Conjunta COLOG/C EX e DPA/PF nº 1, de 29/11/2024, art. 3º, II: integrantes das forças de segurança podem comprovar aptidão psicológica e capacidade técnica por atestado da própria instituição.'
       )
from public.qa_servicos_documentos p
where p.tipo_documento = 'laudo_psicologico' and p.ativo
  and not exists (
    select 1 from public.qa_servicos_documentos x
    where x.servico_id = p.servico_id and x.tipo_documento = 'exames_instituicao_definir'
  );

insert into public.qa_servicos_documentos
 (servico_id, tipo_documento, nome_documento, etapa, ordem, ativo, obrigatorio, condicao_profissional, regra_validacao)
select p.servico_id, d.tipo_documento, d.nome_documento, p.etapa, p.ordem + d.delta,
       true, true, 'seguranca_publica',
       jsonb_build_object('exige_quando', jsonb_build_object('exames_instituicao','sim'))
from public.qa_servicos_documentos p
cross join (values
  ('atestado_aptidao_psicologica_instituicao','Atestado de Aptidão Psicológica da Instituição',1),
  ('atestado_capacidade_tecnica_instituicao','Atestado de Capacidade Técnica / Tiro da Instituição',2)
) as d(tipo_documento, nome_documento, delta)
where p.tipo_documento = 'laudo_psicologico' and p.ativo
  and not exists (
    select 1 from public.qa_servicos_documentos x
    where x.servico_id = p.servico_id and x.tipo_documento = d.tipo_documento
  );

update public.qa_servicos_documentos
set regra_validacao = coalesce(regra_validacao, '{}'::jsonb)
  || jsonb_build_object('dispensa_quando', jsonb_build_object('exames_instituicao','sim'))
where tipo_documento in ('laudo_psicologico','laudo_capacidade_tecnica') and ativo;
