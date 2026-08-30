/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to Legendary Everyday ☕</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img
            src="https://legendary-everyday.lovable.app/favicon.png"
            width="48"
            height="48"
            alt="LGD EDY"
            style={logo}
          />
        </Section>
        <Heading style={h1}>You're invited! ☕</Heading>
        <Text style={text}>
          Someone invited you to join{' '}
          <Link href={siteUrl} style={link}>
            <strong>Legendary Everyday</strong>
          </Link>
          . Click below to accept and create your account.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accept Invitation
        </Button>
        <Text style={footer}>
          Wasn't expecting this? No worries, just ignore it.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '24px' }
const logo = { borderRadius: '12px', display: 'inline-block' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  fontFamily: "'Oswald', Arial, sans-serif",
  color: '#2B2B2B',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: '#4C3F3E',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const link = { color: '#DF7489', textDecoration: 'underline' }
const button = {
  backgroundColor: '#DF7489',
  color: '#F6F1E9',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '16px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }
