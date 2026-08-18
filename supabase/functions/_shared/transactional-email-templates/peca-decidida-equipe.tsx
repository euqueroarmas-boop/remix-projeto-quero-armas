/// <reference types="npm:@types/react@18.3.1" />
// Aviso INTERNO: o cliente decidiu sobre a petição — aprovou ou pediu ajuste.
// Não existe "aprovado e parado": aprovação que ninguém vê é aprovação perdida,
// e o processo fica esperando alguém abrir o admin por acaso.
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nomeCliente?: string
  cpf?: string
  servico?: string
  aprovada?: boolean
  editada?: boolean
  motivo?: string
  adminUrl?: string
}

const Email = (p: Props) => (
  <ArsenalEmail
    preview={p.aprovada ? 'Cliente aprovou a petição' : 'Cliente pediu ajuste na petição'}
    headline={p.aprovada ? 'Petição aprovada pelo cliente' : 'Petição devolvida para ajuste'}
    intro={
      p.aprovada
        ? (p.editada
            ? 'O cliente aprovou COM EDIÇÕES PRÓPRIAS. Compare o texto final com a minuta antes de protocolar — a correção dele é a que vale.'
            : 'O cliente aprovou o texto sem alterações. O processo está liberado para seguir.')
        : 'O cliente leu a petição e apontou algo a corrigir. Ele não consegue seguir enquanto o texto não voltar ajustado.'
    }
    destaques={[
      { label: 'Cliente', valor: p.nomeCliente || '—' },
      { label: 'CPF', valor: p.cpf || '—' },
      { label: 'Serviço', valor: p.servico || '—' },
      { label: 'Decisão', valor: p.aprovada ? (p.editada ? 'APROVADA COM EDIÇÃO' : 'APROVADA') : 'DEVOLVIDA' },
      { label: 'O que ele disse', valor: p.motivo || '—' },
    ]}
    cta={p.adminUrl ? { label: 'Abrir no admin', url: p.adminUrl } : undefined}
    rodape="Notificação interna — equipe Arsenal Inteligente"
  />
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    d?.aprovada
      ? `Petição APROVADA: ${d?.nomeCliente || 'cliente'}${d?.editada ? ' (com edições)' : ''}`
      : `Petição DEVOLVIDA: ${d?.nomeCliente || 'cliente'} pediu ajuste`,
  displayName: 'Petição decidida pelo cliente (equipe)',
  previewData: {
    nomeCliente: 'Fulano de Tal',
    cpf: '000.000.000-00',
    servico: 'Posse de Arma de Fogo',
    aprovada: false,
    editada: false,
    motivo: 'A data do boletim está errada, foi 12/03 e não 21/03.',
  },
} satisfies TemplateEntry
