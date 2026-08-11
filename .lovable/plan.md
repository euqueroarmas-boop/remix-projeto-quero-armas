# Entregas de certidão travadas: o que os registros mostram

## O que está acontecendo

Nas tentativas de hoje (11/08, por volta das 13:02), o arquivo `Certidao.pdf` (7 KB) chegou ao servidor e:

1. A leitura nativa do PDF falhou: o motor de texto respondeu **"Invalid PDF structure"** — o arquivo não abre como PDF válido.
2. Sem texto, a análise caiu na leitura por imagem, e o serviço de IA devolveu **"The document has no pages"** (400).
3. A função respondeu **500 / "Falha na IA"**, e o portal mostrou a faixa vermelha genérica **"Edge Function returned a non-2xx status code"**.

Nenhum documento novo foi gravado hoje — o último registro no Hub é de 10/08 às 23h. Ou seja, a entrega não é parcial: ela não conclui.

## O que ainda não está confirmado

Duas causas possíveis produzem exatamente esse mesmo erro, e os registros atuais não separam as duas:

- **A** — o arquivo que o cliente possui já está corrompido/vazio na origem (7 KB é pequeno até para certidão digital).
- **B** — o arquivo chega íntegro no celular, mas é truncado no caminho até o servidor (leitura do arquivo no iOS/Safari e conversão para envio).

Confirmar qual é o caso é o primeiro passo do trabalho — sem isso, qualquer correção é chute.

## Plano

### Passo 1 — Identificar a causa (antes de qualquer correção)
- Registrar, no log da análise, o tamanho em bytes recebido pelo servidor, se o arquivo começa com a assinatura `%PDF-` e se termina com `%%EOF`.
- Comparar com o tamanho que o navegador do cliente enviou.
- Tamanhos iguais e arquivo já inválido: causa A (arquivo do cliente).
- Servidor recebendo menos bytes: causa B (transporte) — a correção passa a ser no envio, não na leitura.

### Passo 2 — Nunca mais mostrar erro técnico ao cliente
O portal não pode exibir "Edge Function returned a non-2xx status code". Trocar por mensagem que diga o que fazer:

> "Não conseguimos abrir este arquivo — ele parece incompleto ou corrompido. Baixe novamente a certidão no site do órgão e envie o PDF original (não use print, foto nem o 'compartilhar' do WhatsApp)."

Vale para as duas causas e resolve o pior sintoma imediato.

### Passo 3 — Barrar o arquivo inválido antes de gastar a IA
Verificar a integridade do PDF ainda no celular do cliente (assinatura e páginas). Arquivo sem páginas nem chega a ser enviado — o cliente recebe orientação na hora, sem espera de 60 s e sem custo de IA.

### Passo 4 — Corrigir a causa raiz encontrada no Passo 1
- Causa A: manter o bloqueio orientado do Passo 3 e registrar o caso na auditoria como "arquivo inválido na origem".
- Causa B: corrigir o envio no fluxo mobile (leitura completa do arquivo com conferência de tamanho antes de enviar) e reprocessar as tentativas travadas.

### Passo 5 — Visibilidade para a equipe
Registrar toda falha de leitura em auditoria (cliente, arquivo, tamanho, motivo), para o problema aparecer no painel em vez de depender de o cliente reclamar.

## Área do cliente x Admin

- **Área do cliente:** mensagem orientada no lugar do erro técnico; bloqueio antecipado do arquivo inválido; instrução de baixar de novo o PDF original.
- **Admin:** log com tamanho/assinatura/motivo e falhas de leitura visíveis no painel de auditoria de documentos.

## Detalhes técnicos

- Função `qa-classificar-documento-arma`: `extractPdfTextFromDataUrl` cai em `InvalidPDFException`; em seguida o gateway responde 400 "The document has no pages" e a função retorna 500 "Falha na IA".
- Instrumentar `decodeDataUrlBytes` (bytes recebidos, header `%PDF-`, trailer `%%EOF`) antes de decidir a correção.
- Separar na resposta: `arquivo_invalido` (400, mensagem orientada) x `falha_ia` (500, erro real de serviço) — hoje os dois viram o mesmo 500.
- Cliente: validação de integridade em `ClienteDocsHubModal.tsx` antes do `fileToDataUrl` e tratamento de `arquivo_invalido` no `catch` do `invokeComTimeout`.