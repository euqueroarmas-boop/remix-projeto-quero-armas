/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; servico?: string; portalUrl?: string }

const Email = (p: Props) => (
  <ArsenalEmail
    preview="Sua documentação está completa"
    headline="Documentação completa"
    saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
    intro={p.servico ? `Sua documentação para ${p.servico} está completa.` : 'Sua documentação está completa.'}
    paragrafos={['Nossa equipe iniciará a verificação e, em seguida, o protocolo junto ao órgão competente.']}
    cta={{ label: 'Ver status no Arsenal', url: p.portalUrl || 'https://euqueroarmas.com.br/area-do-cliente' }}
  />
)

export const template = {
  component: Email,
  subject: 'Sua documentação está completa — Arsenal Inteligente',
  displayName: 'Documentação completa (cliente)',
  previewData: { nome: 'CAC', servico: 'CAC — Concessão' },
} satisfies TemplateEntry