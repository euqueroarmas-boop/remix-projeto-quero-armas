/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; documento?: string; vencimento?: string; diasRestantes?: string; portalUrl?: string; observacao?: string }

const Email = (p: Props) => {
  const dias = Number(p.diasRestantes ?? 0)
  const vencido = dias < 0
  return (
    <ArsenalEmail
      preview={`${p.documento || 'Documento'} — vencimento`}
      headline={vencido ? 'Documento vencido' : 'Documento próximo do vencimento'}
      saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
      intro={vencido
        ? `Seu ${p.documento || 'documento'} venceu em ${p.vencimento || 'data informada'}.`
        : `Seu ${p.documento || 'documento'} vence em ${dias} dia(s) — ${p.vencimento || ''}.`}
      alerta={{ tipo: vencido ? 'danger' : 'warning', titulo: 'Ação recomendada', texto: p.observacao || 'Providencie a renovação para evitar impacto nos seus processos.' }}
      cta={{ label: 'Abrir no Arsenal', url: p.portalUrl || 'https://euqueroarmas.com.br/area-do-cliente' }}
    />
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const dias = Number(d?.diasRestantes ?? 0)
    return dias < 0
      ? `⚠️ ${d?.documento || 'Documento'} vencido`
      : `⚠️ ${d?.documento || 'Documento'} vence em ${dias} dia(s)`
  },
  displayName: 'Vencimento de documento',
  previewData: { nome: 'CAC', documento: 'CR', vencimento: '30/09/2026', diasRestantes: '30' },
} satisfies TemplateEntry