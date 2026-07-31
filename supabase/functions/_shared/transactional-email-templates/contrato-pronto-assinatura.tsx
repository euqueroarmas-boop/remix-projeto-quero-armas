/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nome?: string
  linkAssinatura?: string
  contrato?: string;
}

const Email = (props: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Contrato pronto para assinatura — assine pelo gov.br ou certificado ICP-Brasil</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>ARSENAL INTELIGENTE</Text></Section>
        <Container style={card}>
          <Heading style={h1}>Contrato pronto para assinar</Heading>
          <Text style={text}>Olá{props.nome ? `, ${props.nome}` : ''},</Text>
          <Text style={text}>Seu contrato foi gerado e está aguardando sua assinatura digital.</Text>
          <Text style={text}><strong>Contrato:</strong> {props.contrato}</Text>
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button style={button} href={props.linkAssinatura || 'https://euqueroarmas.com.br'}>Assinar contrato</Button>
          </Section>
          <Hr style={hr} />

          <Heading as="h2" style={h2}>Como assinar — passo a passo</Heading>
          <Text style={text}>Você pode assinar de duas formas oficiais, ambas com validade jurídica plena (MP 2.200-2/2001):</Text>

          {/* Passo a passo ditado pelo usuário em 31/07/2026. É o caminho REAL
              do assinador: sem os "Atalhos gov.br" o cliente não encontra a
              tela de assinatura, e sem o item do código reenviado ele desiste
              quando o SMS não chega. Este mesmo texto aparece no portal. */}
          <Heading as="h3" style={h3}>Opção 1 — Assinatura gov.br (recomendada, gratuita)</Heading>
          <Text style={step}><strong>1.</strong> Clique no botão <strong>“Assinar contrato”</strong> acima. Você será direcionado ao contrato do seu serviço. Clique em <strong>Baixar contrato</strong> e salve ele no seu celular ou computador.</Text>
          <Text style={step}><strong>2.</strong> Faça login com seu <strong>CPF e senha gov.br</strong>. Se ainda não tem conta, crie em <a href="https://sso.acesso.gov.br" style={link}>sso.acesso.gov.br</a>.</Text>
          <Text style={step}><strong>3.</strong> Sua conta gov.br precisa ser <strong>nível Prata ou Ouro</strong>. Se estiver Bronze, eleve pelo app <strong>gov.br</strong> (biometria facial via CNH digital ou banco credenciado).</Text>
          <Text style={step}><strong>4.</strong> Clique ou toque em <strong>“Atalhos gov.br”</strong> e, na janela que se abrirá, escolha <strong>“Assinar Documentos”</strong>. Toque novamente no redirecionamento <strong>“Assinar documentos”</strong> para ser levado ao <a href="https://assinador.iti.br" style={link}>assinador.iti.br</a>.</Text>
          <Text style={step}><strong>5.</strong> Clique ou toque em <strong>“+ Escolher arquivo”</strong>, navegue até a pasta onde salvou e anexe o documento no assinador.</Text>
          <Text style={step}><strong>6.</strong> Apenas toque ou clique no botão azul <strong>“Avançar”</strong>.</Text>
          <Text style={step}><strong>7.</strong> A assinatura será colada automaticamente na última página do contrato — <strong>mantenha ela onde está</strong>. Clique em <strong>“Assinar”</strong>, toque novamente em <strong>“Assinar”</strong> e autorize com o código enviado por SMS ou pela notificação no app gov.br.</Text>
          <Text style={step}><strong>8.</strong> Se o código não chegar pelo app nem por SMS, abra <strong>somente o aplicativo gov.br</strong> no celular, volte à tela de autorização e toque em <strong>reenviar código</strong> — ele chega na hora.</Text>
          <Text style={step}><strong>9.</strong> Copie e cole o código no campo de assinatura e clique no botão azul <strong>“Autorizar”</strong>.</Text>
          <Text style={step}><strong>10.</strong> Clique ou toque em <strong>“Baixar arquivo assinado”</strong> e salve no seu celular ou computador.</Text>

          <Heading as="h3" style={h3}>Opção 2 — Certificado Digital ICP-Brasil (A1 ou A3)</Heading>
          <Text style={step}><strong>1.</strong> Tenha em mãos seu certificado <strong>e-CPF A1</strong> (arquivo .pfx/.p12) ou <strong>A3</strong> (token/smartcard) já instalado no computador.</Text>
          <Text style={step}><strong>2.</strong> Clique em <strong>“Assinar contrato”</strong> e escolha a opção <strong>“Assinar com Certificado ICP-Brasil”</strong>.</Text>
          <Text style={step}><strong>3.</strong> Selecione o certificado, informe a <strong>senha do certificado</strong> (PIN) e confirme.</Text>
          <Text style={step}><strong>4.</strong> O PDF assinado (padrão PAdES) ficará disponível para download imediato e também será enviado por e-mail.</Text>

          <Text style={note}><strong>Atenção:</strong> não imprima, edite, altere nem refaça o arquivo original baixado — nem mesmo reimprimir em PDF. A assinatura perde a validade e o documento não será aceito no Arsenal Inteligente. Envie o arquivo original baixado.</Text>

          <Text style={note}>Precisa de ajuda? Responda este e-mail ou fale com a equipe pelo WhatsApp no rodapé do site. Não compartilhe sua senha gov.br nem o PIN do certificado com ninguém.</Text>

          <Hr style={hr} />
          <Text style={footer}>Arsenal Inteligente — euqueroarmas.com.br</Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Contrato pronto para assinatura',
  displayName: 'Contrato pronto para assinar',
  previewData: { nome: 'CAC' },
} satisfies TemplateEntry

const main = { backgroundColor: '#f6f5f1', fontFamily: 'Arial, sans-serif', padding: '24px 0' }
const container = { maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#0a0a0a', padding: '20px 24px', borderRadius: '6px 6px 0 0' }
const brand = { color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, letterSpacing: '0.16em', margin: 0 }
const card = { backgroundColor: '#ffffff', padding: '28px 28px 20px', border: '1px solid #e6e3dc', borderTop: 'none', borderRadius: '0 0 6px 6px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#7A1F2B', margin: '0 0 16px' }
const h2 = { fontSize: '16px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '4px 0 10px' }
const h3 = { fontSize: '14px', fontWeight: 'bold' as const, color: '#7A1F2B', margin: '18px 0 8px' }
const text = { fontSize: '14px', color: '#1a1a1a', lineHeight: '1.6', margin: '0 0 14px' }
const step = { fontSize: '13px', color: '#1a1a1a', lineHeight: '1.55', margin: '0 0 8px' }
const link = { color: '#7A1F2B', textDecoration: 'underline' }
const note = { fontSize: '12px', color: '#555', lineHeight: '1.5', margin: '16px 0 0', fontStyle: 'italic' as const }
const button = { backgroundColor: '#7A1F2B', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '4px', padding: '12px 28px', textDecoration: 'none' }
const hr = { borderColor: '#e6e3dc', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#888', margin: 0, textAlign: 'center' as const }
