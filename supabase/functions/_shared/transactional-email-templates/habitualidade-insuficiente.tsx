/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; periodo?: string; comprovados?: string | number; minimo?: string | number; portalUrl?: string }
const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="alerta"
    preview="Habitualidade insuficiente — envie novos comprovantes"
    titulo="Faltam comprovações de habitualidade"
    texto="O Arsenal identificou que a habitualidade registrada ainda não atende ao mínimo necessário para o período analisado. Envie novos comprovantes ou revise os lançamentos disponíveis."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Período', valor: p.periodo || '—' },
      { label: 'Comprovados', valor: String(p.comprovados ?? '—') },
      { label: 'Mínimo exigido', valor: String(p.minimo ?? '—') },
      { label: 'Status', valor: 'INSUFICIENTE' },
    ]}
    cta={{ label: 'Corrigir habitualidade', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'Habitualidade insuficiente identificada',
  displayName: 'Habitualidade insuficiente',
  previewData: { nome: 'CAC', periodo: '01/01/2026 a 31/12/2026', comprovados: 6, minimo: 12 },
} satisfies TemplateEntry