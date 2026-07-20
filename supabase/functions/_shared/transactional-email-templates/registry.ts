import { template as testEmail } from './test-email.tsx'
import { template as boasVindas } from './boas-vindas.tsx'
import { template as credenciaisPortal } from './credenciais-portal.tsx'
import { template as senhaAlterada } from './senha-alterada.tsx'
import { template as loginSuspeito } from './login-suspeito.tsx'
import { template as otpCliente } from './otp-cliente.tsx'
import { template as cobrancaGerada } from './cobranca-gerada.tsx'
import { template as pagamentoConfirmado } from './pagamento-confirmado.tsx'
import { template as pagamentoAtrasado } from './pagamento-atrasado.tsx'
import { template as assinaturaCancelada } from './assinatura-cancelada.tsx'
import { template as falhaCartao } from './falha-cartao.tsx'
import { template as contratoProntoAssinatura } from './contrato-pronto-assinatura.tsx'
import { template as contratoAssinado } from './contrato-assinado.tsx'
import { template as contratoRecusado } from './contrato-recusado.tsx'
import { template as orcamentoRecebido } from './orcamento-recebido.tsx'
import { template as orcamentoResposta } from './orcamento-resposta.tsx'
import { template as ticketSuporte } from './ticket-suporte.tsx'
import { template as redefinicaoSenha } from './redefinicao-senha.tsx'
import { template as clienteJaTemConta } from './cliente-ja-tem-conta.tsx'
import { template as acessoLiberadoPortal } from './acesso-liberado-portal.tsx'
import { template as novaContratacaoAdmin } from './nova-contratacao-admin.tsx'
import { template as documentacaoCompleta } from './documentacao-completa.tsx'
import { template as processoProntoProtocolar } from './processo-pronto-protocolar.tsx'
import { template as vencimentoDocumento } from './vencimento-documento.tsx'
import { template as prazoProcessual } from './prazo-processual.tsx'
import { template as gteAlertaCliente } from './gte-alerta-cliente.tsx'
import { template as gteAlertaEquipe } from './gte-alerta-equipe.tsx'
import { template as exameVencimento } from './exame-vencimento.tsx'
import { template as arsenalPremiumRenovacao } from './arsenal-premium-renovacao.tsx'
import { template as arsenalPremiumSuspenso } from './arsenal-premium-suspenso.tsx'
import { template as eventoMontandoPasta } from './evento-montando-pasta.tsx'
import { template as eventoDocumentoRecebido } from './evento-documento-recebido.tsx'
import { template as eventoTodosDocumentosRecebidos } from './evento-todos-documentos-recebidos.tsx'
import { template as eventoEmVerificacao } from './evento-em-verificacao.tsx'
import { template as eventoProntoProtocolo } from './evento-pronto-protocolo.tsx'
import { template as eventoEnviadoOrgao } from './evento-enviado-orgao.tsx'
import { template as eventoStatusOrgao } from './evento-status-orgao.tsx'
import { template as arsenalGeneric } from './arsenal-generic.tsx'

export interface TemplateEntry {
  // deno-lint-ignore no-explicit-any
  component: (props: any) => unknown
  subject: string | ((data: Record<string, unknown>) => string)
  displayName?: string
  previewData?: Record<string, unknown>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'test-email': testEmail,
  // Conta & Acesso
  'boas-vindas': boasVindas,
  'credenciais-portal': credenciaisPortal,
  'senha-alterada': senhaAlterada,
  'login-suspeito': loginSuspeito,
  'otp-cliente': otpCliente,
  // Financeiro
  'cobranca-gerada': cobrancaGerada,
  'pagamento-confirmado': pagamentoConfirmado,
  'pagamento-atrasado': pagamentoAtrasado,
  'assinatura-cancelada': assinaturaCancelada,
  'falha-cartao': falhaCartao,
  // Contratos
  'contrato-pronto-assinatura': contratoProntoAssinatura,
  'contrato-assinado': contratoAssinado,
  'contrato-recusado': contratoRecusado,
  // Operacional
  'orcamento-recebido': orcamentoRecebido,
  'orcamento-resposta': orcamentoResposta,
  'ticket-suporte': ticketSuporte,
  // Acesso / conta
  'redefinicao-senha': redefinicaoSenha,
  'cliente-ja-tem-conta': clienteJaTemConta,
  'acesso-liberado-portal': acessoLiberadoPortal,
  // Internos / equipe
  'nova-contratacao-admin': novaContratacaoAdmin,
  'processo-pronto-protocolar': processoProntoProtocolar,
  'gte-alerta-equipe': gteAlertaEquipe,
  // Cliente — processo
  'documentacao-completa': documentacaoCompleta,
  // Alertas / vencimentos
  'vencimento-documento': vencimentoDocumento,
  'prazo-processual': prazoProcessual,
  'gte-alerta-cliente': gteAlertaCliente,
  'exame-vencimento': exameVencimento,
  'arsenal-premium-renovacao': arsenalPremiumRenovacao,
  'arsenal-premium-suspenso': arsenalPremiumSuspenso,
  // Eventos de andamento (qa-notify-event)
  'evento-montando-pasta': eventoMontandoPasta,
  'evento-documento-recebido': eventoDocumentoRecebido,
  'evento-todos-documentos-recebidos': eventoTodosDocumentosRecebidos,
  'evento-em-verificacao': eventoEmVerificacao,
  'evento-pronto-protocolo': eventoProntoProtocolo,
  'evento-enviado-orgao': eventoEnviadoOrgao,
  'evento-status-orgao': eventoStatusOrgao,
  // Shim genérico (compatibilidade send-smtp-email)
  'arsenal-generic': arsenalGeneric,
}
