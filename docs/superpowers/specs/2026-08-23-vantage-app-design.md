# Vantage App — Design

Date: 2026-08-23
Status: Approved (via superpowers:brainstorming)
Source: `Downloads\Obsidian sync projects\Scribble World\My Scribbles - Vantage` (Persona, Problem Statement, Solution Overview, Features, Wireframes)

## Deliverable

A real, working web app — not a clickable prototype or a case-study-only artifact. Auth, backend, real Groq API calls for the recommendation engine and Handback artifact, and real persistence.

## Architecture

- **Framework**: Next.js (App Router, TypeScript). One codebase for UI and API routes/server actions, deployed on Vercel.
- **Data & auth**: Supabase — Postgres for all persistence, Supabase Auth for work-email sign-up/login (Feature 1), optional Supabase Storage for Handback artifact downloads.
- **AI**: Groq API (Groq SDK, `llama-3.3-70b-versatile` — Groq's free tier), called **server-side only** (route handlers/server actions) — the API key never reaches the browser.
- **UI**: Tailwind + shadcn/ui, styled to match the wireframe screens (2a–2l) in `Wireframes/Wireframes.dc.html`.

Chosen over two alternatives (best-of-breed Clerk+Neon+Drizzle stack; fully separated frontend/backend deploys) because the driving constraint is solo build, optimize for speed — fewer services and one deploy target beats marginal DX gains or independent scalability right now.

Groq over Claude for the product's own AI calls: this is an MVP, and Groq's free tier covers the three call sites below at no cost. Trade-off, stated plainly: Groq's free tier is rate-limited (requests/tokens per minute) — fine for building and demoing, but worth watching if usage grows, and a candidate to reconsider once the MVP needs to scale past free-tier limits.

## Data model

Single Postgres schema via Supabase, built around one shared "solve" record used by both loops (reactive + practice), since the product's own docs are explicit that both loops share one engine.

- `users` — Supabase Auth (work-email).
- `solves` — one row per problem worked (live client problem or daily practice): raw input text, industry (optional), structured `goal` + `problem_type`, source (`live` | `practice`), guessed category, revealed category, tool class, correct/missed flag, timestamps.
- `takeaways` — Handback artifact per solve: draft text, generated-at timestamp, FK to `solves`.
- `practice_cases` — pool of daily practice scenarios (seeded content, not user-generated) that the proactive loop pulls from.
- `user_settings` — practice difficulty/frequency preferences.

Progress (accuracy, trend, per-category breakdown) is computed from `solves` via derived queries/views — not separate tables.

## Core engine & data flow

One shared "understand → recommend" module, invoked by both loops:

1. **Intake** — raw text (typed/voice-transcribed) + optional industry → stored as a draft `solves` row.
2. **Structure** — one Groq call extracts `goal` + `problem_type` from the raw input → returned as editable fields (Edit affordance) before continuing. Every AI output the user sees is confirmable/correctable, nothing is shown as final without a chance to correct it.
3. **Guess** — pure client-side. User picks a category from a fixed taxonomy list. No AI call — this is the deliberate active-recall step, so it stays instant and doesn't depend on the network.
4. **Reveal** — one Groq call, given the structured problem + the user's guess, returns match/mismatch, why-it-fits, why-alternatives-don't (comparative reasoning), and tool class. Saved to the `solves` row.
5. **Handback** — separate, on-demand Groq call from the session summary screen, triggered only if the user requests the artifact.

## Error handling

Each Groq call site (structure, reveal, handback) is wrapped with a single retry + timeout. Input already persisted in an earlier step is never lost on a later step's failure — only the AI-dependent step shows a retry state. No fallback content is invented on failure. A 429 (rate-limited) response from Groq's free tier is treated the same as any other failure — retry once, then surface the retry state to the user.

## Testing

- **Unit**: prompt-building and response-parsing for each of the three Groq call sites — mock the Groq client, assert correct extraction/shape.
- **Integration**: API routes/server actions against a local Supabase instance (Supabase CLI) — guess-then-reveal round trip, session persistence, progress aggregation queries.
- **Manual QA**: each wireframe screen (2a–2l) walked end-to-end once per feature.

## Deployment

Vercel preview deployments per branch. Supabase project(s) split dev/prod if budget allows, otherwise one project used carefully.

## Open items carried from the vault (not resolved by this spec)

- `Problem Statement.md` in the source vault is flagged stale by its own thought-process log — a corrected version was drafted but never saved. Does not block this build (Persona/Features/Solution Overview are current), but should be reconciled before using the PRD language externally.
- Tool-class tier: Solution Overview says this is decided/in MVP (per the wireframe), but the vault's own MVP Scope note (if it exists) may say otherwise — not independently verified in this session.

(The persona-vs-wireframe "independent consultant" conflict noted in earlier drafts of this spec has since been resolved in the vault — kept firm-employed, wireframe copy updated to "Consultant".)
