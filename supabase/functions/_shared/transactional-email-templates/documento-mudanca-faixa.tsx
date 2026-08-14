/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

/**
 * MUDANÇA DE FAIXA DO DOCUMENTO — texto aprovado em 14/08/2026.
 *
 * Sai UMA vez por virada de faixa, não todo dia:
 *   verde  → amarelo  (faixa "atencao")
 *   amarelo→ vermelho (faixa "critico")
 *
 * Tudo é dinâmico: o nome do documento, o prazo, a data e a frase de origem
 * (onde emitir a via nova). Nada de "certidão próxima do vencimento" genérico —
 * o cliente precisa saber QUAL documento e O QUE fazer com ele.
 */

export type FaixaDocumento = 'atencao' | 'critico'

interface Props {
  nome?: string
  /** Nome canônico do documento, já resolvido pelo motor. */
  documento?: string
  faixa?: FaixaDocumento
  diasRestantes?: string
  vencimento?: string
  /** Frase de origem por tipo: onde emitir/baixar a via nova. */
  comoResolver?: string
  portalUrl?: string
}

const PORTAL_PADRAO = 'https://www.euqueroarmas.com.br/area-do-cliente'

/** "vence em 3 dias" / "vence hoje" — nunca "vence em 0 dias". */
export function prazoEmTexto(dias: number): string {
  if (dias <= 0) return 'vence hoje'
  return `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

const Email = (p: Props) => {
  const critico = p.faixa === 'critico'
  const dias = Number(p.diasRestantes ?? 0)
  const prazo = prazoEmTexto(dias)
  const doc = p.documento || 'documento'
  const venc = p.vencimento && dias > 0 ? `, no dia ${p.vencimento}` : ''

  const paragrafos = critico
    ? [
        `${p.nome || 'Olá'}, o seu ${doc} está em prazo crítico: ${prazo}${venc}.`,
        'Vencido, ele deixa de valer para o protocolo. O seu processo para de andar e só volta quando a via nova chegar — o atraso passa a ser do prazo, não do documento.',
        p.comoResolver || 'Emita e envie hoje pelo Arsenal.',
      ]
    : [
        `${p.nome || 'Olá'}, o seu ${doc} mudou de status: saiu de em dia e entrou em atenção. Ele ${prazo}${venc}.`,
        'A Polícia Federal só aceita documento dentro da validade no dia do protocolo. Se o seu processo for protocolado depois dessa data, esse documento é recusado e a pasta inteira espera.',
        p.comoResolver || 'Envie a via atualizada agora, pelo Arsenal. Ainda dá tempo com folga.',
      ]

  return (
    <ArsenalEmail
      preview={critico ? `${doc} ${prazo}` : `${doc} entrou em atenção`}
      headline={critico ? 'Prazo crítico' : 'Documento entrou em atenção'}
      paragrafos={paragrafos}
      destaques={[
        { label: 'Documento', valor: doc },
        {
          label: dias <= 0 ? 'Vencimento' : 'Vence em',
          valor: dias <= 0
            ? `Hoje${p.vencimento ? ` — ${p.vencimento}` : ''}`
            : `${dias} ${dias === 1 ? 'dia' : 'dias'}${p.vencimento ? ` — ${p.vencimento}` : ''}`,
        },
        { label: 'Status', valor: critico ? 'Prazo crítico' : 'Atenção' },
      ]}
      alerta={{
        tipo: critico ? 'danger' : 'warning',
        titulo: critico ? 'Envie hoje' : 'Ação recomendada',
        texto: critico
          ? 'Depois do vencimento este documento não serve mais para o protocolo.'
          : 'Renovar agora evita que a pasta pare na véspera do protocolo.',
      }}
      cta={{
        label: critico ? 'ENVIAR AGORA' : 'ENVIAR DOCUMENTO ATUALIZADO',
        url: p.portalUrl || PORTAL_PADRAO,
      }}
    />
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const dias = Number(d?.diasRestantes ?? 0)
    const doc = (d?.documento as string) || 'Documento'
    if (d?.faixa === 'critico') {
      return dias <= 0 ? `${doc} vence hoje — envie agora` : `${doc} ${prazoEmTexto(dias)} — envie hoje`
    }
    return `${doc} entra em contagem — ${dias} ${dias === 1 ? 'dia' : 'dias'} para vencer`
  },
  displayName: 'Documento — mudança de faixa (atenção / crítico)',
  previewData: {
    nome: 'Mizael',
    documento: 'Comprovante de Residência — Conta de Energia Elétrica',
    faixa: 'atencao',
    diasRestantes: '9',
    vencimento: '23/08/2026',
    comoResolver: 'Baixe a via atualizada no site da concessionária (EDP).',
  },
} satisfies TemplateEntry
