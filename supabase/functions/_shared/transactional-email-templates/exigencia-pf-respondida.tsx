/// <reference types="npm:@types/react@18.3.1" />
// ============================================================================
// exigencia-pf-respondida — aviso INTERNO: o cliente respondeu a Polícia Federal
// ----------------------------------------------------------------------------
// Quando a PF notifica ou indefere, correm 10 dias e o requerimento é arquivado
// se ninguém responder. O cliente cumprir a exigência é o momento em que a bola
// volta para a equipe — e até 18/08/2026 esse momento era invisível: o e-mail
// `exigencia-cumprida` existia, mas só disparava pelo assistente de pré-piloto,
// nunca pelo fluxo real. A equipe só descobria abrindo o admin por acaso.
//
// Dois estados, um template:
//   parcial  → chegou um documento, ainda faltam outros da mesma manifestação
//   completo → a manifestação foi respondida por inteiro; dá para devolver à PF
// ============================================================================
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nomeCliente?: string
  cpf?: string
  servico?: string
  exigencia?: string
  delegado?: string
  prazoLimite?: string
  pendentes?: string
  completo?: boolean
  adminUrl?: string
}

const Email = (p: Props) => (
  <ArsenalEmail
    preview={p.completo ? 'Exigência da PF respondida por inteiro' : 'O cliente respondeu a PF'}
    headline={p.completo ? 'Exigência da PF respondida' : 'Resposta do cliente à PF'}
    intro={
      p.completo
        ? 'O cliente entregou tudo o que a Polícia Federal pediu. Confira o material e devolva à delegacia dentro do prazo.'
        : 'O cliente entregou um dos documentos que a Polícia Federal pediu. Ainda faltam itens da mesma notificação.'
    }
    destaques={[
      { label: 'Cliente', valor: p.nomeCliente || '—' },
      { label: 'CPF', valor: p.cpf || '—' },
      { label: 'Serviço', valor: p.servico || '—' },
      { label: 'Entregue agora', valor: p.exigencia || '—' },
      { label: 'Delegado', valor: p.delegado || '—' },
      { label: 'Prazo da PF', valor: p.prazoLimite || '—' },
      { label: 'Ainda pendente', valor: p.completo ? 'Nada' : (p.pendentes || '—') },
    ]}
    cta={p.adminUrl ? { label: 'Abrir no admin', url: p.adminUrl } : undefined}
    rodape="Notificação interna — equipe Arsenal Inteligente"
  />
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    d?.completo
      ? `EXIGÊNCIA DA PF RESPONDIDA: ${d?.nomeCliente || 'cliente'} — pronto para devolver`
      : `Cliente respondeu a PF: ${d?.nomeCliente || 'cliente'} — ${d?.exigencia || 'documento'}`,
  displayName: 'Exigência da PF respondida (equipe)',
  previewData: {
    nomeCliente: 'Fulano de Tal',
    cpf: '000.000.000-00',
    servico: 'Posse de Arma de Fogo',
    exigencia: 'Declaração de homonímia',
    delegado: 'DELEARM/DREX/SR/PF/SP',
    prazoLimite: '28/08/2026',
    pendentes: 'Certidão da Justiça Federal',
    completo: false,
  },
} satisfies TemplateEntry
