/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; servico?: string; recebidos?: string; total?: string; portalUrl?: string }

const Email = (p: Props) => (
  <ArsenalEmail
    preview={`Documento recebido — ${p.recebidos || '?'}/${p.total || '?'}`}
    headline="Documento recebido"
    saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
    intro={`Recebemos mais um documento do seu processo${p.servico ? ` de ${p.servico}` : ''}.`}
    destaques={[{ label: 'Progresso', valor: `${p.recebidos || '?'} de ${p.total || '?'}` }]}
    cta={{ label: 'Ver documentos', url: p.portalUrl || 'https://euqueroarmas.com.br/area-do-cliente' }}
  />
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => `Documento recebido — ${d?.recebidos || '?'}/${d?.total || '?'}`,
  displayName: 'Evento — Documento recebido',
  previewData: { nome: 'CAC', servico: 'CAC — Concessão', recebidos: '3', total: '8' },
} satisfies TemplateEntry