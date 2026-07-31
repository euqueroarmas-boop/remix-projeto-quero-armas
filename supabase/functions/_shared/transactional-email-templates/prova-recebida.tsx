/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

/**
 * Confirmação de prova recebida para a efetiva necessidade.
 *
 * Regra do usuário (31/07/2026): o e-mail tem de ser CLARO E ESPECÍFICO —
 * "recebemos o Boletim de Ocorrência nº X, referente a ameaça, ocorrida em
 * 20/03/2026" — e não um "documento recebido" genérico.
 *
 * O motivo é prático: o cliente que mandou três BOs precisa saber QUAL chegou.
 * E ver o próprio fato descrito de volta é o que o faz perceber na hora se
 * mandou o arquivo errado.
 */
interface Props {
  nome?: string
  tipoProva?: string
  numero?: string
  orgao?: string
  dataFato?: string
  naturezas?: string[]
  localFato?: string
  totalProvas?: number
  portalUrl?: string
}

const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => {
  const nats = Array.isArray(p.naturezas) ? p.naturezas : []
  const tipo = p.tipoProva || 'documento'

  // Frase principal, montada só com o que foi realmente lido do documento.
  // Campo ausente simplesmente não é citado — nada de "referente a (indefinido)".
  const partes: string[] = [`Recebemos o ${tipo}`]
  if (p.numero) partes.push(`nº ${p.numero}`)
  if (nats.length) partes.push(`referente a ${nats.join(' e ')}`)
  if (p.dataFato) partes.push(`com fato ocorrido em ${p.dataFato}`)
  const frase = partes.join(' ') + '.'

  return (
    <StatusEmail
      status="ok"
      preview={`${tipo} recebido${p.numero ? ` — nº ${p.numero}` : ''}`}
      titulo="Recebemos a sua prova"
      texto={
        `${frase} ` +
        'Nossa equipe vai analisar este e os demais documentos que você enviar para construir a sua ' +
        'efetiva necessidade — a peça que fundamenta, perante a Polícia Federal, por que você precisa da arma. ' +
        'Se você tiver outras ocorrências, envie todas: cada fato registrado fortalece o pedido.'
      }
      meta={[
        { label: 'Cliente', valor: p.nome || '—' },
        { label: 'Documento', valor: tipo },
        { label: 'Número', valor: p.numero || '—' },
        { label: 'Órgão', valor: p.orgao || '—' },
        { label: 'Data do fato', valor: p.dataFato || '—' },
        { label: 'Local', valor: p.localFato || '—' },
        ...(p.totalProvas
          ? [{ label: 'Provas enviadas até agora', valor: String(p.totalProvas) }]
          : []),
      ]}
      cta={{ label: 'Enviar outra prova', url: p.portalUrl || PORTAL }}
    />
  )
}

export const template = {
  component: Email,
  subject: 'Recebemos a sua prova — Arsenal Inteligente',
  displayName: 'Prova de efetiva necessidade recebida (verde)',
  previewData: {
    nome: 'CAC',
    tipoProva: 'Boletim de Ocorrência',
    numero: 'EP6371-1/2026',
    orgao: 'Delegacia Eletrônica 3',
    dataFato: '20/03/2026',
    naturezas: ['Ameaça (art. 147 do Código Penal)'],
    localFato: 'Alameda das Andorinhas, 1 — Jambeiro/SP',
    totalProvas: 2,
  },
} satisfies TemplateEntry
