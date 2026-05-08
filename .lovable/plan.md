## Plan: Add uploaded articles to Resources

Overwrite 5 markdown files in `src/content/resources/` with the full uploaded content. No component, manifest, routing, or hub changes. Remaining 11 articles keep their "Content coming." placeholders.

### Files to write

| Target file | Source upload |
|---|---|
| `src/content/resources/search.md` | `search.md` (172 lines) |
| `src/content/resources/projects.md` | `projects.md` (123 lines) |
| `src/content/resources/campaigns.md` | `campaigns.md` (158 lines) |
| `src/content/resources/analytics.md` | `analytics.md` |
| `src/content/resources/best-practices/writing-good-searches.md` | `writing-good-searches.md` (132 lines) |

### Skipped

- `index.md` — hub stays as the existing component grid (per your answer).
- 11 other articles — left as `# Title\n\nContent coming.` placeholders until you upload them.

### Verification

Read each written file back to confirm full content landed and the article route still resolves via the existing `MD_FILES` glob in `ResourceArticle.tsx`.
