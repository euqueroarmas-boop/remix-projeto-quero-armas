/* =============================================================================
 * Extração local de PDF — parse-first, IA só como último recurso
 *
 * Por que existe:
 *
 *   Certidões de órgão público (STM, TSE, TJ, TRF, Receita) são PDFs GERADOS,
 *   não digitalizados. Elas carregam uma camada de texto real, que o pdf.js —
 *   já presente no projeto para o preview — lê byte a byte. Mandar esse PDF
 *   para a IA é pagar um modelo probabilístico para transcrever um texto que
 *   já está lá, exato.
 *
 *   Para a Polícia Federal isso não é detalhe: ela indefere por divergência de
 *   uma letra. Um modelo que acerta 99% dos nomes erra 1 a cada 100 processos.
 *   O texto lido do PDF acerta 100% — ou não devolve nada, o que é um estado
 *   honesto e detectável.
 *
 * Divisão de responsabilidade:
 *
 *   1. LEITURA   → local (este arquivo), quando o PDF tem camada de texto.
 *                  IA só entra em imagem, foto e PDF digitalizado, onde não
 *                  existe texto para ler.
 *   2. COMPARAÇÃO → SEMPRE determinística (`calcularConformidade`). Nunca a IA
 *                  decide se dois nomes são "parecidos o bastante".
 *
 * Regra inegociável deste módulo: NADA é inferido. Um campo só é devolvido
 * quando aparece rotulado no documento ("Nome:", "CPF:"). Sem rótulo, o campo
 * volta vazio e o chamador decide se recorre à IA. Preencher no chute é o que
 * gera indeferimento.
 * ============================================================================= */

export interface CamposCertidaoLocal {
  nome_titular?: string;
  cpf?: string;
  data_nascimento?: string; // YYYY-MM-DD
  nome_mae?: string;
  numero_documento?: string;
  data_emissao?: string; // YYYY-MM-DD
  validade_dias?: number;
  resultado?: "NADA_CONSTA" | "CONSTA";
}

export interface ResultadoExtracaoLocal {
  /** Texto bruto da camada do PDF. Vazio quando o arquivo é digitalizado. */
  texto: string;
  /** Só campos encontrados com rótulo explícito. */
  campos: CamposCertidaoLocal;
  /** Órgão identificado pelo cabeçalho, quando reconhecível. */
  orgao: string | null;
  /**
   * `true` quando o PDF não tem camada de texto útil — é imagem. Aí sim a IA
   * é necessária, e o chamador deve chamá-la.
   */
  precisaIA: boolean;
}

/** Remove acentos e uniformiza espaços, preservando as letras. */
function normalizarTexto(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function dataIso(br: string): string | undefined {
  const m = br.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return undefined;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return Number.isNaN(new Date(`${iso}T00:00:00Z`).getTime()) ? undefined : iso;
}

/**
 * Captura o valor de um campo rotulado.
 *
 * Aceita "Nome: FULANO" e "Nome\nFULANO", que é como o pdf.js às vezes quebra
 * a linha. Para no primeiro rótulo seguinte para não engolir o campo de baixo.
 */
function campoRotulado(texto: string, rotulos: string[]): string | undefined {
  for (const r of rotulos) {
    const re = new RegExp(
      `${r}\\s*:?\\s*([^\\n]{2,120}?)(?=\\s{2,}|\\n|$|\\s(?:Nome|CPF|Data|Filia|Naturalidade|RG|Certid|NADA|CONSTA|Certific|Emitid|Os dados|A autentic))`,
      "i",
    );
    const m = texto.match(re);
    const valor = m?.[1]?.trim();
    if (valor) return valor.replace(/[.;,]+$/, "").trim();
  }
  return undefined;
}

const ORGAOS: Array<{ re: RegExp; nome: string }> = [
  { re: /JUSTICA MILITAR DA UNIAO|SUPERIOR TRIBUNAL MILITAR/i, nome: "Superior Tribunal Militar (STM)" },
  { re: /TRIBUNAL SUPERIOR ELEITORAL/i, nome: "Tribunal Superior Eleitoral (TSE)" },
  { re: /TRIBUNAL REGIONAL FEDERAL/i, nome: "Tribunal Regional Federal" },
  { re: /TRIBUNAL DE JUSTICA MILITAR/i, nome: "Tribunal de Justiça Militar estadual" },
  { re: /TRIBUNAL DE JUSTICA/i, nome: "Tribunal de Justiça" },
  { re: /RECEITA FEDERAL/i, nome: "Receita Federal" },
];

/**
 * Carrega o pdf.js apontando o worker para o bundle LOCAL do projeto.
 * O CDN era ponto único de falha: quando ele não carregava, PDFs oficiais
 * (CNH digital, CIN) eram recusados como "sem texto".
 */
export async function carregarPdfjs() {
  const mod = await import("pdfjs-dist");
  const { GlobalWorkerOptions, version } = mod;
  garantirAsyncIteratorEmStreams();
  if (!GlobalWorkerOptions.workerSrc) {
    try {
      const workerUrl = (
        await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ).default as string;
      GlobalWorkerOptions.workerSrc = workerUrl;
    } catch {
      GlobalWorkerOptions.workerSrc =
        `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
    }
  }
  return mod;
}

/**
 * Safari não implementa `Symbol.asyncIterator` em `ReadableStream`, e o pdf.js
 * faz `for await (const value of readableStream)` dentro de `getTextContent()`.
 * Sem esse polyfill a leitura local falha em todo iPhone/Mac Safari, o arquivo
 * cai no caminho lento (visão por IA no servidor) e o usuário espera ~40s.
 */
function garantirAsyncIteratorEmStreams() {
  const proto = (globalThis as { ReadableStream?: { prototype: Record<symbol, unknown> } }).ReadableStream?.prototype;
  if (!proto || proto[Symbol.asyncIterator]) return;
  proto[Symbol.asyncIterator] = function (this: ReadableStream) {
    const reader = this.getReader();
    return {
      async next() {
        const { done, value } = await reader.read();
        if (done) {
          reader.releaseLock();
          return { done: true as const, value: undefined };
        }
        return { done: false as const, value };
      },
      async return(v: unknown) {
        await reader.cancel();
        reader.releaseLock();
        return { done: true as const, value: v };
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  };
}

/**
 * Lê a camada de texto do PDF com o pdf.js que já roda no preview.
 *
 * Usa `streamTextContent` com reader manual (sem `for await`), o caminho que
 * funciona em qualquer navegador, e faz o parse das páginas em paralelo.
 */
export async function extrairTextoPdf(file: File): Promise<string> {
  const { getDocument } = await carregarPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await getDocument({ data: buf }).promise;

  const lerPagina = async (n: number): Promise<string> => {
    const page = await pdf.getPage(n);
    const stream = (page as unknown as {
      streamTextContent?: (p?: unknown) => ReadableStream<{ items?: Array<{ str?: string }> }>;
    }).streamTextContent?.();

    if (stream) {
      const reader = stream.getReader();
      const partes: string[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const it of value?.items ?? []) partes.push(it.str ?? "");
      }
      return partes.join(" ");
    }

    const content = await page.getTextContent();
    return content.items.map((it: unknown) => (it as { str?: string }).str ?? "").join(" ");
  };

  const paginas = await Promise.all(
    Array.from({ length: pdf.numPages }, (_, i) => lerPagina(i + 1)),
  );
  return paginas.join("\n");
}

/**
 * Lê os campos da certidão direto do texto do PDF.
 *
 * Devolve `precisaIA: true` quando não há camada de texto (PDF digitalizado)
 * — único caso em que a IA é realmente necessária.
 */
export async function extrairCertidaoLocal(file: File): Promise<ResultadoExtracaoLocal> {
  let texto = "";
  try {
    texto = await extrairTextoPdf(file);
  } catch (e) {
    console.warn("[extracaoLocal] pdf.js falhou:", e);
    return { texto: "", campos: {}, orgao: null, precisaIA: true };
  }

  const limpo = normalizarTexto(texto);
  // Menos de 80 caracteres = PDF de imagem. Não há o que analisar.
  if (limpo.length < 80) {
    return { texto, campos: {}, orgao: null, precisaIA: true };
  }

  const campos: CamposCertidaoLocal = {};

  const nome = campoRotulado(limpo, ["Nome do requerente", "Nome"]);
  if (nome && !/^da mae/i.test(nome)) campos.nome_titular = nome.toUpperCase();

  const cpfBruto = campoRotulado(limpo, ["CPF"]);
  const cpfDigitos = (cpfBruto ?? "").replace(/\D/g, "");
  if (cpfDigitos.length === 11) campos.cpf = cpfDigitos;

  const nasc = campoRotulado(limpo, ["Data de Nascimento", "Nascimento"]);
  if (nasc) campos.data_nascimento = dataIso(nasc);

  const mae = campoRotulado(limpo, ["Nome da mae", "Nome da Mae", "Filiacao"]);
  if (mae) campos.nome_mae = mae.toUpperCase();

  // Emissão: "Certidão emitida em 23/07/2026 às 18:03:19"
  const emissao = limpo.match(/emitid[ao]\s+em\s+(\d{2}\/\d{2}\/\d{4})/i);
  if (emissao) campos.data_emissao = dataIso(emissao[1]);

  // Validade declarada pelo próprio documento: "válida por 90 dias"
  const validade = limpo.match(/valid[ao]\s+por\s+(\d{1,3})\s+dias/i);
  if (validade) campos.validade_dias = Number(validade[1]);

  if (/NADA CONSTA/i.test(limpo)) campos.resultado = "NADA_CONSTA";
  else if (/\bCONSTA\b/i.test(limpo)) campos.resultado = "CONSTA";

  // Número de controle: a linha solta de dígitos logo abaixo do título.
  const controle = limpo.match(/CERTIDAO DE ACOES CRIMINAIS\s+(\d{6,20})/i)
    ?? limpo.match(/N[uú]mero de Controle\s*:?\s*([\d.\-]{6,25})/i);
  if (controle) campos.numero_documento = controle[1].replace(/\D/g, "");

  const orgao = ORGAOS.find((o) => o.re.test(limpo))?.nome ?? null;

  // Se nem nome nem CPF apareceram rotulados, o layout não é conhecido —
  // devolve o texto e deixa a IA tentar, em vez de entregar meio campo.
  const precisaIA = !campos.nome_titular && !campos.cpf;

  return { texto, campos, orgao, precisaIA };
}

/* ── Comparação determinística (golden record) ─────────────────────────── */

/** Normaliza nome para comparação: sem acento, sem pontuação, caixa alta. */
export function normalizarNome(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function soDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

export type VeredictoCampo = "confere" | "diverge" | "ausente";

export interface ComparacaoCampo {
  campo: string;
  label: string;
  valorDocumento: string;
  valorCadastro: string;
  veredicto: VeredictoCampo;
}

/**
 * Confronta o que o documento diz com o cadastro (golden record).
 *
 * Sem tolerância, sem "parecido o bastante", sem similaridade: a PF compara
 * caractere a caractere e indefere na menor diferença. A única normalização
 * aplicada é a que o próprio órgão ignora — acento, pontuação e caixa.
 *
 * Campo ausente NÃO é divergência: é ausência, e o tratamento é outro (pedir
 * o dado, não rejeitar o documento).
 */
export function compararComCadastro(
  doc: CamposCertidaoLocal,
  cadastro: { nome_completo?: unknown; cpf?: unknown; data_nascimento?: unknown; nome_mae?: unknown },
): ComparacaoCampo[] {
  const itens: ComparacaoCampo[] = [];

  const push = (
    campo: string,
    label: string,
    doDoc: string,
    doCadastro: string,
  ) => {
    if (!doDoc || !doCadastro) {
      itens.push({ campo, label, valorDocumento: doDoc, valorCadastro: doCadastro, veredicto: "ausente" });
      return;
    }
    itens.push({
      campo,
      label,
      valorDocumento: doDoc,
      valorCadastro: doCadastro,
      veredicto: doDoc === doCadastro ? "confere" : "diverge",
    });
  };

  push("nome_titular", "Nome", normalizarNome(doc.nome_titular), normalizarNome(cadastro.nome_completo));
  push("cpf", "CPF", soDigitos(doc.cpf), soDigitos(cadastro.cpf));
  push(
    "data_nascimento",
    "Data de nascimento",
    String(doc.data_nascimento ?? "").slice(0, 10),
    String(cadastro.data_nascimento ?? "").slice(0, 10),
  );
  push("nome_mae", "Nome da mãe", normalizarNome(doc.nome_mae), normalizarNome(cadastro.nome_mae));

  return itens;
}

/** Há divergência real (não apenas campo ausente)? */
export function temDivergencia(itens: ComparacaoCampo[]): boolean {
  return itens.some((i) => i.veredicto === "diverge");
}
