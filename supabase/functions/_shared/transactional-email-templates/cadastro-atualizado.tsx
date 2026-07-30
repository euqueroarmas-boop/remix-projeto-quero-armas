/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

/**
 * Aviso de alteração no cadastro.
 *
 * Regra do usuário (30/07/2026): qualquer mudança no cadastro ou nos processos
 * tem de ser informada ao cliente. Aqui o e-mail lista CAMPO A CAMPO o que
 * mudou, com o valor novo, quem alterou e quando — não um "seu cadastro foi
 * atualizado" genérico, que não permite ao cliente conferir nem contestar.
 *
 * O valor ANTERIOR não é enviado de propósito: o e-mail trafega fora do
 * sistema e repetir o dado antigo dobra a exposição sem ajudar em nada — para
 * conferir o histórico existe o portal, atrás de login.
 */
interface CampoAlterado {
  label: string
  valor: string
}

interface Props {
  nome?: string
  campos?: CampoAlterado[]
  alteradoPor?: string
  alteradoEm?: string
  portalUrl?: string
}

const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => {
  const campos = Array.isArray(p.campos) ? p.campos : []
  const qtd = campos.length
  const plural = qtd === 1 ? 'informação' : 'informações'

  return (
    <StatusEmail
      status="ok"
      preview={`Seu cadastro foi atualizado — ${qtd} ${plural}`}
      titulo={qtd === 1 ? 'Uma informação do seu cadastro foi atualizada' : `${qtd} informações do seu cadastro foram atualizadas`}
      texto={
        'Registramos as alterações abaixo no seu cadastro do Arsenal Inteligente. ' +
        'Confira se está tudo correto: a Polícia Federal confere estes dados letra por letra, ' +
        'e qualquer divergência entre o cadastro e os seus documentos pode gerar exigência ou indeferimento. ' +
        'Se você não reconhece alguma destas alterações, responda este e-mail imediatamente.'
      }
      meta={[
        { label: 'Cliente', valor: p.nome || '—' },
        ...campos.map((c) => ({ label: c.label, valor: c.valor || '—' })),
        { label: 'Alterado por', valor: p.alteradoPor || '—' },
        { label: 'Data', valor: p.alteradoEm || '—' },
      ]}
      cta={{ label: 'Conferir meu cadastro', url: p.portalUrl || PORTAL }}
    />
  )
}

export const template = {
  component: Email,
  subject: 'Seu cadastro foi atualizado — Arsenal Inteligente',
  displayName: 'Cadastro atualizado (verde)',
  previewData: {
    nome: 'CAC',
    campos: [
      { label: 'Título de eleitor', valor: '1234 5678 9012' },
      { label: 'Profissão', valor: 'Empresário' },
      { label: 'Celular', valor: '(11) 99999-9999' },
    ],
    alteradoPor: 'Você, pelo portal do cliente',
    alteradoEm: '30/07/2026 às 16:45',
  },
} satisfies TemplateEntry
