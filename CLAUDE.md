# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **This is a living document.** The app is early and expected to change a lot
> in use. When a decision here is reversed, a gotcha stops being true, or a new
> one is found, **edit this file in the same commit as the change**. A stale
> entry here is worse than a missing one, because it will be trusted. Anything
> recorded below is a decision that was actually made and paid for — do not
> silently undo one; say what changed and why.

## What this is

A single-user mobile web app for one person's cooking loop: a library of meal
ideas, a rolling plan of meals to make soon, and a shopping list **derived**
from that plan. Three tabs — List, Ideas, Plan. No dates, no per-day
scheduling. Data lives in IndexedDB on the device; there is no server.

The design brief in `tmp/design_handoff_meal_planner/` (gitignored) is the
source of truth for copy, layout and behavior of the three screens. Its
prototype is a light "blueprint" style; **this app is dark and soft** — take its
structure, not its palette.

## Commands

|                                                         |                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                                           | Dev server. `-- --host` to reach it from a phone on the LAN. |
| `npm run build`                                         | Typecheck, then production build.                            |
| `npm run test`                                          | Full suite.                                                  |
| `npm run test:watch`                                    | Watch mode.                                                  |
| `npx vitest run src/lib/dates.spec.ts`                  | A single test file.                                          |
| `npx vitest run -t 'never-made'`                        | Tests matching a name.                                       |
| `npm run typecheck` / `npm run lint` / `npm run format` |                                                              |

## Architecture

**The shopping list is derived, never stored.** `lib/shoppingList.ts` is a pure
function of `(meals, plan, extras)` — no Vue, no database. It is the most
load-bearing logic in the app and has the most tests. Never add a "shopping
list" table.

**Write-through repositories.** Store actions call a `db/repositories/*`
function that writes the one changed record. Do _not_ deep-watch stores and
rewrite the DB — that races on rapid check-offs and hides the write path.
Hydration is a single read of all tables in `main.ts`, awaited before
`app.mount()`, so the first paint has real data.

**Sheets live in the query string**, not in routes: `?sheet=meal&id=…`. This is
so the phone's back gesture closes the sheet instead of leaving the app.
`composables/useSheet.ts` owns the names; `components/AppSheets.vue` is the
single mount point. **Views must never mount a sheet themselves.**

**Routing is hash-based** (`createWebHashHistory`) because GitHub Pages has no
SPA rewrite.

**Three-layer styles** in `src/styles/`, and this is the whole point of the
setup: `primitives.css` (raw ramps — what colors _exist_) →
`theme.css` (semantic roles — what they _mean_, **the tuning surface**) →
`components.css` (`.btn`, `.chip`, `.seg`, `.card`, `.list-row`). Components
reference roles (`bg-surface`, `text-muted`, `rounded-card`), **never
primitives**. Retuning the look should mean editing `theme.css` alone. Softness
is a radius token; the accent is one line. `/styleguide` (dev only) renders
every component class in every state — use it as the feedback loop.

**Domain rules live in `src/lib/`, not in components**, so they can be tested
without mounting anything: `shoppingList`, `parseIngredient`, `mealDraft`
(the save rule), `suggestions` (the "been a while" rule), `dates`, `quantities`.
When a view starts making a product decision, extract it here.

## Product rules that are easy to get wrong

**Only `name` is ever required.** Not on a meal, not on an ingredient, not on a
one-off. The user's stated priority is that friction stops ideas being written
down at all. `{ name: 'that thai place thing' }` is a complete valid meal.
Absent fields are _omitted_, not stored as `undefined` or rendered as `0`.

**Three kinds of shopping line, three lifecycles.** Getting this wrong destroys
data:

| Kind                       | After a trip (`clearCart`)              |
| -------------------------- | --------------------------------------- |
| Meal ingredient            | Unchecked — the meal is still planned   |
| One-off (`kind: 'oneoff'`) | **Deleted**                             |
| Staple (`kind: 'staple'`)  | Returned to the shelf (`active: false`) |

`active` is what puts an extra on the current list; `buildItems` filters on it
itself so no caller can forget. Clearing the cart is destructive, so the store
exposes `cartClearPlan` and the UI confirms first.

**"Made it" is the only thing that records history.** It drops the meal from the
plan _and_ stamps `lastMadeAt`. Plain "Remove" must touch neither — changing
your mind about the week should not make a meal look freshly eaten.

**Never-made meals are maximally stale.** `lastMadeAt: null` →
`weeksSince` returns `Infinity` → sorts first under "been longest" and qualifies
for "been a while". This is deliberate: a jotted idea resurfacing is the entire
point of the Ideas tab.

**Ingredient merging is by normalized name** (trimmed, lowercased) — no fuzzy
matching. "chicken thigh" and "chicken thighs" stay separate lines, and extras
never merge with meal ingredients at all (their `qty` is free text, not
`amount` + `unit`). Known and accepted for now; revisit only with real usage.

## Gotchas found the hard way

Each of these was a real bug. Do not reintroduce them.

**Never write Vue reactive state straight to IndexedDB.** Store records carry
Proxy wrappers on nested arrays, and the structured clone algorithm rejects a
Proxy — `DataCloneError` — in real browsers, not just under fake-indexeddb.
Every write goes through `toPlain()` in `db/plain.ts`.

**Never sort on derived week counts.** `weeksSince` returns `Infinity` for
never-made meals, so `weeksSince(b) - weeksSince(a)` yields `NaN` for two of
them — an invalid comparator, and _not_ a rare case. Use `staleFirst` /
`recentFirst` from `lib/dates.ts`, which compare `lastMadeAt` directly.

**Booleans cannot be IndexedDB keys.** Indexing a boolean field silently drops
those records from the index. `active` is deliberately unindexed in
`db/index.ts`; filter small tables in memory.

**A runtime guard does not remove a dynamic import from the bundle.** A `v-if`
around a button whose handler does `await import('@/db/seed')` still ships the
seed data to production. The `import.meta.env.DEV` check must wrap the _import
itself_ so Rollup can drop the block. After touching anything dev-only, verify:
`ls dist/assets/ | grep -i seed` must come back empty.

**Never pair `safe-top`/`safe-bottom` with a `pt-*`/`pb-*`/`py-*`/`p-*` on the
same element.** Both set the same padding property, and whichever Tailwind
generates later wins silently — this is how the header ended up with zero top
padding, jammed under the status bar. The safe utilities already include the
layout's own padding; tune it with `--safe-top-base` / `--safe-bottom-base`.
`styles/safeArea.spec.ts` guards this.

**Backslashes do not survive a bash heredoc.** Writing a `.ts` file via
`cat > file <<'EOF'` turns `\b` into ``, which inside a template literal is
the backspace escape, not a regex word boundary. That silently made an earlier
version of the safe-area guard match nothing while reporting success. Use the
Write tool for files containing regexes, and always prove a new guard fails when
the bug it guards is reintroduced.

**Every name in `SHEET_NAMES` needs a component in `AppSheets.vue`.** A missing
one fails silently — the URL changes, a history entry is pushed, nothing
renders, and it looks like a broken click. `AppSheets.spec.ts` guards this.

**Settings persist across tests.** `fake-indexeddb` state survives between test
cases in a file; a fresh Pinia is not enough. Any test touching settings must
clear the relevant tables in `beforeEach` or it will leak into the next test.

**Schema changes need a Dexie version bump plus an upgrade**, and a test — a
broken migration corrupts real data on the user's next visit. See
`db/migration.spec.ts`, which opens a genuine v1 database to exercise the
upgrade path.

## Conventions

- **Tabs for indentation**, single quotes, no semicolons (Prettier). `npm run
format` covers the whole repo, not just `src/`.
- **`src/styles/` is Prettier-ignored** — the token files are aligned columns
  that read as tables, and Prettier collapses them.
- Tests are colocated as `*.spec.ts` next to what they test.
- Icons are registered one at a time in `plugins/fontawesome.ts` so unused ones
  tree-shake; `FaIcon` is globally registered.
- Fonts are vendored latin-subset-only into `src/assets/fonts` and referenced by
  _relative_ path, so Vite rebases them onto the GitHub Pages base. Absolute
  `/fonts/…` URLs would 404 in production.
- Seeding is dev-only; production starts empty, so empty states are what a real
  new install sees. Keep them good.

## Not built yet

Steps remaining from the original plan: **PWA** (`vite-plugin-pwa` is installed
but unwired — needs a manifest and icons, which do not exist yet) and
**deployment** (a GitHub Actions workflow to Pages).

Known open questions, deliberately unresolved pending real use: whether extras
should merge with meal ingredients; whether never-made meals should dominate the
"been a while" block; and the oddly-named large vendor chunks in the build
output (Rollup naming a shared chunk after an arbitrary module — cosmetic, but
worth tidying before precaching).
