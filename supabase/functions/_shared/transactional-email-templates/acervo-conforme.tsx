/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; item?: string; portalUrl?: string }
const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="ok"
    preview="Acervo em conformidade"
    titulo="Dados do acervo regularizados"
    texto="Os dados analisados estão consistentes com os documentos anexados e com o processo em andamento."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Item', valor: p.item || '—' },
      { label: 'Status', valor: 'CONFORME' },
    ]}
    cta={{ label: 'Abrir Arsenal', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'Acervo em conformidade',
  displayName: 'Acervo conforme',
  previewData: { nome: 'CAC', item: 'Pistola 9mm — SN ABC12345' },
} satisfies TemplateEntry