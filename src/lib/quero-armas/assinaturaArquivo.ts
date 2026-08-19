// ============================================================================
// assinaturaArquivo.ts — o que o arquivo É, lido no conteúdo
// ----------------------------------------------------------------------------
// CASO REAL — Gilson, 20/08/2026, 00h00.
//
// Ele anexou o XML da nota. O Hub recusou com "este arquivo não é um PDF", e a
// linha de identificação que acabáramos de criar entregou o motivo de graça:
//
//     Arquivo enviado: Documento de gilson — formato desconhecido, 11 KB.
//
// 11 KB é o tamanho exato do XML dele. O arquivo estava certo; o que faltava
// era o NOME. O celular entregou "Documento de gilson", sem extensão, e sem
// tipo MIME — e a nossa identificação dependia de um ou de outro.
//
// Identificar documento pelo nome do arquivo é frágil por natureza: quem
// escolhe o nome é o aplicativo por onde o arquivo passou (WhatsApp, gerenciador
// de arquivos, download), não o emissor. Aqui a pergunta é outra: o que estão
// os PRIMEIROS BYTES dizendo? Isso o app do celular não tem como estragar.
//
// Sem afrouxar nada: um PDF continua sendo reconhecido só se começar com a
// assinatura de PDF, e um XML só se começar com XML. A regra do PDF ORIGINAL
// segue inteira — foto e print continuam sendo recusados, porque foto e print
// não têm essas assinaturas.
// ============================================================================

/** Quantos bytes bastam para decidir. A assinatura vive no comecinho. */
export const BYTES_DE_ASSINATURA = 1024;

export type AssinaturaArquivo = "pdf" | "xml" | "desconhecido";

/** Remove BOM e espaços do início — o que atrapalha a leitura da assinatura. */
function semRuidoInicial(inicio: string): string {
  // \uFEFF é o BOM. Escrito pelo código, e não colado como caractere, para não
  // virar um byte invisível que ninguém enxerga ao revisar.
  return String(inicio ?? "").replace(/^\uFEFF/, "").replace(/^\s+/, "");
}

/** O arquivo começa com a assinatura de PDF? */
export function conteudoParecePdf(inicio: string): boolean {
  // A norma admite lixo antes do "%PDF-", então a busca é na janela inicial —
  // mas continua exigindo a assinatura, não bastando "parecer texto".
  return semRuidoInicial(inicio).slice(0, 200).includes("%PDF-");
}

/**
 * O arquivo começa como XML?
 *
 * Aceita a declaração (`<?xml …`) e também o XML que já abre direto na raiz —
 * há emissor que entrega o arquivo sem declaração. Em ambos os casos exige
 * abertura de tag logo no começo: arquivo de texto solto não passa.
 */
export function conteudoPareceXml(inicio: string): boolean {
  const texto = semRuidoInicial(inicio);
  if (!texto.startsWith("<")) return false;
  if (/^<\?xml[\s?]/i.test(texto)) return true;
  // Raiz conhecida das notas, com ou sem prefixo de namespace.
  return /^<\s*(?:[A-Za-z0-9_.-]+:)?(nfeProc|NFe|nfseProc|NFSe|DPS|EnviNFe|CompNfse)\b/i.test(texto);
}

/** Decide o formato pelo trecho inicial do arquivo. */
export function assinaturaDoConteudo(inicio: string): AssinaturaArquivo {
  if (conteudoParecePdf(inicio)) return "pdf";
  if (conteudoPareceXml(inicio)) return "xml";
  return "desconhecido";
}

/**
 * Lê o começo do arquivo, sem carregar o arquivo inteiro na memória.
 *
 * `Blob.text()` não existe em todo navegador nem no ambiente de teste — daí o
 * `FileReader` como reserva. Falha de leitura devolve string vazia: o chamador
 * segue com o que já sabia pelo nome, nunca pior do que antes.
 */
export async function lerInicioDoArquivo(
  arquivo: Blob,
  bytes = BYTES_DE_ASSINATURA,
): Promise<string> {
  try {
    const pedaco = arquivo.slice(0, bytes);
    if (typeof (pedaco as Blob & { text?: () => Promise<string> }).text === "function") {
      return await pedaco.text();
    }
    return await new Promise<string>((resolve) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(String(leitor.result ?? ""));
      leitor.onerror = () => resolve("");
      leitor.readAsText(pedaco);
    });
  } catch {
    return "";
  }
}

/** O que este arquivo é, olhando o conteúdo. */
export async function assinaturaDoArquivo(arquivo: Blob): Promise<AssinaturaArquivo> {
  return assinaturaDoConteudo(await lerInicioDoArquivo(arquivo));
}

/**
 * Lê o arquivo INTEIRO como texto, com a mesma reserva.
 *
 * `Blob.text()` só existe a partir do Chrome 76 e do Safari 14 — celular
 * Android antigo, que é justamente o público que mais apanha aqui, pode não
 * ter. Sem a reserva, o XML falharia com "não conseguimos abrir o arquivo" num
 * aparelho em que o arquivo está perfeito.
 */
export async function lerTextoDoArquivo(arquivo: Blob): Promise<string> {
  if (typeof (arquivo as Blob & { text?: () => Promise<string> }).text === "function") {
    return await arquivo.text();
  }
  return await new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result ?? ""));
    leitor.onerror = () => reject(leitor.error ?? new Error("falha ao ler o arquivo"));
    leitor.readAsText(arquivo);
  });
}
