---
name: No Supabase URL Leak
description: Documentos devem abrir em visualizador interno (blob), nunca via window.open de signed URL do Supabase
type: constraint
---

**Regra:** Nenhum arquivo do Quero Armas (PDF, imagem, etc.) pode ser aberto via `window.open(signedUrl)` ou de qualquer forma que exponha URL `*.supabase.co` na barra do navegador.

**Como aplicar:**
- Sempre usar `DocumentoViewerModal` (`@/components/quero-armas/DocumentoViewerModal`) com o hook `useDocumentoViewer()`.
- O componente baixa o arquivo via `supabase.storage.download` (ou `fetch` autenticado) e renderiza com `URL.createObjectURL(blob)` dentro de um Dialog.
- **PDFs SEMPRE renderizados em `<canvas>` via `pdfjs-dist`**, nunca via `<object>`/`<iframe>`/`<embed>`. O viewer nativo do Edge é frequentemente bloqueado ("Esta página foi bloqueada pelo Microsoft Edge") e o PDF.js elimina essa categoria de incidente.
- Revoga o object URL ao fechar.
- Suporta PDF (canvas PDF.js com paginação e zoom), imagens (`<img>`) e fallback de download para outros formatos.

**Por quê:** Equipe Quero Armas exige que toda navegação fique em `https://www.euqueroarmas.com.br`. Nada de `supabase.co/storage/...` ou `supabase.co/functions/...` visível ao usuário.

**Proibido:**
- `window.open(data.signedUrl, ...)`
- `<a href={signedUrl} target="_blank">`
- Tornar bucket público para esconder URL.

**Permitido (interno):**
- Gerar signed URL para fazer `fetch` server-to-blob, desde que o resultado vá para `URL.createObjectURL`.
- Usar `supabase.storage.download` direto (preferido — mantém RLS).

**Pontos refatorados na implementação inicial:**
- `ProcessoDetalheDrawer.baixarArquivo`
- `ClienteDocsEnviados.handleViewFile`
- `ClienteDocsCadastroPublico.handleOpen`
- `MonitorCadastrosDocumentos.abrirDocumento`