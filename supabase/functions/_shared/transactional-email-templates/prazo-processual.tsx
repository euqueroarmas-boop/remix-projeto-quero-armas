/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; processo?: string; prazoTipo?: string; vencimento?: string; diasRestantes?: string; portalUrl?: string; observacao?: string }

const Email = (p: Props) => {
  const dias = Number(p.diasRestantes ?? 0)
  const vencido = dias < 0
  return (
    <ArsenalEmail
      preview="Prazo processual"
      headline={vencido ? 'Prazo processual vencido' : 'Prazo processual próximo'}
      saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
      intro={vencido
        ? `O prazo "${p.prazoTipo || 'prazo'}" no processo ${p.processo || ''} venceu em ${p.vencimento || ''}.`
        : `O prazo "${p.prazoTipo || 'prazo'}" no processo ${p.processo || ''} vence em ${dias} dia(s) — ${p.vencimento || ''}.`}
      alerta={{ tipo: vencido ? 'danger' : 'warning', texto: p.observacao || 'Não perca este prazo. Nossa equipe está acompanhando pelo Arsenal.' }}
      cta={{ label: 'Ver processo', url: p.portalUrl || 'https://euqueroarmas.com.br/area-do-cliente' }}
    />
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const dias = Number(d?.diasRestantes ?? 0)
    return dias < 0
      ? `⚠️ Prazo vencido — ${d?.prazoTipo || 'processo'}`
      : `⚠️ Prazo em ${dias} dia(s) — ${d?.prazoTipo || 'processo'}`
  },
  displayName: 'Prazo processual',
  previewData: { nome: 'CAC', processo: '2026.001', prazoTipo: 'defesa administrativa', vencimento: '30/09/2026', diasRestantes: '7' },
} satisfies TemplateEntry