
## Remove the filter chip bar entirely

You're right — it adds noise without value. The reasoning panel already says "Parsed your query / Expanded to related terms" and the **Refine** link opens the full `FilterEditor` modal where users can actually inspect and tune every filter. The chip bar duplicates that information in a more confusing way.

## What changes

- **Delete** `ActiveFilterBar` rendering in `src/pages/SearchPage.tsx` (the in-flight block around lines 379–385).
- **Delete** the zero-result "Remove [filter]" suggestion block (lines ~408–425). Replace with a simpler message: "No matches. Open **Refine** to loosen your filters." linking to the existing FilterEditor.
- **Keep** the condensed filter summary inside the reasoning panel (`filterSummary` prop on `AgentReasoningPanel`) — it's a single line of plain text, not a row of chips, so it doesn't create the same confusion.
- **Keep** `classifyFilters` and the `ActiveFilterBar` component file for now (unused but cheap); we can prune in a follow-up if nothing else imports them.

## Files touched

- `src/pages/SearchPage.tsx` — remove the `<ActiveFilterBar>` block, remove the zero-result chip grid, remove the `handleRemoveActiveFilter` handler and the `activeFilters` derivation if no longer used.

## Net result

A cleaner results view: reasoning panel up top → results list → pagination. All filter editing happens through the existing **Refine** button, which is the right single source of truth.
