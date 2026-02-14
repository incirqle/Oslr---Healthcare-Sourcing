

# Design Polish: Clay/Apollo-Inspired SaaS Look

The current codebase already has the dark sidebar + light content area foundation with the right color tokens. This plan refines the visual details to match the polished, modern SaaS aesthetic of tools like Clay and Apollo.

## What Changes

### 1. Auth Page Enhancement
- Add a subtle gradient or pattern to the left side of the auth page (split-screen layout like Apollo's login)
- Add a tagline/feature highlights on the left panel
- Tighten card styling with softer shadows and refined spacing

### 2. Sidebar Refinements
- Add subtle hover transitions and active state indicator (left border accent bar on active item, like Clay)
- Add a search/command palette shortcut hint in the sidebar
- Refine spacing and icon sizing for a tighter, more professional feel

### 3. Dashboard Cards Polish
- Add subtle gradient borders or hover lift effects on stat cards
- Use colored icon backgrounds (circular badges) instead of plain icons
- Add a welcome banner at the top with the user's name

### 4. Search Page Enhancement
- Make the search bar more prominent with a larger input, subtle glow/ring on focus
- Add suggested search chips below the search bar (e.g., "Nurses in Texas", "Cardiologists")
- Better empty state illustration

### 5. Global Design Tokens
- Slightly adjust border radius to 0.625rem for a softer look
- Add subtle card hover states globally (translate-y and shadow transition)
- Ensure consistent 4px/8px spacing grid across all components

### 6. Top Header Bar
- Add breadcrumb navigation showing current page name
- Add a global search trigger (Cmd+K style) in the header
- Add notification bell placeholder icon

## Technical Details

Files to modify:
- `src/index.css` -- Add utility classes for card hover effects, subtle animations
- `src/components/AppLayout.tsx` -- Enhanced header with breadcrumbs, search trigger
- `src/components/AppSidebar.tsx` -- Active state accent bar, refined hover styles
- `src/pages/Auth.tsx` -- Split-screen layout with feature panel
- `src/pages/Dashboard.tsx` -- Welcome banner, enhanced stat cards with icon badges
- `src/pages/SearchPage.tsx` -- Prominent search bar with suggestion chips
- `tailwind.config.ts` -- Adjusted border radius, add box-shadow utilities

No database or backend changes needed -- this is purely a frontend visual polish pass.

