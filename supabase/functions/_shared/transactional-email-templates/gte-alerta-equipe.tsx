/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nomeCliente?: string; numeroGte?: string; validade?: string; diasRestantes?: string; adminUrl?: string }

const Email = (p: Props) => (
  <ArsenalEmail
    preview="Alerta interno de GTE"
    headline="GTE próxima do vencimento"
    intro="Uma GTE de cliente precisa de atenção."
    destaques={[
      { label: 'Cliente', valor: p.nomeCliente || '—' },
      { label: 'GTE', valor: p.numeroGte || '—' },
      { label: 'Validade', valor: p.validade || '—' },
      { label: 'Dias', valor: String(p.diasRestantes ?? '—') },
    ]}
    cta={p.adminUrl ? { label: 'Abrir no admin', url: p.adminUrl } : undefined}
    rodape="Notificação interna — equipe Arsenal Inteligente"
  />
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => `GTE ${d?.numeroGte || ''} — ${d?.nomeCliente || 'cliente'}`,
  displayName: 'GTE — equipe',
  previewData: { nomeCliente: 'Fulano', numeroGte: '123456', validade: '30/09/2026', diasRestantes: '7' },
} satisfies TemplateEntry