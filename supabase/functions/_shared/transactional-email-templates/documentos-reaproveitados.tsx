/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

/**
 * Cardinalidade documental: um documento válido na Central de Documentos
 * atende exigências de VÁRIOS processos. Quando isso acontece, a exigência
 * é dada por CUMPRIDA sem novo upload — e o cliente precisa saber, senão ele
 * acha que o processo parou.
 *
 * Este e-mail é o resumo do lote: lista o que foi atendido de uma vez e diz
 * quantas exigências ainda faltam no mesmo processo.
 */
interface ItemReaproveitado {
  exigencia: string
  documento?: string
  validade?: string
}

interface Props {
  nome?: string
  processo?: string
  itens?: ItemReaproveitado[]
  pendentes?: number
  portalUrl?: string
}

const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => {
  const itens = Array.isArray(p.itens) ? p.itens : []
  const total = itens.length
  const pendentes = Number(p.pendentes ?? 0)

  return (
    <StatusEmail
      status="ok"
      preview={`${total} ${total === 1 ? 'exigência atendida' : 'exigências atendidas'} com documentos que você já enviou`}
      titulo={total === 1 ? 'Exigência atendida sem novo envio' : 'Exigências atendidas sem novo envio'}
      texto={
        `Seu documento já estava válido na Central de Documentos e foi usado automaticamente ` +
        `${total === 1 ? 'nesta exigência' : 'nestas exigências'} do processo. ` +
        `Você não precisa reenviar nada: o mesmo documento vale para todos os processos que o exigem, ` +
        `enquanto estiver dentro da validade. ` +
        (pendentes > 0
          ? `Ainda ${pendentes === 1 ? 'falta 1 exigência' : `faltam ${pendentes} exigências`} para concluirmos esta etapa.`
          : `Com isso, não há mais nada pendente da sua parte nesta etapa — a equipe segue com o processo.`)
      }
      meta={[
        { label: 'Cliente', valor: p.nome || '—' },
        { label: 'Processo', valor: p.processo || '—' },
        ...itens.slice(0, 12).map((i) => ({
          label: 'Atendida',
          valor: i.validade
            ? `${i.exigencia} (documento: ${i.documento || '—'}, válido até ${i.validade})`
            : `${i.exigencia}${i.documento ? ` (documento: ${i.documento})` : ''}`,
        })),
        { label: 'Ainda faltam', valor: pendentes > 0 ? String(pendentes) : 'Nenhuma exigência sua' },
      ]}
      cta={{ label: 'Acompanhar processo', url: p.portalUrl || PORTAL }}
      rodape="Controle documental conforme a Lei 10.826/2003, Decreto 11.615/2023, Decreto 12.345/2024 e Instruções Normativas DG/PF aplicáveis."
    />
  )
}

export const template = {
  component: Email,
  subject: (d) => {
    const n = Array.isArray(d?.itens) ? d.itens.length : 1
    return n === 1
      ? 'Exigência atendida com documento que você já enviou'
      : `${n} exigências atendidas com documentos que você já enviou`
  },
  displayName: 'Documentos reaproveitados no processo (verde)',
  previewData: {
    nome: 'CAC',
    processo: 'Autorização de compra',
    itens: [
      { exigencia: 'Certidão Estadual TJSP — Execuções Criminais', documento: 'Execucoes_Criminais.pdf', validade: '05/11/2026' },
      { exigencia: 'Comprovante de residência', documento: 'conta_luz.pdf', validade: '01/09/2026' },
    ],
    pendentes: 3,
  },
} satisfies TemplateEntry
