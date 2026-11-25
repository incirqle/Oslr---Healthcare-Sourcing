import type {} from '../../email-model-types/models.d.ts';
import { generateMessage, GatewayError } from '@lovable.dev/ai-gateway';
import { EMAIL_PATTERNS } from './institution-email.ts';
import { EMAIL_REASONING_PROMPT, EMAIL_REVIEW_PROMPT, parseEmailDecision, type EmailReasoningInput, type EmailReasoningResult } from './institution-reasoning.ts';

export const EMAIL_MODEL = 'anthropic/claude-sonnet-5' as const;
export const EMAIL_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    pattern: { anyOf: [{ type: 'string', enum: [...EMAIL_PATTERNS] }, { type: 'null' }] },
    sharedAcrossRoles: { type: 'boolean' }, sampleIds: { type: 'array', items: { type: 'string' } },
    blockers: { type: 'array', items: { type: 'string' } },
  }, required: ['pattern', 'sharedAcrossRoles', 'sampleIds', 'blockers'],
};

export async function reasonInstitutionEmail(input: EmailReasoningInput, system = EMAIL_REASONING_PROMPT): Promise<EmailReasoningResult> {
  const start = Date.now();
  try {
    const response = await generateMessage({
      model: EMAIL_MODEL, max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: JSON.stringify(input) }],
      output_config: { format: { type: 'json_schema', schema: EMAIL_SCHEMA } },
    }, { signal: AbortSignal.timeout(15000), maxRetries: 0 });
    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const decision = response.stop_reason === 'end_turn' ? parseEmailDecision(JSON.parse(text)) : null;
    return { decision, model: EMAIL_MODEL, elapsedMs: Date.now() - start, requestId: response.id };
  } catch (e) {
    // No replay after an ambiguous timeout; no credentials or evidence in errors.
    return { decision: null, model: EMAIL_MODEL, elapsedMs: Date.now() - start, error: e instanceof GatewayError ? e.code : 'invalid_model_response' };
  }
}

/** Veto-only second opinion on a rule the deterministic election already chose. */
export const reviewInstitutionEmail = (input: EmailReasoningInput) => reasonInstitutionEmail(input, EMAIL_REVIEW_PROMPT);
