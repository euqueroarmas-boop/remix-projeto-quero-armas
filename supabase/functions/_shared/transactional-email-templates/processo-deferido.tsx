/// <reference types="npm:@types/react@18.3.1" />
// O e-mail que fecha o fluxo. Até 18/08/2026 ele não existia: `deferido` era só
// um rótulo numa tela, e o documento que o cliente comprou — a autorização, o
// CR — chegava por fora do sistema, quando chegava.
//
// A VALIDADE VAI NO CORPO de propósito. Autorização de compra vence, e vencida
// obriga a refazer o processo inteiro. Entregar o papel sem dizer até quando ele
// vale é entregar metade.
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nome?: string
  servico?: string
  documento?: string
  numero?: string
  dataDeferimento?: string
  validade?: string
  portalUrl?: string
}

const PORTAL = 'https://www.euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="ok"
    preview="Deferido — seu documento está disponível"
    titulo="Deferido"
    texto={
      p.validade
        ? 'Saiu a decisão e ela é favorável. O documento já está na sua Área do Cliente, pronto para baixar. Guarde a data de validade: quando ela se aproximar, avisamos com antecedência.'
        : 'Saiu a decisão e ela é favorável. O documento já está na sua Área do Cliente, pronto para baixar.'
    }
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Serviço', valor: p.servico || '—' },
      { label: 'Documento', valor: p.documento || '—' },
      ...(p.numero ? [{ label: 'Número', valor: p.numero }] : []),
      { label: 'Deferido em', valor: p.dataDeferimento || '—' },
      ...(p.validade ? [{ label: 'Válido até', valor: p.validade }] : []),
    ]}
    cta={{ label: 'Baixar meu documento', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Deferido — ${d?.documento || 'seu documento'} já está disponível`,
  displayName: 'Processo deferido — documento entregue (cliente)',
  previewData: {
    nome: 'Fulano',
    servico: 'Autorização de Compra de Arma de Fogo',
    documento: 'Autorização de compra',
    numero: '2026.0001234-56',
    dataDeferimento: '18/08/2026',
    validade: '18/02/2027',
  },
} satisfies TemplateEntry
