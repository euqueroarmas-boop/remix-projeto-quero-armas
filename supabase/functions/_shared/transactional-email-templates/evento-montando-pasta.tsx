/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; servico?: string; portalUrl?: string }

const Email = (p: Props) => (
  <ArsenalEmail
    preview="Iniciamos a preparação do seu processo"
    headline="Preparação iniciada"
    saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
    intro={`Iniciamos a preparação da pasta do seu processo${p.servico ? ` de ${p.servico}` : ''}.`}
    paragrafos={['Vamos organizar toda a documentação. Você receberá atualizações a cada etapa.']}
    cta={{ label: 'Acompanhar', url: p.portalUrl || 'https://euqueroarmas.com.br/area-do-cliente' }}
  />
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => `Iniciamos a preparação do seu processo${d?.servico ? ` — ${d.servico}` : ''}`,
  displayName: 'Evento — Montando pasta',
  previewData: { nome: 'CAC', servico: 'CAC — Concessão' },
} satisfies TemplateEntry