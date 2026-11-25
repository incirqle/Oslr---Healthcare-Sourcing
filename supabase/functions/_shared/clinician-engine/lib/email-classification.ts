import { emailMatchesName } from './contact-waterfall.ts';
import { normalizeDomain, normalizeEmail } from './institution-email.ts';

// An address already sourced for this identity may be misfiled. This does not
// verify deliverability and never creates pattern-learning evidence by itself.
export function employerEmail(emails: readonly string[], domainValue: string | null | undefined, name: string | null | undefined): string | null {
  const domain = normalizeDomain(domainValue);
  if (!domain || !name || ['gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','aol.com'].includes(domain)) return null;
  const matches = [...new Set(emails.map(normalizeEmail).filter((e): e is string => !!e && e.split('@')[1] === domain && emailMatchesName(e, name)))];
  return matches.length === 1 ? matches[0] : null;
}
