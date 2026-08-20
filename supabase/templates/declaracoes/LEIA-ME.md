# Templates de declaração — fonte de verdade dos arquivos do Storage

Estes .docx são os modelos que `qa-fill-template-cliente` preenche com os dados
do cliente. O runtime NÃO lê deste diretório: lê do Storage, bucket
`qa-templates`, pasta `declaracoes/`. Este diretório existe para versionar os
arquivos e para o Lovable poder subi-los ao Storage quando pedido.

Regras dos templates:
- SEM cabeçalho e SEM rodapé da Quero Armas (decisão do titular, 19/08/2026).
- Placeholders no formato [NOME COMPLETO], conforme o catálogo em
  `supabase/functions/_shared/qaPlaceholders.ts`.
- A linha de assinatura precisa de 10+ underscores (o pós-processo insere o
  respiro antes dela).
- Nome do arquivo = template_key + `.docx`. O Storage não sobrescreve nome
  repetido; para trocar o conteúdo de um template, crie sufixo novo (`_v2`,
  `_v3`…) e reaponte o `template_key` por migration.
