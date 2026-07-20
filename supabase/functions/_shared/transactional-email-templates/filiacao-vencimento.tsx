/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; clube?: string; vencimento?: string; diasRestantes?: string | number; portalUrl?: string }
const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => {
  const dias = String(p.diasRestantes ?? '—')
  return (
    <StatusEmail
      status="alerta"
      preview={`Sua filiação vence em ${dias} dias`}
      titulo={`Sua filiação vence em ${dias} dias`}
      texto="Sua filiação está próxima do vencimento. Antecipe a renovação para manter o processo e o acervo em conformidade."
      meta={[
        { label: 'Cliente', valor: p.nome || '—' },
        { label: 'Clube', valor: p.clube || '—' },
        { label: 'Vencimento', valor: p.vencimento || '—' },
        { label: 'Dias restantes', valor: dias },
        { label: 'Status', valor: 'PRÓXIMA DO VENCIMENTO' },
      ]}
      cta={{ label: 'Ver filiação', url: p.portalUrl || PORTAL }}
    />
  )
}

export const template = {
  component: Email,
  subject: 'Sua filiação vence em breve',
  displayName: 'Filiação — vencimento próximo',
  previewData: { nome: 'CAC', clube: 'Clube de Tiro Exemplo', vencimento: '15/08/2026', diasRestantes: 20 },
} satisfies TemplateEntry