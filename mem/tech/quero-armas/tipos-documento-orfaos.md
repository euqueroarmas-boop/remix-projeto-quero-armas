---
name: Catálogo de tipos sem órfãos (Bloco 3)
description: Todo tipo_documento usado em processo, Hub ou catálogo de serviços precisa existir em qa_tipos_documento_catalogo
type: feature
---
Regra: `qa_tipos_documento_catalogo` é o vocabulário fechado. Nenhum
`tipo_documento` pode aparecer em `qa_processo_documentos`,
`qa_documentos_cliente` ou `qa_servicos_documentos` sem constar do catálogo
(direto ou via `qa_tipo_documento_aliases`).

Aplicado em 07/08/2026:
- Registrados 7 documentos reais que faltavam: atestados psicológico/técnico da
  instituição, `renda_ficha_cadastral_jucesp`, declarações de habitualidade e
  compromisso de treino, `procuracao_assinada`, `contrato_assinado`.
- Perguntas do checklist (`pergunta_*`, `renda_definir_condicao`,
  `exames_instituicao_definir`) entram com `escopo_documental = 'pergunta'` —
  são conhecidas pelo sistema mas nunca tratadas como documento do Hub.
- Tipo genérico `documento` eliminado: virou `rg_com_cpf` pendente onde era o
  único slot de identidade, removido onde duplicava.

Consulta de auditoria: LEFT JOIN das três tabelas contra o catálogo + apelidos;
o resultado precisa ser zero linhas.
