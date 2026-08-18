// ============================================================================
// TERCEIRA AUDITORIA — a petição aprovada precisa chegar na delegacia
// ----------------------------------------------------------------------------
// O furo era silencioso e caro: o cliente lia a petição, corrigia, aprovava — e
// o dossiê ia para a Polícia Federal sem ela. Ninguém via, porque a tela dizia
// "APROVADA PELO CLIENTE" e o botão de montar o dossiê funcionava normalmente.
//
// O que este arquivo trava:
//   1. aprovar gera as duas vias e registra a SIMPLES como documento;
//   2. a via LACRADA não vira documento (senão o carimbo com IP iria ao órgão);
//   3. o relato de efetiva necessidade fica FORA do dossiê;
//   4. a declaração de veracidade é obrigatória e igual dos dois lados.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DECLARACAO_VERACIDADE } from "../peticaoDeclaracao";
import { posicaoProtocolo } from "../ordemProtocolo";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

const EDGE = r("supabase/functions/qa-peca-aprovar-cliente/index.ts");
const JUNTADA = r("supabase/functions/qa-montar-juntada/index.ts");
const PDF = r("supabase/functions/_shared/peticaoPdf.ts");
const PAINEL = r("src/components/quero-armas/portal/PecaAprovacaoPanel.tsx");
const SQL = r("supabase/migrations/20260818170000_peticao_aprovada_vira_documento.sql");

/** Só o SQL/código executável: comentário citando um trecho não é o trecho. */
const semComentario = (fonte: string, marca: string) =>
  fonte.split("\n").filter((l) => !l.trim().startsWith(marca)).join("\n");

describe("aprovar transforma a petição em documento do processo", () => {
  it("gera as duas vias", () => {
    expect(EDGE).toMatch(/montarPeticaoSimplesPdf/);
    expect(EDGE).toMatch(/montarPeticaoLacradaPdf/);
  });

  it("registra a petição no checklist com o tipo que o dossiê numera", () => {
    expect(EDGE).toMatch(/const TIPO_PETICAO = "peticao_efetiva_necessidade"/);
    // Se o tipo não tiver posição no mapa de protocolo, a peça entra no dossiê
    // como "Outros" — no fim, longe das provas que ela amarra.
    const pos = posicaoProtocolo("peticao_efetiva_necessidade", null);
    expect(pos.grupo).toBe(1);
    expect(pos.numero).toBe("1.9");
  });

  it("grava a linha como APROVADA e com arquivo — é o que a juntada exige", () => {
    expect(EDGE).toMatch(/status: "aprovado"/);
    expect(EDGE).toMatch(/arquivo_storage_key: path/);
  });

  it("sobe no bucket dos documentos do processo, não noutro qualquer", () => {
    expect(EDGE).toMatch(/const BUCKET_PROCESSO = "qa-processo-docs"/);
    // A juntada só sabe abrir dois buckets; um terceiro sumiria em silêncio.
    expect(JUNTADA).toMatch(/BUCKET_PROCESSO = "qa-processo-docs"/);
  });

  it("reaprovar atualiza a linha em vez de criar uma segunda", () => {
    // Duas linhas do mesmo tipo colocariam a petição duas vezes no dossiê.
    expect(EDGE).toMatch(/\.eq\("tipo_documento", TIPO_PETICAO\)[\s\S]{0,120}maybeSingle\(\)/);
    expect(EDGE).toMatch(/if \(existente\) \{[\s\S]{0,200}\.update\(campos\)/);
  });

  it("não marca a petição como obrigatória do checklist", () => {
    // Quem produz esta peça é a equipe. Obrigatória, ela faria o contador de
    // conclusão do processo esperar por um documento nunca cobrado do cliente.
    expect(EDGE).toMatch(/obrigatorio: false/);
  });
});

describe("a via lacrada é nossa — não vai ao órgão", () => {
  it("o lacre não é registrado como documento do processo", () => {
    // `arquivo_storage_key` recebe `path` (a simples). Se algum dia receber
    // `lacrePath`, o IP e o hash do cliente iriam para a delegacia.
    expect(EDGE).not.toMatch(/arquivo_storage_key: lacrePath/);
  });

  it("só a via lacrada carrega o carimbo", () => {
    const simples = PDF.slice(
      PDF.indexOf("export async function montarPeticaoSimplesPdf"),
      PDF.indexOf("export async function montarPeticaoLacradaPdf"),
    );
    expect(simples.length).toBeGreaterThan(200);
    for (const proibido of ["carimbo", "SHA-256", "Endereco IP"]) {
      expect(simples, `a via simples não pode citar ${proibido}`).not.toContain(proibido);
    }
    const lacrada = PDF.slice(PDF.indexOf("export async function montarPeticaoLacradaPdf"));
    expect(lacrada).toContain("Endereco IP");
    expect(lacrada).toContain("SHA-256");
  });

  it("o texto do PDF é traduzido para o alfabeto da fonte", () => {
    // Uma aspa curva vinda da IA derrubava o arquivo inteiro no pdf-lib.
    expect(PDF).toMatch(/export function paraWinAnsi/);
    expect(PDF).toMatch(/paraWinAnsi\(t\)/);
  });
});

describe("o relato de efetiva necessidade não vai à delegacia", () => {
  it("a juntada exclui o dossiê do relato", () => {
    expect(JUNTADA).toMatch(/from\("qa_efetiva_necessidade"\)[\s\S]{0,120}dossie_storage_path/);
    expect(JUNTADA).toMatch(/if \(excluidos\.has\(caminho\)\)/);
  });

  it("o corte é por caminho, nunca por tipo", () => {
    // `comprovante_efetiva_necessidade` também é uma PROVA legítima do porte.
    // Cortar por tipo levaria a prova junto com a narrativa.
    const executavel = semComentario(JUNTADA, "//");
    expect(executavel).not.toMatch(/excluidos\.add\(\s*["']comprovante_efetiva_necessidade/);
    expect(executavel).toMatch(/excluidos\.add\(p\)/);
  });

  it("o que ficou de fora aparece com motivo, não some calado", () => {
    expect(JUNTADA).toMatch(/motivo: "relato de efetiva necessidade/);
  });
});

describe("a declaração de veracidade", () => {
  it("é obrigatória para aprovar", () => {
    expect(EDGE).toMatch(/declaracao_veracidade_obrigatoria/);
    expect(PAINEL).toMatch(/if \(acao === "aprovar" && !declarou\)/);
    expect(PAINEL).toMatch(/declaracao_veracidade: true/);
  });

  it("o botão fica travado até a caixa ser marcada", () => {
    expect(PAINEL).toMatch(/disabled=\{enviando \|\| !declarou\}/);
  });

  it("o texto é idêntico nos dois lados", () => {
    // O painel mostra a frase; a edge a carimba na via lacrada. Divergindo, o
    // arquivo atestaria uma declaração que o cliente nunca leu.
    const naEdge = EDGE.match(/const DECLARACAO_VERACIDADE =\s*([\s\S]*?);/)?.[1] ?? "";
    const montada = naEdge
      .split("\n")
      .map((l) => l.trim().replace(/^\+\s*/, ""))
      .join(" ")
      .replace(/"\s*\+?\s*"/g, "")
      .replace(/^"|"$/g, "")
      .replace(/"\s*$/, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^"/, "")
      .replace(/"$/, "");
    expect(montada.replace(/"/g, "")).toBe(DECLARACAO_VERACIDADE);
  });

  it("fica guardada na própria aprovação", () => {
    expect(EDGE).toMatch(/aprovacao_declaracao: DECLARACAO_VERACIDADE/);
    expect(SQL).toMatch(/ADD COLUMN IF NOT EXISTS aprovacao_declaracao text/);
  });
});

describe("falha ao arquivar não desfaz a aprovação do cliente", () => {
  it("o erro vira aviso, não derruba a requisição", () => {
    // Derrubar faria o cliente clicar de novo e bater na trava de idempotência
    // (`ja_aprovada`): ficaria preso, aprovado e sem arquivo.
    expect(EDGE).toMatch(/documento_ok: mat\.ok/);
    expect(EDGE).toMatch(/documento_aviso: mat\.aviso/);
    const fn = EDGE.slice(EDGE.indexOf("async function materializarPeticao"));
    expect(fn).toMatch(/catch \(e\) \{[\s\S]{0,300}ok: false/);
  });

  it("a aprovação é gravada ANTES de tentar gerar o arquivo", () => {
    const posUpdate = EDGE.indexOf('status_cliente: "aprovada"');
    const posMaterializar = EDGE.indexOf("const mat = await materializarPeticao");
    expect(posUpdate).toBeGreaterThan(0);
    expect(posMaterializar).toBeGreaterThan(posUpdate);
  });

  it("o histórico do processo diz se a petição entrou ou não", () => {
    expect(EDGE).toMatch(/PETIÇÃO ANEXADA AO DOSSIÊ/);
    expect(EDGE).toMatch(/NÃO ANEXADA AO DOSSIÊ/);
  });
});

describe("a migration", () => {
  it("só acrescenta coluna — nada é removido nem renomeado", () => {
    const executavel = semComentario(SQL, "--");
    expect(executavel).not.toMatch(/DROP COLUMN/i);
    expect(executavel).not.toMatch(/RENAME/i);
    expect(executavel).toMatch(/ADD COLUMN IF NOT EXISTS peticao_storage_path text/);
    expect(executavel).toMatch(/ADD COLUMN IF NOT EXISTS lacre_storage_path\s+text/);
  });

  it("traz a consulta que encontra o passivo", () => {
    expect(SQL).toMatch(/peticao_storage_path IS NULL/);
  });
});
