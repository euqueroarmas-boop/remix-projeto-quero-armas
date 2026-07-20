/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; servico?: string; valor?: string; vendaId?: string; adminUrl?: string; contato?: string }

const Email = (p: Props) => (
  <ArsenalEmail
    preview="Nova contratação recebida"
    headline="Nova contratação"
    intro="Uma nova contratação chegou no Arsenal Inteligente."
    destaques={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Serviço', valor: p.servico || '—' },
      { label: 'Valor', valor: p.valor || '—' },
      { label: 'Contato', valor: p.contato || '—' },
      { label: 'Venda', valor: p.vendaId || '—' },
    ]}
    cta={p.adminUrl ? { label: 'Abrir no admin', url: p.adminUrl } : undefined}
    rodape="Notificação interna — equipe Arsenal Inteligente"
  />
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => `Nova contratação: ${d?.nome || 'cliente'} — ${d?.servico || 'serviço'}`,
  displayName: 'Nova contratação (admin)',
  previewData: { nome: 'Fulano', servico: 'CAC — Concessão', valor: 'R$ 1.500,00', vendaId: '319', contato: '+55 (11) 90000-0000' },
} satisfies TemplateEntry