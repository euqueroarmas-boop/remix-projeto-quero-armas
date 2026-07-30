/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

/**
 * Certidão recusada na conferência automática.
 *
 * Regra do usuário (30/07/2026): rejeitou, avisa por e-mail E ensina a emitir
 * de novo no próprio e-mail. O cliente não pode precisar abrir um chamado para
 * descobrir o que fazer.
 *
 * O e-mail responde três perguntas, nesta ordem:
 *   1. O que está errado?  → campo a campo, com o valor que veio e o esperado
 *   2. Como emitir de novo? → link do órgão + o passo que causou o erro
 *   3. Como reenviar?      → os três caminhos do portal, porque o checklist
 *                            pode já estar aberto ou não
 */
interface ProblemaCertidao {
  label: string
  noDocumento?: string
  noCadastro?: string
  mensagem: string
}

interface Props {
  nome?: string
  certidao?: string
  orgao?: string
  problemas?: ProblemaCertidao[]
  linkEmissao?: string
  portalUrl?: string
}

const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const li: React.CSSProperties = { fontSize: '13px', lineHeight: 1.6, margin: '0 0 8px', color: '#1a1a1a' }
const box: React.CSSProperties = {
  backgroundColor: '#fdf5f5',
  borderLeft: '3px solid #7A1F2B',
  padding: '12px 14px',
  margin: '0 0 14px',
  borderRadius: '3px',
}
const passos: React.CSSProperties = {
  backgroundColor: '#f7f6f2',
  padding: '12px 14px',
  margin: '14px 0 0',
  borderRadius: '4px',
}

const Email = (p: Props) => {
  const problemas = Array.isArray(p.problemas) ? p.problemas : []
  const cert = p.certidao || 'a certidão enviada'

  return (
    <StatusEmail
      status="alerta"
      preview={`${cert} precisa ser emitida novamente`}
      titulo={`${cert} precisa ser emitida novamente`}
      texto={
        `Conferimos a certidão que você enviou com os dados do seu cadastro e encontramos divergência. ` +
        `A Polícia Federal confere esses dados letra por letra e indefere o processo por uma única diferença — ` +
        `por isso preferimos avisar agora, antes do protocolo.`
      }
      meta={[
        { label: 'Cliente', valor: p.nome || '—' },
        { label: 'Documento', valor: cert },
        { label: 'Órgão', valor: p.orgao || '—' },
      ]}
      cta={{ label: 'Enviar a certidão corrigida', url: p.portalUrl || PORTAL }}
    >
      <div>
        <p style={{ ...li, fontWeight: 'bold', margin: '0 0 10px' }}>O que precisa ser corrigido</p>
        {problemas.map((pr, i) => (
          <div key={i} style={box}>
            <p style={{ ...li, fontWeight: 'bold', margin: '0 0 4px' }}>{pr.label}</p>
            {pr.noDocumento ? (
              <p style={{ ...li, margin: '0 0 4px' }}>
                Na certidão: <strong>{pr.noDocumento}</strong>
                {pr.noCadastro ? <> · No seu cadastro: <strong>{pr.noCadastro}</strong></> : null}
              </p>
            ) : null}
            <p style={{ ...li, margin: 0 }}>{pr.mensagem}</p>
          </div>
        ))}

        <div style={passos}>
          <p style={{ ...li, fontWeight: 'bold', margin: '0 0 8px' }}>Como emitir novamente</p>
          <p style={li}>
            1. Acesse o site do órgão emissor
            {p.linkEmissao ? <> — <a href={p.linkEmissao} style={{ color: '#7A1F2B' }}>{p.linkEmissao}</a></> : null}.
          </p>
          <p style={li}>
            2. Preencha os dados <strong>exatamente como estão no seu documento de identidade</strong>.
            É o formulário do site que gera o conteúdo da certidão: o que você digitar ali é o que sai impresso.
          </p>
          <p style={li}>
            3. Baixe o <strong>PDF original</strong> pelo link do órgão. Não use “Imprimir → Salvar como PDF”:
            isso quebra a assinatura digital e pode cortar a data de emissão.
          </p>

          <p style={{ ...li, fontWeight: 'bold', margin: '14px 0 8px' }}>Como reenviar para nós</p>
          <p style={li}>
            Entre na sua área do cliente. Normalmente o checklist já abre pedindo esta certidão.
          </p>
          <p style={li}>
            Se não abrir, você tem três caminhos: clique em <strong>“Clique aqui”</strong> no card
            <strong> PROCESSOS</strong>; ou abra o <strong>balão da Quero Armas</strong>, no canto inferior direito;
            ou simplesmente <strong>atualize a página</strong>.
          </p>
        </div>
      </div>
    </StatusEmail>
  )
}

export const template = {
  component: Email,
  subject: 'Sua certidão precisa ser emitida novamente — Arsenal Inteligente',
  displayName: 'Certidão rejeitada na conferência (alerta)',
  previewData: {
    nome: 'CAC',
    certidao: 'Certidão de Antecedentes Criminais — Justiça Militar/SP',
    orgao: 'Tribunal de Justiça Militar do Estado de São Paulo',
    problemas: [
      {
        label: 'Naturalidade',
        noDocumento: '3750 - SP',
        noCadastro: 'Ferraz de Vasconcelos',
        mensagem:
          'Esse campo é preenchido por quem emite — refaça a emissão informando a cidade de nascimento correta.',
      },
    ],
    linkEmissao: 'https://certidaocriminal.tjmsp.jus.br/',
  },
} satisfies TemplateEntry
