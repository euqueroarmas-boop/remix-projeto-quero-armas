/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

/**
 * O cliente mandou um documento diferente do pedido — e ele serviu para outra
 * exigência do mesmo processo.
 *
 * Regra do usuário (31/07/2026): se der para aproveitar, aproveita E informa.
 * O aviso existe porque, sem ele, o cliente acha que resolveu a exigência que
 * estava vendo na tela. Ele fecha o portal satisfeito, a exigência original
 * continua aberta, e ninguém entende por que o processo não anda.
 *
 * Por isso o e-mail diz as duas coisas na mesma frase: o que foi aproveitado
 * e o que continua faltando.
 */
interface Props {
  nome?: string
  documento?: string
  exigenciaPedida?: string
  exigenciaCumprida?: string
  linkEmissao?: string
  portalUrl?: string
}

const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="alerta"
    preview={`Aproveitamos o documento — mas ${p.exigenciaPedida || 'uma exigência'} continua pendente`}
    titulo="Aproveitamos o seu documento, mas ainda falta um"
    texto={
      `O documento que você enviou não era o que estava sendo pedido naquele momento — mas ele serve para ` +
      `outra exigência do seu processo, então já o aproveitamos ali. Nada foi perdido. ` +
      `Só que a exigência original continua em aberto, e é por isso que estamos te avisando: ` +
      `se você fechar o portal agora, ela ficaria esperando sem ninguém perceber.`
    }
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Você enviou', valor: p.documento || '—' },
      { label: 'Aproveitado em', valor: p.exigenciaCumprida || '—' },
      { label: 'Ainda falta', valor: p.exigenciaPedida || '—' },
      ...(p.linkEmissao ? [{ label: 'Onde emitir', valor: p.linkEmissao }] : []),
    ]}
    cta={{ label: 'Enviar o documento que falta', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'Aproveitamos seu documento — mas ainda falta um',
  displayName: 'Documento reaproveitado em outra exigência (alerta)',
  previewData: {
    nome: 'CAC',
    documento: 'Antecedentes Criminais — Polícia Civil (SSP)',
    exigenciaCumprida: 'Certidão Estadual — Polícia Civil',
    exigenciaPedida: 'Certidão de Crimes Eleitorais — TSE',
    linkEmissao: 'https://www.tse.jus.br/servicos-eleitorais/certidoes/certidao-de-crimes-eleitorais',
  },
} satisfies TemplateEntry
