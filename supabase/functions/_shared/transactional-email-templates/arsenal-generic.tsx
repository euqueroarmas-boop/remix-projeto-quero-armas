/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

/**
 * Template genérico usado como shim pela edge function send-smtp-email.
 * Aceita HTML arbitrário e envolve no shell Arsenal Inteligente.
 */
interface Props { subject?: string; html?: string }

const main = { backgroundColor: '#f6f5f1', fontFamily: 'Arial, sans-serif', padding: '24px 0' }
const container = { maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#0a0a0a', padding: '20px 24px', borderRadius: '6px 6px 0 0' }
const brand = { color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, letterSpacing: '0.16em', margin: 0 }
const card = { backgroundColor: '#ffffff', padding: '28px 28px 20px', border: '1px solid #e6e3dc', borderTop: 'none', borderRadius: '0 0 6px 6px' }
const hr = { borderColor: '#e6e3dc', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#888', margin: 0, textAlign: 'center' as const }

const Email = (p: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{p.subject || 'Arsenal Inteligente'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>ARSENAL INTELIGENTE</Text></Section>
        <Container style={card}>
          <div dangerouslySetInnerHTML={{ __html: p.html || '' }} />
          <Hr style={hr} />
          <Text style={footer}>Arsenal Inteligente — euqueroarmas.com.br</Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => String(d?.subject || 'Arsenal Inteligente'),
  displayName: 'Genérico (shim SMTP)',
  previewData: { subject: 'Notificação Arsenal', html: '<p>Conteúdo dinâmico.</p>' },
} satisfies TemplateEntry