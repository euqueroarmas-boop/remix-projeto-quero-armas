/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; servico?: string; portalUrl?: string }

const Email = (p: Props) => (
  <ArsenalEmail
    preview="Tudo pronto para protocolar"
    headline="Pronto para protocolar"
    saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
    intro={`Seu processo${p.servico ? ` de ${p.servico}` : ''} está pronto para protocolo junto ao órgão.`}
    cta={{ label: 'Acompanhar', url: p.portalUrl || 'https://euqueroarmas.com.br/area-do-cliente' }}
  />
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => `Tudo pronto para protocolar${d?.servico ? ` — ${d.servico}` : ''}`,
  displayName: 'Evento — Pronto para protocolo',
  previewData: { nome: 'CAC', servico: 'CAC — Concessão' },
} satisfies TemplateEntry