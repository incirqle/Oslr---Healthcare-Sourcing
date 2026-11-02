import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Text, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
function TeamInvite({ companyName, acceptUrl }: { companyName: string; acceptUrl: string }) {
  return <Html><Head /><Body><Container><Heading>Join {companyName} on Oslr</Heading><Text>You have been invited to your team's clinical sourcing workspace.</Text><Link href={acceptUrl}>Accept invitation</Link><Text>Sign in or create an account using the email address this invitation was sent to.</Text></Container></Body></Html>
}
export const template = { component: TeamInvite, subject: (d: Record<string, unknown>) => `Join ${d.companyName} on Oslr`, displayName: 'Team invitation' } satisfies TemplateEntry