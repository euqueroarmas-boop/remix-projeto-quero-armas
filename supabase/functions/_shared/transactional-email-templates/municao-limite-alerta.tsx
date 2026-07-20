/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; calibre?: string; consumido?: string | number; limite?: string | number; portalUrl?: string }
const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="alerta"
    preview="Controle de munição exige atenção"
    titulo="Consumo próximo do limite"
    texto="O controle de munição ou insumos está próximo do limite ou apresenta inconsistência com o acervo cadastrado. Revise o consumo antes de novas movimentações."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Calibre', valor: p.calibre || '—' },
      { label: 'Consumido', valor: String(p.consumido ?? '—') },
      { label: 'Limite', valor: String(p.limite ?? '—') },
      { label: 'Status', valor: 'PRÓXIMO DO LIMITE' },
    ]}
    cta={{ label: 'Ver controle', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'Controle de munição exige atenção',
  displayName: 'Munição — alerta de limite',
  previewData: { nome: 'CAC', calibre: '9mm', consumido: 850, limite: 1000 },
} satisfies TemplateEntry