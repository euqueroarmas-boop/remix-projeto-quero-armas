/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'

export type StatusTipo = 'critico' | 'alerta' | 'ok'

export interface StatusMeta { label: string; valor: string }

export interface StatusEmailProps {
  status: StatusTipo
  preview?: string
  titulo: string
  texto: string
  meta?: StatusMeta[]
  cta?: { label: string; url: string }
  rodape?: string
}

const CORES: Record<StatusTipo, { cor: string; badgeBg: string; badgeFg: string; label: string }> = {
  critico: { cor: '#8A1828', badgeBg: '#8A1828', badgeFg: '#ffffff', label: 'VENCIDO / CRÍTICO' },
  alerta:  { cor: '#D9A21B', badgeBg: '#D9A21B', badgeFg: '#1a1a1a', label: 'ALERTA' },
  ok:      { cor: '#1F8A4C', badgeBg: '#1F8A4C', badgeFg: '#ffffff', label: 'OK / CONFORME' },
}

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', padding: '32px 0' }
const container = { maxWidth: '560px', margin: '0 auto' }
const header = { padding: '0 4px 12px' }
const brand = { color: '#0a0a0a', fontSize: '12px', fontWeight: 'bold' as const, letterSpacing: '0.24em', margin: 0 }
const card = { backgroundColor: '#ffffff', border: '1px solid #e6e3dc', borderRadius: '6px', overflow: 'hidden' as const }
const topLine = (cor: string) => ({ backgroundColor: cor, height: '4px', lineHeight: '4px', fontSize: '4px' })
const cardBody = { padding: '22px 26px 20px' }
const badgeRow = { textAlign: 'right' as const, margin: '0 0 10px' }
const badgeStyle = (bg: string, fg: string) => ({ display: 'inline-block', padding: '4px 10px', backgroundColor: bg, color: fg, fontSize: '10px', fontWeight: 'bold' as const, letterSpacing: '0.14em', borderRadius: '3px' })
const titulo = { fontSize: '20px', lineHeight: 1.25, fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 10px', textTransform: 'uppercase' as const, letterSpacing: '-0.01em' }
const texto = { fontSize: '14px', color: '#1a1a1a', lineHeight: 1.6, margin: '0 0 18px' }
const metaBox = { backgroundColor: '#f7f6f2', padding: '12px 14px', borderRadius: '4px', margin: '0 0 18px' }
const metaRow = { fontSize: '12px', color: '#1a1a1a', margin: '3px 0', lineHeight: 1.5 }
const metaLabel = { color: '#666', fontWeight: 'bold' as const, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }
const ctaWrap = { textAlign: 'center' as const, margin: '10px 0 6px' }
const btn = (bg: string, fg: string) => ({ backgroundColor: bg, color: fg, fontSize: '13px', fontWeight: 'bold' as const, letterSpacing: '0.08em', borderRadius: '4px', padding: '12px 22px', textDecoration: 'none', textTransform: 'uppercase' as const })
const hr = { borderColor: '#e6e3dc', margin: '20px 0 10px' }
const footer = { fontSize: '11px', color: '#888', margin: 0, textAlign: 'center' as const }

export const StatusEmail = (p: StatusEmailProps) => {
  const c = CORES[p.status]
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{p.preview || p.titulo}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}><Text style={brand}>ARSENAL INTELIGENTE · QUERO ARMAS</Text></Section>
          <Container style={card}>
            <div style={topLine(c.cor)}>&nbsp;</div>
            <Container style={cardBody}>
              <div style={badgeRow}>
                <span style={badgeStyle(c.badgeBg, c.badgeFg)}>{c.label}</span>
              </div>
              <Heading style={titulo}>{p.titulo}</Heading>
              <Text style={texto}>{p.texto}</Text>
              {p.meta && p.meta.length > 0 ? (
                <Section style={metaBox}>
                  {p.meta.map((m, i) => (
                    <Text key={i} style={metaRow}><span style={metaLabel}>{m.label}: </span>{m.valor}</Text>
                  ))}
                </Section>
              ) : null}
              {p.cta ? (
                <Section style={ctaWrap}>
                  <Button style={btn(c.cor, c.badgeFg)} href={p.cta.url}>{p.cta.label}</Button>
                </Section>
              ) : null}
              <Hr style={hr} />
              <Text style={footer}>{p.rodape || 'Arsenal Inteligente — monitoramento contínuo do seu acervo e processos.'}</Text>
            </Container>
          </Container>
        </Container>
      </Body>
    </Html>
  )
}