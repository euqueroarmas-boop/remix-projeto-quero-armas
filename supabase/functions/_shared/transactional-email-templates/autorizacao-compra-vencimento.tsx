/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; autorizacao?: string; vencimento?: string; portalUrl?: string }
const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="alerta"
    preview="Autorização de compra próxima do vencimento"
    titulo="Sua autorização de compra está perto do vencimento"
    texto="A autorização de compra vinculada ao seu processo vence em breve. Conclua a etapa ou solicite orientação antes do prazo final."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Autorização', valor: p.autorizacao || '—' },
      { label: 'Vencimento', valor: p.vencimento || '—' },
      { label: 'Status', valor: 'PRÓXIMA DO VENCIMENTO' },
    ]}
    cta={{ label: 'Ver autorização', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'Autorização de compra vence em breve',
  displayName: 'Autorização de compra — vencimento',
  previewData: { nome: 'CAC', autorizacao: 'AC-2026-0091', vencimento: '30/08/2026' },
} satisfies TemplateEntry