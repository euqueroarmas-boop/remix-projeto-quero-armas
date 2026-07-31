/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

/**
 * Documento removido do acervo pela equipe.
 *
 * Excluir em silêncio é pior do que não excluir: o cliente mandou algo achando
 * que resolveu, e o item some sem explicação. Ele fica esperando, e nós também.
 *
 * Regra do usuário (31/07/2026): o aviso tem de dizer que, se ele já enviou o
 * documento correto, pode desconsiderar o pedido de reenvio — mas precisa saber
 * que aquele arquivo foi excluído por não ser útil ao processo. O que se evita
 * aqui é o cliente reenviar por medo, ou achar que perdeu algo importante.
 */
interface Props {
  nome?: string
  documento?: string
  arquivo?: string
  motivo?: string
  oQueEnviar?: string
  portalUrl?: string
}

const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="alerta"
    preview={`Um arquivo foi removido do seu processo`}
    titulo="Removemos um arquivo do seu processo"
    texto={
      `Ao revisar os documentos do seu processo, nossa equipe removeu um arquivo que não é aproveitável ` +
      `para o pedido. Nada do que você já enviou corretamente foi afetado. ` +
      `Se você já mandou o documento certo, pode desconsiderar qualquer pedido de reenvio — ` +
      `só queremos que você saiba que aquele arquivo específico foi excluído por não servir ao processo.`
    }
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Item do checklist', valor: p.documento || '—' },
      { label: 'Arquivo removido', valor: p.arquivo || '—' },
      { label: 'Motivo', valor: p.motivo || 'Não aproveitável para o processo' },
      ...(p.oQueEnviar ? [{ label: 'O que enviar no lugar', valor: p.oQueEnviar }] : []),
    ]}
    cta={{ label: 'Ver meu checklist', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'Removemos um arquivo do seu processo — Arsenal Inteligente',
  displayName: 'Documento excluído pela equipe (alerta)',
  previewData: {
    nome: 'CAC',
    documento: 'Certidão Federal — TRF 3ª Região',
    arquivo: 'SCREENSHOT_20260730_234118.JPG',
    motivo: 'O arquivo era um print da tela de instruções, não o documento em si.',
    oQueEnviar: 'O PDF da certidão baixado no site do TRF3.',
  },
} satisfies TemplateEntry
