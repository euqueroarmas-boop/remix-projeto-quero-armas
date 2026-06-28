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
}
