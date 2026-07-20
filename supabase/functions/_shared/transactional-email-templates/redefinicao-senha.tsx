/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; linkReset?: string; validadeHoras?: string }

const Email = (p: Props) => (
  <ArsenalEmail
    preview="Redefinição de senha"
    headline="Redefinir senha"
    saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
    intro="Recebemos uma solicitação para redefinir a senha do seu acesso ao Arsenal Inteligente."
    paragrafos={[`Clique no botão abaixo para criar uma nova senha. Este link expira em ${p.validadeHoras || '1'} hora(s).`, 'Se você não solicitou esta redefinição, ignore este e-mail.']}
    cta={p.linkReset ? { label: 'Redefinir senha', url: p.linkReset } : undefined}
  />
)

export const template = {
  component: Email,
  subject: 'Redefinição de senha — Arsenal Inteligente',
  displayName: 'Redefinição de senha',
  previewData: { nome: 'CAC', linkReset: 'https://euqueroarmas.com.br/reset', validadeHoras: '1' },
} satisfies TemplateEntry