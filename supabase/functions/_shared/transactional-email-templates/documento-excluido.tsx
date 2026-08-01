/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

/**
 * Documento removido do acervo — pela equipe OU pelo próprio cliente.
 *
 * Duas autorias, dois textos. Regra do usuário (31/07/2026): quando é o
 * próprio cliente quem apaga, o e-mail é COMPROVANTE — data, hora e o que
 * saiu do acervo —, não um aviso de que mexeram nas coisas dele. Mandar
 * "nossa equipe removeu um arquivo" logo depois de ele mesmo clicar na
 * lixeira é confuso e alarmante.
 *
 * Quando é a equipe, o aviso tem de dizer que, se ele já enviou o documento
 * correto, pode desconsiderar o pedido de reenvio — mas precisa saber que
 * aquele arquivo foi excluído por não ser útil ao processo. O que se evita
 * aqui é o cliente reenviar por medo, ou achar que perdeu algo importante.
 */
interface Props {
  nome?: string
  documento?: string
  arquivo?: string
  motivo?: string
  oQueEnviar?: string
  autor?: 'cliente' | 'equipe'
  excluidoEm?: string
  portalUrl?: string
}

const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => {
  const peloCliente = p.autor === 'cliente'

  const texto = peloCliente
    ? `Este é o comprovante da remoção que você fez no seu acervo. ` +
      `Guarde este e-mail: ele registra o que saiu, com data e hora. ` +
      `Nenhum outro documento seu foi afetado. ` +
      `Se você removeu por engano, é só enviar o arquivo de novo pelo portal — ` +
      `e se ele estava cumprindo alguma exigência de um processo em andamento, ` +
      `essa exigência volta a aparecer no seu checklist até você reenviar.`
    : `Ao revisar os documentos do seu processo, nossa equipe removeu um arquivo que não é aproveitável ` +
      `para o pedido. Nada do que você já enviou corretamente foi afetado. ` +
      `Se você já mandou o documento certo, pode desconsiderar qualquer pedido de reenvio — ` +
      `só queremos que você saiba que aquele arquivo específico foi excluído por não servir ao processo.`

  return (
    <StatusEmail
      // 'ok' no comprovante: a ação foi do próprio cliente e deu certo — não
      // é alerta. 'alerta' fica para a remoção feita pela equipe, que exige
      // atenção dele.
      status={peloCliente ? 'ok' : 'alerta'}
      preview={
        peloCliente
          ? 'Comprovante: documento removido do seu acervo'
          : 'Um arquivo foi removido do seu processo'
      }
      titulo={
        peloCliente
          ? 'Comprovante de remoção do seu acervo'
          : 'Removemos um arquivo do seu processo'
      }
      texto={texto}
      meta={[
        { label: 'Cliente', valor: p.nome || '—' },
        { label: 'Documento', valor: p.documento || '—' },
        { label: 'Arquivo', valor: p.arquivo || '—' },
        ...(p.excluidoEm ? [{ label: 'Removido em', valor: p.excluidoEm }] : []),
        { label: 'Removido por', valor: peloCliente ? 'Você, pelo portal' : 'Equipe Quero Armas' },
        ...(!peloCliente
          ? [{ label: 'Motivo', valor: p.motivo || 'Não aproveitável para o processo' }]
          : []),
        ...(!peloCliente && p.oQueEnviar
          ? [{ label: 'O que enviar no lugar', valor: p.oQueEnviar }]
          : []),
      ]}
      cta={{
        label: peloCliente ? 'Ver meu acervo' : 'Ver meu checklist',
        url: p.portalUrl || PORTAL,
      }}
    />
  )
}

export const template = {
  component: Email,
  subject: 'Documento removido do seu acervo — Arsenal Inteligente',
  displayName: 'Documento excluído (equipe ou cliente)',
  previewData: {
    nome: 'CAC',
    documento: 'Certidão Federal — TRF 3ª Região',
    arquivo: 'SCREENSHOT_20260730_234118.JPG',
    motivo: 'O arquivo era um print da tela de instruções, não o documento em si.',
    oQueEnviar: 'O PDF da certidão baixado no site do TRF3.',
    autor: 'cliente',
    excluidoEm: '31/07/2026 às 21:34',
  },
} satisfies TemplateEntry
