/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'

export interface ArsenalEmailProps {
  preview?: string
  headline?: string
  saudacao?: string
  intro?: string
  paragrafos?: string[]
  destaques?: Array<{ label: string; valor: string }>
  alerta?: { tipo?: 'warning' | 'success' | 'danger'; titulo?: string; texto: string }
  cta?: { label: string; url: string }
  rodape?: string
}

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
const destaqueRow = { fontSize: '13px', color: '#1a1a1a', margin: '4px 0' }
const destaqueLabel = { color: '#666', fontWeight: 'bold' as const }

const alertaStyles = {
  warning: { bg: '#fef3c7', border: '#fde68a', color: '#92400e' },
  success: { bg: '#dcfce7', border: '#bbf7d0', color: '#166534' },
  danger: { bg: '#fee2e2', border: '#fecaca', color: '#991b1b' },
}

export const ArsenalEmail = (props: ArsenalEmailProps) => {
  const alertaCfg = props.alerta ? alertaStyles[props.alerta.tipo || 'warning'] : null
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{props.preview || props.headline || 'Arsenal Inteligente'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}><Text style={brand}>ARSENAL INTELIGENTE</Text></Section>
          <Container style={card}>
            {props.headline ? <Heading style={h1}>{props.headline}</Heading> : null}
            {props.saudacao ? <Text style={text}>{props.saudacao}</Text> : null}
            {props.intro ? <Text style={text}>{props.intro}</Text> : null}
            {(props.paragrafos || []).map((p, i) => <Text key={i} style={text}>{p}</Text>)}
            {props.destaques && props.destaques.length > 0 ? (
              <Section style={{ backgroundColor: '#f6f5f1', padding: '14px 16px', borderRadius: 4, margin: '8px 0 18px' }}>
                {props.destaques.map((d, i) => (
                  <Text key={i} style={destaqueRow}><span style={destaqueLabel}>{d.label}: </span>{d.valor}</Text>
                ))}
              </Section>
            ) : null}
            {props.alerta && alertaCfg ? (
              <Section style={{ backgroundColor: alertaCfg.bg, border: `1px solid ${alertaCfg.border}`, borderRadius: 6, padding: '12px 14px', margin: '8px 0 18px' }}>
                {props.alerta.titulo ? <Text style={{ margin: 0, fontSize: 13, fontWeight: 'bold', color: alertaCfg.color }}>{props.alerta.titulo}</Text> : null}
                <Text style={{ margin: '4px 0 0', fontSize: 13, color: alertaCfg.color }}>{props.alerta.texto}</Text>
              </Section>
            ) : null}
            {props.cta ? (
              <Section style={{ textAlign: 'center', margin: '24px 0' }}>
                <Button style={button} href={props.cta.url}>{props.cta.label}</Button>
              </Section>
            ) : null}
            <Hr style={hr} />
            <Text style={footer}>{props.rodape || 'Arsenal Inteligente — euqueroarmas.com.br'}</Text>
          </Container>
        </Container>
      </Body>
    </Html>
  )
}