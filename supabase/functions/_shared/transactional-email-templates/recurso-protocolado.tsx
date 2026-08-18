/// <reference types="npm:@types/react@18.3.1" />
// Aviso ao CLIENTE: o recurso dele entrou na Polícia Federal, com número.
//
// Até 18/08/2026 este e-mail não existia porque o próprio ato não era
// registrado: `qa_processo_recursos.numero_protocolo` nunca foi escrito por
// código nenhum. O cliente aprovava o relato e a tela dele dizia "aprovado"
// para sempre — sem número, sem data, sem nada que ele pudesse conferir no
// site da PF.
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nome?: string
  servico?: string
  numeroProtocolo?: string
  dataProtocolo?: string
  portalUrl?: string
}

const PORTAL = 'https://www.euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="ok"
    preview="Seu recurso foi protocolado na Polícia Federal"
    titulo="Recurso protocolado"
    texto="Entregamos o seu recurso na Polícia Federal. A partir de agora o processo volta para análise, e o prazo que corria contra nós está cumprido. Guarde o número abaixo: é por ele que você acompanha o recurso no site da PF."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Serviço', valor: p.servico || '—' },
      { label: 'Nº do protocolo', valor: p.numeroProtocolo || '—' },
      { label: 'Protocolado em', valor: p.dataProtocolo || '—' },
      { label: 'Situação', valor: 'EM ANÁLISE PELA PF' },
    ]}
    cta={{ label: 'Acompanhar na Área do Cliente', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Recurso protocolado${d?.numeroProtocolo ? ` — Nº ${d.numeroProtocolo}` : ''}`,
  displayName: 'Recurso protocolado (cliente)',
  previewData: {
    nome: 'Fulano',
    servico: 'Posse de Arma de Fogo',
    numeroProtocolo: '2026.0001234-56',
    dataProtocolo: '18/08/2026',
  },
} satisfies TemplateEntry
