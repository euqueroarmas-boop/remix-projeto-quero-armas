/**
 * Cliente autenticado com documento pessoal válido NÃO deve reenviar.
 * Cobre as regras de reaproveitamento dos requisitos identidade/comprovante/selfie
 * na Etapa 02 do /cadastro Mira. Também garante que:
 *  - documentos vencidos / substituídos / reprovados NÃO satisfazem;
 *  - pendente_aprovacao aparece como "em_analise" mas NÃO satisfaz sozinho;
 *  - Etapa02 chama o helper na decisão do botão Continuar;
 *  - opcionais NÃO bloqueiam o botão;
 *  - WMTi/Arsenal/checkout/contrato/processo/checklist NÃO são tocados.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  buscarReaproveitamento,
  classificarReaproveitavel,
  pertenceAoRequisito,
  requisitoCumpridoPorReaproveitamento,
} from "../documentosReaproveitamento";
import type { DocumentoArsenal } from "@/pages/quero-armas/cadastro-refinado/hooks/useCadastroRefinadoState";

const ROOT = process.cwd();
const r = (p: string) => readFileSync(join(ROOT, p), "utf8");
const E02 = "src/pages/quero-armas/cadastro-refinado/steps/Etapa02Documentos.tsx";
const HELPER = "src/lib/quero-armas/documentosReaproveitamento.ts";

function doc(over: Partial<DocumentoArsenal & { substituido_em?: string | null }>): DocumentoArsenal {
  return {
    id: "d1",
    tipo_documento: "CIN",
    arquivo_nome: "CIN Will Massaroto.pdf",
    data_validade: null,
    status: "aprovado",
    validado_admin: true,
    ...over,
  } as DocumentoArsenal;
}

describe("Reaproveitamento de documentos pessoais — /cadastro Mira", () => {
  it("helper existe", () => {
    expect(existsSync(join(ROOT, HELPER))).toBe(true);
  });

  it("CIN válida (aprovada) satisfaz identidade — não pede reenvio", () => {
    const d = doc({ tipo_documento: "CIN", status: "aprovado", validado_admin: true });
    expect(pertenceAoRequisito(d, "doc_identidade")).toBe(true);
    expect(requisitoCumpridoPorReaproveitamento("doc_identidade", [d])).toBe(true);
  });

  it("CNH válida sem data_validade no payload satisfaz identidade", () => {
    const d = doc({ tipo_documento: "CNH", arquivo_nome: "cnh.pdf", status: "aprovado", validado_admin: true, data_validade: null });
    expect(requisitoCumpridoPorReaproveitamento("doc_identidade", [d])).toBe(true);
  });

  it("Comprovante de residência aprovado satisfaz endereço", () => {
    const d = doc({ tipo_documento: "comprovante_residencia", arquivo_nome: "conta-de-luz.pdf", status: "aprovado", validado_admin: true });
    expect(requisitoCumpridoPorReaproveitamento("doc_endereco", [d])).toBe(true);
  });

  it("Documento vindo de qa_cadastro_publico satisfaz identidade e comprovante", () => {
    const identidade = doc({ tipo_documento: "DOC_IDENTIDADE", arquivo_nome: "rg-frente-verso.pdf", status: "aprovado", validado_admin: true });
    const endereco = doc({ tipo_documento: "COMPROVANTE_RESIDENCIA", arquivo_nome: "comprovante-endereco.pdf", status: "aprovado", validado_admin: true });
    expect(requisitoCumpridoPorReaproveitamento("doc_identidade", [identidade])).toBe(true);
    expect(requisitoCumpridoPorReaproveitamento("doc_endereco", [endereco])).toBe(true);
  });

  it("Documento vencido NÃO satisfaz — usuário precisa enviar novo", () => {
    const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const d = doc({ tipo_documento: "RG", status: "aprovado", validado_admin: true, data_validade: ontem });
    expect(classificarReaproveitavel(d as any)).toBe("vencido");
    expect(requisitoCumpridoPorReaproveitamento("doc_identidade", [d])).toBe(false);
  });

  it("Documento substituído NÃO conta como ativo", () => {
    const d = doc({ tipo_documento: "CIN", status: "aprovado", validado_admin: true });
    (d as any).substituido_em = new Date().toISOString();
    expect(classificarReaproveitavel(d as any)).toBe("substituido");
    expect(requisitoCumpridoPorReaproveitamento("doc_identidade", [d])).toBe(false);
  });

  it("Documento reprovado NÃO satisfaz", () => {
    const d = doc({ status: "reprovado" });
    expect(classificarReaproveitavel(d as any)).toBe("reprovado");
    expect(requisitoCumpridoPorReaproveitamento("doc_identidade", [d])).toBe(false);
  });

  it("Pendente_aprovacao aparece como 'em_analise' e NÃO satisfaz sozinho", () => {
    const d = doc({ status: "pendente_aprovacao", validado_admin: false });
    expect(classificarReaproveitavel(d as any)).toBe("em_analise");
    expect(requisitoCumpridoPorReaproveitamento("doc_identidade", [d])).toBe(false);
  });

  it("Selfie satisfaz por arquivo_nome contendo 'selfie'", () => {
    const d = doc({ tipo_documento: "outro", arquivo_nome: "minha_selfie.jpg", status: "aprovado", validado_admin: true });
    expect(requisitoCumpridoPorReaproveitamento("doc_selfie", [d])).toBe(true);
  });

  it("buscarReaproveitamento prioriza válido sobre vencido", () => {
    const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const venc = doc({ id: "a", tipo_documento: "RG", status: "aprovado", validado_admin: true, data_validade: ontem });
    const ok = doc({ id: "b", tipo_documento: "CIN", status: "aprovado", validado_admin: true });
    const m = buscarReaproveitamento("doc_identidade", [venc, ok]);
    expect(m.status).toBe("valido");
    expect(m.documento?.id).toBe("b");
  });

  describe("Integração na Etapa 02", () => {
    const src = r(E02);
    it("importa e usa o helper", () => {
      expect(src).toMatch(/from\s+["']@\/lib\/quero-armas\/documentosReaproveitamento["']/);
      expect(src).toMatch(/requisitoCumpridoPorReaproveitamento/);
    });
    it("podeAvancar considera reaproveitamento (não só upload da sessão)", () => {
      expect(src).toMatch(/obrigatoriosPendentes\s*=\s*obrigatorios\.filter\(\(d\)\s*=>\s*!requisitoCumprido/);
    });
    it("renderDoc mostra 'JÁ RECEBIDO' quando há reaproveitamento válido", () => {
      expect(src).toMatch(/JÁ RECEBIDO/);
      expect(src).toMatch(/data-reuso=["']1["']/);
    });
    it("opcionais continuam não bloqueando o botão", () => {
      // obrigatorios = filter(obrigatorio_etapa02); pendentes = filter(!cumprido) — opcionais ficam de fora.
      expect(src).toMatch(/obrigatorios\s*=\s*docs\.filter\(\(d\)\s*=>\s*d\.obrigatorio_etapa02\)/);
    });
    it("substituição continua usando edge qa-cadastro-substituir-documento (não-destrutiva)", () => {
      expect(src).toMatch(/qa-cadastro-substituir-documento/);
    });
    it("NÃO toca WMTi/checkout/contrato/processo/checklist", () => {
      expect(src).not.toMatch(/from\(["'](?:customers|payments|contracts|quotes)["']\)/);
      expect(src).not.toMatch(/invoke\(["']qa-checkout-/);
      expect(src).not.toMatch(/invoke\(["']qa-generate-contract/);
      expect(src).not.toMatch(/invoke\(["']qa-provisionar-acesso-portal/);
      expect(src).not.toMatch(/arsenal_plano|qa_arsenal_access_gate/);
    });
  });
});
