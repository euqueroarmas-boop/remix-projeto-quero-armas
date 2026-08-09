/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nome?: string
  servico?: string
  entregues?: string
  total?: string
  proximoDoc?: string
  diasParado?: string
  portalUrl?: string
}

const PORTAL = 'https://www.euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="alerta"
    preview={`Seu processo está parado há ${p.diasParado || '15'} dias`}
    titulo="Seu processo está parado"
    texto={`${p.nome ? `${p.nome}, ` : ''}faz ${p.diasParado || '15'} dias que não recebemos nenhum documento seu. Enquanto faltar documento, o processo não anda — e o prazo continua correndo. Falta pouco: ${p.entregues || '0'} de ${p.total || '0'} documentos já estão conosco.`}
    meta={[
      { label: 'Serviço', valor: p.servico || '—' },
      { label: 'Progresso', valor: `${p.entregues || '0'} de ${p.total || '0'} documentos` },
      { label: 'Próximo documento', valor: p.proximoDoc || '—' },
      { label: 'Dias sem movimentação', valor: p.diasParado || '—' },
    ]}
    cta={{ label: 'Enviar documento agora', url: p.portalUrl || PORTAL }}
    rodape="Assim que você enviar, o processo volta a andar e este aviso para."
  />
)

export const template = {
  component: Email,
  subject: (d) => `Seu processo está parado há ${(d?.diasParado as string) || '15'} dias — falta pouco`,
  displayName: 'Cobrança de inatividade (processo parado)',
  previewData: {
    nome: 'WILLIAN',
    servico: 'POSSE DE ARMA DE FOGO',
    entregues: '17',
    total: '22',
    proximoDoc: 'CERTIDÃO JUSTIÇA MILITAR',
    diasParado: '15',
  },
} satisfies TemplateEntry
