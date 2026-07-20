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
    status="alerta"
    preview={"Risco de n\u00e3o sustentar o n\u00edvel atual"}
    titulo={"Risco de n\u00e3o sustentar o n\u00edvel atual"}
    texto={"Considerando o ritmo atual de comprova\u00e7\u00f5es, a contagem pode n\u00e3o sustentar o seu n\u00edvel de atirador desportivo no pr\u00f3ximo ciclo. Regularize antes do fechamento."}
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Nível atual', valor: p.nivelAtual || '—' },
      { label: 'Nível sugerido', valor: p.nivelSugerido || '—' },
      { label: 'Treinos válidos', valor: String(p.treinosValidos ?? '—') },
      { label: 'Competições válidas', valor: String(p.competicoesValidas ?? '—') },
      { label: 'Período analisado', valor: p.periodo || '—' },
      { label: 'Próxima ação', valor: p.proximaAcao || "Regularizar habitualidade antes do fechamento do ciclo" },
    ]}
    cta={{ label: "REGULARIZAR HABITUALIDADE", url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: "Sua habitualidade pode n\u00e3o sustentar o n\u00edvel atual",
  displayName: "Risco de n\u00e3o sustentar o n\u00edvel atual",
  previewData: {
    nome: 'CAC',
    nivelAtual: 'Nível 1',
    nivelSugerido: 'Nível 2',
    treinosValidos: 9,
    competicoesValidas: 2,
    periodo: '01/01/2026 a 31/12/2026',
    proximaAcao: "Regularizar habitualidade antes do fechamento do ciclo",
  },
} satisfies TemplateEntry
