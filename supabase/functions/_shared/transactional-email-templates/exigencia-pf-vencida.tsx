/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; processo?: string; venceuEm?: string; portalUrl?: string }
const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="critico"
    preview="Prazo de exigência da PF vencido"
    titulo="O prazo da exigência expirou"
    texto="O prazo para resposta da exigência venceu. O processo exige análise imediata para definir a próxima medida."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Processo', valor: p.processo || '—' },
      { label: 'Venceu em', valor: p.venceuEm || '—' },
      { label: 'Status', valor: 'VENCIDA' },
    ]}
    cta={{ label: 'Ação urgente', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'Prazo de exigência PF vencido',
  displayName: 'Exigência PF — vencida',
  previewData: { nome: 'CAC', processo: 'Concessão de CR', venceuEm: '20/07/2026' },
} satisfies TemplateEntry