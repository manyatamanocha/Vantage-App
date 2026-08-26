---
name: Vantage
description: A calm, instrument-panel design system for building AI judgment, one client problem at a time.
colors:
  signal-blue: "#2F6FF5"
  signal-blue-dark: "#3B82F6"
  console-navy: "#13294B"
  canvas: "#DCE8FB"
  background: "#EEF4FD"
  card: "#FFFFFF"
  foreground: "#16233F"
  muted-foreground: "#6B7A99"
  border: "#E1E7F5"
  success: "#2FBE7A"
  destructive: "#E8536B"
  canvas-dark: "#000000"
  background-dark: "#0A0A0C"
  card-dark: "#131418"
  foreground-dark: "#F0F3FA"
typography:
  display:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(24px, 3.4vw, 32px)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  metric:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.06em"
rounded:
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "18px"
  2xl: "20px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "14px"
  lg: "22px"
  xl: "26px"
components:
  button-primary:
    backgroundColor: "{colors.signal-blue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "0 22px"
    height: "46px"
  button-secondary:
    backgroundColor: "#EEF3FC"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 22px"
    height: "46px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
    padding: "26px"
  segmented-active:
    backgroundColor: "{colors.console-navy}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "8px 15px"
---

# Design System: Vantage

## Overview

**Creative North Star: "The Judgment Console"**

Vantage is where a consultant makes a call — not a game, not a toy. The visual system reads like an instrument panel built for confident decisions under time pressure: a deep navy control surface, one disciplined signal-blue accent, flat and precise rather than soft and decorative. Every screen is built around the same act — guess, then reveal — so the interface stays quiet and gets out of the way of that moment.

The palette runs in two registers: a light "New Blue" mode (soft blue-white canvas, white cards, navy ink) for daytime work, and a dark "Black & Blue" mode (true black canvas, near-black cards, the same signal blue turned up in luminance) for a genuine console-at-night feel. Both are locked and share the same structural rules — only the values change.

Confirmed anti-reference: **not** a playful, cartoonish consumer app *as a whole*. Vantage has streaks and quizzes, but they're instrumentation for judgment-building, not gamified decoration — no mascots, no candy colors, no bounce for its own sake, across buttons, inputs, data, and status.

**One deliberate exception — "Bold & Bouncy" option-card links.** The small set of "pick one of two paths" navigation cards (Home's "Let's Solve"/"Quiz time", "Continue where you left off", Practice's two entry cards) run a scoped cartoony treatment: a soft accent-tinted blob behind the icon, an extra-bold heading, a chunky Console Navy pill CTA, and a slight rotate-and-lift on hover. Picked directly by the user from three mocked-up directions (the other two — "Chunky Console" thick-border/hard-shadow, and "Sticker Badges" — were rejected). This lives only on `.panel-link.bold-bounce`; it does not change buttons, inputs, stat tiles, or any other component, and the flat Judgment Console rules below still govern everything else.

**Key Characteristics:**
- One disciplined accent color (Signal Blue) against a navy/white console structure
- Flat by design — depth comes from color and tonal contrast, not shadow layering
- Manrope for anything the eye should land on first (headings, metrics); Inter for everything read in full sentences
- Pill shapes for state and status (segmented controls, badges, chips); rectangular radii for containers and inputs

## Colors

The palette is deliberately narrow: one accent carries almost all color signal, everything else is neutral navy/white/black scaffolding plus three semantic status colors.

### Primary
- **Signal Blue** (`#2F6FF5` light / `#3B82F6` dark): the app's one true accent — primary buttons, active states, links, focus rings, chart lines. It is the color of "this is the answer" and should stay rare enough that when it appears, it means something.

### Secondary
- **Deep Console Navy** (`#13294B`): the control-panel color — active segmented-control pills, dark gradient panels, the badge for "in progress" states. Reads as authority/confirmation next to Signal Blue's "action" role.

### Neutral
- **Canvas** (`#DCE8FB` light / `#000000` dark): the outermost page background, paired with a faint diagonal `--starfield` gradient wash and the centered brain/orbit watermark illustration at low opacity (0.14 light / 0.2 dark with `mix-blend-mode: screen`).
- **Background** (`#EEF4FD` light / `#0A0A0C` dark): the layout background sitting on top of canvas.
- **Card** (`#FFFFFF` light / `#131418` dark): the surface every content block sits on.
- **Foreground** (`#16233F` light / `#F0F3FA` dark): primary text ink.
- **Muted foreground** (`#6B7A99` light / `#8E97A8` dark): secondary text, timestamps, hints.
- **Border** (`#E1E7F5` light / `rgba(240,243,250,0.10)` dark): the only line-weight in the system — 1px, no exceptions.

### Semantic
- **Success** (`#2FBE7A`): correct-guess badges, positive trend deltas, "matched" states.
- **Destructive** (`#E8536B` light / `#F17C86` dark): incorrect-guess badges, negative trend deltas, errors.

### Named Rules
**The One Accent Rule.** Signal Blue is the only color used to mean "act on this." Everything else in the palette is structural (navy, neutral) or purely semantic status (success/destructive) — never decorative color for its own sake.

## Typography

**Display/Heading Font:** Manrope (with `ui-sans-serif, system-ui, sans-serif` fallback)
**Body Font:** Inter (with `ui-sans-serif, system-ui, sans-serif` fallback)

**Character:** Manrope's slightly geometric, confident weight carries every number and headline the eye should land on first — metrics, page titles, section headers. Inter recedes into legible, neutral body text underneath it. The pairing is functional, not expressive: two clean grotesques doing two different jobs, not a personality statement.

### Hierarchy
- **Display** (700, `clamp(24px, 3.4vw, 32px)`, 1.15): page-level `h1`/`.display` — one per screen, `max-width: 30ch`, `text-wrap: balance`.
- **Headline** (700, 21px, 1.2): section/panel titles (`.panel-link h2`).
- **Metric** (750, 44px, 1, `-0.02em`): the one number a screen most wants noticed — accuracy percentage, streak count. `font-variant-numeric: tabular-nums` always, so digits don't shift width as they update live.
- **Body** (400, 15px, 1.6): `.card-text`, `.lede` (max 52ch), form labels and content.
- **Label** (700, 11px, 1.3, `0.06em` uppercase): `.card-label`, `.eyebrow` — the small caps tag above a block that names what it is.

### Named Rules
**The Tabular Numbers Rule.** Any number that updates or is compared against another number (metrics, timers, history timestamps) uses `font-variant-numeric: tabular-nums` — digits never reflow the layout as they change.

## Layout

Content is centered in a constrained column (`max-w-2xl`/`max-w-3xl`), never full-bleed — this is a console you sit in front of, not a marketing canvas that sprawls. Vertical rhythm runs on a small set of gap values (8px tight, 14px default stack, 22–26px section breaks), applied via `gap`/`margin-top` on `.stack`, `.grid-2`, `.compare-grid` rather than one-off spacing. Two-column grids (`.grid-2`, `.compare-grid`, `.cat-grid`) collapse to one column under ~520–560px. The canvas/background split gives every page a two-layer depth even though it's flat: a faint gradient-and-watermark outer canvas, with a slightly different, cleaner background layer for the actual content.

## Elevation & Depth

Flat by design. There is exactly one shadow value in active use (`0 1px 2px hsl(var(--shadow-color) / 0.05)`, a near-invisible contact shadow on cards and inputs) — depth is conveyed through color and tonal layering instead: card-on-background contrast, the navy segmented-control pill sitting on a lighter track, `color-mix()` tints on hover rather than lifted shadows. The one exception is interaction feedback — hover states on `.panel-link.outline` and `.landing-feature-tile` add a slightly stronger shadow (`0 6px 20px…`, `0 14px 28px…`) as a response to that specific state, never at rest.

### Shadow Vocabulary
- **Contact** (`box-shadow: 0 1px 2px hsl(var(--shadow-color) / 0.05)`): default resting shadow for cards, inputs, stat tiles — barely perceptible, just enough to separate a white/near-black card from its background.
- **Hover lift** (`0 6px 20px -10px hsl(var(--shadow-color) / 0.3)` to `0 14px 28px -14px hsl(var(--shadow-color) / 0.25)`): applied only on `:hover`, for interactive cards and outline panel links.

### Named Rules
**The Flat-At-Rest Rule.** Surfaces are flat by default. A stronger shadow appears only as a direct response to hover/interaction state, never as ambient decoration on a static element.

## Shapes

Two radius families, used consistently by role. **Pill** (`999px`) is reserved for state and status: segmented controls, badges, chips, tags, stat pills — anything communicating "this is a mode or a value," not a container. **Scaled radii** (`--radius-sm` 8px → `--radius-2xl` 20px) handle everything else, roughly by size: small controls and inputs at `sm`/`lg` (8–14px), larger containers and cards at `xl`/`2xl` (18–20px). Borders are always 1px, always `var(--border)` — no double borders, no border color other than the one token.

### Named Rules
**The Pill-Means-State Rule.** If a `border-radius: 999px` is used, the element is communicating a mode, status, or selectable state (segmented control, badge, chip, tag). Containers and static content never use a full pill radius.

## Components

Precise and confident: solid fills, crisp 1px borders, minimal ornament. Nothing bounces or glows at rest — motion and glow are reserved for a small number of specific, meaningful moments (the pro-tip bulb's ambient shine, a feedback pop-in on a quiz result, a landing feature tile's hover lift).

### Buttons
- **Shape:** `border-radius: var(--radius-lg)` (14px), 46px height, `0 22px` padding.
- **Primary:** solid Signal Blue fill, white text; hover darkens 6–10% via `color-mix()`.
- **Secondary:** `--secondary` fill (near-white/near-black neutral), foreground text, 1px border.
- **Ghost:** transparent, Signal Blue text, underline on hover, no fixed height.
- **Icon:** 46×46px square variant of secondary; an `aria-pressed="true"` state (e.g. active mic/recording) turns destructive-red with a slow pulse animation — the one button state allowed continuous motion, because it signals "something is live."

### Chips / Badges / Tags
- **Style:** pill radius, small (12–13px) bold text, no border — color communicated entirely through background/text pairing (`success-soft`/`success`, `muted`/`muted-foreground`, `accent2-soft`/`accent2`).
- **State:** selectable variants (`.chip-btn`, `.cat-btn`) show `aria-pressed="true"` as a solid Signal Blue fill; unselected state is a 1px-bordered neutral.

### Cards / Containers
- **Corner Style:** `var(--radius-2xl)` (20px) for cards, `var(--radius-xl)` (18px) for category buttons.
- **Background:** `var(--card)` — pure white light / near-black (`#131418`) dark.
- **Shadow Strategy:** Contact shadow at rest (see Elevation); hover lift only on explicitly interactive cards.
- **Border:** 1px `var(--border)`, always.
- **Internal Padding:** 26px standard (`.card`), 30px for the larger `.panel-link` mode-selector tiles.

### Inputs / Fields
- **Style:** 1px `var(--input)` border, `var(--card)` background, `var(--radius-lg)` (14px), 14×16px padding, contact shadow.
- **Focus:** border shifts to `var(--ring)` (Signal Blue) plus a 3px soft glow ring (`color-mix(... 20%, transparent)`).

### Navigation
- **Segmented control** (`.segmented`): pill-track container, individual pill buttons; the active item is a solid Deep Console Navy pill with white text — the one place Console Navy, not Signal Blue, marks "selected."

### Quiz Ring (signature component)
A 132px circular SVG timer used on quiz screens: an outer progress ring in Signal Blue over a faint tinted track, a navy clock face at center with live tick/hand rendering, and a large tabular-nums number below it. The one place in the system where a fully custom illustrated component carries real product meaning (elapsed time) rather than decoration.

### Option-card links ("Bold & Bouncy", scoped exception)
- **Shape:** `.panel-link.outline.bold-bounce` — a horizontal icon+title+description row, `var(--radius-xl)`, 18×20px padding.
- **Blob:** an absolutely-positioned `.panel-link-blob`, ~84px, `border-radius: 42% 58% 61% 39% / 45% 40% 60% 55%`, Signal Blue at 16% behind the icon, `z-index: 0`, `pointer-events: none`.
- **Icon:** solid Signal Blue fill, white icon, 46px circle — not the soft-tint circle other icon badges use.
- **Heading:** 800 weight (heavier than the standard 700 Headline).
- **CTA:** `.panel-link-cta-pill` — solid Console Navy pill, white 700-weight text, not a plain text link.
- **Motion:** `rotate(-0.6deg) translateY(-3px)` plus a stronger hover shadow on the whole card; the CTA pill scales up slightly in sync. Respects `prefers-reduced-motion`.
- **Where it applies:** Home's two option cards and its "Continue where you left off" card, Practice's two entry cards. Nowhere else.

## Do's and Don'ts

### Do:
- **Do** keep Signal Blue rare — it should mean "the answer" or "act here," not "a nice color to add."
- **Do** use Deep Console Navy for the one "selected/active" state that Signal Blue doesn't already own (segmented controls).
- **Do** use `tabular-nums` on every metric, timer, and comparable number.
- **Do** keep shadows near-invisible at rest; let hover states carry the only real lift.
- **Do** pair Manrope (headings/metrics) with Inter (body) — never introduce a third typeface.

### Don't:
- **Don't** add a second accent color. If something needs to stand out, use Signal Blue, Console Navy, or a semantic status color — not a new hue.
- **Don't** design toward a playful/cartoonish consumer-app look outside the one named "Bold & Bouncy" option-card exception above — streaks, quiz screens, and everything else stay judgment-building instrumentation, not gamified decoration.
- **Don't** default to generic AI-slop gradient blobs or purple/violet AI branding — this palette is blue/navy on purpose, not a stand-in for "AI product colors."
- **Don't** add ambient shadow or glow to a static element — motion/glow is reserved for meaningful state (live recording, a correct-answer pop, the pro-tip bulb).
