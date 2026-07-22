/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nome?: string
  processo?: string
  exigencia?: string
  cumpridaEm?: string
  portalUrl?: string
}

const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="ok"
    preview="Exigência cumprida"
    titulo="Exigência cumprida com sucesso"
    texto="Sua exigência foi atendida e o processo segue sem pendências pela sua parte. Nossa equipe acompanha a próxima etapa junto ao órgão competente."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Processo', valor: p.processo || '—' },
      { label: 'Exigência', valor: p.exigencia || '—' },
      { label: 'Cumprida em', valor: p.cumpridaEm || '—' },
      { label: 'Status', valor: 'CUMPRIDA' },
    ]}
    cta={{ label: 'Acompanhar processo', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'Exigência cumprida — Arsenal Inteligente',
  displayName: 'Exigência cumprida (verde)',
  previewData: {
    nome: 'CAC',
    processo: 'CAC — Concessão',
    exigencia: 'Comprovante de residência atualizado',
    cumpridaEm: '22/07/2026',
  },
} satisfies TemplateEntry
