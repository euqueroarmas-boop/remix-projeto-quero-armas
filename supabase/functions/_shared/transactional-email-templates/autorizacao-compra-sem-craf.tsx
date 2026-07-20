/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; autorizacao?: string; portalUrl?: string }
const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="critico"
    preview="Compra concluída sem CRAF no acervo"
    titulo="Compra concluída sem CRAF no acervo"
    texto="Existe autorização ou compra registrada sem CRAF correspondente anexado ao Arsenal. O ciclo documental precisa ser concluído para manter o acervo organizado."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Autorização', valor: p.autorizacao || '—' },
      { label: 'Status', valor: 'CRAF PENDENTE' },
    ]}
    cta={{ label: 'Anexar CRAF', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'Compra sem CRAF vinculado',
  displayName: 'Autorização de compra — sem CRAF',
  previewData: { nome: 'CAC', autorizacao: 'AC-2026-0091' },
} satisfies TemplateEntry