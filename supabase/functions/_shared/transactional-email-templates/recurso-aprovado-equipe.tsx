/// <reference types="npm:@types/react@18.3.1" />
// ============================================================================
// E-mail interno — o cliente aprovou o relato do recurso
// ----------------------------------------------------------------------------
// Existe o `processo-pronto-protocolar`, mas ele fala de outra coisa: checklist
// completo, processo pronto para entrar. Este aqui é o oposto em urgência — o
// processo JÁ foi negado, correm 10 dias para recorrer, e a única peça que
// faltava (a confirmação dos fatos pelo próprio cliente) acabou de chegar.
//
// Aprovação que espera alguém abrir o admin é aprovação perdida. Por isso o
// e-mail sai no mesmo ato da aprovação.
//
// "EDITADO PELO CLIENTE" é o dado que muda o trabalho de quem lê: quando ele
// mexeu no texto, alguma coisa estava errada — data, endereço, nome — e quem
// for redigir a peça precisa ler o texto dele, não o gerado.
// ============================================================================
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nomeCliente?: string
  cpf?: string
  servico?: string
  editadoPeloCliente?: boolean
  adminUrl?: string
}

const Email = (p: Props) => (
  <ArsenalEmail
    preview="Cliente aprovou o relato do recurso"
    headline="Recurso aprovado pelo cliente"
    intro={
      'O cliente leu o relato em primeira pessoa, confirmou os fatos e liberou. ' +
      'Falta redigir a peça e protocolar — o prazo de 10 dias está correndo.'
    }
    destaques={[
      { label: 'Cliente', valor: p.nomeCliente || '—' },
      { label: 'CPF', valor: p.cpf || '—' },
      { label: 'Serviço', valor: p.servico || '—' },
      {
        label: 'Texto',
        valor: p.editadoPeloCliente ? 'EDITADO pelo cliente — leia a versão dele' : 'Aprovado sem alterações',
      },
    ]}
    cta={p.adminUrl ? { label: 'Abrir no admin', url: p.adminUrl } : undefined}
    rodape="Notificação interna — equipe Quero Armas"
  />
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Recurso aprovado: ${d?.nomeCliente || 'cliente'}${d?.editadoPeloCliente ? ' (texto editado)' : ''}`,
  displayName: 'Recurso aprovado pelo cliente (equipe)',
  previewData: {
    nomeCliente: 'Fulano de Tal',
    cpf: '123.456.789-00',
    servico: 'Posse de arma de fogo',
    editadoPeloCliente: true,
  },
} satisfies TemplateEntry
