/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const COPY: Record<string, { subject: string; heading: string; body: string; cta: string }> = {
  cancel_scheduled: {
    subject: 'Your Oslr plan is set to end',
    heading: 'Your plan is set to end',
    body: 'Your plan stays active, with your credits, until the end of this billing period. Changed your mind? You can keep your plan from Billing at any time.',
    cta: 'Open Billing',
  },
  payment_failed: {
    subject: "Your Oslr payment didn't go through",
    heading: "Your payment didn't go through",
    body: "We couldn't charge your card for Oslr. Please update your payment details in Billing so your searches and credits keep working.",
    cta: 'Update payment details',
  },
  refund: {
    subject: 'Your Oslr refund is on its way',
    heading: 'Your refund is on its way',
    body: "We've issued your refund. It usually shows on your statement within 5 to 10 business days.",
    cta: 'Open Oslr',
  },
}

interface Props { kind?: string }

const pick = (kind?: string) => COPY[kind ?? ''] ?? COPY.payment_failed

const BillingNotice = ({ kind }: Props) => {
  const c = pick(kind)
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{c.heading}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>Oslr</Text>
          <Heading style={h1}>{c.heading}</Heading>
          <Text style={text}>{c.body}</Text>
          <Button style={button} href="https://oslr.health/credits">{c.cta}</Button>
          <Text style={footer}>Questions? Reply to hello@oslr.health.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: BillingNotice,
  subject: (d: Record<string, any>) => pick(d.kind).subject,
  displayName: 'Billing notice',
  previewData: { kind: 'payment_failed' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }
const container = { padding: '24px 28px' }
const brand = { fontSize: '18px', fontWeight: 'bold' as const, color: '#3f8f6a', margin: '0 0 16px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#14181f', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 24px' }
const button = { backgroundColor: '#a9d9c2', color: '#0f2a1d', fontSize: '15px', fontWeight: 'bold' as const, borderRadius: '10px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '28px 0 0' }
