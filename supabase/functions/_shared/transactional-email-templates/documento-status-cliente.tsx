/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nome?: string
  documento?: string
  status?: 'aprovado' | 'reprovado' | 'invalido'
  motivo?: string
  processo?: string
  portalUrl?: string
}

const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => {
  const aprovado = p.status === 'aprovado'
  const statusLabel = aprovado ? 'APROVADO' : 'REPROVADO'
  const motivoPadrao = aprovado
    ? 'Documento conferido pela equipe e aprovado para uso no cadastro, acervo ou processo aplicável.'
    : 'Documento conferido pela equipe e recusado. Verifique o motivo e envie uma nova versão pelo portal.'

  return (
    <StatusEmail
      status={aprovado ? 'ok' : 'critico'}
      preview={`${p.documento || 'Documento'} ${aprovado ? 'aprovado' : 'reprovado'}`}
      titulo={aprovado ? 'Documento aprovado' : 'Documento reprovado'}
      texto={aprovado
        ? 'A equipe concluiu a análise do documento. Ele ficou aprovado e registrado no Arsenal Inteligente.'
        : 'A equipe concluiu a análise do documento, mas ele precisa ser corrigido ou reenviado.'}
      meta={[
        { label: 'Cliente', valor: p.nome || '—' },
        { label: 'Documento', valor: p.documento || '—' },
        { label: 'Status', valor: statusLabel },
        { label: 'Motivo', valor: p.motivo || motivoPadrao },
        ...(p.processo ? [{ label: 'Processo', valor: p.processo }] : []),
      ]}
      cta={{ label: aprovado ? 'Abrir Arsenal' : 'Reenviar documento', url: p.portalUrl || PORTAL }}
      rodape="Controle documental conforme a Lei 10.826/2003, Decreto 11.615/2023, Decreto 12.345/2024 e Instruções Normativas DG/PF aplicáveis."
    />
  )
}

export const template = {
  component: Email,
  subject: (d) => `${String(d?.documento || 'Documento')} ${d?.status === 'aprovado' ? 'aprovado' : 'reprovado'} — Arsenal Inteligente`,
  displayName: 'Documento aprovado/reprovado',
  previewData: {
    nome: 'Cliente',
    documento: 'Comprovante de residência',
    status: 'aprovado',
    motivo: 'Documento conferido e aprovado pela equipe.',
    processo: 'Autorização de compra / posse de arma de fogo',
  },
} satisfies TemplateEntry
