/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; servico?: string; portalUrl?: string }

const Email = (p: Props) => (
  <ArsenalEmail
    preview="Sua documentação está em verificação"
    headline="Em verificação"
    saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
    intro={`Sua documentação${p.servico ? ` de ${p.servico}` : ''} está em análise pela nossa equipe.`}
    paragrafos={['Se algo precisar ser ajustado, avisaremos por aqui.']}
    cta={{ label: 'Ver status', url: p.portalUrl || 'https://euqueroarmas.com.br/area-do-cliente' }}
  />
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => `Sua documentação está em verificação${d?.servico ? ` — ${d.servico}` : ''}`,
  displayName: 'Evento — Em verificação',
  previewData: { nome: 'CAC', servico: 'CAC — Concessão' },
} satisfies TemplateEntry