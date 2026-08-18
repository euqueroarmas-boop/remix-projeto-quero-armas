/// <reference types="npm:@types/react@18.3.1" />
// Aviso ao CLIENTE: a resposta à Polícia Federal foi entregue.
//
// Terceira auditoria (18/08/2026): responder a uma notificação era o ato mais
// comum do fluxo e o único que não deixava rastro nenhum. O cliente corria
// atrás do documento, entregava, e depois disso não recebia nada — ficava sem
// saber se a resposta tinha chegado à delegacia, enquanto o painel dele ainda
// exibia o prazo correndo.
//
// Este e-mail fecha esse silêncio: a resposta entrou, o prazo está cumprido, e
// a bola voltou para a PF.
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nome?: string
  servico?: string
  dataResposta?: string
  protocolo?: string
  portalUrl?: string
}

const PORTAL = 'https://www.euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="ok"
    preview="Sua resposta à Polícia Federal foi entregue"
    titulo="Resposta entregue à Polícia Federal"
    texto="Entregamos à Polícia Federal a resposta à notificação do seu processo, dentro do prazo. Não há nada pendente com você neste momento: o processo volta para a análise da PF e avisamos assim que houver novidade."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Serviço', valor: p.servico || '—' },
      { label: 'Entregue em', valor: p.dataResposta || '—' },
      ...(p.protocolo ? [{ label: 'Nº do protocolo', valor: p.protocolo }] : []),
      { label: 'Situação', valor: 'EM ANÁLISE PELA PF' },
    ]}
    cta={{ label: 'Acompanhar na Área do Cliente', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: () => 'Resposta entregue à Polícia Federal',
  displayName: 'Resposta à notificação entregue (cliente)',
  previewData: {
    nome: 'Fulano',
    servico: 'Posse de Arma de Fogo',
    dataResposta: '18/08/2026',
    protocolo: '2026.0001234-56',
  },
} satisfies TemplateEntry
