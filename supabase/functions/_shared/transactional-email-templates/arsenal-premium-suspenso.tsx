/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; linkPagamento?: string }

const Email = (p: Props) => (
  <ArsenalEmail
    preview="Arsenal Premium suspenso"
    headline="Arsenal Premium suspenso"
    saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
    intro="Seu Arsenal Inteligente Premium foi suspenso por falta de pagamento da anuidade."
    paragrafos={['Após a regularização, o acesso é liberado automaticamente.']}
    alerta={{ tipo: 'danger', titulo: 'Acesso Premium suspenso', texto: 'Funções premium indisponíveis até a regularização.' }}
    cta={p.linkPagamento ? { label: 'Regularizar pagamento', url: p.linkPagamento } : undefined}
  />
)

export const template = {
  component: Email,
  subject: '🔒 Arsenal Premium suspenso — Arsenal Inteligente',
  displayName: 'Premium — suspenso',
  previewData: { nome: 'CAC' },
} satisfies TemplateEntry