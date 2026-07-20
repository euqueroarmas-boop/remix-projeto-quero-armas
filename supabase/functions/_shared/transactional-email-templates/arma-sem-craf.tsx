/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; arma?: string; portalUrl?: string }
const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="critico"
    preview="Arma no acervo sem CRAF vinculado"
    titulo="Existe arma sem CRAF vinculado"
    texto="Uma arma foi identificada no acervo sem o respectivo CRAF anexado. Envie o documento para que o Arsenal possa validar o vínculo."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Arma', valor: p.arma || '—' },
      { label: 'Status', valor: 'SEM CRAF' },
    ]}
    cta={{ label: 'Anexar documento', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'Arma cadastrada sem CRAF',
  displayName: 'Arma sem CRAF',
  previewData: { nome: 'CAC', arma: 'Carabina .22 — SN XYZ99887' },
} satisfies TemplateEntry