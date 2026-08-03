---
name: Só PDF original nos documentos do processo
description: Regra de anexo para o Hub Documental da Quero Armas — todos os documentos devem ser PDF original do órgão emissor, exceto a foto 3x4 que pode ser JPG/PNG/WebP.
type: feature
---
# Regra canônica de anexos

**Data de criação:** 03/08/2026

## Princípio

Em nenhuma fase do processo se aceita **print**, **foto de tela** ou **scan/digitalização** de documentos.

Todo documento enviado ao Hub Documental deve ser o **PDF original emitido pelo órgão/emissor**, baixado diretamente do site oficial.

## Única exceção

A **Foto 3x4 do titular** é, por natureza, uma imagem. Pode ser reenquadrada pelo cliente e enviada como arquivo de imagem (JPG/PNG/WebP).

## Implementação central

- `src/lib/quero-armas/somentePdfOriginal.ts` — regra, mensagens e funções utilitárias (`tipoAceitaImagem`, `acceptPorTipo`).
- `src/components/quero-armas/clientes/ClienteDocsHubModal.tsx` — validação global no upload e dropzone.
- `src/components/quero-armas/clientes/HubDocPreviewSlot.tsx` — textos e `accept` dinâmicos no slot de pré-visualização.

## Mensagem padrão ao tentar burlar

> "Só aceitamos o PDF ORIGINAL emitido pelo órgão. Foto, print ou digitalização do documento não são aceitos em nenhuma fase do processo. Baixe o arquivo em PDF no site do emissor e anexe aqui."

## Mensagem para foto 3x4

> "Para a foto 3x4 envie um arquivo de imagem (JPG ou PNG) já reenquadrado."
