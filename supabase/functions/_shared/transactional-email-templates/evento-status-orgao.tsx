/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; servico?: string; status?: string; observacao?: string; portalUrl?: string }

const Email = (p: Props) => (
  <ArsenalEmail
    preview={`Atualização do órgão${p.status ? ` — ${p.status}` : ''}`}
    headline="Atualização do órgão"
    saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
    intro={`Houve uma atualização no seu processo${p.servico ? ` de ${p.servico}` : ''}.`}
    destaques={[{ label: 'Status', valor: p.status || '—' }]}
    paragrafos={p.observacao ? [p.observacao] : undefined}
    cta={{ label: 'Ver detalhes', url: p.portalUrl || 'https://euqueroarmas.com.br/area-do-cliente' }}
  />
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => `Atualização do órgão${d?.status ? ` — ${d.status}` : ''}`,
  displayName: 'Evento — Status do órgão',
  previewData: { nome: 'CAC', servico: 'CAC — Concessão', status: 'Em análise' },
} satisfies TemplateEntry