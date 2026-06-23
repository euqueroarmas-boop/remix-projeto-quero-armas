/**
 * Dados de referência do Cockpit Z6 Light — replicam exatamente o mockup
 * aprovado em `cockpits/cockpit-z6.jpg`. Usados como fallback quando o
 * cliente ainda não tem processos reais cadastrados.
 */
import type { CockpitZ6MeusProcessosProps } from "./CockpitZ6MeusProcessos";

export function buildCockpitZ6MockData(overrides?: Partial<CockpitZ6MeusProcessosProps>): CockpitZ6MeusProcessosProps {
  const base: CockpitZ6MeusProcessosProps = {
    nomeCliente: "RAFAEL",
    cpfMascarado: "123.456.789-00",
    membroDesde: "FEV/2024",
    processosAtivos: 3,
    focoDoDia: {
      titulo: "Falta sua assinatura GOV.BR no contrato CR — Pistola Glock G19",
      descricao: "Sem isso, não avançamos para protocolar na Polícia Federal. Prazo recomendado: hoje.",
      cta: { label: "ASSINAR AGORA →" },
    },
    kpis: [
      { label: "COM VOCÊ",     value: "2",       sub: "aguardando ação",        dot: "amber" },
      { label: "COM EQUIPE",   value: "1",       sub: "em análise",             dot: "blue"  },
      { label: "NA PF",        value: "1",       sub: "aguardando deferimento", dot: "bordo" },
      { label: "CONCLUÍDOS",   value: "4",       sub: "últimos 12 meses",       dot: "green" },
      { label: "PAGO 2026",    value: "R$ 8.4K", sub: "3 contratos",            dot: "gray"  },
      { label: "DOC VENCENDO", value: "2",       sub: "CNH em 22d · CR em 9d",  dot: "amber" },
    ],
    processos: [
      {
        id: "CR-2024-0451",
        badge: "EM ANDAMENTO",
        badgeTone: "bordo",
        protocolo: "PROTOCOLO PF · 0451-2024-PF/RJ",
        titulo: "CR-2024-0451 · REGISTRO CR — PISTOLA GLOCK G19",
        progressoPct: 45,
        progressoTone: "bordo",
        etapaAtual: "ANTECEDENTES",
        previsao: { label: "Prev. conclusão", value: "14/MAR/2026" },
        metricaTempo: { label: "Dias em andamento", value: "16 DIAS" },
        detalhado: {
          stages: [
            { index: 1, label: "ENDEREÇO",     status: "done",    date: "12/02" },
            { index: 2, label: "PROFISSIONAL", status: "done",    date: "20/02" },
            { index: 3, label: "ANTECEDENTES", status: "current", date: "EM ANÁLISE" },
            { index: 4, label: "DECLARAÇÕES",  status: "pending" },
            { index: 5, label: "EXAMES",       status: "pending" },
          ],
          timeline: [
            { title: "Contrato assinado via Gov.br",         sub: "10/02/2026 · você",                  status: "done" },
            { title: "Endereço validado · BrasilAPI",        sub: "12/02/2026 · equipe",                status: "done" },
            { title: "Condição profissional · Engenheiro",   sub: "20/02/2026 · CREA validado",         status: "done" },
            { title: "Antecedentes · 4 órgãos",              sub: "28/02/2026 · prev. retorno 02/03",   status: "current" },
            { title: "Declarações · aguardando antecedentes",sub: "prev. 05/03/2026",                   status: "pending" },
          ],
          checklist: [
            { label: "Antecedentes — Justiça Federal",  badge: "EM ANÁLISE", tone: "amber" },
            { label: "Antecedentes — Justiça Estadual", badge: "RECEBIDO",   tone: "green" },
            { label: "Certidão Eleitoral",              badge: "EM ANÁLISE", tone: "amber" },
            { label: "Certidão Militar",                badge: "RECEBIDO",   tone: "green" },
          ],
          proximoPasso: "quando os 4 retornarem, liberamos as declarações para você assinar via Gov.br.",
        },
      },
      {
        id: "CAC-2025-0089",
        badge: "AGUARDA VOCÊ",
        badgeTone: "amber",
        protocolo: "PROTOCOLO · PENDENTE ASSINATURA",
        titulo: "CAC-2025-0089 · RENOVAÇÃO CAC ATIRADOR",
        progressoPct: 20,
        progressoTone: "amber",
        etapaAtual: "ASSINATURA",
        etapaAtualTone: "danger",
        previsao: { label: "Prev. conclusão", value: "30/ABR/2026" },
        metricaTempo: { label: "Contrato vence em", value: "7 DIAS", tone: "danger" },
        compacto: {
          banner: {
            tipo: "danger",
            titulo: "Aguardando você assinar o contrato via Gov.br",
            sub: "Documento gerado em 18/02 · vence em 7 dias",
            cta: { label: "ASSINAR" },
          },
          barras: [
            { label: "CONTRATAÇÃO", tone: "done" },
            { label: "ASSINATURA",  tone: "current" },
            { label: "PROTOCOLO",   tone: "pending" },
            { label: "ANÁLISE PF",  tone: "pending" },
            { label: "DEFERIMENTO", tone: "pending" },
          ],
        },
      },
      {
        id: "PORTE-2024-0023",
        badge: "NA POLÍCIA FEDERAL",
        badgeTone: "green",
        protocolo: "PROTOCOLO PF · 0023-2024-DRCM/RJ · 18/01/2026",
        titulo: "PORTE-2024-0023 · PORTE FEDERAL DE TRÂNSITO",
        progressoPct: 78,
        progressoTone: "green",
        etapaAtual: "ANÁLISE PF",
        previsao: { label: "Prev. conclusão", value: "31/MAR/2026" },
        metricaTempo: { label: "Na PF há", value: "36 DIAS" },
        compacto: {
          barras: [
            { label: "CONTRATAÇÃO", tone: "done" },
            { label: "ASSINATURA",  tone: "done" },
            { label: "PROTOCOLO",   tone: "done" },
            { label: "ANÁLISE PF",  tone: "current" },
            { label: "DEFERIMENTO", tone: "pending" },
          ],
          rodape: (
            <>
              Prazo legal para resposta da PF: <b style={{ color: "#0A0A0A" }}>até 31/03/2026</b> · acompanhamos diariamente.
            </>
          ),
        },
      },
    ],
  };
  return { ...base, ...(overrides ?? {}) };
}