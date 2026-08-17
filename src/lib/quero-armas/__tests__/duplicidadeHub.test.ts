import { describe, expect, it } from "vitest";
import {
  anoDoSlotEndereco,
  avaliarDuplicidadeHub,
  docCobreExigencia,
} from "../duplicidadeHub";

/**
 * Caso Gilson (17/08/2026): comprovante de residência aprovado no Hub, mas
 * vencido. O checklist continuava pedindo o comprovante (certo — o banco não
 * fecha slot com documento vencido) e o Hub recusava o comprovante novo por
 * duplicidade (errado — a tela olhava só tipo + status). Resultado: o cliente
 * reenviava, via carimbo verde de "exigência atendida", e a pendência ficava.
 */
const HOJE = new Date("2026-08-17T12:00:00Z");

const comprovante = (over: Record<string, unknown> = {}) => ({
  id: "doc-1",
  tipo_documento: "comprovante_residencia",
  status: "aprovado",
  created_at: "2026-01-12T10:00:00Z",
  data_emissao: "2026-01-10",
  ...over,
});

describe("duplicidade no Hub × exigência realmente coberta", () => {
  it("comprovante vencido NÃO cobre a exigência — é renovação, não duplicidade", () => {
    const r = docCobreExigencia(comprovante(), { hoje: HOJE });
    expect(r.cobre).toBe(false);
    expect(r.motivo).toBe("vencido");
  });

  it("comprovante dentro da validade cobre a exigência", () => {
    const r = docCobreExigencia(
      comprovante({ data_emissao: "2026-08-05", created_at: "2026-08-05T10:00:00Z" }),
      { hoje: HOJE },
    );
    expect(r.cobre).toBe(true);
    expect(r.motivo).toBeNull();
  });

  it("comprovante de ano anterior não cobre o slot do ano corrente", () => {
    const r = docCobreExigencia(
      comprovante({ data_emissao: "2023-05-10", created_at: "2023-05-10T10:00:00Z" }),
      { hoje: HOJE },
    );
    expect(r.cobre).toBe(false);
    expect(r.motivo).toBe("outro_ano");
  });

  it("comprovante do ano pedido cobre o slot daquele ano, mesmo fora da validade corrente", () => {
    const r = docCobreExigencia(
      comprovante({ data_emissao: "2023-05-10", created_at: "2023-05-10T10:00:00Z" }),
      { tipoAlvo: "comprovante_endereco_ano_2023", anoAlvo: 2023, hoje: HOJE },
    );
    expect(r.cobre).toBe(true);
  });

  it("envio novo sobre comprovante vencido vira substituição do antigo", () => {
    const antigo = comprovante();
    const r = avaliarDuplicidadeHub({
      docs: [antigo],
      tipo: "comprovante_residencia",
      hoje: HOJE,
    });
    expect(r.duplicata).toBeNull();
    expect(r.renovar?.id).toBe("doc-1");
    expect(r.motivo).toBe("vencido");
  });

  it("envio repetido de comprovante ainda válido continua sendo duplicidade", () => {
    const valido = comprovante({
      id: "doc-2",
      data_emissao: "2026-08-05",
      created_at: "2026-08-05T10:00:00Z",
    });
    const r = avaliarDuplicidadeHub({
      docs: [comprovante(), valido],
      tipo: "comprovante_residencia",
      hoje: HOJE,
    });
    expect(r.duplicata?.id).toBe("doc-2");
    expect(r.renovar).toBeNull();
  });

  it("acervo sem documento do tipo não gera nem duplicidade nem renovação", () => {
    const r = avaliarDuplicidadeHub({
      docs: [comprovante({ tipo_documento: "rg_com_cpf" })],
      tipo: "comprovante_residencia",
      hoje: HOJE,
    });
    expect(r).toEqual({ duplicata: null, renovar: null, motivo: null });
  });

  it("documento reprovado no acervo não bloqueia envio novo", () => {
    const r = avaliarDuplicidadeHub({
      docs: [comprovante({ status: "reprovado", data_emissao: "2026-08-05" })],
      tipo: "comprovante_residencia",
      hoje: HOJE,
    });
    expect(r.duplicata).toBeNull();
    expect(r.renovar).toBeNull();
  });

  it("certidão sem regra de ano continua bloqueando reenvio enquanto vale", () => {
    const r = avaliarDuplicidadeHub({
      docs: [
        {
          id: "cert-1",
          tipo_documento: "antecedentes_federal_sjsp_jef",
          status: "aprovado",
          data_emissao: "2026-07-20",
          created_at: "2026-07-20T10:00:00Z",
        },
      ],
      tipo: "antecedentes_federal_sjsp_jef",
      hoje: HOJE,
    });
    expect(r.duplicata?.id).toBe("cert-1");
  });

  it("certidão vencida libera o reenvio como renovação", () => {
    const r = avaliarDuplicidadeHub({
      docs: [
        {
          id: "cert-2",
          tipo_documento: "antecedentes_federal_sjsp_jef",
          status: "aprovado",
          data_emissao: "2026-01-05",
          created_at: "2026-01-05T10:00:00Z",
        },
      ],
      tipo: "antecedentes_federal_sjsp_jef",
      hoje: HOJE,
    });
    expect(r.duplicata).toBeNull();
    expect(r.renovar?.id).toBe("cert-2");
    expect(r.motivo).toBe("vencido");
  });

  it("lê o ano exigido pelo slot do checklist", () => {
    expect(anoDoSlotEndereco("comprovante_endereco_ano_2025")).toBe(2025);
    expect(anoDoSlotEndereco("comprovante_residencia_2024")).toBe(2024);
    expect(anoDoSlotEndereco("comprovante_residencia")).toBeNull();
    expect(anoDoSlotEndereco("rg_com_cpf")).toBeNull();
  });
});
