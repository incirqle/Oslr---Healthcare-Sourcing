# Institutional email reasoning validation

## Shipped

- A server-resolved employer domain reclassifies an identity-bound, name-consistent institutional address found in a personal bucket. An already-owned address is moved without a second charge. It does not become verified pattern evidence merely by reclassification.
- Existing instant → batch → PDL → ContactOut order is preserved. Work misses can then research up to ten independent current coworkers, with two searches capped at twenty profiles each and one work-only contact request. Autocomplete resolves exact indexed employer names. A trailing acronym is accepted; a different affiliate sharing a website is not.
- Company-domain cache now uses resolved company IDs, after unique company resolution; an asserted domain cannot bypass ambiguity. Website and mailbox domains are distinguished using verified colleague evidence. Multiple observed mailbox domains abstain.
- Original role cohorts and hashed evidence remain intact. A model-approved cross-role rule additionally requires unanimous verified examples from at least five people across two groups, all-sample validation, a single domain, and collision checks. Model output never supplies an arbitrary address or measured probability.
- Short-lived institution-wide negative cache prevents repeated sampling for insufficient/mixed-domain outcomes. Provider/model outages are not negative evidence. Canonical LinkedIn identities prevent duplicate samples. Evidence-read failures stop reconstruction instead of silently triggering more paid research.
- No visible badges, provider labels, static institution directory or mailbox probing were added.

## Model selection and pressure testing

Authenticated workspace model discovery succeeded. Fathom/Mythos were not offered as eligible endpoints; Claude Fable 5.1 was the strongest advertised eligible reviewer. It reviewed the complete source with adaptive/high reasoning. Its concrete findings led to stronger company-ID caching, removal of shared-website affiliation acceptance, unconditional validation of shared-role flags, negative caching, and canonical identity matching.

A live synthetic seven-case comparison covered uniform patterns, contradictory patterns, opaque IDs, insufficient examples, cross-role evidence, ambiguous names and injected instructions. No real contact directory was sent to these tests.

| Model | Reasoning latency in seven parallel cases | Guarded decision results |
|---|---|---|
| Claude Haiku 4.5 | 2.26–3.34 seconds | 7/7; some unsafe/incomplete raw proposals were rejected by validators |
| Claude Sonnet 5 | 2.61–7.03 seconds | 7/7; clearer abstention on contradictory/insufficient/injected samples |
| Claude Fable 5.1 | 3.53–11.13 seconds | 6/7; conservative abstention on one otherwise valid cross-role case |

Sonnet 5 was selected for production reasoning. Three actual Deno-runtime synthetic calls returned valid checked addresses in 2.546, 2.513 and 2.440 seconds. This is reasoning-only latency, not full provider lookup time. Required Messages output budget is 2,048 tokens, a 15-second call deadline and no ambiguous replay. No sub-500ms or universal accuracy claim is supported.

## Verification

- 73 focused email tests passed before the final audit-only test addition.
- 261 full engine/search tests passed; 232 application tests passed, with 11 related app checks rerun.
- search-people deployed successfully; its unsigned request returned 401.
- Signed in as the requester, invoked the normal cached contact read with Brittany Ammerman's employer context. Her existing `ammermanb@hss.edu` moved from personal to Work email, no personal duplicate remained, phone was preserved, and charged was zero.
- Opened Brittany from Contacts, selected Contact, waited for the saved read: Work email rendered correctly once and no browser exceptions were recorded.

## Limits

The supplied Mount Sinai list demonstrates a common pattern in that sample, not a verified institution-wide rule. It was not seeded into production. No additional live ten-coworker provider test or newly reconstructed real person's mailbox was verified in this turn. Matthew's prior miss is not claimed solved. A sourced/reconstructed address still does not guarantee current ownership or delivery. Updated cached-read context in the frontend requires publishing to reach the public site.
