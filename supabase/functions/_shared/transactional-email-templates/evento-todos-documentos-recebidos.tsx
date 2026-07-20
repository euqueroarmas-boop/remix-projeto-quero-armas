/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; servico?: string; portalUrl?: string }

const Email = (p: Props) => (
  <ArsenalEmail
    preview="Documentação completa"
    headline="Documentação completa"
    saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
    intro={`Toda a documentação${p.servico ? ` de ${p.servico}` : ''} foi recebida.`}
    paragrafos={['A próxima etapa é a verificação interna antes do protocolo.']}
    cta={{ label: 'Acompanhar', url: p.portalUrl || 'https://euqueroarmas.com.br/area-do-cliente' }}
  />
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => `Documentação completa${d?.servico ? ` — ${d.servico}` : ''}`,
  displayName: 'Evento — Todos documentos recebidos',
  previewData: { nome: 'CAC', servico: 'CAC — Concessão' },
} satisfies TemplateEntry