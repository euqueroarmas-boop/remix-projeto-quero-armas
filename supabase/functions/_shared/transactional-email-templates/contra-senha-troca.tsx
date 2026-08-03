/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props { nome?: string; codigo?: string }

const Email = (props: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Contra-senha para trocar sua senha</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>ARSENAL INTELIGENTE</Text></Section>
        <Container style={card}>
          <Heading style={h1}>Contra-senha de confirmação</Heading>
          <Text style={text}>Olá{props.nome ? `, ${props.nome}` : ''},</Text>
          <Text style={text}>
            Recebemos um pedido para <strong>trocar a senha</strong> da sua conta. Para confirmar que é você mesmo,
            informe a contra-senha abaixo na tela de segurança. Ela expira em 10 minutos.
          </Text>
          <Section style={{ textAlign: 'center', backgroundColor: '#0a0a0a', padding: '18px', borderRadius: 4, margin: '12px 0 20px' }}>
            <Text style={{ color: '#fff', fontSize: 28, letterSpacing: '0.4em', fontWeight: 'bold', margin: 0 }}>{props.codigo}</Text>
          </Section>
          <Text style={text}>
            Se não foi você quem pediu, <strong>ignore este e-mail</strong> e encerre as sessões ativas em
            Configurações → Segurança da conta.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>Arsenal Inteligente — euqueroarmas.com.br</Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Contra-senha para trocar sua senha',
  displayName: 'Contra-senha (troca de senha)',
  previewData: { nome: 'CAC', codigo: '482913' },
} satisfies TemplateEntry

const main = { backgroundColor: '#f6f5f1', fontFamily: 'Arial, sans-serif', padding: '24px 0' }
const container = { maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#0a0a0a', padding: '20px 24px', borderRadius: '6px 6px 0 0' }
const brand = { color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, letterSpacing: '0.16em', margin: 0 }
const card = { backgroundColor: '#ffffff', padding: '28px 28px 20px', border: '1px solid #e6e3dc', borderTop: 'none', borderRadius: '0 0 6px 6px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#7A1F2B', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#1a1a1a', lineHeight: '1.6', margin: '0 0 14px' }
const hr = { borderColor: '#e6e3dc', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#888', margin: 0, textAlign: 'center' as const }