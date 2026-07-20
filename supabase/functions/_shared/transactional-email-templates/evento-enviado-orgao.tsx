/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; servico?: string; portalUrl?: string; protocolo?: string }

const Email = (p: Props) => (
  <ArsenalEmail
    preview="Processo enviado ao órgão"
    headline="Enviado ao órgão"
    saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
    intro={`Seu processo${p.servico ? ` de ${p.servico}` : ''} foi protocolado no órgão competente.`}
    destaques={p.protocolo ? [{ label: 'Protocolo', valor: p.protocolo }] : undefined}
    paragrafos={['Agora aguardamos a análise. Você receberá atualizações à medida que houver movimentação.']}
    cta={{ label: 'Ver protocolo', url: p.portalUrl || 'https://euqueroarmas.com.br/area-do-cliente' }}
  />
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => `Processo enviado ao órgão${d?.servico ? ` — ${d.servico}` : ''}`,
  displayName: 'Evento — Enviado ao órgão',
  previewData: { nome: 'CAC', servico: 'CAC — Concessão', protocolo: '12345/2026' },
} satisfies TemplateEntry