# Controles do documento no Hub + download em lote na ordem do protocolo

## Ordem que entendi do seu ZIP (ordem de protocolo PF)

```text
GRUPO 1 — REQUERIMENTO E TAXAS
  1.0 Requerimento do SINARM
  1.1 Boleto (GRU)
  1.2 Comprovante de pagamento da taxa
  1.3 Petição de Efetiva Necessidade
GRUPO 2 — FOTO
  02. Foto 3x4
GRUPO 3 — IDENTIFICAÇÃO CIVIL
  03. Documento de identificação (CNH/CIN/RG)
GRUPO 4 — IDENTIFICAÇÃO RESIDENCIAL
  04. Comprovante de residência original (30 dias)
GRUPO 5 — OCUPAÇÃO LÍCITA
  05. Ocupação lícita (contracheque, extrato INSS, CCMEI, NF etc.)
GRUPO 6 — IDONEIDADE (ANTECEDENTES)
  06. Polícia Civil (SSP)
  07. TRF3 — 1º grau em São Paulo + Regional
  08. Execuções Criminais — e-SAJ
  09. Distribuição de Ações Criminais — e-SAJ
  10. Crimes Eleitorais — TSE
  11. Justiça Militar da União (STM) + nada consta STJ
  12. Justiça Militar Estadual (TJM-SP)
GRUPO 7 — LAUDOS
  13. Exame psicológico
  14. Exame de tiro (instrutor credenciado)
```

Essa sequência vira uma tabela canônica de ordem de protocolo, aplicada a todos os clientes do serviço de compra/posse. Documentos que o cliente enviar e não se encaixarem em nenhum item entram ao final, em "99. Complementares", nunca são descartados.

## 1. Controles por documento (admin — Hub Cliente)

Cada linha da timeline e cada card por família ganha uma barra de ações fixa:
- Visualizar (abre o PDF em visualizador interno, sem expor URL de storage)
- Baixar (via blob, nome já no padrão numerado do protocolo)
- Substituir/Adicionar nova versão
- Rejeitar (motivo obrigatório)
- Excluir (confirmação dupla, exclusão lógica com registro de auditoria)

## 2. Notificação ao cliente em toda ação

Toda ação acima gera evento auditado e notifica o cliente:
- Visualizamos seu documento X
- Baixamos seu documento X
- Documento X foi rejeitado — motivo
- Documento X foi removido — motivo

Notificação aparece no portal (sino) e sai por e-mail/WhatsApp conforme a preferência já existente. Visualização/download são agregados por sessão (1 aviso por documento a cada 6h) para não spammar o cliente.

## 3. Baixar tudo de uma vez

Botão "BAIXAR TUDO (ZIP)" no cabeçalho do Hub, com opções:
- Todos os documentos aprovados
- Só as certidões (grupo Idoneidade)

O ZIP sai com os arquivos renomeados e ordenados exatamente na numeração acima (ex.: `06. AAC_Policia Civil.pdf`), pastas opcionais por grupo, e um `00. Indice.txt` com a listagem. O download em lote também notifica o cliente (um único aviso: "a equipe baixou seu dossiê completo").

## Detalhes técnicos

- Nova tabela `qa_documento_ordem_protocolo` (serviço, grupo, ordem, rótulo, tipos de documento aceitos) como fonte única da ordem; seed com o mapa acima.
- Novo helper `src/lib/quero-armas/ordemProtocolo.ts` resolvendo `tipo_documento → {grupo, indice, nomeArquivo}`.
- Edge function `qa-dossie-zip`: monta o ZIP no servidor com service_role, devolve blob assinado de curta duração (nenhuma URL de storage vaza).
- Ações e notificações passam por uma edge function única `qa-doc-acao-equipe` (estendida com `visualizar`, `baixar`, `excluir`) que grava em `qa_documento_downloads` / `qa_processo_eventos` e dispara `qa-processo-notificar`.
- UI: barra de ações em `ClienteDocsEnviados.tsx` e no painel de timeline do Hub; botão de lote no cabeçalho.
