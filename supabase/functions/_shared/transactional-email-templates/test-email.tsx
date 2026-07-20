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
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipientName?: string
  siteUrl?: string
}

const TestEmail = ({ recipientName, siteUrl }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Teste de envio - Arsenal Inteligente</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>ARSENAL INTELIGENTE</Heading>
        <Text style={text}>
          Olá{recipientName ? `, ${recipientName}` : ''}! Este é um e-mail de teste
          enviado pelo sistema através do domínio notify.euqueroarmas.com.br.
        </Text>
        <Text style={text}>
          Se você recebeu esta mensagem, a infraestrutura de e-mails está
          funcionando corretamente.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button style={button} href={siteUrl || 'https://euqueroarmas.com.br'}>
            Acessar o site
          </Button>
        </Section>
        <Text style={footer}>
          Arsenal Inteligente — Soluções jurídicas para CACs.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TestEmail,
  subject: 'Teste de envio - Arsenal Inteligente',
  displayName: 'Teste de envio',
  previewData: { recipientName: 'CAC', siteUrl: 'https://euqueroarmas.com.br' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const h1 = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
  color: '#7A1F2B',
  letterSpacing: '0.08em',
  margin: '0 0 24px',
}
const text = {
  fontSize: '14px',
  color: '#1a1a1a',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const button = {
  backgroundColor: '#7A1F2B',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '4px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#666', margin: '32px 0 0' }
