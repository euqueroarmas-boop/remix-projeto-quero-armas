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
    status="ok"
    preview={"N\u00edvel atual sustentado"}
    titulo={"N\u00edvel atual sustentado"}
    texto={"A habitualidade validada sustenta o seu n\u00edvel atual de atirador desportivo. Continue mantendo o ritmo de treinos e competi\u00e7\u00f5es registrados."}
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Nível atual', valor: p.nivelAtual || '—' },
      { label: 'Nível sugerido', valor: p.nivelSugerido || '—' },
      { label: 'Treinos válidos', valor: String(p.treinosValidos ?? '—') },
      { label: 'Competições válidas', valor: String(p.competicoesValidas ?? '—') },
      { label: 'Período analisado', valor: p.periodo || '—' },
      { label: 'Próxima ação', valor: p.proximaAcao || "Manter ritmo de treinos e competi\u00e7\u00f5es" },
    ]}
    cta={{ label: "ABRIR ARSENAL", url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: "Seu n\u00edvel est\u00e1 sustentado pela habitualidade",
  displayName: "N\u00edvel atual sustentado",
  previewData: {
    nome: 'CAC',
    nivelAtual: 'Nível 1',
    nivelSugerido: 'Nível 2',
    treinosValidos: 9,
    competicoesValidas: 2,
    periodo: '01/01/2026 a 31/12/2026',
    proximaAcao: "Manter ritmo de treinos e competi\u00e7\u00f5es",
  },
} satisfies TemplateEntry
