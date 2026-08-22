// ============================================================================
// GERADOR DE DOCUMENTO SINTÉTICO PARA TESTE DO HUB
// ----------------------------------------------------------------------------
// Produz um PDF com CAMADA DE TEXTO NATIVA, que é exatamente o que o Hub lê
// para classificar e conferir o envio do cliente. Serve para exercitar o fluxo
// real (upload → leitura → trava → carimbo) sem precisar do documento de
// ninguém.
//
// Os dados são fictícios e cada página sai carimbada como amostra de teste.
// Não é, e não deve ser usado como, documento oficial.
//
//   node scripts/gerar-doc-teste.mjs                 → lista os modelos
//   node scripts/gerar-doc-teste.mjs ctps            → tmp/doc-teste/ctps.pdf
//   node scripts/gerar-doc-teste.mjs todos           → gera todos
//   node scripts/gerar-doc-teste.mjs ctps --sem-texto → versão "escaneada",
//        sem camada de texto, que é o caminho em que a IA assume a leitura
// ============================================================================

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = join(RAIZ, "tmp", "doc-teste");

const CARIMBO = "AMOSTRA SINTETICA PARA TESTE DE SISTEMA - DADOS FICTICIOS";

// Cada modelo carrega o texto que o parser determinístico enxerga. Os marcadores
// (orgão emissor, título do documento, "NADA CONSTA") são o que decide o tipo —
// por isso ficam escritos por extenso, como aparecem no documento verdadeiro.
const MODELOS = {
  ctps: {
    titulo: "Carteira de Trabalho Digital",
    slot: "ctps",
    linhas: [
      "REPUBLICA FEDERATIVA DO BRASIL",
      "MINISTERIO DO TRABALHO E EMPREGO",
      "CARTEIRA DE TRABALHO DIGITAL",
      "",
      "Nome: FULANO DE TAL DA SILVA",
      "CPF: 000.000.000-00",
      "Data de nascimento: 01/01/1980",
      "Nome da mae: MARIA DE TAL DA SILVA",
      "Numero da CTPS: 0000000 Serie: 0000-SP",
      "",
      "CONTRATOS DE TRABALHO",
      "Empregador: EMPRESA FICTICIA DE TESTE LTDA",
      "CNPJ: 00.000.000/0001-00",
      "Cargo: ANALISTA ADMINISTRATIVO",
      "Admissao: 03/02/2020",
      "Situacao: CONTRATO EM VIGOR",
      "Remuneracao: R$ 4.500,00",
    ],
  },

  "certidao-criminal": {
    titulo: "Certidao criminal estadual",
    slot: "antecedentes_estadual_distribuicao",
    linhas: [
      "PODER JUDICIARIO",
      "TRIBUNAL DE JUSTICA DO ESTADO DE SAO PAULO",
      "CERTIDAO ESTADUAL DE DISTRIBUICAO DE ACOES CRIMINAIS",
      "",
      "CERTIFICO que, revendo os registros de distribuicao de feitos CRIMINAIS",
      "deste Estado, verifiquei NADA CONSTAR em nome de:",
      "",
      "Nome: FULANO DE TAL DA SILVA",
      "CPF: 000.000.000-00",
      "",
      "Data de emissao: 01/08/2026",
      "Validade: 90 dias a contar da emissao",
      "Codigo de autenticacao: TESTE-0000-0000-0000",
    ],
  },

  // O par do de cima: mesmo tribunal, escopo CÍVEL. É o documento que a trava
  // de escopo tem de barrar no slot de certidão — e ignorar em qualquer outro.
  "certidao-civel": {
    titulo: "Certidao civel estadual (deve ser barrada no slot de certidao)",
    slot: "antecedentes_estadual_distribuicao",
    linhas: [
      "PODER JUDICIARIO",
      "TRIBUNAL DE JUSTICA DO ESTADO DE SAO PAULO",
      "CERTIDAO ESTADUAL DE DISTRIBUICOES CIVEIS",
      "",
      "CERTIFICO que, revendo os registros de distribuicao de feitos CIVEIS",
      "deste Estado, verifiquei NADA CONSTAR em nome de:",
      "",
      "Nome: FULANO DE TAL DA SILVA",
      "CPF: 000.000.000-00",
      "",
      "Data de emissao: 01/08/2026",
    ],
  },

  holerite: {
    titulo: "Holerite / contracheque",
    slot: "renda_holerite_mes_atual",
    linhas: [
      "EMPRESA FICTICIA DE TESTE LTDA",
      "CNPJ: 00.000.000/0001-00",
      "DEMONSTRATIVO DE PAGAMENTO DE SALARIO",
      "",
      "Funcionario: FULANO DE TAL DA SILVA",
      "CPF: 000.000.000-00",
      "Cargo: ANALISTA ADMINISTRATIVO",
      "Competencia: 07/2026",
      "",
      "VENCIMENTOS",
      "Salario base .................... 4.500,00",
      "DESCONTOS",
      "INSS ............................   495,00",
      "IRRF ............................   180,00",
      "",
      "TOTAL LIQUIDO ................... 3.825,00",
    ],
  },

  "comprovante-residencia": {
    titulo: "Comprovante de residencia",
    slot: "comprovante_residencia",
    linhas: [
      "CONCESSIONARIA FICTICIA DE ENERGIA S.A.",
      "CONTA DE ENERGIA ELETRICA",
      "",
      "Cliente: FULANO DE TAL DA SILVA",
      "CPF: 000.000.000-00",
      "Instalacao: 0000000000",
      "",
      "Endereco: RUA DE TESTE, 100, APTO 1",
      "Bairro: JARDIM FICTICIO",
      "Cidade: SAO PAULO - SP",
      "CEP: 00000-000",
      "",
      "Referencia: 07/2026",
      "Vencimento: 10/08/2026",
      "Valor: R$ 180,00",
    ],
  },
};

async function gerar(chave, semTexto) {
  const modelo = MODELOS[chave];
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([595, 842]); // A4
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const fonteBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  if (semTexto) {
    // "PDF escaneado": o conteúdo vira desenho, não texto. O pdf.js não acha
    // camada de texto e o Hub cai no caminho da IA — que é o outro trecho do
    // fluxo, e precisa ser testado separadamente.
    let y = 780;
    for (const linha of modelo.linhas) {
      if (linha) desenharComoTracos(pagina, linha, y, fonte);
      y -= 22;
    }
  } else {
    let y = 780;
    for (const [i, linha] of modelo.linhas.entries()) {
      if (linha) {
        pagina.drawText(linha, {
          x: 56,
          y,
          size: i < 3 ? 12 : 10,
          font: i < 3 ? fonteBold : fonte,
          color: rgb(0.1, 0.1, 0.1),
        });
      }
      y -= 22;
    }
  }

  pagina.drawText(CARIMBO, {
    x: 56,
    y: 40,
    size: 8,
    font: fonteBold,
    color: rgb(0.75, 0.1, 0.1),
  });

  const sufixo = semTexto ? "-escaneado" : "";
  const destino = join(SAIDA, `${chave}${sufixo}.pdf`);
  await writeFile(destino, await pdf.save());
  return { destino, modelo };
}

// Rasterizar de verdade exigiria um renderizador. Para o efeito que interessa
// — PDF sem camada de texto extraível — basta desenhar as letras como traços.
function desenharComoTracos(pagina, linha, y, fonte) {
  let x = 56;
  for (const caractere of linha) {
    const largura = fonte.widthOfTextAtSize(caractere, 10);
    if (caractere !== " ") {
      pagina.drawRectangle({
        x,
        y: y + 1,
        width: Math.max(largura - 1, 1),
        height: 7,
        color: rgb(0.15, 0.15, 0.15),
      });
    }
    x += largura;
  }
}

const args = process.argv.slice(2);
const semTexto = args.includes("--sem-texto");
const alvo = args.find((a) => !a.startsWith("--"));

if (!alvo) {
  console.log("Modelos disponiveis:\n");
  for (const [chave, m] of Object.entries(MODELOS)) {
    console.log(`  ${chave.padEnd(26)} ${m.titulo}`);
    console.log(`  ${"".padEnd(26)} slot esperado: ${m.slot}\n`);
  }
  console.log("Uso: node scripts/gerar-doc-teste.mjs <modelo|todos> [--sem-texto]");
  process.exit(0);
}

const chaves = alvo === "todos" ? Object.keys(MODELOS) : [alvo];
for (const chave of chaves) {
  if (!MODELOS[chave]) {
    console.error(`Modelo desconhecido: ${chave}`);
    process.exit(1);
  }
}

await mkdir(SAIDA, { recursive: true });
for (const chave of chaves) {
  const { destino, modelo } = await gerar(chave, semTexto);
  console.log(`${destino}   (slot: ${modelo.slot})`);
}
