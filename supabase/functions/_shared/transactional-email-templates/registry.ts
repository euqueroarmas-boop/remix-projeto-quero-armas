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

// Alertas operacionais Arsenal Inteligente (mockup — sem trigger automático ainda)
import { template as filiacaoVencida } from './filiacao-vencida.tsx'
import { template as filiacaoVencimento } from './filiacao-vencimento.tsx'
import { template as habitualidadeInsuficiente } from './habitualidade-insuficiente.tsx'
import { template as habitualidadePrazoCritico } from './habitualidade-prazo-critico.tsx'
import { template as autorizacaoCompraVencimento } from './autorizacao-compra-vencimento.tsx'
import { template as autorizacaoCompraSemCraf } from './autorizacao-compra-sem-craf.tsx'
import { template as crafInconsistente } from './craf-inconsistente.tsx'
import { template as armaSemCraf } from './arma-sem-craf.tsx'
import { template as gteInconsistente } from './gte-inconsistente.tsx'
import { template as exigenciaPfPrazo } from './exigencia-pf-prazo.tsx'
import { template as exigenciaPfVencida } from './exigencia-pf-vencida.tsx'
import { template as documentoIncompativelProcesso } from './documento-incompativel-processo.tsx'
import { template as riscoJanelaRenovacaoCr } from './risco-janela-renovacao-cr.tsx'
import { template as municaoLimiteAlerta } from './municao-limite-alerta.tsx'
import { template as acervoInconsistente } from './acervo-inconsistente.tsx'
import { template as acervoConforme } from './acervo-conforme.tsx'

// Habitualidade — 12 novos alertas (mockup visual — NÃO conectados a motor ainda)
import { template as habitualidadeProgressoNivel } from './habitualidade-progresso-nivel.tsx'
import { template as habitualidadeQuaseNivel } from './habitualidade-quase-nivel.tsx'
import { template as habitualidadeProntoMudancaNivel } from './habitualidade-pronto-mudanca-nivel.tsx'
import { template as habitualidadeProntoPorCompeticao } from './habitualidade-pronto-por-competicao.tsx'
import { template as habitualidadeServicoSugerido } from './habitualidade-servico-sugerido.tsx'
import { template as habitualidadePendenteValidacaoIa } from './habitualidade-pendente-validacao-ia.tsx'
import { template as habitualidadeDocumentoRejeitado } from './habitualidade-documento-rejeitado.tsx'
import { template as habitualidadeRiscoManterNivel } from './habitualidade-risco-manter-nivel.tsx'
import { template as habitualidadeRiscoRebaixamento } from './habitualidade-risco-rebaixamento.tsx'
import { template as habitualidadeNivelConfirmado } from './habitualidade-nivel-confirmado.tsx'
import { template as habitualidadePorTipoArmaIncompleta } from './habitualidade-por-tipo-arma-incompleta.tsx'
import { template as habitualidadeNovoDocumentoProcessado } from './habitualidade-novo-documento-processado.tsx'

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

  // Alertas operacionais (mockup visual — NÃO conectados a triggers automáticos)
  'filiacao-vencida': filiacaoVencida,
  'filiacao-vencimento': filiacaoVencimento,
  'habitualidade-insuficiente': habitualidadeInsuficiente,
  'habitualidade-prazo-critico': habitualidadePrazoCritico,
  'autorizacao-compra-vencimento': autorizacaoCompraVencimento,
  'autorizacao-compra-sem-craf': autorizacaoCompraSemCraf,
  'craf-inconsistente': crafInconsistente,
  'arma-sem-craf': armaSemCraf,
  'gte-inconsistente': gteInconsistente,
  'exigencia-pf-prazo': exigenciaPfPrazo,
  'exigencia-pf-vencida': exigenciaPfVencida,
  'documento-incompativel-processo': documentoIncompativelProcesso,
  'risco-janela-renovacao-cr': riscoJanelaRenovacaoCr,
  'municao-limite-alerta': municaoLimiteAlerta,
  'acervo-inconsistente': acervoInconsistente,
  'acervo-conforme': acervoConforme,

  // Habitualidade — 12 novos alertas (mockup — sem motor ainda)
  'habitualidade-progresso-nivel': habitualidadeProgressoNivel,
  'habitualidade-quase-nivel': habitualidadeQuaseNivel,
  'habitualidade-pronto-mudanca-nivel': habitualidadeProntoMudancaNivel,
  'habitualidade-pronto-por-competicao': habitualidadeProntoPorCompeticao,
  'habitualidade-servico-sugerido': habitualidadeServicoSugerido,
  'habitualidade-pendente-validacao-ia': habitualidadePendenteValidacaoIa,
  'habitualidade-documento-rejeitado': habitualidadeDocumentoRejeitado,
  'habitualidade-risco-manter-nivel': habitualidadeRiscoManterNivel,
  'habitualidade-risco-rebaixamento': habitualidadeRiscoRebaixamento,
  'habitualidade-nivel-confirmado': habitualidadeNivelConfirmado,
  'habitualidade-por-tipo-arma-incompleta': habitualidadePorTipoArmaIncompleta,
  'habitualidade-novo-documento-processado': habitualidadeNovoDocumentoProcessado,
}
