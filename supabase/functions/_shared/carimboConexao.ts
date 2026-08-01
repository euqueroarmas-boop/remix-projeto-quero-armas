/**
 * Carimbo de conexão — código ÚNICO, usado pelo contrato e pela procuração.
 *
 * Existe porque os dois carimbos nasceram separados e divergiram: o da
 * procuração tinha idioma, referência e user-agent completo; o do contrato
 * tinha IP, sistema, navegador e hash. Cada correção num deles deixava o
 * outro para trás, e o usuário via dois documentos da mesma empresa com
 * rodapés diferentes.
 *
 * Agora o desenho mora aqui. Quem chama só entrega os CAMPOS; o layout,
 * a quebra e a régua são iguais para todo documento gerado pela Quero Armas.
 *
 * Base legal citada no título: MP 2.200-2/2001, que institui a ICP-Brasil e
 * dá validade jurídica ao documento eletrônico.
 */

export const CARIMBO_TITULO =
  "REGISTRO DE SESSÃO — EMISSÃO DO INSTRUMENTO · MP 2.200-2/2001";

export interface SessaoCarimbo {
  /** Identificador do documento: número do contrato ou da procuração. */
  numero?: string | null;
  /** Data/hora do ato que o carimbo registra, já em ISO. */
  registrado_em?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  accept_language?: string | null;
  referer?: string | null;
  /** Descrição do ato: "aceite eletrônico", "emissão do instrumento". */
  acao?: string | null;
  /** Hash probatório, quando houver. */
  hash?: string | null;
  /** Rótulo do identificador: "CONTRATO" ou "PROCURAÇÃO". */
  rotuloNumero?: string;
}

export function detectarSO(ua: string | null | undefined): string {
  const s = String(ua || "");
  if (/iPhone|iPad|iPod/i.test(s)) return "iOS";
  if (/Android/i.test(s)) return "Android";
  if (/Mac OS X|Macintosh/i.test(s)) return "macOS";
  if (/Windows/i.test(s)) return "Windows";
  if (/Linux/i.test(s)) return "Linux";
  return "Não identificado";
}

export function detectarNavegador(ua: string | null | undefined): string {
  const s = String(ua || "");
  // Ordem importa: Edge e Opera também dizem "Chrome" no user-agent.
  if (/Edg\//i.test(s)) return "Edge";
  if (/OPR\//i.test(s)) return "Opera";
  if (/CriOS|Chrome\//i.test(s)) return "Chrome";
  if (/FxiOS|Firefox\//i.test(s)) return "Firefox";
  if (/Safari\//i.test(s)) return "Safari";
  return "Não identificado";
}

export function formatarBrt(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Campos do carimbo, na ordem em que aparecem.
 *
 * Campo sem valor NÃO entra: "IDIOMA: —" num documento probatório parece
 * descuido, e o espaço é escasso.
 */
export function camposCarimbo(s: SessaoCarimbo): string[] {
  const ua = String(s.user_agent || "").trim();
  const linhas: Array<[string, string | null | undefined]> = [
    [s.rotuloNumero || "DOCUMENTO", s.numero],
    ["DATA/HORA (BRT)", s.registrado_em ? formatarBrt(s.registrado_em) : null],
    ["IP", s.ip],
    ["SISTEMA", ua ? detectarSO(ua) : null],
    ["NAVEGADOR", ua ? detectarNavegador(ua) : null],
    ["IDIOMA", s.accept_language],
    ["REFERÊNCIA", s.referer],
    ["USER-AGENT", ua || null],
    ["AÇÃO", s.acao],
    ["HASH", s.hash],
  ];
  return linhas
    .filter(([, v]) => !!String(v ?? "").trim())
    .map(([r, v]) => `${r}: ${String(v).trim()}`);
}

/**
 * Distribui os campos em colunas verticais.
 *
 * Quebra SOMENTE entre campos, na vírgula — nunca no meio de um valor
 * (regra do usuário, 31/07/2026). Campo maior que a coluna inteira é a única
 * exceção: aí parte-se, porque omitir seria pior.
 */
export function montarColunas(
  campos: string[],
  opts: { maxCharsPorColuna: number; maxColunas: number },
): string[] {
  const { maxCharsPorColuna, maxColunas } = opts;
  const colunas: string[] = [];
  let atual = "";

  for (const campo of campos) {
    if (colunas.length >= maxColunas) break;

    const candidato = atual ? `${atual}, ${campo}` : campo;
    if (candidato.length <= maxCharsPorColuna) {
      atual = candidato;
      continue;
    }

    if (atual) {
      colunas.push(atual);
      atual = "";
      if (colunas.length >= maxColunas) break;
    }

    if (campo.length > maxCharsPorColuna) {
      for (let i = 0; i < campo.length; i += maxCharsPorColuna) {
        if (colunas.length >= maxColunas) break;
        colunas.push(campo.slice(i, i + maxCharsPorColuna));
      }
    } else {
      atual = campo;
    }
  }
  if (atual && colunas.length < maxColunas) colunas.push(atual);

  // Ficou campo de fora: o documento avisa, em vez de parecer completo.
  const impresso = colunas.join(", ");
  const faltou = campos.some((c) => !impresso.includes(c.slice(0, 12)));
  if (faltou && colunas.length > 0) {
    const ult = colunas.length - 1;
    colunas[ult] = colunas[ult].slice(0, Math.max(0, maxCharsPorColuna - 1)) + "…";
  }
  return colunas;
}

/**
 * Desenha o carimbo em TODAS as páginas do documento.
 *
 * `doc` é um jsPDF. Tipado como `any` de propósito: as duas edge functions
 * importam o jsPDF por caminhos diferentes (npm: e esm.sh), e prender o tipo
 * aqui obrigaria as duas a compartilharem a mesma importação.
 */
export function desenharCarimbo(
  doc: any,
  opts: {
    sessao: SessaoCarimbo;
    /** Margem esquerda do texto do documento. A faixa vive antes dela. */
    margemEsquerda: number;
    maxColunas?: number;
  },
): void {
  const pageH = doc.internal.pageSize.getHeight();
  const TOPO = 42;
  const BASE = pageH - 42;
  const REGUA_X = 24;
  const TITULO_X = 32;
  const CAMPOS_X = 44;
  const PASSO = 9;
  const GUTTER = 16;
  const FONTE = 6.8;
  // Avanço médio por caractere nesta fonte — só para quebrar em colunas.
  const AVANCO = 3.1;

  const maxColunas = Math.max(
    1,
    Math.min(
      opts.maxColunas ?? 4,
      Math.floor((opts.margemEsquerda - CAMPOS_X - GUTTER) / PASSO),
    ),
  );
  const maxCharsPorColuna = Math.max(20, Math.floor((BASE - TOPO) / AVANCO));
  const colunas = montarColunas(camposCarimbo(opts.sessao), {
    maxCharsPorColuna,
    maxColunas,
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);

    doc.setDrawColor(190);
    doc.setLineWidth(0.4);
    doc.line(REGUA_X, TOPO, REGUA_X, BASE);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(90);
    doc.text(CARIMBO_TITULO, TITULO_X, BASE, { angle: 90, baseline: "alphabetic" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONTE);
    doc.setTextColor(70);
    for (let c = 0; c < colunas.length; c++) {
      doc.text(colunas[c], CAMPOS_X + c * PASSO, BASE, {
        angle: 90,
        baseline: "alphabetic",
      });
    }

    doc.setFontSize(6.5);
    doc.setTextColor(140);
    doc.text(`PÁG. ${page}/${totalPages}`, TITULO_X, TOPO + 26, {
      angle: 90,
      baseline: "alphabetic",
    });

    doc.setTextColor(0);
  }
}
