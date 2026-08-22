import { describe, it, expect } from "vitest";
import { mensagemAgendamento } from "../mensagemWhatsApp";

describe("mensagemAgendamento", () => {
  it("apresenta o cliente pelo primeiro nome e pela cidade do cadastro", () => {
    const msg = mensagemAgendamento({
      tipo: "psicologo",
      nome: "WILLIAN RODRIGUES DA SILVA MASSAROTO",
      cidade: "SÃO JOSÉ DOS CAMPOS",
      uf: "sp",
    });
    expect(msg).toContain("Sou Willian, de São José dos Campos/SP, e encontrei você");
  });

  it("pede laudo psicológico ao psicólogo e exame de capacidade técnica ao instrutor", () => {
    const base = { nome: "Gilson", cidade: "Goiânia", uf: "GO" };
    expect(mensagemAgendamento({ ...base, tipo: "psicologo" }))
      .toContain("agendar meu laudo psicológico para adquirir uma arma de fogo");
    expect(mensagemAgendamento({ ...base, tipo: "instrutor_tiro" }))
      .toContain("agendar meu exame de capacidade técnica e manuseio para adquirir uma arma de fogo");
  });

  it("não deixa vírgula nem barra solta quando falta nome ou cidade", () => {
    expect(mensagemAgendamento({ tipo: "psicologo", nome: "Gilson" }))
      .toContain("Sou Gilson e encontrei você");
    expect(mensagemAgendamento({ tipo: "psicologo", cidade: "Goiânia", uf: "GO" }))
      .toContain("Sou de Goiânia/GO e encontrei você");
    expect(mensagemAgendamento({ tipo: "psicologo" }))
      .toContain("Olá! Encontrei você pelo Arsenal Inteligente");
  });

  it("leva o endereço do site em todas as versões, sem recado da Quero Armas na mensagem", () => {
    for (const tipo of ["psicologo", "instrutor_tiro"] as const) {
      const msg = mensagemAgendamento({ tipo, nome: "Gilson", cidade: "Goiânia", uf: "GO" });
      expect(msg).toContain("https://www.euqueroarmas.com.br");
      // Só a voz do cliente: nada de convite ao profissional enxertado no texto.
      expect(msg).not.toMatch(/97848|indicados|credenciado:/i);
      expect(msg.trim().split("\n")).toHaveLength(1);
    }
  });
});
