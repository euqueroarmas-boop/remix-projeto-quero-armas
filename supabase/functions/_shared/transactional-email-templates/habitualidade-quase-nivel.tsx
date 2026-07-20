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
    preview={"Falta pouco para o pr\u00f3ximo n\u00edvel"}
    titulo={"Falta pouco para o pr\u00f3ximo n\u00edvel"}
    texto={"Sua habitualidade est\u00e1 pr\u00f3xima de atingir os requisitos do pr\u00f3ximo n\u00edvel de atirador desportivo. Confira o que ainda falta para consolidar a mudan\u00e7a."}
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Nível atual', valor: p.nivelAtual || '—' },
      { label: 'Nível sugerido', valor: p.nivelSugerido || '—' },
      { label: 'Treinos válidos', valor: String(p.treinosValidos ?? '—') },
      { label: 'Competições válidas', valor: String(p.competicoesValidas ?? '—') },
      { label: 'Período analisado', valor: p.periodo || '—' },
      { label: 'Próxima ação', valor: p.proximaAcao || "Completar treinos ou competi\u00e7\u00f5es restantes" },
    ]}
    cta={{ label: "VER O QUE FALTA", url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: "Voc\u00ea est\u00e1 perto do pr\u00f3ximo n\u00edvel",
  displayName: "Falta pouco para o pr\u00f3ximo n\u00edvel",
  previewData: {
    nome: 'CAC',
    nivelAtual: 'Nível 1',
    nivelSugerido: 'Nível 2',
    treinosValidos: 9,
    competicoesValidas: 2,
    periodo: '01/01/2026 a 31/12/2026',
    proximaAcao: "Completar treinos ou competi\u00e7\u00f5es restantes",
  },
} satisfies TemplateEntry
