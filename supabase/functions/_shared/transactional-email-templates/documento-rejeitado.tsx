/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { StatusEmail } from './_status_shell.tsx'
import type { TemplateEntry } from './registry.ts'

/**
 * Documento recusado na conferência automática do Hub Documental.
 *
 * Regra do usuário (01/08/2026): quando o cliente clica em "Enviar novamente",
 * ele recebe um e-mail que explica em detalhe o motivo da recusa E o risco real
 * perante a Polícia Federal — indício de tentativa de burlar a análise queima o
 * cadastro do requerente para sempre.
 */
interface Detalhe {
  label: string
  valor: string
}

type Motivo = 'parentesco' | 'titular' | 'duplicidade' | 'tipo'

interface Props {
  nome?: string
  documento?: string
  arquivo?: string
  motivo?: Motivo
  detalhes?: Detalhe[]
  portalUrl?: string
}

const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const p13: React.CSSProperties = { fontSize: '13px', lineHeight: 1.65, margin: '0 0 10px', color: '#1a1a1a' }
const caixa: React.CSSProperties = {
  backgroundColor: '#fdf5f5',
  borderLeft: '3px solid #7A1F2B',
  padding: '12px 14px',
  margin: '0 0 14px',
  borderRadius: '3px',
}
const alerta: React.CSSProperties = {
  backgroundColor: '#fff8e6',
  border: '1px solid #D9A21B',
  padding: '12px 14px',
  margin: '4px 0 14px',
  borderRadius: '4px',
}
const passos: React.CSSProperties = {
  backgroundColor: '#f7f6f2',
  padding: '12px 14px',
  margin: '4px 0 0',
  borderRadius: '4px',
}

const TITULOS: Record<Motivo, string> = {
  parentesco: 'Documento recusado — grau de parentesco no mesmo endereço',
  titular: 'Documento recusado — está em nome de outra pessoa',
  duplicidade: 'Documento recusado — já consta entregue',
  tipo: 'Documento recusado — não é o documento exigido',
}

const EXPLICACAO: Record<Motivo, string> = {
  parentesco:
    'A nota fiscal que você enviou foi emitida para um tomador que tem o mesmo sobrenome de família que você ' +
    'e que consta no mesmo endereço do prestador. Uma nota emitida de um parente para outro, dentro da mesma casa, ' +
    'não comprova atividade econômica real — ela comprova apenas uma movimentação entre pessoas da mesma família. ' +
    'Para o grupo de OCUPAÇÃO LÍCITA, esse documento não serve.',
  titular:
    'Os dados lidos no documento não são os seus: nome e/ou CPF divergem do cadastro do interessado. ' +
    'Documento de terceiro não cumpre exigência do seu processo.',
  duplicidade:
    'Esse mesmo documento já está aprovado no seu Hub Documental. Enviar de novo não cumpre nenhuma exigência — ' +
    'a que está aberta é outra.',
  tipo:
    'O documento que você anexou não é o que a exigência pede. Ele foi lido, classificado e não corresponde ao ' +
    'item que está aberto no seu checklist.',
}

const Email = (props: Props) => {
  const motivo: Motivo = props.motivo || 'tipo'
  const detalhes = Array.isArray(props.detalhes) ? props.detalhes : []
  const doc = props.documento || 'O documento enviado'

  return (
    <StatusEmail
      status="alerta"
      preview={`${doc} foi recusado — veja o motivo antes de reenviar`}
      titulo={TITULOS[motivo]}
      texto={EXPLICACAO[motivo]}
      meta={[
        { label: 'Cliente', valor: props.nome || '—' },
        { label: 'Exigência', valor: doc },
        { label: 'Arquivo enviado', valor: props.arquivo || '—' },
      ]}
      cta={{ label: 'Enviar o documento correto', url: props.portalUrl || PORTAL }}
    >
      <div>
        {detalhes.length > 0 ? (
          <div style={caixa}>
            <p style={{ ...p13, fontWeight: 'bold', margin: '0 0 6px' }}>O que a leitura encontrou</p>
            {detalhes.map((d, i) => (
              <p key={i} style={{ ...p13, margin: '0 0 4px' }}>
                {d.label}: <strong>{d.valor}</strong>
              </p>
            ))}
          </div>
        ) : null}

        <div style={alerta}>
          <p style={{ ...p13, fontWeight: 'bold', margin: '0 0 6px' }}>
            Por que somos tão rigorosos aqui
          </p>
          <p style={{ ...p13, margin: 0 }}>
            A Polícia Federal cruza os dados de todos os documentos do seu processo — nome, CPF, CNPJ,
            endereço e vínculo familiar entre as partes. Se a PF identificar similaridade entre quem
            emite e quem recebe a nota, ela não trata isso como um erro de anexo: trata como
            <strong> tentativa de burlar a análise para forjar comprovação de ocupação lícita</strong>.
            O efeito prático é grave e permanente — o requerente passa a ser visto como pessoa que
            tentou fraudar a autoridade policial, o processo é indeferido e, na prática,
            <strong> você não consegue mais adquirir arma de fogo</strong>, nem naquele processo nem
            em pedidos futuros. Por isso barramos o documento aqui, antes do protocolo: é a única
            etapa em que o erro ainda pode ser corrigido sem consequência.
          </p>
        </div>

        <div style={passos}>
          <p style={{ ...p13, fontWeight: 'bold', margin: '0 0 6px' }}>Como resolver agora</p>
          {motivo === 'parentesco' ? (
            <>
              <p style={p13}>1. Escolha uma nota emitida para um cliente <strong>sem vínculo familiar</strong> com você.</p>
              <p style={p13}>2. Confira que o endereço do tomador é <strong>diferente</strong> do endereço da sua empresa.</p>
              <p style={p13}>3. Qualquer período serve — nota antiga também é aceita.</p>
              <p style={{ ...p13, margin: 0 }}>4. Baixe o PDF da NFS-e (ou o DANFE da NF-e) e reenvie pelo portal.</p>
            </>
          ) : motivo === 'titular' ? (
            <>
              <p style={p13}>1. Emita ou localize o documento <strong>em seu próprio nome e CPF</strong>.</p>
              <p style={{ ...p13, margin: 0 }}>2. Reenvie pelo portal, no mesmo item do checklist.</p>
            </>
          ) : motivo === 'duplicidade' ? (
            <>
              <p style={p13}>1. Abra o Hub Documental e veja qual exigência ainda está aberta.</p>
              <p style={{ ...p13, margin: 0 }}>2. Envie o documento daquele item — não o que já está aprovado.</p>
            </>
          ) : (
            <>
              <p style={p13}>1. Confira, no item do checklist, exatamente qual documento é pedido.</p>
              <p style={{ ...p13, margin: 0 }}>2. Anexe esse documento e reenvie pelo portal.</p>
            </>
          )}
        </div>
      </div>
    </StatusEmail>
  )
}

export const template = {
  component: Email,
  subject: 'Documento recusado — leia antes de reenviar',
  displayName: 'Documento rejeitado (Hub Documental)',
  previewData: {
    nome: 'Gilson do Nascimento',
    documento: 'Nota fiscal emitida a um cliente',
    arquivo: 'nfse-00000180.pdf',
    motivo: 'parentesco',
    detalhes: [
      { label: 'Tomador na nota', valor: 'RYAN DIAS DO NASCIMENTO' },
      { label: 'Prestador (você / sua empresa)', valor: 'GILSON DO NASCIMENTO 29934113813' },
      { label: 'Endereço do tomador', valor: 'ANTONIO MIGLIORI, 117, JARDIM SAO JOAO' },
      { label: 'Endereço do prestador', valor: 'RUA ANTONIO MIGLIORI, 117, JARDIM SAO JOAO' },
    ],
  },
} satisfies TemplateEntry
