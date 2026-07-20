/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; loginUrl?: string; email?: string }

const Email = (p: Props) => (
  <ArsenalEmail
    preview="Você já tem acesso ao Arsenal Inteligente"
    headline="Você já tem Arsenal"
    saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
    intro={`Já existe um acesso ativo com o e-mail ${p.email || 'informado'}.`}
    paragrafos={['Use o botão abaixo para entrar. Se esqueceu a senha, use "Esqueci minha senha" na tela de login.']}
    cta={{ label: 'Entrar no portal', url: p.loginUrl || 'https://euqueroarmas.com.br/area-do-cliente' }}
  />
)

export const template = {
  component: Email,
  subject: 'Você já tem acesso — Arsenal Inteligente',
  displayName: 'Cliente já tem conta',
  previewData: { nome: 'CAC', email: 'cliente@exemplo.com' },
} satisfies TemplateEntry