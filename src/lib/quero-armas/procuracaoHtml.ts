const PROCURACAO_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f6f5f1;
    color: #1a1a1a;
    font-family: Georgia, "Times New Roman", serif;
  }
  .qa-procuracao-body {
    width: min(100% - 32px, 896px);
    margin: 24px auto;
    padding: 48px;
    background: #fff;
    border: 1px solid #d7d3ca;
    font-size: 15px;
    line-height: 1.75;
    text-align: justify;
  }
  .qa-procuracao-body .qa-doc,
  .qa-procuracao-body article {
    max-width: 720px;
    margin: 0 auto;
  }
  .qa-procuracao-body .qa-procuracao__letterhead {
    margin: 0 0 30px;
    font-family: Arial, sans-serif;
    font-size: 11px;
    line-height: 1.45;
    text-align: right;
  }
  .qa-procuracao-body p { margin: 0 0 14px; }
  .qa-procuracao-body ol,
  .qa-procuracao-body ul {
    margin: 12px 0 16px 24px;
    padding: 0;
  }
  .qa-procuracao-body li { margin: 0 0 8px; }
  .qa-procuracao-body h1,
  .qa-procuracao-body h2,
  .qa-procuracao-body h3 {
    font-size: 16px;
    font-weight: 700;
    text-align: center;
    margin: 28px 0 18px;
    text-transform: uppercase;
    line-height: 1.35;
  }
  .qa-procuracao-body h2,
  .qa-procuracao-body h3 {
    font-size: 14px;
    margin-top: 22px;
    text-align: left;
  }
  .qa-procuracao-body .qa-procuracao-template h2 { text-align: center; }
  .qa-procuracao-body .qa-procuracao__powers { margin-left: 26px; }
  .qa-procuracao-body .qa-procuracao__powers li {
    padding-left: 2px;
    margin-bottom: 14px;
  }
  .qa-procuracao-body strong { font-weight: 700; }
  .qa-procuracao-body .qa-doc__date {
    margin-top: 28px;
    text-align: right;
  }
  .qa-procuracao-body .qa-doc__signature {
    margin-top: 52px;
    text-align: center;
  }
  .qa-procuracao-body .qa-doc__signature::before {
    content: "";
    display: block;
    width: 320px;
    max-width: 80%;
    border-top: 1px solid #1a1a1a;
    margin: 0 auto 8px;
  }
  .qa-procuracao-body .qa-doc__signature span,
  .qa-procuracao-body .qa-doc__signature small { display: block; }
  @media print {
    body { background: #fff; }
    .qa-procuracao-body {
      width: 100%;
      margin: 0;
      padding: 0;
      border: 0;
      font-size: 12pt;
    }
  }
`;

function escaparHtml(valor: string) {
  return valor
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizarNomeArquivo(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function montarHtmlProcuracao(conteudoHtml: string, titulo: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escaparHtml(titulo)}</title>
  <style>${PROCURACAO_CSS}</style>
</head>
<body>
  <main class="qa-procuracao-body">${conteudoHtml}</main>
</body>
</html>`;
}

export function baixarHtmlProcuracao(conteudoHtml: string, nomeArquivo: string, titulo: string) {
  const documento = montarHtmlProcuracao(conteudoHtml, titulo);
  const blob = new Blob([documento], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${normalizarNomeArquivo(nomeArquivo) || "Procuracao Quero Armas"}.html`;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
