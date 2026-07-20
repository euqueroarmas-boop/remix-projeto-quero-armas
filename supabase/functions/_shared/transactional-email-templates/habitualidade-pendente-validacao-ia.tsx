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
    preview={"H\u00e1 comprovantes aguardando revis\u00e3o"}
    titulo={"H\u00e1 comprovantes aguardando revis\u00e3o"}
    texto={"A IA encontrou novos comprovantes de habitualidade, mas alguns campos precisam de revis\u00e3o humana antes de entrar na contagem. Confira os pendentes."}
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Nível atual', valor: p.nivelAtual || '—' },
      { label: 'Nível sugerido', valor: p.nivelSugerido || '—' },
      { label: 'Treinos válidos', valor: String(p.treinosValidos ?? '—') },
      { label: 'Competições válidas', valor: String(p.competicoesValidas ?? '—') },
      { label: 'Período analisado', valor: p.periodo || '—' },
      { label: 'Próxima ação', valor: p.proximaAcao || "Revisar comprovantes pendentes" },
    ]}
    cta={{ label: "REVISAR COMPROVANTES", url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: "Comprovantes aguardando valida\u00e7\u00e3o",
  displayName: "H\u00e1 comprovantes aguardando revis\u00e3o",
  previewData: {
    nome: 'CAC',
    nivelAtual: 'Nível 1',
    nivelSugerido: 'Nível 2',
    treinosValidos: 9,
    competicoesValidas: 2,
    periodo: '01/01/2026 a 31/12/2026',
    proximaAcao: "Revisar comprovantes pendentes",
  },
} satisfies TemplateEntry
