/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; numeroGte?: string; validade?: string; diasRestantes?: string; portalUrl?: string }

const Email = (p: Props) => {
  const dias = Number(p.diasRestantes ?? 0)
  const vencido = dias < 0
  return (
    <ArsenalEmail
      preview={`GTE ${p.numeroGte || ''} — vencimento`}
      headline={vencido ? 'GTE vencida' : 'GTE próxima do vencimento'}
      saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
      intro={vencido
        ? `Sua GTE ${p.numeroGte ? `nº ${p.numeroGte}` : ''} venceu em ${p.validade || ''}.`
        : `Sua GTE ${p.numeroGte ? `nº ${p.numeroGte}` : ''} vence em ${dias} dia(s) — ${p.validade || ''}.`}
      alerta={{ tipo: vencido ? 'danger' : 'warning', texto: 'Providencie a renovação para não interromper o transporte.' }}
      cta={{ label: 'Ver GTE no Arsenal', url: p.portalUrl || 'https://euqueroarmas.com.br/area-do-cliente' }}
    />
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const dias = Number(d?.diasRestantes ?? 0)
    return dias < 0 ? '⚠️ GTE vencida' : `⚠️ GTE vence em ${dias} dia(s)`
  },
  displayName: 'GTE — cliente',
  previewData: { nome: 'CAC', numeroGte: '123456', validade: '30/09/2026', diasRestantes: '7' },
} satisfies TemplateEntry