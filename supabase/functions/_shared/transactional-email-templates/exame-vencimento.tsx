/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; tipoExame?: string; vencimento?: string; diasRestantes?: string; portalUrl?: string }

const Email = (p: Props) => {
  const dias = Number(p.diasRestantes ?? 0)
  return (
    <ArsenalEmail
      preview={`${p.tipoExame || 'Exame'} — vencimento`}
      headline="Exame próximo do vencimento"
      saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
      intro={`Seu ${p.tipoExame || 'exame'} vence em ${dias} dia(s) — ${p.vencimento || ''}.`}
      alerta={{ tipo: 'warning', titulo: 'Importante', texto: 'Exames têm validade de 1 ano. Após o vencimento, será necessário refazer o exame.' }}
      cta={{ label: 'Agendar renovação', url: p.portalUrl || 'https://euqueroarmas.com.br/area-do-cliente/agendar-exame' }}
    />
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => `⚠️ ${d?.tipoExame || 'Exame'} vence em ${d?.diasRestantes || '?'} dia(s)`,
  displayName: 'Exame — vencimento',
  previewData: { nome: 'CAC', tipoExame: 'Exame Psicológico', vencimento: '30/09/2026', diasRestantes: '15' },
} satisfies TemplateEntry