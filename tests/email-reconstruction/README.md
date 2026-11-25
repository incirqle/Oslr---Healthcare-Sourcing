# Institutional email pressure-test lab

This lab is not imported by Oslr and is not deployed. It creates unconfirmed hypotheses, not customer contacts. No production contact records, contact billing, search or Agents logic are changed.

## Run locally (maintainer reference)

```sh
python3 -m unittest discover -s tests/email-reconstruction -p 'test_*.py' -v
python3 tests/email-reconstruction/live.py --phase all
```

The second command replays captured private responses under `/tmp/email-reconstruction-live`. It makes no provider requests. Missing recordings fail instead of silently fetching.

Live research requires `--live` and the existing server-side `CRUSTDATA_API_KEY`. Do not put credentials in fixtures, command arguments or reports. Keep identifiable results under `/tmp`, not the repository or public assets. The lab uses the provider REST API, not an MCP transport.

Supported live phases are `identify`, `web`, `targeted`, and `colleagues`. Web phases support bounded `--start`/`--stop` slices. Explicit `--live --phase all` covers the original 36 searches and colleague samples; targeted exception searches are a separate phase. Do not delete the ledger to repeat paid trials.

## Spend controls

- Maximum 75 provider credits; no CLI option can raise it.
- File lock prevents concurrent runners using the same ledger.
- Reservation is written before each request and survives restarts; uncertain requests do not automatically resubmit.
- Each request uses a closed endpoint/body allowlist. Web calls request one standard source/page. Colleague calls request only work emails, with `verified: true`, for at most three people.
- Failed requests are not automatically retried. Repeated requests use the recording and cost nothing further.
- Starting/ending account balance and `x-credits-used` are recorded separately; shared account activity can affect the balance delta.
- An unexpected cost halts further live requests. The configured account rate/price snapshot was inspected before the November 25 run; review current prices before any new live campaign.
- Separate directories are separate campaigns, not a global provider spending limit. Never use multiple directories to bypass the authorized campaign budget.

## Proof boundaries

- Names, surname collisions, opaque IDs, aliases and multiple affiliations do not become known facts through permutation generation.
- Pattern learning needs independent people in the exact organization/domain/cohort and recent evidence. Source duplication and multiple aliases are not extra colleagues.
- Leave-one-person-out evaluation excludes every alias of the held-out person from training.
- Role buckets and manually supplied institutional domains are experimental routing hypotheses, not a complete institutional relationship graph.
- Official web pages and provider-reported addresses are different evidence sources. Extraction counts do not establish ownership, recency, mailbox existence or deliverability.
- MX is domain-level routing only. SMTP/catch-all acceptance cannot confirm the named person's ownership; no live SMTP probes or test emails are sent.
- Unknown situations abstain. Even the strongest eligibility label is `eligible_not_guaranteed`, never “100% verified.”

See `docs/email-reconstruction-pressure-test-2026-11-25.md` for actual results and production-readiness blockers.