/// <reference types="npm:@types/react@18.3.1" />
// ============================================================================
// E-mail da ETAPA FINAL — "chegamos no momento da entrega à PF"
// ----------------------------------------------------------------------------
// Existe o `documentacao-completa`, que avisa que a papelada acabou e a equipe
// segue sozinha. Ele continua certo para os serviços em que é isso mesmo que
// acontece. Mas no requerimento da Polícia Federal a documentação completa NÃO
// é o fim: é o gatilho de dois passos que só o cliente pode fazer —
//
//   1. assinar a juntada no gov.br dele (assinatura ICP-Brasil, ninguém assina
//      no lugar dele);
//   2. gerar o código de verificação em duas etapas para a equipe entrar na
//      conta gov.br e protocolar.
//
// Mandar "está tudo pronto, pode relaxar" nessa hora é o pior e-mail possível:
// o cliente para de olhar o portal justamente quando ele precisa agir, e o
// processo fica montado e parado.
//
// POR QUE O CÓDIGO NÃO É PEDIDO ANTES: ele expira em poucos minutos. Pedido na
// semana errada, chega vencido. Por isso o passo só abre agora — e é agora que
// o e-mail sai (regra da equipe, 16/08/2026: "aparece no pop-up guiado e vai
// por e-mail informando que chegamos no momento da entrega à PF").
// ============================================================================
import * as React from 'npm:react@18.3.1'
import { ArsenalEmail } from './_shell.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nome?: string
  servico?: string
  portalUrl?: string
}

const Email = (p: Props) => (
  <ArsenalEmail
    preview="Chegamos no momento da entrega à Polícia Federal"
    headline="Chegou a hora de entregar à Polícia Federal"
    saudacao={`Olá${p.nome ? `, ${p.nome}` : ''},`}
    intro={
      `A sua documentação${p.servico ? ` de ${p.servico}` : ''} está completa e conferida. ` +
      'Faltam dois passos, e os dois são seus — ninguém pode fazer no seu lugar.'
    }
    paragrafos={[
      '1) ASSINAR A JUNTADA. Nós reunimos todos os seus documentos e a petição num arquivo ' +
        'único. Você baixa esse arquivo na Área do Cliente, assina com o seu gov.br e devolve ' +
        'por lá. O sistema confere a assinatura antes de liberar o envio. Assine sem editar nem ' +
        'renomear o arquivo: qualquer alteração depois da assinatura invalida a assinatura.',
      '2) GERAR O CÓDIGO DO GOV.BR. O protocolo é feito na sua conta gov.br — não existe acesso ' +
        'de despachante. Quando a equipe for entrar, ela pede na Área do Cliente o código de ' +
        'verificação em duas etapas, que você gera no aplicativo gov.br. Esse código vale poucos ' +
        'minutos: é por isso que só pedimos agora, e não antes.',
      'Assim que você fizer os dois, a equipe faz a última conferência e protocola. Você recebe ' +
        'o número do protocolo por e-mail.',
    ]}
    alerta={{
      tipo: 'warning',
      titulo: 'O processo fica parado até você concluir',
      texto:
        'Sem a juntada assinada e sem o código, o dossiê fica pronto e sem entrar na Polícia ' +
        'Federal. Se o requerimento tiver prazo correndo, ele corre nesse tempo.',
    }}
    cta={{
      label: 'Concluir na Área do Cliente',
      url: p.portalUrl || 'https://www.euqueroarmas.com.br/area-do-cliente',
    }}
  />
)

export const template = {
  component: Email,
  subject: () => 'Chegou a hora: assine a juntada e gere o código do gov.br',
  displayName: 'Etapa final liberada (cliente)',
  previewData: {
    nome: 'CAC',
    servico: 'Posse de arma de fogo',
    portalUrl: 'https://www.euqueroarmas.com.br/area-do-cliente',
  },
} satisfies TemplateEntry
