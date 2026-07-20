/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; processo?: string; prazo?: string; diasRestantes?: string | number; portalUrl?: string }
const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="alerta"
    preview="Exigência da PF com prazo em andamento"
    titulo="Existe exigência da PF para responder"
    texto="Seu processo recebeu uma exigência com prazo em andamento. A resposta deve ser preparada e enviada antes do vencimento."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Processo', valor: p.processo || '—' },
      { label: 'Prazo final', valor: p.prazo || '—' },
      { label: 'Dias restantes', valor: String(p.diasRestantes ?? '—') },
      { label: 'Status', valor: 'EM ANDAMENTO' },
    ]}
    cta={{ label: 'Responder exigência', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'Exigência PF com prazo em andamento',
  displayName: 'Exigência PF — prazo',
  previewData: { nome: 'CAC', processo: 'Concessão de CR', prazo: '12/08/2026', diasRestantes: 8 },
} satisfies TemplateEntry