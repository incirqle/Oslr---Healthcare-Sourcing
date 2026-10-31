/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props { name?: string; email?: string; company?: string; page?: string }

const DemoRequest = ({ name, email, company, page }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${name ?? 'Someone'} from ${company ?? 'a company'} wants a demo`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New Oslr demo request</Heading>
        <Text style={text}><b>Name:</b> {name ?? '-'}</Text>
        <Text style={text}><b>Email:</b> {email ?? '-'}</Text>
        <Text style={text}><b>Company:</b> {company ?? '-'}</Text>
        <Text style={muted}>Sent from {page ?? 'the website'}. They were shown your booking calendar next.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DemoRequest,
  subject: (d: Record<string, any>) => `New Oslr demo request: ${d.name ?? ''} (${d.company ?? ''})`,
  displayName: 'Owner demo request alert',
  to: 'steven@pitchsink.com',
  previewData: { name: 'Jane Doe', email: 'jane@hospital.org', company: 'Mercy Health', page: '/pricing' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }
const container = { padding: '24px 28px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#14181f', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#14181f', lineHeight: '1.5', margin: '0 0 6px' }
const muted = { fontSize: '13px', color: '#6b7280', margin: '14px 0 0' }
