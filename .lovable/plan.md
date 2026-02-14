

# MedSource AI — Healthcare Recruiter Sourcing Platform

A modern SaaS platform for healthcare recruiters to source doctors, nurses, and other medical professionals using natural language search powered by People Data Labs.

**Design:** Dark sidebar + light content area (similar to Clay/Apollo), clean and professional.

---

## 1. Authentication & Company Workspaces
- Full signup/login flow using Supabase Auth (email + password)
- Company workspaces: users belong to an organization
- Role-based access: **Admin**, **Recruiter**, **Viewer**
  - **Admin**: Manage team members, billing, all projects & campaigns
  - **Recruiter**: Create/edit searches, projects, campaigns
  - **Viewer**: Read-only access to shared projects and candidate lists
- User profiles with name, avatar, and company association

## 2. Natural Language Search (Core Feature)
- AI-powered search bar where users type queries like *"Registered nurses in Dallas with 5+ years experience at HCA Healthcare"*
- Translates natural language into People Data Labs API queries via a Supabase Edge Function
- Search results displayed in a rich, sortable/filterable table showing:
  - Name, title, current employer, location
  - **Salary range** (from PDL data)
  - **Average tenure** at each position (calculated from PDL job history)
  - Company/hospital details (enriched from PDL company data)
- Filters panel for refining results by specialty, location, experience, employer, etc.

## 3. Project Lists & Candidate Management
- Create named projects (e.g., "ICU Nurses - Q1 Hiring")
- Save candidates from search results into project lists
- Add notes and tags to candidates within a project
- Track candidate status (New → Contacted → Interested → Hired)
- Shared across the company workspace based on user roles

## 4. Company & Hospital Enrichment
- Automatically pull company/hospital data from PDL's Company API when viewing a candidate
- Display company profile cards with: size, industry, location, founding year
- Show how many candidates in your lists work at each company

## 5. Find Similar Profiles
- "Find Similar" button on any candidate profile
- Uses PDL fields (company, title, skills, location) to find matching professionals
- Results can be saved directly into project lists

## 6. Email Campaigns (Basic)
- Create email templates with merge fields (first name, title, company, etc.)
- Build recipient lists from project candidates
- Preview personalized emails before sending
- Export campaign lists as CSV for use in external email tools (Mailchimp, Outreach, etc.)

## 7. Dashboard & Analytics
- Overview dashboard showing:
  - Total candidates sourced
  - Active projects and their statuses
  - Recent searches
  - Team activity feed
- Per-project stats: candidates added, contacted, response tracking

## 8. Layout & Navigation
- **Dark sidebar** with navigation: Dashboard, Search, Projects, Campaigns, Company Directory, Team Settings
- **Light content area** with clean cards and tables
- Responsive design for desktop-first use
- Collapsible sidebar with icon-only mini mode

