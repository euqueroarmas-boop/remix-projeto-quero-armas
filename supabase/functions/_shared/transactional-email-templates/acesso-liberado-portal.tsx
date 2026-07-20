/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; portalUrl?: string; servico?: string; loginUrl?: string; senhaTemporaria?: string }

const Email = (p: Props) => (
  <ArsenalEmail
    preview="Seu acesso ao Arsenal Inteligente foi liberado"
    headline="Acesso liberado"
    saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
    intro={p.servico ? `Pagamento confirmado para ${p.servico}. Seu acesso está liberado.` : 'Pagamento confirmado. Seu acesso está liberado.'}
    destaques={p.senhaTemporaria ? [{ label: 'Senha temporária', valor: p.senhaTemporaria }] : undefined}
    paragrafos={['Acompanhe o andamento do processo, envie documentos e receba atualizações em tempo real.', 'Liberado durante o processo. Após o deferimento, será cobrada anuidade.']}
    cta={{ label: 'Acessar Arsenal', url: p.loginUrl || p.portalUrl || 'https://euqueroarmas.com.br/area-do-cliente' }}
  />
)

export const template = {
  component: Email,
  subject: 'Seu acesso ao Arsenal Inteligente está liberado',
  displayName: 'Acesso liberado',
  previewData: { nome: 'CAC', servico: 'CAC — Concessão' },
} satisfies TemplateEntry