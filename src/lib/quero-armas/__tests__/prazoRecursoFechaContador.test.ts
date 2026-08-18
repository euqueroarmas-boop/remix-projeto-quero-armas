// ============================================================================
// Recurso protocolado FECHA o prazo de 10 dias.
// ----------------------------------------------------------------------------
// `data_recurso_administrativo` era declarada em `ItemComPrazo`, documentada
// como o campo que faz o prazo parar de correr — e nunca era lida por
// `extrairPrazoDoItem`. Na prática: cliente indeferido, equipe protocola o
// recurso, e o cron `qa-processo-prazo-alertas` seguia disparando
// "🚨 prazo VENCIDO há N dias" para o cliente e para a equipe, diariamente,
// num processo que estava em dia.
//
// Este teste existe para que o campo nunca mais volte a ser decorativo.
// ============================================================================

import { describe, it, expect } from "vitest";
import { extrairPrazoDoItem, type ItemComPrazo } from "../prazosProcessuais";

/** Data ISO deslocada em `dias` a partir de hoje (negativo = passado). */
function diasDeHoje(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const base: ItemComPrazo = { id: 1, servico_id: 2, servico_nome: "Posse", status: "INDEFERIDO" };

describe("prazo de 10 dias x recurso protocolado", () => {
  it("sem recurso: indeferimento de 30 dias atrás continua vencido e alarmando", () => {
    const p = extrairPrazoDoItem({ ...base, data_indeferimento: diasDeHoje(-30) });
    expect(p).not.toBeNull();
    expect(p!.evento).toBe("INDEFERIMENTO");
    expect(p!.status).toBe("vencido");
  });

  it("recurso protocolado depois do indeferimento: prazo fecha, zero alarme", () => {
    const p = extrairPrazoDoItem({
      ...base,
      data_indeferimento: diasDeHoje(-30),
      data_recurso_administrativo: diasDeHoje(-25),
    });
    expect(p).toBeNull();
  });

  it("recurso no MESMO dia do indeferimento também fecha", () => {
    const dia = diasDeHoje(-12);
    const p = extrairPrazoDoItem({
      ...base,
      data_indeferimento: dia,
      data_recurso_administrativo: dia,
    });
    expect(p).toBeNull();
  });

  it("recurso protocolado e a PF notificou DEPOIS: prazo novo volta a correr", () => {
    const p = extrairPrazoDoItem({
      ...base,
      status: "NOTIFICADO",
      data_indeferimento: diasDeHoje(-40),
      data_recurso_administrativo: diasDeHoje(-30),
      data_notificacao: diasDeHoje(-3),
    });
    expect(p).not.toBeNull();
    expect(p!.evento).toBe("NOTIFICAÇÃO");
    expect(p!.diasRestantes).toBe(7);
  });

  it("indeferimento DO RECURSO tem prioridade: abre os 120 dias do MS mesmo com recurso protocolado", () => {
    const p = extrairPrazoDoItem({
      ...base,
      data_indeferimento: diasDeHoje(-60),
      data_recurso_administrativo: diasDeHoje(-50),
      data_indeferimento_recurso: diasDeHoje(-10),
    });
    expect(p).not.toBeNull();
    expect(p!.evento).toBe("MANDADO DE SEGURANÇA");
    expect(p!.prazoTotalDias).toBe(120);
  });

  it("recurso sem nenhum evento aberto não inventa prazo", () => {
    const p = extrairPrazoDoItem({ ...base, data_recurso_administrativo: diasDeHoje(-5) });
    expect(p).toBeNull();
  });
});
