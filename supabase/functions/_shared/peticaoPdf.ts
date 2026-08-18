// ============================================================================
// peticaoPdf — a petição aprovada vira arquivo, em duas versões
// ----------------------------------------------------------------------------
// Achado da TERCEIRA auditoria (18/08/2026): o ciclo de aprovação da petição
// funcionava inteiro — a equipe enviava, o cliente lia, corrigia e aprovava — e
// terminava ali. O texto aprovado ficava guardado numa tabela, e o PDF único
// que vai para a Polícia Federal é montado a partir dos DOCUMENTOS do processo.
// Texto em tabela não é documento. Então a peça que o cliente aprovou não
// entrava no dossiê: ou alguém baixava o Word, convertia e subia à mão, ou o
// processo era protocolado sem ela.
//
// ── DUAS VERSÕES, DE PROPÓSITO (decisão do titular, 18/08/2026) ─────────────
//
//   SIMPLES  → é a que vai para a delegacia. Só o texto da petição, limpo,
//              sem carimbo, sem IP, sem hash. A PF não tem nada a ver com a
//              nossa trilha de auditoria, e poluir a peça com ela só dá
//              margem a questionamento sobre a forma.
//
//   LACRADA  → fica com a gente. Mesmo texto + uma página final de registro:
//              data e hora BRT, IP, navegador, idioma, impressão digital
//              SHA-256 do texto exato e a declaração que ele marcou. É a
//              prova de que ele leu, concordou e afirmou que os fatos são
//              verdadeiros. Existe para o dia em que alguém disser que não
//              disse aquilo. NÃO entra no dossiê.
//
// ── ACENTO ──────────────────────────────────────────────────────────────────
// As fontes padrão do PDF usam WinAnsi, que cobre o português inteiro. O que
// ela NÃO cobre é a pontuação tipográfica que a IA gosta de usar (travessão
// longo, aspas curvas, reticências de um caractere). Sem tradução, o pdf-lib
// levanta erro e o arquivo inteiro se perde — por causa de uma aspa. Por isso
// `paraWinAnsi` traduz o que dá para traduzir e remove o resto: um travessão
// vira hífen, o texto jurídico continua legível e nada estoura.
// ============================================================================

const W = 595.28; // A4 em pontos
const H = 841.89;
const M = 56;

/** Substituições seguras para caracteres fora do WinAnsi. */
const TRADUCAO: Record<string, string> = {
  "—": "-", // travessão longo
  "–": "-", // travessão curto
  "‐": "-",
  "‑": "-",
  "‘": "'",
  "’": "'",
  "‚": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "…": "...",
  " ": " ", // espaço inquebrável
  " ": " ",
  " ": " ",
  "•": "-",
  "­": "",
  "﻿": "",
};

/**
 * Deixa o texto seguro para as fontes padrão do PDF.
 *
 * Traduz a pontuação tipográfica e remove o que sobrar fora do Latin-1. Os
 * acentos do português passam intactos — é `ç`, `ã` e `é` que fazem a petição
 * ser lida como petição.
 */
export function paraWinAnsi(texto: string): string {
  let out = "";
  for (const ch of String(texto ?? "")) {
    if (Object.prototype.hasOwnProperty.call(TRADUCAO, ch)) {
      out += TRADUCAO[ch];
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\n" || ch === "\r" || ch === "\t") { out += ch; continue; }
    if (code >= 32 && code <= 255) { out += ch; continue; }
    // Fora do alcance da fonte: melhor um espaço do que um arquivo perdido.
    out += " ";
  }
  return out;
}

interface FonteMedidora {
  widthOfTextAtSize(texto: string, size: number): number;
}

/** Quebra o parágrafo na largura útil da página, respeitando as quebras dele. */
function quebrar(texto: string, fonte: FonteMedidora, size: number, largura: number): string[] {
  const linhas: string[] = [];
  for (const bruto of String(texto ?? "").split("\n")) {
    const palavras = bruto.split(/\s+/).filter(Boolean);
    if (palavras.length === 0) { linhas.push(""); continue; }
    let atual = "";
    for (const palavra of palavras) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(tentativa, size) <= largura) {
        atual = tentativa;
      } else {
        if (atual) linhas.push(atual);
        // Palavra sozinha maior que a linha (URL, número de processo colado):
        // corta na força, senão ela some da página.
        if (fonte.widthOfTextAtSize(palavra, size) > largura) {
          let pedaco = "";
          for (const ch of palavra) {
            if (fonte.widthOfTextAtSize(pedaco + ch, size) > largura) {
              linhas.push(pedaco); pedaco = ch;
            } else { pedaco += ch; }
          }
          atual = pedaco;
        } else {
          atual = palavra;
        }
      }
    }
    if (atual) linhas.push(atual);
  }
  return linhas;
}

export interface CarimboPeticao {
  /** Data/hora da aprovação, já formatada em BRT. */
  aprovadaEm: string;
  ip: string | null;
  userAgent: string | null;
  idioma: string | null;
  /** SHA-256 do texto exatamente como aprovado. */
  hash: string;
  /** O cliente alterou o texto antes de aprovar? */
  editada: boolean;
  /** Texto da declaração que ele marcou na caixa. */
  declaracao: string;
}

export interface MetaPeticao {
  titulo: string;
  requerente: string;
  cpf?: string | null;
  servico?: string | null;
}

/**
 * A petição como ela vai para a Polícia Federal: só o texto.
 *
 * Sem carimbo, sem hash, sem IP. O cabeçalho traz apenas o que identifica a
 * peça no dossiê — título, requerente e serviço —, que é o que a autoridade
 * precisa para saber de quem é o papel que está lendo.
 */
export async function montarPeticaoSimplesPdf(
  texto: string,
  meta: MetaPeticao,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("npm:pdf-lib@1.17.1");
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([W, H]);
  let y = H - M;

  const escrever = (t: string, o: { size?: number; bold?: boolean; gap?: number } = {}) => {
    const size = o.size ?? 11;
    const f = o.bold ? bold : fonte;
    for (const linha of quebrar(paraWinAnsi(t), f, size, W - M * 2)) {
      if (y < M + 30) { page = doc.addPage([W, H]); y = H - M; }
      if (linha) page.drawText(linha, { x: M, y, size, font: f, color: rgb(0.08, 0.08, 0.08) });
      y -= size + 5;
    }
    y -= o.gap ?? 6;
  };

  escrever(meta.titulo || "PETICAO", { size: 13, bold: true, gap: 8 });
  escrever(
    `Requerente: ${meta.requerente}${meta.cpf ? ` - CPF ${meta.cpf}` : ""}` +
      (meta.servico ? `\nAssunto: ${meta.servico}` : ""),
    { size: 10, gap: 14 },
  );
  escrever(texto, { size: 11, gap: 0 });

  return await doc.save();
}

/**
 * A mesma petição + a página de registro. Prova interna, nunca vai ao órgão.
 *
 * A página de registro fica no FIM, e não no começo, para que o documento
 * continue sendo lido como a petição que é. Ela responde a uma pergunta só:
 * quem afirmou o quê, quando, de onde, e o texto era exatamente este?
 */
export async function montarPeticaoLacradaPdf(
  texto: string,
  meta: MetaPeticao,
  carimbo: CarimboPeticao,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("npm:pdf-lib@1.17.1");
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([W, H]);
  let y = H - M;

  const escrever = (t: string, o: { size?: number; bold?: boolean; gap?: number } = {}) => {
    const size = o.size ?? 11;
    const f = o.bold ? bold : fonte;
    for (const linha of quebrar(paraWinAnsi(t), f, size, W - M * 2)) {
      if (y < M + 30) { page = doc.addPage([W, H]); y = H - M; }
      if (linha) page.drawText(linha, { x: M, y, size, font: f, color: rgb(0.08, 0.08, 0.08) });
      y -= size + 5;
    }
    y -= o.gap ?? 6;
  };

  escrever("ARSENAL INTELIGENTE - QUERO ARMAS", { size: 9, bold: true, gap: 2 });
  escrever(`${meta.titulo || "PETICAO"} - VIA LACRADA (ARQUIVO INTERNO)`, {
    size: 13, bold: true, gap: 8,
  });
  escrever(
    `Requerente: ${meta.requerente}${meta.cpf ? ` - CPF ${meta.cpf}` : ""}` +
      (meta.servico ? `\nAssunto: ${meta.servico}` : ""),
    { size: 10, gap: 14 },
  );
  escrever("TEXTO APROVADO PELO REQUERENTE", { size: 11.5, bold: true, gap: 4 });
  escrever(texto, { size: 11, gap: 16 });

  // A página de registro começa limpa: misturar o lacre com o fim do texto
  // deixa dúvida sobre onde termina a petição e onde começa o nosso carimbo.
  page = doc.addPage([W, H]);
  y = H - M;

  escrever("REGISTRO DE ACEITE ELETRONICO - MP 2.200-2/2001", {
    size: 12, bold: true, gap: 10,
  });
  escrever(carimbo.declaracao, { size: 10.5, gap: 14 });
  escrever(
    `Aprovado em: ${carimbo.aprovadaEm} (BRT)\n` +
      `Endereco IP: ${carimbo.ip ?? "-"}\n` +
      `Navegador: ${carimbo.userAgent ?? "-"}\n` +
      `Idioma: ${carimbo.idioma ?? "-"}\n` +
      `Texto: ${carimbo.editada
        ? "editado pelo proprio requerente antes de aprovar"
        : "aprovado sem alteracoes"}\n` +
      `Impressao digital SHA-256 do texto aprovado:\n${carimbo.hash}`,
    { size: 10, gap: 14 },
  );
  escrever(
    "Este arquivo e a via de arquivo da Quero Armas. A via entregue ao orgao " +
      "publico contem apenas o texto da peticao, sem esta pagina de registro.",
    { size: 9, gap: 0 },
  );

  return await doc.save();
}
