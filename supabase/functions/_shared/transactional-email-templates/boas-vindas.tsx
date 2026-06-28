/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nome?: string
  portalUrl?: string
  
}

const Email = (props: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Bem-vindo à Quero Armas</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>QUERO ARMAS</Text></Section>
        <Container style={card}>
          <Heading style={h1}>Bem-vindo!</Heading>
          <Text style={text}>Olá{props.nome ? `, ${props.nome}` : ''},</Text>
          <Text style={text}>Sua conta foi confirmada e está pronta para uso. Faça seu primeiro acesso e explore o portal.</Text>
          
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button style={button} href={props.portalUrl || 'https://euqueroarmas.com.br'}>Acessar portal</Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>Quero Armas — euqueroarmas.com.br</Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Bem-vindo à Quero Armas',
  displayName: 'Bem-vindo!',
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
