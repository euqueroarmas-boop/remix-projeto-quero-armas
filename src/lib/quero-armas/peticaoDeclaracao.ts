// ============================================================================
// A declaração que o cliente marca antes de aprovar a petição
// ----------------------------------------------------------------------------
// Decisão do titular (18/08/2026): a via que vai para a Polícia Federal é um
// PDF simples, só com o texto. O lacre — data, hora, IP, navegador e impressão
// digital do texto — fica com a gente, numa via de arquivo, para o dia em que
// alguém disser que não afirmou aquilo.
//
// Esta frase é o que dá sentido ao lacre. Sem ela, o registro prova apenas que
// alguém clicou num botão; com ela, prova o que a pessoa afirmou ao clicar.
// Por isso o texto é O MESMO na caixa que ele marca e na página de registro do
// arquivo lacrado — se divergirem, a via de arquivo estaria atestando uma
// declaração que ninguém leu.
//
// ESPELHO em `supabase/functions/qa-peca-aprovar-cliente/index.ts`. Deno e Vite
// não compartilham módulo; o teste `peticaoViraDocumento` compara as duas
// cópias e falha se alguém mexer só em um lado. Mesma convenção de
// `pendenciasGrupos` e `ordemProtocolo`.
// ============================================================================

export const DECLARACAO_VERACIDADE =
  "Declaro que li a petição por inteiro, que concordo com o seu conteúdo e que " +
  "os fatos nela narrados são verdadeiros.";
