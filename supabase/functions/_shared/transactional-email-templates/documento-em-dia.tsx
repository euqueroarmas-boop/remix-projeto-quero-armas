/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nome?: string
  documento?: string
  numero?: string
  validade?: string
  diasRestantes?: string
  evento?: 'cadastrado' | 'renovado'
  portalUrl?: string
}

const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => {
  const acao = p.evento === 'renovado' ? 'renovado' : 'cadastrado'
  return (
    <StatusEmail
      status="ok"
      preview={`Documento ${acao} e em dia`}
      titulo={`Documento ${acao} com sucesso`}
      texto={`Seu ${p.documento || 'documento'} foi ${acao} no Arsenal Inteligente e está em dia. Vamos monitorar o vencimento por você e avisar antes.`}
      meta={[
        { label: 'Cliente', valor: p.nome || '—' },
        { label: 'Documento', valor: p.documento || '—' },
        { label: 'Número', valor: p.numero || '—' },
        { label: 'Validade', valor: p.validade || '—' },
        { label: 'Dias até vencer', valor: p.diasRestantes || '—' },
        { label: 'Status', valor: 'EM DIA' },
      ]}
      cta={{ label: 'Abrir Arsenal', url: p.portalUrl || PORTAL }}
    />
  )
}

export const template = {
  component: Email,
  subject: (d) => `✅ ${(d?.documento as string) || 'Documento'} em dia — Arsenal Inteligente`,
  displayName: 'Documento em dia (verde)',
  previewData: {
    nome: 'CAC',
    documento: 'CR',
    numero: '12345/PF/SP',
    validade: '22/07/2036',
    diasRestantes: '3653',
    evento: 'cadastrado',
  },
} satisfies TemplateEntry
