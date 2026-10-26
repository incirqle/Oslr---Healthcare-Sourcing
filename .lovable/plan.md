# Oslr Agents: your own researcher, working every night

A premium rebuild of the Bakken/RepGPT agent system for clinical hiring. An agent takes a plain-English brief ("Board-certified pain physicians in the Southwest open to private practice"), shows a small first batch to learn your taste, then brings up to N fresh clinicians every morning, ranked by what you approved and passed.

## What I learned from the blueprint and screenshots

- Flow: brief, calibration batch of 6, learn from every yes/pass with reasons and notes, daily run, morning email, review workspace.
- Learning: tags map to boosts (+15% to +40%) and cuts (-30% to -80%), "skip this town" becomes a hard rule, waiting people are re-ranked instantly, and an AI "taste memo" (favor / ignore / never) steers the next search.
- Daily run: at most one paid search per agent per 24 hours, stops on goal or finish date, pauses after inactivity or repeated empty runs.
- UI pieces: empty-state hero with 3 steps, "Start a new agent" dialog (name, brief, people per day, saving goal, finish date), agent workspace (job progress bar, next search time, chat thread, milestone card, To review / Approved / Passed tabs, chat box to steer), right rail (Today / Looks for / Skips / Timeline), and a two-pane profile with your decision on the right.

## What Oslr gets (premium version)

**1. Agents home** (new "Agents" item in the sidebar, plus cards on Dashboard and inside each Project)
- Agents grouped as Ready for you / Working / Needs attention / Resting, each with a live status dot, today's count, goal ring and next run time.
- First-visit hero in the Oslr dark + mint look, Comfortaa headers, translucent cards, soft spring motion (still for reduced-motion users).

**2. Start an agent**
- Same fields as the reference, plus "Save into project" (pick or create). Every agent belongs to a project, so approved people land in that project's pipeline automatically (keeps Oslr project-centric).
- Brief is read by the existing search engine, so location, specialty and credential handling (including the Southwest fix) is reused, and shown back as chips before you start.

**3. Agent workspace**
- Header: name, status, job progress bar ("5 of 25 saved, finishes Nov 18"), next search time, email updates on/off, pause/resume/close menu.
- Conversation thread with the brief, milestone card (first matches reviewed, next batch, goal), and a chat box to steer ("only private practice owners", "skip Phoenix").
- Review tabs: To review / Approved / Passed. Cards show photo or initials, title, organization logo, location, "why picked" line, liked/passed tag and your note.
- Fast review: Approve / Pass with one tap, reason chips, "Skip everyone in [city]", optional note, keyboard shortcuts (A, P, arrows).
- Right rail: Today, Looks for (your brief chips, "ranks higher" signals with % approved, quotes from your notes), Skips (blocked towns, employers, people passed), Timeline.

**4. Profile view**
- Reuses the Oslr profile (experience/education logos, contact lookup with the current credit rules and "You will not be charged" message) with a "Your decision" side panel and previous/next arrows.

**5. Learning and daily runs**
- Clinical reason tags: Specialty fit, Board certified, Practice owner / partner, Leadership role, Right area, Right career stage; pass reasons: Wrong area, Wrong specialty, Too junior, In training, Wrong practice setting.
- Re-ranking happens instantly in place; taste memo refreshes after each decision with tags or a note.
- One run per agent per day at your chosen hour; shared search limits and caching still apply.

**6. Morning email**
- "5 new matches ready", top 3 people preview, goal bar, one button straight to the agent. Needs an Oslr sending address set up (one-time step in this build).

## Decisions baked in (tell me if any are wrong)
- People per day: 1 to 10 on Starter, default 10 (reference said 25; lower keeps your data costs safe).
- Daily runs only for paying, exempt or unlimited workspaces; beta pass users can create one agent with calibration only.
- No outreach emails to candidates in this build (campaigns stay retired). Contact lookups stay manual and credit-priced.
- Old agent tables from the earlier build are left untouched and unused.

## Technical section

- New tables (with grants + RLS scoped to the workspace via `is_company_member`): `clin_agents` (company_id, project_id, owner, name, brief, parsed_payload, status calibrating|sourcing|paused|completed|closed, per_day, goal, finish_date, run_hour, timezone, next_run_at, last_run_at, empty_runs, taste_memo, email_updates), `clin_agent_pool` (person_id, profile snapshot, base_score, boost, final_score, served_at, decision), `clin_agent_decisions` (append-only: decision, tags[], note, skip_city), `clin_agent_preferences` (weights, negative weights, skip rules), `clin_agent_events`.
- Edge function `clinician-agent` with actions create / decide / roster / steer / pause; reuses `_shared/clinician-engine` parsing, CrustData search, ranking-criteria scoring and run-snapshot cache. Pure learning module `agent-brain.ts` (tag to feature deltas, multiplicative re-rank, skip rules) with tests asserting the +/- ranges and city skips.
- Taste memo and steer replies via Lovable AI Gateway (default model, streamed, error rules for 402/429).
- `agents-tick` edge function on an hourly schedule: single-flight lease, bounded batch, one provider pull per agent per 24h, idempotent pool inserts, pause on credit/limit errors, stop on goal/date, pause after 3 empty runs or 7 days without review.
- Email via Lovable's built-in email sender (domain setup step), digest template in Oslr branding, direct links.
- Frontend: `/agents`, `/agents/:id` routes (replace current redirects), `AgentsHome`, `AgentBriefDialog`, `AgentWorkspace`, `AgentReviewCard`, `AgentRail`, profile reuse from CandidateDrawer; Dashboard "Active agents" strip and Project "Agents" tab. Approve inserts into `candidates` for the agent's project.
- Rules respected: LinkedIn only as badge, no em dashes in UI, no DEI wording, no NPI/privileges, public stats only.
- Record architecture rule in AGENTS.md; update the Oslr Agents memory.
