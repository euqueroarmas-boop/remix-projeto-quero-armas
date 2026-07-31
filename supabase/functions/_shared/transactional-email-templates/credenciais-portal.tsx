/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  nome?: string
  portalUrl?: string
  loginEmail?: string; senhaProvisoria?: string;
}

const Email = (props: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Bem-vindo à nossa família — seu acesso ao Arsenal Inteligente</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>ARSENAL INTELIGENTE</Text></Section>
        <Container style={card}>
          <Heading style={h1}>Bem-vindo à nossa família</Heading>
          <Text style={text}>Olá{props.nome ? `, ${props.nome}` : ''},</Text>
          <Text style={text}>A partir de agora, você faz parte da nossa família.</Text>
          <Text style={text}>
            Criamos o seu acesso ao <strong>Arsenal Inteligente</strong>, o ambiente onde você poderá acompanhar seus processos,
            documentos, prazos, pendências e atualizações importantes com mais clareza, segurança e organização.
          </Text>
          <Text style={text}>
            A ideia é simples: você não precisa ficar tentando lembrar o que falta, quando vence ou onde está cada documento.
            O Arsenal Inteligente foi criado para cuidar dessa parte com você, mantendo tudo em um só lugar e ajudando nossa
            equipe a conduzir seu atendimento com mais precisão.
          </Text>
          <Text style={text}>Para acessar pela primeira vez, use as credenciais abaixo:</Text>
          <Section style={credentialsBox}>
            <Text style={{ ...text, margin: '4px 0' }}><strong>E-mail:</strong> {props.loginEmail}</Text>
            <Text style={{ ...text, margin: '4px 0' }}><strong>Senha temporária:</strong></Text>
            <Text style={passwordBox}>{props.senhaProvisoria}</Text>
          </Section>
          <Text style={text}>
            Copie e cole a senha temporária no primeiro acesso. Por segurança, antes de carregar qualquer informação do portal,
            você será direcionado para criar uma nova senha pessoal.
          </Text>
          <Text style={text}>
            <strong>Importante:</strong> se você acessar usando sua conta Google ou Apple, não será necessário trocar essa senha temporária.
          </Text>
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button style={button} href={props.portalUrl || 'https://euqueroarmas.com.br'}>Entrar no Arsenal Inteligente</Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>Arsenal Inteligente — sua documentação, seus processos e seus prazos sob controle.</Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Bem-vindo à nossa família — seu acesso ao Arsenal Inteligente',
  displayName: 'Bem-vindo à nossa família',
  previewData: { nome: 'CAC' },
} satisfies TemplateEntry

const main = { backgroundColor: '#f6f5f1', fontFamily: 'Arial, sans-serif', padding: '24px 0' }
const container = { maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#0a0a0a', padding: '20px 24px', borderRadius: '6px 6px 0 0' }
const brand = { color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, letterSpacing: '0.16em', margin: 0 }
const card = { backgroundColor: '#ffffff', padding: '28px 28px 20px', border: '1px solid #e6e3dc', borderTop: 'none', borderRadius: '0 0 6px 6px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#7A1F2B', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#1a1a1a', lineHeight: '1.6', margin: '0 0 14px' }
const credentialsBox = { backgroundColor: '#f6f5f1', padding: '14px 18px', borderRadius: 4, margin: '8px 0 18px' }
const passwordBox = { margin: '6px 0 2px', padding: '10px 12px', backgroundColor: '#ffffff', border: '1px solid #e6e3dc', borderRadius: 4, fontFamily: 'Menlo, Consolas, monospace', fontSize: '15px', fontWeight: 'bold' as const, color: '#7A1F2B', letterSpacing: '0.04em' }
const button = { backgroundColor: '#7A1F2B', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '4px', padding: '12px 28px', textDecoration: 'none' }
const hr = { borderColor: '#e6e3dc', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#888', margin: 0, textAlign: 'center' as const }
