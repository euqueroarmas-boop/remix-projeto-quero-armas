/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nome?: string
  nivelAtual?: string
  nivelSugerido?: string
  treinosValidos?: string | number
  competicoesValidas?: string | number
  periodo?: string
  proximaAcao?: string
  portalUrl?: string
}
const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="critico"
    preview={"Risco de rebaixamento de n\u00edvel"}
    titulo={"Risco de rebaixamento de n\u00edvel"}
    texto={"A habitualidade validada n\u00e3o sustenta o seu n\u00edvel atual de atirador desportivo. Regularize com urg\u00eancia para evitar o rebaixamento no pr\u00f3ximo enquadramento."}
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Nível atual', valor: p.nivelAtual || '—' },
      { label: 'Nível sugerido', valor: p.nivelSugerido || '—' },
      { label: 'Treinos válidos', valor: String(p.treinosValidos ?? '—') },
      { label: 'Competições válidas', valor: String(p.competicoesValidas ?? '—') },
      { label: 'Período analisado', valor: p.periodo || '—' },
      { label: 'Próxima ação', valor: p.proximaAcao || "Regularizar habitualidade com urg\u00eancia" },
    ]}
    cta={{ label: "REGULARIZAR HABITUALIDADE", url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: "Risco de rebaixamento de n\u00edvel",
  displayName: "Risco de rebaixamento de n\u00edvel",
  previewData: {
    nome: 'CAC',
    nivelAtual: 'Nível 1',
    nivelSugerido: 'Nível 2',
    treinosValidos: 9,
    competicoesValidas: 2,
    periodo: '01/01/2026 a 31/12/2026',
    proximaAcao: "Regularizar habitualidade com urg\u00eancia",
  },
} satisfies TemplateEntry
