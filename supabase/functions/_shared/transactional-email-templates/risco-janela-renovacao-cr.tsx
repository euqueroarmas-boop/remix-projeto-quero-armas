/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; cr?: string; vencimento?: string; portalUrl?: string }
const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="critico"
    preview="Janela de renovação do CR em risco"
    titulo="Seu prazo de renovação exige prioridade"
    texto="O Arsenal identificou risco na janela de renovação do CR. A demora pode transformar a renovação em novo processo de concessão."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'CR', valor: p.cr || '—' },
      { label: 'Vencimento', valor: p.vencimento || '—' },
      { label: 'Status', valor: 'JANELA EM RISCO' },
    ]}
    cta={{ label: 'Priorizar renovação', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'Janela de renovação do CR em risco',
  displayName: 'Renovação CR — janela em risco',
  previewData: { nome: 'CAC', cr: 'CR 000.000', vencimento: '05/09/2026' },
} satisfies TemplateEntry