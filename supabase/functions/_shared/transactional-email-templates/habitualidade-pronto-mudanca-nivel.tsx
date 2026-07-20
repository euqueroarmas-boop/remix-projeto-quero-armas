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
    preview={"Requisitos operacionais atingidos"}
    titulo={"Requisitos operacionais atingidos"}
    texto={"Sua habitualidade validada j\u00e1 atende aos requisitos operacionais para solicitar mudan\u00e7a de n\u00edvel de atirador desportivo. Podemos iniciar o processo pelo Arsenal."}
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Nível atual', valor: p.nivelAtual || '—' },
      { label: 'Nível sugerido', valor: p.nivelSugerido || '—' },
      { label: 'Treinos válidos', valor: String(p.treinosValidos ?? '—') },
      { label: 'Competições válidas', valor: String(p.competicoesValidas ?? '—') },
      { label: 'Período analisado', valor: p.periodo || '—' },
      { label: 'Próxima ação', valor: p.proximaAcao || "Solicitar mudan\u00e7a de n\u00edvel de atirador desportivo" },
    ]}
    cta={{ label: "SOLICITAR MUDAN\u00c7A DE N\u00cdVEL", url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: "Voc\u00ea j\u00e1 pode solicitar mudan\u00e7a de n\u00edvel",
  displayName: "Requisitos operacionais atingidos",
  previewData: {
    nome: 'CAC',
    nivelAtual: 'Nível 1',
    nivelSugerido: 'Nível 2',
    treinosValidos: 9,
    competicoesValidas: 2,
    periodo: '01/01/2026 a 31/12/2026',
    proximaAcao: "Solicitar mudan\u00e7a de n\u00edvel de atirador desportivo",
  },
} satisfies TemplateEntry
