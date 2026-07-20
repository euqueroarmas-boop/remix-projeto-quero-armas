/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; item?: string; divergencia?: string; portalUrl?: string }
const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="critico"
    preview="Inconsistência no acervo"
    titulo="Dados do acervo precisam revisão"
    texto="O Arsenal encontrou divergências entre arma, CRAF, autorização, finalidade ou documentos vinculados. Revise os dados para evitar uso incorreto em processos."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Item', valor: p.item || '—' },
      { label: 'Divergência', valor: p.divergencia || '—' },
      { label: 'Status', valor: 'INCONSISTENTE' },
    ]}
    cta={{ label: 'Revisar acervo', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'Inconsistência no acervo',
  displayName: 'Acervo inconsistente',
  previewData: { nome: 'CAC', item: 'Pistola 9mm — SN ABC12345', divergencia: 'Finalidade divergente do CRAF' },
} satisfies TemplateEntry