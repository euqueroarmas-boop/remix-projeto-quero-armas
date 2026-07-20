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
    preview={"Falta habitualidade para algum tipo de arma"}
    titulo={"Falta habitualidade para algum tipo de arma"}
    texto={"Sua contagem geral avan\u00e7ou, mas ainda falta habitualidade espec\u00edfica para algum tipo de arma do seu acervo. Confira os requisitos por tipo."}
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Nível atual', valor: p.nivelAtual || '—' },
      { label: 'Nível sugerido', valor: p.nivelSugerido || '—' },
      { label: 'Treinos válidos', valor: String(p.treinosValidos ?? '—') },
      { label: 'Competições válidas', valor: String(p.competicoesValidas ?? '—') },
      { label: 'Período analisado', valor: p.periodo || '—' },
      { label: 'Próxima ação', valor: p.proximaAcao || "Completar habitualidade por tipo de arma" },
    ]}
    cta={{ label: "VER O QUE FALTA", url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: "Falta habitualidade por tipo de arma",
  displayName: "Falta habitualidade para algum tipo de arma",
  previewData: {
    nome: 'CAC',
    nivelAtual: 'Nível 1',
    nivelSugerido: 'Nível 2',
    treinosValidos: 9,
    competicoesValidas: 2,
    periodo: '01/01/2026 a 31/12/2026',
    proximaAcao: "Completar habitualidade por tipo de arma",
  },
} satisfies TemplateEntry
