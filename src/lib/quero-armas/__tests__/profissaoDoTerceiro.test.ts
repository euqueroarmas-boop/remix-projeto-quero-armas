// ============================================================================
// A PROFISSÃO DO TITULAR É A DO TERCEIRO — regra do titular (20/08/2026)
// ----------------------------------------------------------------------------
// A pergunta `titular_profissao` só existe quando o comprovante de residência
// está em nome de OUTRA pessoa. O defeito: o preenchimento automático usava a
// profissão do PRÓPRIO CLIENTE — e a declaração do responsável saía com o
// dado do requerente. A resposta certa vem do bloco do responsável no
// cadastro, ou da pergunta com seletor que o portal já faz.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  respostasDoCadastro,
  mesclarRespostasCadastro,
} from "../respostasCadastro";

describe("de onde vem a profissão do titular do comprovante", () => {
  it("vem do bloco do RESPONSÁVEL, nunca da profissão do cliente", () => {
    const r = respostasDoCadastro({
      profissao: "Engenheiro Agrônomo",             // a do cliente
      responsavel_endereco_profissao: "Empresário", // a do terceiro
    });
    expect(r.titular_profissao).toBe("Empresário");
  });

  it("cliente com profissão mas responsável sem: a pergunta fica em aberto", () => {
    const r = respostasDoCadastro({ profissao: "Engenheiro Agrônomo" });
    expect(r.titular_profissao).toBeUndefined();
  });

  it("a resposta do seletor do portal (titular_comprovante_profissao) fecha a pergunta", () => {
    const out = mesclarRespostasCadastro(
      { titular_comprovante_profissao: "Advogado" },
      { profissao: "Engenheiro Agrônomo" },
    );
    expect(out.titular_profissao).toBe("Advogado");
  });

  it("resposta explícita no processo vence tudo", () => {
    const out = mesclarRespostasCadastro(
      { titular_profissao: "Médico", titular_comprovante_profissao: "Advogado" },
      { responsavel_endereco_profissao: "Empresário" },
    );
    expect(out.titular_profissao).toBe("Médico");
  });

  it("a categoria do titular continua derivando normalmente", () => {
    const r = respostasDoCadastro({ categoria_titular: "Pessoa_Fisica" });
    expect(r.categoria_titular).toBe("pessoa_fisica");
  });
});

describe("os espelhos concordam e os chamadores carregam o dado", () => {
  const ler = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

  it("o espelho Deno tem a mesma regra", () => {
    const deno = ler("supabase/functions/_shared/respostasCadastro.ts");
    expect(deno).toContain("responsavel_endereco_profissao");
    expect(deno).not.toContain("const prof = String(cliente.profissao");
  });

  it("os três chamadores selecionam responsavel_endereco_profissao", () => {
    for (const p of [
      "src/lib/quero-armas/checklistGuiadoEngine.ts",
      "supabase/functions/qa-processo-etapa-auto-liberar/index.ts",
      "supabase/functions/qa-processo-checar-conclusao-checklist/index.ts",
    ]) {
      expect(ler(p), p).toContain("responsavel_endereco_profissao");
    }
  });
});
