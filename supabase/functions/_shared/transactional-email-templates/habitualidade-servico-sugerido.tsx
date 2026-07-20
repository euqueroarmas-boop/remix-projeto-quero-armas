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
    preview={"Servi\u00e7o recomendado para voc\u00ea"}
    titulo={"Servi\u00e7o recomendado para voc\u00ea"}
    texto={"Com base na sua habitualidade validada, o Arsenal recomenda contratar o servi\u00e7o \"Mudan\u00e7a de n\u00edvel de atirador desportivo\" para formalizar o novo n\u00edvel junto ao Ex\u00e9rcito."}
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Nível atual', valor: p.nivelAtual || '—' },
      { label: 'Nível sugerido', valor: p.nivelSugerido || '—' },
      { label: 'Treinos válidos', valor: String(p.treinosValidos ?? '—') },
      { label: 'Competições válidas', valor: String(p.competicoesValidas ?? '—') },
      { label: 'Período analisado', valor: p.periodo || '—' },
      { label: 'Próxima ação', valor: p.proximaAcao || "Contratar o servi\u00e7o de mudan\u00e7a de n\u00edvel" },
    ]}
    cta={{ label: "CONTRATAR MUDAN\u00c7A DE N\u00cdVEL", url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: "Servi\u00e7o recomendado: Mudan\u00e7a de n\u00edvel de atirador desportivo",
  displayName: "Servi\u00e7o recomendado para voc\u00ea",
  previewData: {
    nome: 'CAC',
    nivelAtual: 'Nível 1',
    nivelSugerido: 'Nível 2',
    treinosValidos: 9,
    competicoesValidas: 2,
    periodo: '01/01/2026 a 31/12/2026',
    proximaAcao: "Contratar o servi\u00e7o de mudan\u00e7a de n\u00edvel",
  },
} satisfies TemplateEntry
