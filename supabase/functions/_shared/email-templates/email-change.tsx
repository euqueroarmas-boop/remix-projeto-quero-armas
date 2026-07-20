/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirmação de novo e-mail — Arsenal Inteligente</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>ARSENAL INTELIGENTE</Text></Section>
        <Container style={card}>
          <Heading style={h1}>Confirme seu novo e-mail</Heading>
          <Text style={text}>Olá,</Text>
          <Text style={text}>
            Recebemos um pedido para alterar o e-mail da sua conta no <strong>Arsenal Inteligente</strong> de{' '}
            <strong>{oldEmail}</strong> para <strong>{newEmail}</strong>.
          </Text>
          <Text style={text}>Clique no botão abaixo para confirmar a alteração:</Text>
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button style={button} href={confirmationUrl}>Confirmar novo e-mail</Button>
          </Section>
          <Text style={text}>Se você não solicitou essa alteração, proteja sua conta imediatamente redefinindo sua senha.</Text>
          <Hr style={hr} />
          <Text style={footer}>Arsenal Inteligente — euqueroarmas.com.br</Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#f6f5f1', fontFamily: 'Arial, sans-serif', padding: '24px 0' }
const container = { maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#0a0a0a', padding: '20px 24px', borderRadius: '6px 6px 0 0' }
const brand = { color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, letterSpacing: '0.16em', margin: 0 }
const card = { backgroundColor: '#ffffff', padding: '28px 28px 20px', border: '1px solid #e6e3dc', borderTop: 'none', borderRadius: '0 0 6px 6px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#7A1F2B', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#1a1a1a', lineHeight: '1.6', margin: '0 0 14px' }
const button = { backgroundColor: '#7A1F2B', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '4px', padding: '12px 28px', textDecoration: 'none' }
const hr = { borderColor: '#e6e3dc', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#888', margin: 0, textAlign: 'center' as const }
