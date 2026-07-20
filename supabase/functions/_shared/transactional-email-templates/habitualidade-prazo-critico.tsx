/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; periodo?: string; fechamento?: string; portalUrl?: string }
const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="alerta"
    preview="Prazo crítico de habitualidade"
    titulo="Habitualidade perto do fechamento"
    texto="O período de habitualidade está próximo do fechamento. Regularize os comprovantes antes que o requisito fique comprometido."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Período', valor: p.periodo || '—' },
      { label: 'Fechamento', valor: p.fechamento || '—' },
      { label: 'Status', valor: 'PRAZO CRÍTICO' },
    ]}
    cta={{ label: 'Ver prazo', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'Prazo crítico de habitualidade',
  displayName: 'Habitualidade — prazo crítico',
  previewData: { nome: 'CAC', periodo: '01/01/2026 a 31/12/2026', fechamento: '31/12/2026' },
} satisfies TemplateEntry