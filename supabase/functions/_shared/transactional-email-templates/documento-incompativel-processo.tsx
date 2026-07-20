/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; documento?: string; exigencia?: string; portalUrl?: string }
const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="alerta"
    preview="Documento não atende à exigência atual"
    titulo="Este documento não atende à exigência atual"
    texto="O documento enviado foi identificado, mas não atende ao processo ou à exigência selecionada. Substitua o arquivo ou revise o tipo documental."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Documento enviado', valor: p.documento || '—' },
      { label: 'Exigência', valor: p.exigencia || '—' },
      { label: 'Status', valor: 'INCOMPATÍVEL' },
    ]}
    cta={{ label: 'Substituir documento', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'Documento incompatível com o processo',
  displayName: 'Documento incompatível',
  previewData: { nome: 'CAC', documento: 'Certidão de execuções criminais', exigencia: 'Certidão de ações criminais' },
} satisfies TemplateEntry