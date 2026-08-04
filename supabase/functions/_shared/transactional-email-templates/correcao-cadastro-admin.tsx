/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Row, Column, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

/**
 * Enviado pela equipe Arsenal Inteligente quando corrige manualmente
 * um dado incorreto no cadastro do cliente.
 *
 * Mostra "era → agora" para cada campo corrigido, alerta sobre reprovação
 * da PF por dado errado, e oferece botão de WhatsApp para dúvidas.
 */
interface CampoCorrigido {
  campo: string
  era: string
  agora: string
}

interface Props {
  nome?: string
  campos?: CampoCorrigido[]
  corrigidoEm?: string
  whatsappUrl?: string
  portalUrl?: string
}

const WA = 'https://wa.me/5512978136556?text=Ol%C3%A1!%20Recebi%20o%20e-mail%20sobre%20a%20corre%C3%A7%C3%A3o%20do%20meu%20cadastro%20e%20tenho%20uma%20d%C3%BAvida.'
const PORTAL = 'https://euqueroarmas.com.br/area-do-cliente'

const Email = (p: Props) => {
  const campos: CampoCorrigido[] = Array.isArray(p.campos) ? p.campos : []
  const qtd = campos.length

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Corrigimos {qtd === 1 ? 'um dado' : `${qtd} dados`} do seu cadastro — confira antes que a PF analise seu processo</Preview>
      <Body style={main}>
        <Container style={container}>

          {/* Header */}
          <Section style={header}>
            <Text style={brand}>ARSENAL INTELIGENTE</Text>
          </Section>

          <Container style={card}>
            {/* Badge de atenção */}
            <Section style={{ textAlign: 'center' as const, marginBottom: '16px' }}>
              <Text style={badge}>⚠️ ATENÇÃO — DADO CORRIGIDO</Text>
            </Section>

            <Heading style={h1}>
              {qtd === 1
                ? 'Corrigimos um dado importante do seu cadastro'
                : `Corrigimos ${qtd} dados importantes do seu cadastro`}
            </Heading>

            <Text style={text}>Olá{p.nome ? `, ${p.nome}` : ''},</Text>

            <Text style={text}>
              A equipe Arsenal Inteligente identificou {qtd === 1 ? 'um dado incorreto' : 'dados incorretos'} no seu cadastro e já realizou a correção. Veja abaixo o que mudou:
            </Text>

            {/* Tabela de correções */}
            <Section style={tabelaContainer}>
              {/* Cabeçalho */}
              <Row style={tabelaHeader}>
                <Column style={{ ...col, fontWeight: 'bold' as const, color: '#ffffff' }}>Campo</Column>
                <Column style={{ ...col, fontWeight: 'bold' as const, color: '#ffffff' }}>Era</Column>
                <Column style={{ ...col, fontWeight: 'bold' as const, color: '#ffffff' }}>Agora (correto)</Column>
              </Row>
              {campos.map((c, i) => (
                <Row key={i} style={i % 2 === 0 ? linhaImpar : linhaEven}>
                  <Column style={{ ...col, fontWeight: 'bold' as const, color: '#0a0a0a' }}>{c.campo}</Column>
                  <Column style={{ ...col, color: '#8A1828', textDecoration: 'line-through' as const }}>{c.era || '—'}</Column>
                  <Column style={{ ...col, color: '#1F8A4C', fontWeight: 'bold' as const }}>{c.agora || '—'}</Column>
                </Row>
              ))}
            </Section>

            <Hr style={hr} />

            {/* Alerta PF */}
            <Section style={alertaBox}>
              <Text style={alertaTexto}>
                <strong>Por que isso importa?</strong> A Polícia Federal confere cada dado do seu cadastro
                letra por letra durante a análise do seu processo. Uma informação errada —
                mesmo que pequena — pode gerar exigência ou reprovar o pedido completamente.
                A correção foi feita para proteger o seu processo.
              </Text>
            </Section>

            <Text style={text}>
              Confira os dados atualizados no portal e certifique-se de que todas as informações batem
              com os seus documentos originais:
            </Text>

            {/* CTA portal */}
            <Section style={{ textAlign: 'center' as const, margin: '20px 0 12px' }}>
              <Button style={btnPortal} href={p.portalUrl || PORTAL}>
                Conferir meu cadastro
              </Button>
            </Section>

            <Hr style={hr} />

            {/* Dúvidas — WhatsApp */}
            <Text style={text}>
              Alguma dúvida sobre a correção ou discordou de algo? Fale com a equipe agora mesmo:
            </Text>
            <Section style={{ textAlign: 'center' as const, margin: '12px 0 24px' }}>
              <Button style={btnWA} href={p.whatsappUrl || WA}>
                💬 Falar com o suporte via WhatsApp
              </Button>
            </Section>

            {p.corrigidoEm && (
              <Text style={footer}>Correção registrada em: {p.corrigidoEm}</Text>
            )}
            <Text style={footer}>Arsenal Inteligente — euqueroarmas.com.br</Text>
          </Container>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Corrigimos um dado do seu cadastro — Arsenal Inteligente',
  displayName: 'Correção de cadastro (equipe → cliente)',
  previewData: {
    nome: 'Anthony',
    corrigidoEm: '04/08/2026 às 18:30',
    campos: [
      { campo: 'Título de Eleitor', era: 'ELEITOR(A): ANTHONY NELSON FERREIRA DE SOUZA INSCRIÇÃO: 2887 7178 0183...', agora: '288771780183' },
      { campo: 'Profissão', era: 'Policia Militar', agora: 'Policial Militar' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#f6f5f1', fontFamily: 'Arial, sans-serif', padding: '24px 0' }
const container = { maxWidth: '580px', margin: '0 auto' }
const header = { backgroundColor: '#0a0a0a', padding: '20px 24px', borderRadius: '6px 6px 0 0' }
const brand = { color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, letterSpacing: '0.16em', margin: 0 }
const card = { backgroundColor: '#ffffff', padding: '28px 28px 20px', border: '1px solid #e6e3dc', borderTop: 'none', borderRadius: '0 0 6px 6px' }
const h1 = { fontSize: '18px', fontWeight: 'bold' as const, color: '#7A1F2B', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 12px' }
const hr = { borderColor: '#e6e3dc', margin: '20px 0' }
const footer = { fontSize: '11px', color: '#888', margin: '4px 0' }
const badge = { display: 'inline-block', backgroundColor: '#FEF3C7', color: '#92400E', fontWeight: 'bold' as const, fontSize: '11px', padding: '4px 12px', borderRadius: '100px', letterSpacing: '0.05em', margin: 0 }
const tabelaContainer = { border: '1px solid #e6e3dc', borderRadius: '6px', overflow: 'hidden', margin: '16px 0' }
const tabelaHeader = { backgroundColor: '#0a0a0a', padding: '8px 0' }
const col = { padding: '8px 12px', fontSize: '13px', verticalAlign: 'top' as const, width: '33%' }
const linhaImpar = { backgroundColor: '#ffffff' }
const linhaEven = { backgroundColor: '#f9f8f6' }
const alertaBox = { backgroundColor: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '6px', padding: '12px 16px', margin: '0 0 16px' }
const alertaTexto = { fontSize: '13px', color: '#7C2D12', lineHeight: '1.5', margin: 0 }
const btnPortal = { backgroundColor: '#7A1F2B', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, padding: '12px 28px', borderRadius: '8px', display: 'inline-block' }
const btnWA = { backgroundColor: '#16A34A', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, padding: '12px 28px', borderRadius: '8px', display: 'inline-block' }
