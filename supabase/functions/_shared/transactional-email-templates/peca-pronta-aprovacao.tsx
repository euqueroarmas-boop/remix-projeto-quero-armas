/// <reference types="npm:@types/react@18.3.1" />
// Aviso ao CLIENTE: a petição dele está pronta e espera aprovação.
// O e-mail avisa; a aprovação acontece no pop-up guiado da área do cliente
// (mem://constraints/quero-armas-popup-guiado-canal-do-cliente).
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; servico?: string; portalUrl?: string }

const PORTAL = 'https://www.euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => (
  <StatusEmail
    status="alerta"
    preview="Sua petição está pronta para você conferir"
    titulo="Sua petição está pronta"
    texto="Escrevemos o documento que vai sustentar o seu pedido na Polícia Federal. Antes de entregar, precisamos que você leia e confirme que os fatos estão certos — datas, endereços, nomes. Depois de protocolado, o texto não pode mais ser corrigido."
    meta={[
      { label: 'Cliente', valor: p.nome || '—' },
      { label: 'Serviço', valor: p.servico || '—' },
      { label: 'O que fazer', valor: 'LER E APROVAR NA ÁREA DO CLIENTE' },
    ]}
    cta={{ label: 'Ler minha petição', url: p.portalUrl || PORTAL }}
  />
)

export const template = {
  component: Email,
  subject: 'Sua petição está pronta — confira antes de protocolarmos',
  displayName: 'Petição pronta para aprovação (cliente)',
  previewData: { nome: 'Fulano', servico: 'Posse de Arma de Fogo' },
} satisfies TemplateEntry
