# Writing good searches

Oslr's search engine accepts plain English. That doesn't mean every plain-English question works equally well. This guide is the short version of what to do, what to avoid, and why.

---

## Start with the role, not the description

Searches that lead with a clinical role — physician, surgeon, NP, PA, RN, CRNA — work better than searches that describe the candidate.

**Better:** *Family medicine physicians in the Mountain West*
**Worse:** *Doctors who like rural medicine*

The search engine is built to extract a clinical role first. If you bury the role in modifiers, you'll get noisier results.

---

## One specialty per search

Combining multiple specialties usually returns a confusing mix. Run them as separate searches and compare.

**Better:** *Interventional cardiologists in Florida* (then a separate search for *Electrophysiologists in Florida*)
**Worse:** *Interventional cardiologists, electrophysiologists, and structural heart cardiologists in Florida*

This is a tradeoff against effort, but it almost always produces cleaner results. Separate searches also let you compare candidate volume across subspecialties.

---

## Be specific about geography, not vague

Oslr handles state, city, metro, and named regions ("the Southeast," "the Mountain West"). It does *not* infer cleverly from vague phrasing.

**Better:** *Hospitalists in Texas, Oklahoma, or Louisiana*
**Worse:** *Hospitalists in the south central area*

Named metros work. State lists work. Vague descriptors get unpredictable results.

---

## Use the actual healthcare term, not the colloquial one

The search engine knows healthcare vocabulary. Use it.

**Better:** *Nurse anesthetists in Atlanta*
**Worse:** *People who put patients to sleep before surgery in Atlanta*

If you're not sure of the right term, the [healthcare recruiting glossary](/resources/glossary) (in the marketing site's resources) covers the common ones.

---

## Don't pile on every requirement at once

A query like *"Senior fellowship-trained interventional cardiologists with structural heart experience in private practice in Florida open to partnership track"* asks too many things at once. The search engine will try to honor every clause, return very few results, and trigger the cascade (which relaxes filters and gives you a wider net than you wanted).

**Better:** Start broad, narrow with the Refine panel.
**Worse:** Cram everything into the initial query.

---

## Watch the parsed filters

After every search, the reasoning panel tells you what Oslr extracted. If it inferred something you didn't intend, fix it before scrolling further:

- Click **Refine** to edit the filter set
- Click the X on any filter chip in the active filter bar to drop that constraint
- Run **New Search** to start over with a different phrasing

A 30-second check of the parsed filters saves 10 minutes of scrolling through wrong results.

---

## Read the banners

Two banners will appear depending on what happened:

### "Geo expanded to metro / state"
Your original geography was too narrow. Oslr widened to a metro or state-level search and ranked everything against your original query. The candidates returned aren't filtered to your original geography — they include the wider area.

If geographic precision matters, your original geography is too narrow. Try a broader original query or accept the metro-level result.

### "[Health system] spans multiple affiliated entities"
Health-system searches automatically expand to include affiliated facilities. A "Mayo Clinic" search includes Mayo's other locations and entities. If you want a single specific facility, narrow by city ("Mayo Clinic in Rochester") or by a more specific entity name ("Mayo Clinic Arizona").

---

## When the search refuses

Two cases:

### "Empty intent"
Your query had no clinical role, specialty, employer, or credential. The fix is to add one. *"People in Nashville"* doesn't work. *"Cardiologists in Nashville"* does.

### "Too broad"
Your query would return more than ~5,000 candidates with no specific role or company. The fix is to narrow — add a specialty, title, geography, or employer.

These guards exist because both empty-intent and too-broad searches produce results that aren't useful. Add specificity.

---

## Things to stop doing

- **Boolean strings.** *"cardiologist AND interventional NOT structural"* doesn't help. Write naturally.
- **Quotation marks.** *"interventional cardiology"* in quotes doesn't change anything. Drop them.
- **Specifying "active NPI" or "currently licensed."** Oslr surfaces NPI numbers where publicly listed but doesn't filter on license-status; the search engine ignores these clauses.
- **PGY-1 / PGY-2 / PGY-3.** Training stage is detected as a category ("resident," "fellow") but not by specific year. Phrases like *"graduating in 2027"* will be treated as a keyword, not a structured filter.

---

## Three patterns that work consistently

### 1. Role + specialty + geography
*Cardiologists in Houston* · *Family medicine physicians in the Mountain West* · *ICU nurses in Atlanta*

### 2. Role + employer
*Spine surgeons at the Mayo Clinic* · *Hospitalists at HCA Healthcare* · *Cardiologists at Cleveland Clinic*

### 3. Training + specialty + geography
*Family medicine residents in Texas* · *Surgical residents at NYU*

These three patterns cover roughly 80% of useful Oslr searches. Start here.

---

## Where to go next

- **[Search](/resources/search)** — the full search guide.
- **[Sourcing healthcare talent](/resources/best-practices/sourcing-healthcare-talent)** — sourcing tactics for specific clinical roles.
- **[Managing your pipeline](/resources/best-practices/managing-pipelines)** — what to do with the candidates you find.

---

*A query you wish worked but doesn't? Email **hello@oslr.health** — that's exactly the kind of feedback that drives our search improvements.*
