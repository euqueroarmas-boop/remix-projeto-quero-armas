/// <reference types="npm:@types/react@18.3.1" />
// ============================================================================
// E-mail do protocolo — o marco que o cliente mais espera
// ----------------------------------------------------------------------------
// Existe um template genérico de "atualização do órgão", mas o protocolo merece
// o seu: é o momento em que o cliente para de ter tarefas e passa a esperar. Se
// ele não receber os três dados (número, data, delegacia) aqui, ele pergunta no
// WhatsApp — que é o custo que este e-mail existe para eliminar.
//
// O AVISO DO E-MAIL DA PF é a parte que não pode faltar. A delegacia notifica
// direto o requerente, com prazo de 10 dias e arquivamento se ele perder. Já
// vimos isso escrito em notificação real. Cliente que só olha o portal perde
// prazo — e é por e-mail que ele precisa ser avisado disso, justamente porque é
// no e-mail que a PF vai falar com ele.
// ============================================================================
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nome?: string
  servico?: string
  numeroProtocolo?: string
  dataProtocolo?: string
  delegacia?: string
  portalUrl?: string
}

const Email = (p: Props) => (
  <ArsenalEmail
    preview="Seu processo foi protocolado na Polícia Federal"
    headline="Processo protocolado"
    saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
    intro={
      `Entregamos o seu processo${p.servico ? ` de ${p.servico}` : ''} na Polícia Federal. ` +
      'A partir de agora a análise é deles — não há nada pendente com você.'
    }
    destaques={[
      { label: 'Número do protocolo', valor: p.numeroProtocolo || '—' },
      { label: 'Protocolado em', valor: p.dataProtocolo || '—' },
      { label: 'Delegacia', valor: p.delegacia || 'Polícia Federal' },
    ]}
    paragrafos={[
      'O próximo passo é a análise pelo delegado. Se a Polícia Federal pedir algo a mais, ' +
        'você recebe uma notificação — e nós preparamos a resposta.',
      'IMPORTANTE: a Polícia Federal também escreve direto para você, neste mesmo e-mail. ' +
        'As notificações costumam dar 10 dias para responder, e quem perde o prazo tem o ' +
        'requerimento arquivado. Confira a caixa de entrada e o spam, e nos avise assim que ' +
        'receber qualquer mensagem da PF. Não responda sozinho.',
    ]}
    cta={{
      label: 'Acompanhar no Arsenal',
      url: p.portalUrl || 'https://euqueroarmas.com.br/area-do-cliente',
    }}
  />
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Processo protocolado na Polícia Federal${d?.numeroProtocolo ? ` — ${d.numeroProtocolo}` : ''}`,
  displayName: 'Processo protocolado (cliente)',
  previewData: {
    nome: 'CAC',
    servico: 'Posse de arma de fogo',
    numeroProtocolo: '202509251233571981',
    dataProtocolo: '25/09/2025',
    delegacia: 'DELEARM/DREX/SR/PF/SP',
  },
} satisfies TemplateEntry
