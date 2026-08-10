/* =============================================================================
 * Leitura canônica de campos rotulados em documentos oficiais
 *
 * Por que existe
 * --------------
 * O texto de um PDF não chega pronto: o pdf.js devolve FRAGMENTOS soltos, cada
 * um com sua posição na página. Juntar todos com um espaço — como se fazia —
 * destrói a única estrutura confiável do documento: a linha e a coluna.
 *
 * Sem linha, "Nome: FULANO" e o campo de cima e o de baixo viram uma frase só.
 * Foi exatamente essa perda que produziu os dois defeitos reais observados na
 * certidão do TSE do mesmo cliente, no mesmo dia:
 *
 *   1) o nome saiu colado com o campo seguinte
 *      ("PEDRO ... OCUPACAO DECLARADA PELO(A) ELEITOR(A): ..."), e a
 *      conferência acusou divergência de nome;
 *   2) na tentativa seguinte, o nome saiu VAZIO, e a conferência acusou
 *      "a certidão não traz Nome" — sobre uma certidão que traz o nome.
 *
 * Os dois são o mesmo defeito de leitura, e nenhum deles é do documento.
 *
 * O que este módulo faz
 * ---------------------
 *   - reconstrói LINHAS a partir dos fragmentos, usando `hasEOL` e a
 *     coordenada vertical, e marca salto de COLUNA com espaço duplo;
 *   - lê campo rotulado em três layouts reais: valor na mesma linha, valor na
 *     linha seguinte e valor em coluna ao lado;
 *   - encerra o valor no primeiro rótulo vizinho, e não no fim do documento;
 *   - valida o que devolve: nome tem cara de nome, CPF tem 11 dígitos, data é
 *     data. Campo que não passa volta `undefined`.
 *
 * O que este módulo NÃO faz
 * -------------------------
 * Não infere, não completa, não "aproxima". A regra do projeto continua de pé:
 * a PF indefere por uma letra, então é melhor devolver vazio (estado honesto e
 * detectável) do que devolver um palpite.
 * ============================================================================= */

export type FonteCampo =
  | "rotulo_mesma_linha"
  | "rotulo_linha_seguinte"
  | "rotulo_coluna"
  | "literal_cadastro_no_pdf";

export interface CampoLido {
  valor?: string;
  fonte?: FonteCampo;
}

/** Item de texto como o pdf.js entrega. */
export interface ItemTextoPdf {
  str?: string;
  hasEOL?: boolean;
  width?: number;
  transform?: number[];
}

/** Diferença vertical, em pontos, a partir da qual já é outra linha. */
const TOLERANCIA_LINHA = 2.5;
/** Vão horizontal, em pontos, que caracteriza salto de coluna. */
const VAO_COLUNA = 8;

/**
 * Reconstrói as linhas da página a partir dos fragmentos do pdf.js.
 *
 * Preserva duas informações que o `join(" ")` antigo jogava fora:
 *   - quebra de linha real (`\n`), que os parsers usam com `^` e `$`;
 *   - salto de coluna (dois espaços), que separa "MAE: X" de "PAI: Y" quando
 *     os dois estão impressos lado a lado na mesma linha.
 */
export function reconstruirLinhasPdf(items: ItemTextoPdf[]): string {
  type Frag = { x: number; fim: number; texto: string };
  const linhas: Frag[][] = [];
  let atual: Frag[] = [];
  let yAtual: number | null = null;

  const fechar = () => {
    if (atual.length) linhas.push(atual);
    atual = [];
  };

  for (const it of items) {
    const texto = String(it?.str ?? "");
    const t = it?.transform;
    const x = Array.isArray(t) && typeof t[4] === "number" ? t[4] : 0;
    const y = Array.isArray(t) && typeof t[5] === "number" ? t[5] : 0;
    const largura = typeof it?.width === "number" ? it.width : texto.length * 4;

    if (yAtual !== null && Math.abs(y - yAtual) > TOLERANCIA_LINHA) fechar();
    yAtual = y;

    if (texto.trim()) atual.push({ x, fim: x + largura, texto });

    if (it?.hasEOL) {
      fechar();
      yAtual = null;
    }
  }
  fechar();

  return linhas
    .map((frags) => {
      const ordenados = [...frags].sort((a, b) => a.x - b.x);
      let linha = "";
      let fimAnterior: number | null = null;
      for (const f of ordenados) {
        if (fimAnterior === null) {
          linha = f.texto;
        } else {
          const vao = f.x - fimAnterior;
          // Espaço duplo = coluna nova. É o sinal que impede o valor de um
          // campo engolir o campo impresso ao lado dele.
          linha += vao >= VAO_COLUNA ? `  ${f.texto}` : vao > 0.8 ? ` ${f.texto}` : f.texto;
        }
        fimAnterior = f.fim;
      }
      return linha.replace(/[ \t]+$/g, "");
    })
    .filter((l) => l.trim().length > 0)
    .join("\n");
}

/** Tira acentos, mantendo letras, dígitos e a estrutura de linhas. */
export function semAcentos(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Rótulos que encerram o valor de um campo.
 *
 * A lista inclui os campos que aparecem GRUDADOS no valor em documentos reais:
 * "OCUPACAO DECLARADA" no TSE, "MAE:"/"PAI:" no TJM, "RG"/"CPF" no e-SAJ.
 */
const PARADAS = new RegExp(
  "\\s(?:" +
    [
      "Nome(?: Civil| Social| do| da)?",
      "Ocupa(?:c|ç)(?:a|ã)o",
      "Inscri(?:c|ç)(?:a|ã)o",
      "Zona",
      "Se(?:c|ç)(?:a|ã)o",
      "Munic(?:i|í)pio",
      "Domic(?:i|í)lio",
      "Filia(?:c|ç)(?:a|ã)o",
      "M(?:a|ã)e",
      "Pai",
      "CPF",
      "RG",
      "Identidade",
      "Naturalidade",
      "Nacionalidade",
      "Sexo",
      "G(?:e|ê)nero",
      "Estado civil",
      "Data",
      "Nascimento",
      "Validade",
      "Finalidade",
      "Endere(?:c|ç)o",
      "Documento",
      "Certid(?:a|ã)o",
      "Certifica",
      "Emitid[ao]",
      "Observa",
      "Registro",
      "Protocolo",
      "(?:O|Ó)rg(?:a|ã)o",
      "NADA CONSTA",
      "Os dados",
      "A autentic",
    ].join("|") +
    ")\\b",
  "i",
);

/**
 * Encerra o valor de um campo: primeira quebra, primeiro salto de coluna,
 * primeiro rótulo vizinho. Nessa ordem.
 */
export function cortarValorCampo(bruto: string | undefined): string | undefined {
  if (!bruto) return undefined;
  let s = semAcentos(bruto).split("\n")[0];
  s = s.split(/\s{2,}/)[0];
  const p = s.search(PARADAS);
  if (p > 0) s = s.slice(0, p);
  s = s.replace(/^[\s:–—-]+/, "").replace(/[.;,:]+$/, "").trim();
  return s.length > 1 ? s.replace(/\s+/g, " ") : undefined;
}

/* ── Validadores semânticos ─────────────────────────────────────────────── */

/**
 * Palavras que denunciam texto institucional lido como se fosse nome de
 * pessoa. É o filtro que impede "TRIBUNAL SUPERIOR ELEITORAL" e
 * "OCUPACAO DECLARADA PELO ELEITOR" de virarem titular da certidão.
 */
const NAO_E_NOME =
  /\b(CERTID|TRIBUNAL|JUSTICA|JUIZ|CARTORIO|SECRETARIA|MINISTERIO|REPUBLICA|PODER|ESTADO DE|UNIAO|SUPERIOR|REGIONAL|FEDERAL|MILITAR|ELEITORAL|NADA|CONSTA|OCUPACAO|DECLARADA|ELEITOR|INSCRICAO|DOMICILIO|MUNICIPIO|ZONA|SECAO|VALIDADE|EMITID|DOCUMENTO|PROCESSO|CODIGO|AUTENTIC|SITIO|HTTPS?|WWW|PAGINA|FOLHA|PESQUISA|REGISTRO|DISTRIBUI|EXECUCAO|CRIMINAL|CRIMINAIS|FINALIDADE|OBSERVA|PRAZO|DIAS)\b/;

/** O valor tem cara de nome de pessoa? Sem isso, campo vizinho vira titular. */
export function pareceNomePessoa(v: string | undefined): boolean {
  if (!v) return false;
  const s = semAcentos(v).toUpperCase().replace(/\s+/g, " ").trim();
  if (s.length < 5 || s.length > 90) return false;
  if (/\d/.test(s)) return false;
  if (!/^[A-Z][A-Z '´`^~.-]*$/.test(s)) return false;
  if (s.split(" ").filter(Boolean).length < 2) return false;
  if (NAO_E_NOME.test(s)) return false;
  return true;
}

export function pareceCpf(v: string | undefined): boolean {
  return String(v ?? "").replace(/\D/g, "").length === 11;
}

export function pareceData(v: string | undefined): boolean {
  return /\b\d{2}\/\d{2}\/\d{4}\b/.test(String(v ?? ""));
}

/* ── Leitor canônico ────────────────────────────────────────────────────── */

export interface OpcoesLeitura {
  /** Aceita o valor lido? Recusado, o leitor continua procurando. */
  validar?: (v: string) => boolean;
  /** Quantas linhas abaixo do rótulo procurar o valor. */
  linhasAbaixo?: number;
}

function regexRotulo(rotulo: string): RegExp {
  // O rótulo pode vir com dois-pontos, com hífen ou sem nada depois.
  return new RegExp(`(?:^|\\s)${rotulo}\\s*[:\\-–—]?\\s*(.*)$`, "i");
}

/**
 * Lê um campo rotulado do texto ESTRUTURADO (com quebras de linha).
 *
 * Ordem de tentativa, que é a ordem em que os documentos reais imprimem:
 *   1. valor na mesma linha do rótulo;
 *   2. valor na coluna seguinte da mesma linha (separado por espaço duplo);
 *   3. valor na linha de baixo (layout de formulário).
 */
export function lerCampoRotulado(
  texto: string,
  rotulos: string[],
  opcoes: OpcoesLeitura = {},
): CampoLido {
  const { validar, linhasAbaixo = 2 } = opcoes;
  const aceita = (v: string | undefined): v is string => !!v && (!validar || validar(v));
  const linhas = semAcentos(texto).split(/\r?\n/);

  for (const rotulo of rotulos) {
    const re = regexRotulo(rotulo);
    for (let i = 0; i < linhas.length; i++) {
      const m = linhas[i].match(re);
      if (!m) continue;
      const resto = (m[1] ?? "").trim();

      // 1) mesma linha
      const mesma = cortarValorCampo(resto);
      if (aceita(mesma)) return { valor: mesma, fonte: "rotulo_mesma_linha" };

      // 2) coluna ao lado — o corte acima ficou no primeiro pedaço; se ele não
      //    serviu, o valor pode estar depois do salto de coluna.
      for (const pedaco of resto.split(/\s{2,}/).slice(1)) {
        const col = cortarValorCampo(pedaco);
        if (aceita(col)) return { valor: col, fonte: "rotulo_coluna" };
      }

      // 3) linha(s) de baixo
      for (let j = i + 1; j <= i + linhasAbaixo && j < linhas.length; j++) {
        const abaixo = linhas[j].trim();
        if (!abaixo) continue;
        for (const pedaco of abaixo.split(/\s{2,}/)) {
          const val = cortarValorCampo(pedaco);
          if (aceita(val)) return { valor: val, fonte: "rotulo_linha_seguinte" };
        }
        break; // só a primeira linha útil abaixo do rótulo
      }
    }
  }
  return {};
}

/** Açúcar: devolve só o valor, em caixa alta, ou `undefined`. */
export function lerNomeRotulado(texto: string, rotulos: string[]): CampoLido {
  const lido = lerCampoRotulado(texto, rotulos, { validar: pareceNomePessoa });
  return lido.valor
    ? { valor: lido.valor.toUpperCase().replace(/\s+/g, " ").trim(), fonte: lido.fonte }
    : {};
}

/* ── Recuperação determinística pelo cadastro ───────────────────────────── */

const chaveComparacao = (v: unknown) =>
  semAcentos(String(v ?? ""))
    .replace(/[^A-Za-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

/**
 * O valor do cadastro está IMPRESSO no documento, ainda que o parser não tenha
 * conseguido localizá-lo por rótulo?
 *
 * Isto não é tolerância nem semelhança: exige o valor do cadastro presente,
 * inteiro e literal, no texto do próprio PDF. Serve para não acusar "a certidão
 * não traz o nome" quando o nome está lá, num layout que ainda não mapeamos.
 */
export function valorDoCadastroPresenteNoTexto(
  texto: string,
  valorCadastro: unknown,
): boolean {
  const alvo = chaveComparacao(valorCadastro);
  if (alvo.length < 5) return false;
  return chaveComparacao(texto).includes(alvo);
}

/** O CPF do cadastro aparece no documento, com ou sem máscara? */
export function cpfDoCadastroPresenteNoTexto(texto: string, cpfCadastro: unknown): boolean {
  const d = String(cpfCadastro ?? "").replace(/\D/g, "");
  if (d.length !== 11) return false;
  return String(texto ?? "").replace(/\D/g, "").includes(d);
}