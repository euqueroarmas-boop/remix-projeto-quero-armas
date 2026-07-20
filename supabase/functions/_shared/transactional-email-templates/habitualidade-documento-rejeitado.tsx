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
    preview={"Comprovante rejeitado"}
    titulo={"Comprovante rejeitado"}
    texto={"Um comprovante enviado n\u00e3o p\u00f4de ser validado e n\u00e3o entrou na contagem de habitualidade. Substitua o documento para manter a sua evolu\u00e7\u00e3o no Arsenal."}
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Nível atual', valor: p.nivelAtual || '—' },
      { label: 'Nível sugerido', valor: p.nivelSugerido || '—' },
      { label: 'Treinos válidos', valor: String(p.treinosValidos ?? '—') },
      { label: 'Competições válidas', valor: String(p.competicoesValidas ?? '—') },
      { label: 'Período analisado', valor: p.periodo || '—' },
      { label: 'Próxima ação', valor: p.proximaAcao || "Substituir o comprovante rejeitado" },
    ]}
    cta={{ label: "SUBSTITUIR DOCUMENTO", url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: "Comprovante n\u00e3o entrou na contagem",
  displayName: "Comprovante rejeitado",
  previewData: {
    nome: 'CAC',
    nivelAtual: 'Nível 1',
    nivelSugerido: 'Nível 2',
    treinosValidos: 9,
    competicoesValidas: 2,
    periodo: '01/01/2026 a 31/12/2026',
    proximaAcao: "Substituir o comprovante rejeitado",
  },
} satisfies TemplateEntry
