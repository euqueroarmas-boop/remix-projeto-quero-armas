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
    preview={"Sua contagem de habitualidade foi atualizada"}
    titulo={"Sua contagem de habitualidade foi atualizada"}
    texto={"A IA processou novos comprovantes e atualizou sua contagem de treinos e competi\u00e7\u00f5es v\u00e1lidos. Confira o progresso no Arsenal Inteligente."}
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Nível atual', valor: p.nivelAtual || '—' },
      { label: 'Nível sugerido', valor: p.nivelSugerido || '—' },
      { label: 'Treinos válidos', valor: String(p.treinosValidos ?? '—') },
      { label: 'Competições válidas', valor: String(p.competicoesValidas ?? '—') },
      { label: 'Período analisado', valor: p.periodo || '—' },
      { label: 'Próxima ação', valor: p.proximaAcao || "Acompanhar progresso no Arsenal" },
    ]}
    cta={{ label: "VER HABITUALIDADE", url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: "IA atualizou sua contagem de habitualidade",
  displayName: "Sua contagem de habitualidade foi atualizada",
  previewData: {
    nome: 'CAC',
    nivelAtual: 'Nível 1',
    nivelSugerido: 'Nível 2',
    treinosValidos: 9,
    competicoesValidas: 2,
    periodo: '01/01/2026 a 31/12/2026',
    proximaAcao: "Acompanhar progresso no Arsenal",
  },
} satisfies TemplateEntry
