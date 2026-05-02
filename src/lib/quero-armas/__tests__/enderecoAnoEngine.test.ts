import { describe, it, expect } from "vitest";
import {
  aproveitarComprovante,
  validarAnoManual,
  tipoSlotDoAno,
  janelaAnos,
  type SlotEndereco,
} from "../enderecoAnoEngine";

const ANO_ATUAL = 2026;

function slotsBase(): SlotEndereco[] {
  return janelaAnos(ANO_ATUAL).map((ano) => ({
    id: `slot-${ano}`,
    tipo_documento: tipoSlotDoAno(ano),
    ano_competencia: ano,
    arquivo_storage_key: null,
    status: "pendente",
  }));
}

describe("Engine de ano de competência (Slice 2.2)", () => {
  it("documento de 2025 cumpre slot de 2025", () => {
    const r = aproveitarComprovante({
      dataEmissao: "2025-08-12",
      slots: slotsBase(),
      anoAtual: ANO_ATUAL,
    });
    expect(r).toEqual({ tipo: "vinculado_ao_ano", ano: 2025, slotId: "slot-2025" });
  });

  it("documento de 2026 cumpre slot de 2026", () => {
    const r = aproveitarComprovante({
      dataEmissao: "2026-03-01",
      slots: slotsBase(),
      anoAtual: ANO_ATUAL,
    });
    expect(r).toEqual({ tipo: "vinculado_ao_ano", ano: 2026, slotId: "slot-2026" });
  });

  it("documento sem data vai para revisão manual (NÃO presume ano atual)", () => {
    const r = aproveitarComprovante({
      dataEmissao: null,
      slots: slotsBase(),
      anoAtual: ANO_ATUAL,
    });
    expect(r).toEqual({ tipo: "revisao_manual", motivo: "sem_data" });
  });

  it("documento fora da janela (ex.: 2019) vai para revisão manual", () => {
    const r = aproveitarComprovante({
      dataEmissao: "2019-12-01",
      slots: slotsBase(),
      anoAtual: ANO_ATUAL,
    });
    expect(r).toEqual({ tipo: "revisao_manual", motivo: "fora_da_janela" });
  });

  it("não sobrescreve slot já preenchido — devolve revisão manual", () => {
    const slots = slotsBase().map((s) =>
      s.tipo_documento === "comprovante_endereco_ano_2025"
        ? { ...s, arquivo_storage_key: "outro/arquivo.pdf", status: "em_analise" as const }
        : s,
    );
    const r = aproveitarComprovante({
      dataEmissao: "2025-06-15",
      slots,
      anoAtual: ANO_ATUAL,
    });
    expect(r).toEqual({ tipo: "revisao_manual", motivo: "slot_preenchido" });
  });

  it("não duplica slots: um único slot por ano na janela", () => {
    const janela = janelaAnos(ANO_ATUAL);
    const tipos = janela.map(tipoSlotDoAno);
    expect(new Set(tipos).size).toBe(janela.length);
    expect(janela).toEqual([2026, 2025, 2024, 2023, 2022]);
  });

  it("validarAnoManual aceita ano dentro da janela com slot vazio", () => {
    const r = validarAnoManual({ ano: 2024, slots: slotsBase(), anoAtual: ANO_ATUAL });
    expect(r).toEqual({ ok: true, slotId: "slot-2024" });
  });

  it("validarAnoManual rejeita ano fora da janela", () => {
    const r = validarAnoManual({ ano: 2018, slots: slotsBase(), anoAtual: ANO_ATUAL });
    expect(r.ok).toBe(false);
  });

  it("validarAnoManual rejeita ano cujo slot já está preenchido", () => {
    const slots = slotsBase().map((s) =>
      s.tipo_documento === "comprovante_endereco_ano_2024"
        ? { ...s, arquivo_storage_key: "x/y.pdf", status: "aprovado" as const }
        : s,
    );
    const r = validarAnoManual({ ano: 2024, slots, anoAtual: ANO_ATUAL });
    expect(r.ok).toBe(false);
  });
});
