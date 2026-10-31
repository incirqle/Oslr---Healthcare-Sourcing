/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props { title?: string; details?: string }

const BillingAlert = ({ title, details }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{title ?? 'Billing update'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{title ?? 'Billing update'}</Heading>
        <Text style={text}>{details ?? 'A billing event needs your attention.'}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BillingAlert,
  subject: (d: Record<string, any>) => `[Oslr billing] ${d.title ?? 'Billing update'}`,
  displayName: 'Owner billing alert',
  to: 'hello@oslr.health',
  previewData: { title: 'Refund issued', details: 'Workspace example refunded $129.00 (full, credits removed).' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }
const container = { padding: '24px 28px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#14181f', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#6b7280', lineHeight: '1.5', margin: 0 }
