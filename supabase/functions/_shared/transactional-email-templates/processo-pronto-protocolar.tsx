/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nomeCliente?: string; servico?: string; vendaId?: string; adminUrl?: string }

const Email = (p: Props) => (
  <ArsenalEmail
    preview="Processo pronto para protocolar"
    headline="Pronto para protocolar"
    intro="Um processo foi verificado e está pronto para protocolo junto ao órgão."
    destaques={[
      { label: 'Cliente', valor: p.nomeCliente || '—' },
      { label: 'Serviço', valor: p.servico || '—' },
      { label: 'Venda', valor: p.vendaId || '—' },
    ]}
    cta={p.adminUrl ? { label: 'Abrir no admin', url: p.adminUrl } : undefined}
    rodape="Notificação interna — equipe Arsenal Inteligente"
  />
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => `Pronto para protocolar: ${d?.nomeCliente || 'cliente'} — ${d?.servico || 'serviço'}`,
  displayName: 'Processo pronto (equipe)',
  previewData: { nomeCliente: 'Fulano', servico: 'CAC — Concessão', vendaId: '319' },
} satisfies TemplateEntry