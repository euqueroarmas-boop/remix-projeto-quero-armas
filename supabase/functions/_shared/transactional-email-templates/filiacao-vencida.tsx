/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; clube?: string; vencimento?: string; processo?: string; portalUrl?: string }

const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="critico"
    preview="Filiação vencida — regularize para não travar o processo"
    titulo="Sua filiação precisa ser regularizada"
    texto="Sua filiação está vencida e pode impedir o andamento de processos vinculados ao seu CR. Regularize o vínculo com o clube e envie o comprovante atualizado pelo Arsenal Inteligente."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Clube', valor: p.clube || '—' },
      { label: 'Processo', valor: p.processo || '—' },
      { label: 'Vencimento', valor: p.vencimento || '—' },
      { label: 'Status', valor: 'VENCIDA' },
    ]}
    cta={{ label: 'Regularizar filiação', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'Filiação vencida no Arsenal Inteligente',
  displayName: 'Filiação vencida',
  previewData: { nome: 'CAC', clube: 'Clube de Tiro Exemplo', vencimento: '10/06/2026', processo: 'Renovação de CR' },
} satisfies TemplateEntry