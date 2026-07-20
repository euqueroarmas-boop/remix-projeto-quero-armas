/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nome?: string
  linkPagamento?: string
  valor?: string; venceuEm?: string; diasAtraso?: string;
}

const Email = (props: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Pagamento em atraso</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>ARSENAL INTELIGENTE</Text></Section>
        <Container style={card}>
          <Heading style={h1}>Cobrança em atraso</Heading>
          <Text style={text}>Olá{props.nome ? `, ${props.nome}` : ''},</Text>
          <Text style={text}>Identificamos que sua cobrança está em atraso. Para evitar a suspensão do serviço, regularize o pagamento o quanto antes.</Text>
          <Text style={text}><strong>Valor:</strong> R$ {props.valor}<br/><strong>Venceu em:</strong> {props.venceuEm}<br/><strong>Dias em atraso:</strong> {props.diasAtraso}</Text>
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button style={button} href={props.linkPagamento || 'https://euqueroarmas.com.br'}>Regularizar agora</Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>Arsenal Inteligente — euqueroarmas.com.br</Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Pagamento em atraso',
  displayName: 'Cobrança em atraso',
  previewData: { nome: 'CAC' },
} satisfies TemplateEntry

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
