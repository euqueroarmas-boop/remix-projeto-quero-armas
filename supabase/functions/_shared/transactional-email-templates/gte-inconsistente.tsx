/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; gte?: string; origem?: string; destino?: string; data?: string; portalUrl?: string }
const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="alerta"
    preview="GTE com dados a revisar"
    titulo="Trajeto ou finalidade da GTE precisam revisão"
    texto="A GTE anexada possui dados que precisam ser conferidos, como origem, destino, data, finalidade ou vínculo com evento."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'GTE', valor: p.gte || '—' },
      { label: 'Origem', valor: p.origem || '—' },
      { label: 'Destino', valor: p.destino || '—' },
      { label: 'Data', valor: p.data || '—' },
      { label: 'Status', valor: 'REVISAR' },
    ]}
    cta={{ label: 'Revisar GTE', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'GTE precisa de revisão',
  displayName: 'GTE inconsistente',
  previewData: { nome: 'CAC', gte: 'GTE-2026-0044', origem: 'São José dos Campos/SP', destino: 'Jacareí/SP', data: '05/08/2026' },
} satisfies TemplateEntry