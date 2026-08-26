---
target: /login and /signup (AuthShell redesign)
total_score: 15
max_score: 32
na_heuristics: 7,10
p0_count: 2
p1_count: 2
timestamp: 2026-08-26T05-38-18Z
slug: app-auth-login-page-tsx
---
Method: dual-agent (A: general-purpose design review · B: general-purpose detector/browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good bones (`isPending`→"Working…", `role="alert"`/`role="status"`), docked for unclear tab focus state |
| 2 | Match System / Real World | 2 | Shared `AuthForm` leaks signup-only copy ("At least 8 characters") and `autoComplete="current-password"` onto login too |
| 3 | User Control and Freedom | 1 | No "Forgot password?" link anywhere in `app/(auth)/` — a wrong-password user hits a hard dead end |
| 4 | Consistency and Standards | 1 | `role="tablist"` wrapper around plain `<Link>`s carrying `aria-pressed` — declared as ARIA tabs, doesn't implement the pattern |
| 5 | Error Prevention | 2 | Native `minLength`/`type="email"` validation present; undermined by the autocomplete bug above |
| 6 | Recognition Rather Than Recall | 3 | Fields labeled and visible, no memory burden |
| 7 | Flexibility and Efficiency | n/a | Not a meaningful axis for a two-field auth form |
| 8 | Aesthetic and Minimalist Design | 1 | Pitch panel (badge + 34px title + lede + 4-feature list on a gradient+glow background) is heavy for a screen whose only job is collecting email/password |
| 9 | Error Recovery | 2 | Structurally correct (`role="alert"`, soft-destructive box); `--destructive-soft` unset in `.dark` — likely washed out in dark mode |
| 10 | Help and Documentation | n/a | Not applicable to a login/signup form |
| **Total** | | **15/32** | **Poor (47%)** |

*(Heuristics 7 and 10 scored n/a — genuinely inapplicable to a two-field auth surface.)*

## Design Specificity Verdict

**Fails specificity.** This reads as a generic SaaS split-screen auth pattern with Vantage's color tokens dropped in, not a screen authored for "the Judgment Console."

**LLM assessment:** The tell is `.auth-pitch`'s diagonal gradient plus a static 420px radial-gradient glow blob (`app/globals.css:455`, `:458-467`) — precisely the "AI-slop gradient blob" and "ambient glow on a static element" that `DESIGN.md`'s Overview and Don'ts sections name and prohibit by name. The system's own vocabulary for depth (flat tonal layering, the existing `--starfield` wash, the watermark illustration already defined at `globals.css:67-69`) was available and unused; a new decorative element was invented instead. Compounding this, the hero title reads **"Vantage AI"** (`auth-shell.tsx:26`) while the rest of the app brands itself simply **"Vantage"** (`components/site-nav.tsx:30`) — a branding slip that leans directly into the generic-AI-product framing the anti-reference disavows. The `.auth-pitch-badge` is also a Pill-Means-State Rule violation: a decorative marketing slogan in a pill, when pills are reserved for state/status.

**Deterministic scan:** `detect.mjs --json` on the six in-scope files returns `[]` (exit 0) under the project's current config — but that's a config-suppression artifact, not a clean bill of health. Re-running with `--no-config` surfaces 3 `bounce-easing` findings (all `cubic-bezier(0.34, 1.56, 0.64, 1)`), of which one (`globals.css:483`, `.auth-feature-item`) is inside the auth surface, used at `whats-inside.tsx:37`. It's suppressed by a waiver dated 2026-08-25 whose stated reason ("a one-shot celebratory reveal… PartyPopper/Heart icon") describes the *quiz feedback popup* (line 424), not this staggered list-entrance animation — a scope mismatch worth a human decision, not a hard violation on its own. No other rule fired on `login/page.tsx`, `signup/page.tsx`, `auth-shell.tsx`, or `auth-form.tsx` under either mode.

**Visual overlays:** Not available — no browser automation tool (Playwright/chromium-cli/etc.) and no `puppeteer` dependency exist in this environment, so neither screenshots nor the `detect.js` live-injection overlay could run. Both assessments independently confirmed this and fell back to a curl liveness check (`/login` and `/signup` both return 200). This critique is therefore a code-level read, not a rendered-pixel read — treat the P0 findings below as high-confidence (they're structural CSS/markup facts, not framing judgment calls) but ask a human to eyeball the actual render before signing off.

## Overall Impression

The redesign is more disciplined than the code it replaced in a few specific ways (see What's Working) but the pitch panel — the one part of the screen with the most creative latitude — defaulted to the single visual pattern DESIGN.md was written to rule out: a gradient-and-glow SaaS hero. That's very likely the concrete source of "looks bad": it's not a broken component, it's a genre mismatch between "calm instrument panel" and "eager landing page," landing on a screen whose whole job is to be the *first* proof that positioning is real. The single biggest opportunity is replacing that one hero background with the system's own flat/navy/watermark vocabulary — a small, bounded change with outsized effect on first impression.

## What's Working

1. **`AuthForm` consolidation.** One shared component for login/signup with error/confirmation states now actually wired to `useActionState` (previously silently swallowed) is a real, non-cosmetic improvement worth preserving through any further redesign.
2. **`WhatsInside`'s single-accent fix.** Collapsing four decorative per-feature hues down to one Signal-Blue-on-navy treatment for every icon is a correct, deliberate application of the One Accent Rule — the one place this diff visibly followed DESIGN.md rather than defaulting to convention.
3. **Input focus ring.** The focus-visible glow on form inputs (`border-color: var(--ring)` + soft ring) is the system's one sanctioned glow-on-interaction, applied correctly to an actual interactive element rather than a static one.

## Priority Issues

**[P0] Static gradient + radial-glow hero violates the Flat-At-Rest Rule and the system's core anti-reference**
- **Why it matters:** DESIGN.md names this exact pattern twice independently as forbidden ("flat by design," "don't add ambient shadow or glow to a static element," "don't default to generic AI-slop gradient blobs"). It's the single element most likely responsible for the "looks bad" reaction, because it puts the most genre-defining part of the identity (a marketing hero) in the one place the system explicitly rejects that genre.
- **Fix:** Replace `.auth-pitch`'s gradient + `::before` glow blob with a solid Deep Console Navy fill (or a restrained two-stop gradient, no radial glow) and reuse the existing `--starfield` wash / watermark illustration already defined for the rest of the app instead of a bespoke decorative element.
- **Suggested command:** `/impeccable quieter`

**[P0] Mobile layout puts the marketing pitch before the task, on both login and signup**
- **Why it matters:** Under 860px, `.auth-shell` stacks column-first with `.auth-pitch` (badge, headline, lede, 4-item feature list) ahead of `.auth-formpanel` in DOM order. Every mobile visitor — including a returning user just trying to log in — scrolls through a full pitch before reaching the email field. This is the single worst experience in the flow for the Casey/mobile persona and a direct cognitive-load violation (single-focus, one-thing-at-a-time).
- **Fix:** On mobile, collapse the pitch to a compact brand strip (wordmark + one line, no feature list) or reorder so the form renders first, especially on `/login` where the full pitch content is least relevant to a returning user.
- **Suggested command:** `/impeccable adapt`

**[P1] `autoComplete="current-password"` hardcoded for signup too**
- **Why it matters:** The shared `AuthForm` (`auth-form.tsx:54`) doesn't branch by mode, so password managers get told to autofill an *existing* saved password on signup instead of offering to generate a new one — a functional annoyance, not cosmetic.
- **Fix:** Pass `autoComplete` (and the placeholder text) as a prop from `login/page.tsx` / `signup/page.tsx` instead of hardcoding it inside the shared form.
- **Suggested command:** `/impeccable harden`

**[P1] No password-recovery path anywhere in the auth flow**
- **Why it matters:** Nielsen heuristic 3 (user control and freedom). A user who forgets or mistypes their password on `/login` has no escape — re-signup will presumably fail since the account exists. This is one of the first things a stress-testing user will hit.
- **Fix:** Add a "Forgot password?" link near the password field. If a full recovery flow is out of MVP scope, that should be a deliberate, documented decision rather than a silent gap.
- **Suggested command:** `/impeccable harden`

**[P2] Mode-switcher declares ARIA tabs but doesn't implement them**
- **Why it matters:** `auth-shell.tsx:36-42` wraps plain `<Link>` elements (real navigation) in `role="tablist"`, and gives them `aria-pressed` — neither `role="tab"`, `aria-selected`, nor arrow-key roving tabindex exist. Screen-reader users get a control that announces as a tab widget but doesn't behave like one.
- **Fix:** Either drop `role="tablist"`/`aria-pressed` and treat these as plain nav links (they do navigate to different URLs, so this is the honest fix), or fully implement the ARIA APG tabs pattern if tab semantics are actually wanted.
- **Suggested command:** `/impeccable audit`

**[P3] Several semantic color tokens (`--destructive-soft` and others) unset in `.dark`**
- **Why it matters:** The login error banner uses `bg-destructive-soft`, which is defined only under `:root` and never redefined for `.dark` — it will likely render as a washed-out pale-pink box against a near-black card in dark mode, in exactly the state (a failed login) where legibility matters most. Pre-existing gap in `globals.css`, surfaced by this diff.
- **Fix:** Audit `.dark` for every semantic token defined in `:root` and add the missing dark equivalents.
- **Suggested command:** `/impeccable harden`

## Persona Red Flags

**Jordan (first-timer, signup):** Lands on a screen titled "Vantage AI" (inconsistent with the product's actual name, "Vantage," used elsewhere in the app) inside a glowing gradient hero — the exact generic-AI-startup first impression the design system exists to avoid. The first three seconds work against the "calm instrument panel, not a toy" positioning.

**Riley (stress-tester):** Immediately tries "I forgot my password" and hits a dead end (no recovery link). Also tries switching login↔signup via keyboard/screen reader and hits the broken tab semantics (P2) — announced as a tab widget, behaves as plain links.

**Casey (mobile):** On `/login` specifically, scrolls past an entire marketing pitch (badge, headline, lede, 4-feature list) — irrelevant to a returning user — before reaching two form fields. The single worst mobile moment in the flow.

## Minor Observations

- Confirmation message ("Account created…") uses `bg-accent`/`text-accent-foreground` (light-blue informational tint) rather than `--success` (green) — arguably fine as "informational" vs. "success," but worth a deliberate call rather than a default.
- `.auth-pitch-title` hardcodes `font-size: 34px` instead of the tokenized `--display` scale (`clamp(24px, 3.4vw, 32px)`), so it's larger than the system's own display size and doesn't scale down on small viewports the way `.display`/`h1.display` does elsewhere.
- Feature-list icon background and badge background both use ad hoc `rgba(255,255,255,0.12)` rather than a token — a small "not quite using the system" signal, low stakes on its own.
- The suppressed `bounce-easing` waiver on `.auth-feature-item` (Assessment B) is worth a deliberate re-read — its stated justification describes a different component (the quiz feedback popup), not this list-entrance stagger.

## Questions to Consider

- Does `/login` need the full pitch panel at all — a returning user has already been sold, so why re-run the signup pitch every time someone logs in?
- Is "Vantage AI" the intended product name, or a slip that never got reconciled with the rest of the app's "Vantage" branding?
- DESIGN.md names gradient blobs and ambient glow as the anti-reference by name — was DESIGN.md consulted as a generative constraint while building this hero, or only checked after the fact? The colors used are on-brand (navy/blue, not purple); the *treatment* is still the forbidden pattern.
