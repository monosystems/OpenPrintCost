# OpenPrintCost — Design System & UI Review

Status: reviewed against the **popular-web-designs** skill (Linear, Supabase,
Sentry, Raycast) on 2026-10-24.

Scope: the desktop UI (Tauri + React + Tailwind CSS 4). This document records
the visual language that the implementation now follows, the deliberate
deviations from the reference sites, and the open gaps that are **not**
visual-system work.

---

## 1. Verdict

The UI is no longer a generic Tailwind dark theme. It has a coherent
desktop-tool visual language:

- near-black, blue-tinted canvas with three surface levels
- translucent white borders instead of solid slate borders
- Inter for UI, JetBrains Mono for technical values
- a compact 11 px uppercase label voice and a 24 px page-title voice
- one brand accent (blue) plus one result accent (teal)
- border-defined depth, with shadows reserved for overlays
- dense tables, a sticky result panel, and a fixed sidebar

The skill templates are marketing sites. Their **systems** were translated
for a dense desktop application; their page compositions were not copied.

**Scorecard**

| Criterion | Result | Notes |
|---|---|---|
| Colour system & surfaces | Pass | Luminance stacking, one accent per role |
| Typography | Pass | Inter + JetBrains Mono, tabular numerals |
| Spacing & layout | Pass | 8 px grid, sidebar, two-column workspace |
| Component consistency | Pass | Buttons, fields, checkboxes, tables, modals, toasts |
| Depth & borders | Pass | Border-defined depth; shadows only for overlays |
| Data density | Pass | Tables with search/sort, KPI result panel |
| Responsive behaviour | Pass (desktop) | Min window 1024 px; mobile is out of scope |
| Motion | Pass (minimal) | Colour transitions; reduced-motion respected |
| Accessibility | **Partial** | Contrast, focus, labels pass; focus trap/axe open |
| Documentation | Pass | This file |

---

## 2. Reference Systems

| Reference | Adopted | Adapted for OpenPrintCost | Not adopted |
|---|---|---|---|
| **Linear** | Near-black canvas, luminance-stepped surfaces, translucent borders, one accent, 6 px controls, 8–12 px cards | Indigo accent → brand blue/teal from the logo; display tracking relaxed for a tool | 64–72 px marketing display type, large hero sections |
| **Supabase** | Border-defined depth, no decorative shadows, technical uppercase labels, restrained weights | Source Code Pro → JetBrains Mono; pill CTAs → 6 px desktop controls | Pill primary CTAs, marketing gradients |
| **Sentry** | Data-dense dashboards, uppercase micro-labels, strong hierarchy | Purple/lime identity → brand blue/teal | Purple surfaces, lime CTAs, illustration-driven hero |
| **Raycast** | Desktop shell, sidebar, near-black blue canvas, compact controls, focus clarity | Raycast red → brand blue; macOS shadow stacks → borders + overlay shadows | Marketing key-cap illustrations, red accent |

**Rule of thumb:** copy the *system* (colour roles, type scale, spacing,
borders, component hierarchy), never the *marketing composition*.

---

## 3. Design Tokens

All tokens live in [`src/styles.css`](src/styles.css) under `@theme`.
Components use semantic utilities (`bg-surface`, `text-ink-muted`,
`border-line`, …), not raw palette names.

### 3.1 Colour

| Token | Value | Role |
|---|---|---|
| `--color-canvas` | `#060a12` | Page / scroll container |
| `--color-surface` | `#0b1220` | Sidebar, cards, table shell |
| `--color-raised` | `#111a2b` | Controls, popovers, secondary buttons |
| `--color-raised-hover` | `#17233a` | Hover state for raised controls |
| `--color-field` | `rgba(255,255,255,0.04)` | Input surface, lifts off any parent |
| `--color-field-hover` | `rgba(255,255,255,0.06)` | Hover state for inputs |
| `--color-line` | `rgba(255,255,255,0.08)` | Standard card border / divider |
| `--color-line-strong` | `rgba(255,255,255,0.14)` | Inputs, active borders, secondary buttons |
| `--color-ink` | `#eef2f7` | Primary text |
| `--color-ink-muted` | `#9aa7b8` | Secondary text, labels |
| `--color-ink-faint` | `#7a8a9f` | Metadata, table headers, placeholders |
| `--color-brand` | `#0070f0` | Primary action, links, focus |
| `--color-brand-hover` | `#0062d6` | Primary hover |
| `--color-brand-soft` | `#07203f` | Active nav, info toast, summary row |
| `--color-brand-ink` | `#7cc0ff` | Text on brand-soft |
| `--color-accent` | `#00b080` | Final total, success |
| `--color-accent-soft` | `#062a22` | Success toast / accent surfaces |
| `--color-danger` | `#f87171` | Errors, destructive text |
| `--color-danger-soft` | `#2a0f12` | Error banner, destructive surfaces |
| `--color-warning` | `#fbbf24` | Failure-rate badge, caution |
| `--color-warning-soft` | `#2a1c05` | Warning surfaces |
| `--color-focus` | `#4da3ff` | Global focus outline |

**Accent rules**

- **Brand blue** is for the one primary action per screen, active navigation,
  links, and focus.
- **Teal** is only for the final result total and success feedback.
- **Warning** is for the failure-rate badge and caution messages.
- **Danger** is for errors and destructive actions; row deletes are ghost
  buttons, not filled red blocks.
- No other chromatic colours. Slate/sky/emerald utilities are not used in
  components.

### 3.2 Typography

| Role | Font | Size / line-height | Weight | Tracking |
|---|---|---|---|---|
| Page title | Inter Variable | 24 / 32 px | 600 | −0.025em |
| KPI / result total | Inter Variable | 30 / 36 px | 600 | normal, tabular |
| Panel / setup heading | Inter Variable | 16 / 24 px | 600 | normal |
| Result group title | Inter Variable | 14 / 20 px | 600 | normal |
| Body | Inter Variable | 14 / 20 px | 400 | normal |
| Section label | Inter Variable | 11 / 16 px | 600 | +0.08em, uppercase |
| Table header | Inter Variable | 11 / 16 px | 600 | +0.08em, uppercase |
| Field label | Inter Variable | 11 / 16 px | 600 | +0.08em, uppercase |
| Sidebar title | Inter Variable | 16 / 24 px | 600 | normal |
| Sidebar subtitle | Inter Variable | 11 / 16 px | 400 | normal |
| Mono / technical | JetBrains Mono Variable | 11–12 px | 400–500 | normal |

- `font-variant-numeric: tabular-nums` is enabled on `body`.
- Prices, quantities, hours and percentages are right-aligned in tables and
  inputs.
- Body text is 14 px in the application chrome; the 16 px base remains for
  reading contexts and empty-state copy.
- Maximum heading weight is 600. 700 is not used.

### 3.3 Spacing, radii, elevation

- Base unit: **8 px**.
- Card padding: 16–20 px. Section gap: 24 px. Page padding: 24 px.
- Control height: 36 px. Icon button: 32 px.
- Radius: **6 px controls**, **12 px cards/modals/toasts**, full pills for
  badges only.
- Depth: 1 px translucent border on cards; no drop shadows on cards.
  Shadows are reserved for modals, dropdowns and the sticky/toast overlays.
- Focus: 2 px `--color-focus` outline, 2 px offset, globally on
  `:focus-visible`.

---

## 4. Layout

### Shell

- Fixed **240 px sidebar** (`w-60`) with grouped navigation:
  - Calculation
  - Master data: Printers, Materials, Work steps, Hourly rates, Profiles
  - System: Settings
- Sidebar footer: update badge, language switcher (opens upward), build
  number in mono.
- Main area scrolls independently (`overflow-y-auto`), max width 1280 px,
  24 px padding.
- Visited views stay mounted; active tab state and scroll position are
  managed by the shell. Switching tabs resets the main scroll to the top.

### Calculation workspace

- From 1280 px (`xl`): `grid-cols-[minmax(0,1fr)_360px]`, 24 px gap.
  - Left: project, printer, profile, files, work steps, extras.
  - Right: sticky result panel (`top: 24px`) with total, actions and cost
    breakdown.
- Below 1280 px: single column with a sticky compact summary bar
  (total, Save, Calculate).
- The detailed result table stays **full width below the grid**; “Details”
  scrolls to it.
- The profile form is collapsed to a select + three-value summary by
  default. “Customize” reveals the advanced fields.

### Tables

- `DataTable` provides search, sortable headers (`aria-sort`), an entries
  count, a no-matches state, and a horizontal scroll wrapper.
- First column carries the name plus an optional muted secondary line.
- Numeric columns are right-aligned; actions are a right-aligned column.
- Table header cells use the 11 px uppercase label voice.
- Rows use a 1 px `--color-line` divider and a subtle `raised/40` hover.

### Empty states

- Dashed `--color-line-strong` border, optional 40 px icon tile, 14 px
  muted description, optional primary action.
- First-run Calculation shows a three-step setup checklist instead of a
  dead-end error.
- Master-data empty states carry the primary “create” action; the page
  header button is hidden while the list is empty to avoid duplicate CTAs.

---

## 5. Components

| Component | Rule |
|---|---|
| Primary button | `bg-brand`, white text, 36 px, 6 px radius; one per screen |
| Secondary button | raised surface, 1 px strong border |
| Ghost button | text only, raised hover; used for Customize / tertiary actions |
| Danger ghost | red text, red-soft hover; used for row deletes |
| Danger filled | only in confirmation dialogs |
| Icon button | 32 px, icon only, always `aria-label` + `title` |
| Inputs / selects | translucent field surface (lighter than parent), strong border, 36 px, focus border + global outline |
| Decimal input | right-aligned, tabular numerals |
| Checkbox | native input + custom 16 px box, brand fill, focus ring on the box |
| Field | visible 11 px label, 14 px control, error outside the label (`role="alert"`) |
| Empty state | icon + description + one action |
| Modal | raised surface, 12 px radius, divided header/body/footer, backdrop blur, Escape/backdrop close, trapped focus with return to the trigger; long forms scroll the body and keep actions in the footer |
| Form section | 11 px uppercase label + hairline rule; 24 px between groups; fields on a 12-column grid |
| Printability hint | 12 px status line under the part dimensions: teal when it fits, warning tone when an axis exceeds the build volume |
| Toast | fixed bottom-right on desktop, full-width sheet on narrow widths, auto-dismiss after 5 s, `role="status"`, info/success/warning tones |
| Result panel | sticky, 30 px teal selling price, production cost and price per piece, primary Calculate, secondary Save/Details, cost breakdown |
| Table | search + sortable headers + right-aligned numbers; no shadows |
| Sidebar item | 36 px row, 16 px icon, brand-soft active state |

Icons are inline SVGs from `src/components/icons.tsx`: 16 px box, 1.75 px
stroke, round caps/joins. Emoji and text glyphs (`✕`, `🌐`, `▾`) are not used
as icons.

---

## 6. Accessibility

### Contrast (measured against the actual tokens)

| Pair | Ratio | AA normal text |
|---|---|---|
| `ink` on canvas | 17.6:1 | Pass |
| `ink-muted` on surface | 7.66:1 | Pass |
| `ink-faint` on surface | 5.32:1 | Pass |
| `ink-faint` on raised | 4.94:1 | Pass |
| white on `brand` | 4.59:1 | Pass |
| white on `brand-hover` | 5.65:1 | Pass |
| `brand-ink` on `brand-soft` | 8.42:1 | Pass |
| `accent` on `brand-soft` | 5.84:1 | Pass |
| `danger` on `danger-soft` | 6.46:1 | Pass |
| `warning` on `warning-soft` | 9.93:1 | Pass |

### Semantics and keyboard

- Semantic `section`, `table`, `th scope`, `fieldset`/`legend`, `role="alert"`,
  `role="status"`, `aria-live`, `aria-sort`, `aria-current`.
- Every input has a visible label or an equivalent `aria-label`; numeric
  fields that previously relied on placeholders now have labels.
- Modals close on Escape and backdrop click; focus stays inside the dialog,
  Tab wraps at both ends, and closing returns focus to the trigger.
- Language switcher supports Escape, outside click and focus return.
- Global `:focus-visible` outline is never removed.
- `prefers-reduced-motion` disables transitions and smooth scrolling.
- An automated `axe-core` pass covers the empty calculation view, the open
  form, and a modal at WCAG A/AA level (contrast excluded because jsdom has
  no layout engine).

### Known gaps

- **Mobile layout below 1024 px** is not designed; the desktop window has a
  1024 px minimum.

---

## 7. Deliberate Deviations

These are decisions, not missed requirements:

1. **No marketing display scale.** A desktop calculator needs 24 px page
   titles and 30 px KPIs, not 64–72 px hero type.
2. **No gradients, glows or illustrations.** The result and tables must stay
   legible; decoration would compete with numbers.
3. **No pill primary CTAs.** 6 px controls and 12 px cards follow desktop
   convention and keep density high.
4. **No light theme.** Spec 0012 explicitly excludes a theme switcher.
5. **No reference-brand colours.** Linear indigo, Supabase green, Sentry
   purple and Raycast red are replaced by OpenPrintCost blue/teal from the
   logo.
6. **Border-defined depth.** Card shadows are intentionally absent; shadows
   appear only on overlays.
7. **Dense 11 px labels.** The reference marketing sites use larger labels;
   the tool voice is deliberately compact.

---

## 8. Review Closure

The original review findings and their resolutions:

| Original finding | Resolution |
|---|---|
| Generic Tailwind dark look | Semantic tokens, Inter + JetBrains Mono, brand blue/teal |
| Flat hierarchy | Three surface levels, sidebar, 11 px section labels, one primary per screen |
| Result below the fold | Sticky result panel on wide screens, compact sticky bar below 1280 px |
| Contrast failures | `ink-faint` ≥ 4.9:1; white on brand 4.59:1; focus token |
| Weak focus states | Global 2 px focus outline |
| Emoji/glyph icons | Inline SVG icon set, icon buttons with labels |
| Unlabeled numeric fields | Visible labels for extras/surcharges; field errors outside labels |
| Native checkboxes | Custom checkbox with native input and focus ring |
| Lost in-progress calculation | Visited views stay mounted; scroll resets on tab change |
| Profile tab disconnected | Profile select loads saved profiles; first profile is used by new calculations |
| Card lists instead of tables | Searchable/sortable `DataTable` for all master data |
| Banner-only feedback | Toasts for import/export, auto-dismiss and close |
| No unsaved-changes guard | Confirm dialog before discarding on “New calculation” |
| Number formatting | Tabular numerals, right-aligned values, `formatQuantity` for units |

---

## 9. Change Rules

When adding a screen or component:

1. Use semantic tokens; never introduce raw `slate-*`, `sky-*` or hex values
   in components.
2. One primary action per screen. Use brand blue; teal belongs to the final
   total/success.
3. Use 11 px uppercase labels for fields and section headers; 14 px body.
4. Right-align and tabular-align numeric values.
5. Use `DataTable` for master data; do not build one-off card lists.
6. Use `Modal`, `Toast`, `EmptyState`, `Field` and the shared buttons instead
   of local variants.
7. Keep the 2 px focus outline; do not remove `:focus-visible`.
8. Add new strings to both `src/i18n/de.ts` and `src/i18n/en.ts`.
9. Verify:
   ```bash
   npm run typecheck
   npm test
   npx vite build --outDir /tmp/opc-build --emptyOutDir
   ```
10. Check new colour pairs against WCAG AA (4.5:1 normal text).

---

## 10. Open Items (not visual-system work)

1. **Long table headers** at 1024 px: monitor wrapping; short labels are
   already used for printer rate and flat rate.
2. **Light theme** — explicitly out of scope for this iteration.

Resolved in 0.2.0: cost vs. selling-price semantics, price per piece from the
engine, modal focus trap, automated axe pass, and narrow-width toast
placement.
