/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; arma?: string; divergencia?: string; portalUrl?: string }
const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="critico"
    preview="CRAF divergente do acervo cadastrado"
    titulo="Dados do CRAF divergem do cadastro da arma"
    texto="O CRAF anexado possui divergência em relação ao acervo cadastrado, como calibre, número de série, finalidade ou titular. Revise os dados antes de usar o documento em processos."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Arma', valor: p.arma || '—' },
      { label: 'Divergência', valor: p.divergencia || '—' },
      { label: 'Status', valor: 'INCONSISTENTE' },
    ]}
    cta={{ label: 'Revisar CRAF', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'CRAF inconsistente com o acervo',
  displayName: 'CRAF inconsistente',
  previewData: { nome: 'CAC', arma: 'Pistola 9mm — SN ABC12345', divergencia: 'Calibre divergente do cadastro' },
} satisfies TemplateEntry