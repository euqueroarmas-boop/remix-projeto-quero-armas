/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; diasRestantes?: string; valorRenovacao?: string; linkPagamento?: string }

const Email = (p: Props) => {
  const dias = Number(p.diasRestantes ?? 0)
  return (
    <ArsenalEmail
      preview="Arsenal Inteligente Premium — renovação"
      headline={dias === 0 ? 'Sua anuidade vence hoje' : `Sua anuidade vence em ${dias} dia(s)`}
      saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
      intro="Lembrete de renovação da anuidade do Arsenal Inteligente Premium após o deferimento do processo."
      destaques={p.valorRenovacao ? [{ label: 'Valor da renovação', valor: p.valorRenovacao }] : undefined}
      alerta={{ tipo: 'warning', texto: 'Sem renovação, o acesso premium será suspenso ao término do período.' }}
      cta={p.linkPagamento ? { label: 'Renovar agora', url: p.linkPagamento } : undefined}
    />
  )
}

export const template = {
  component: Email,
  subject: 'Renovação Arsenal Premium — Arsenal Inteligente',
  displayName: 'Premium — renovação',
  previewData: { nome: 'CAC', diasRestantes: '7', valorRenovacao: 'R$ 240,00' },
} satisfies TemplateEntry