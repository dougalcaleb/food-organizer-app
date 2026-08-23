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

**Routing is hash-based** (`createWebHashHistory`). GitHub Pages having no SPA
rewrite was the original reason; the app now ships to CloudFront, which does
rewrite 403/404 to `/index.html`, so path history would work. Hash is kept
deliberately — it also needs no origin support inside an installed PWA. Do not
"fix" it without deciding to.

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

**Every kind of record needs a way to be created in the UI.** Staples shipped
fully built — store, shelf, lifecycle, migration, tests — but nothing outside
the dev seed could set `kind: 'staple'`, and the shelf was hidden when empty. In
production the feature was unreachable and looked absent. When adding a variant
to a model, check the creation path and the empty state in the same change.

**Tags are mostly inferred, and the pinned few are a setting.** v1 shipped
thirteen preset tags ("Weekend project", "Greek") that were never used, so the
filter row was full of chips matching nothing — and because nothing in Settings
edited them, they looked hard-coded. `Settings.tags` is now Breakfast / Lunch /
Dinner, editable in the settings sheet, and it only _leads_ the list: every
other option comes from `meals.usedTags`. Removing one there unpins it, it does
not strip it off any meal. Schema v3 resets the stored list; keep the seeded
set small.

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

**A sheet's `<Transition>` needs `appear`.** Sheets are mounted already open,
and a Transition does not animate its first render without it — which traded
the missing exit animation for a missing entrance one. `AppSheets.spec.ts`
guards it, and has to pass `stubs: { transition: false }`: Test Utils stubs
transitions by default, so the default setup cannot see this at all.

**A sheet has to stay mounted to animate out.** `?sheet=` clears the instant
the back gesture fires, and `AppSheets` used to unmount on that — so every
sheet faded in and then vanished. `AppSheets` now keeps a closed sheet mounted
for `SHEET_EXIT_MS` (and freezes the id it was opened with, or the contents
blank mid-flight) while `BaseSheet` runs the leave. Anything else mounting a
`BaseSheet` — `CartClearSheet` from the List view — must not `v-if` it on the
same boolean it passes as `open`.

**An exit animation has to hold its final frame.** A CSS animation with no fill
mode reverts the element to its base style the moment it ends, and the sheet is
still on screen at that point — Vue removes it on its own timer a frame or two
later. The panel snapped back to fully open and bright right at the end of every
close. Every `.sheet-leave-active` rule sets `forwards`, and
`ui/BaseSheet.spec.ts` guards that (as text: jsdom implements no animations, so
mounting the sheet would prove nothing). The two timers are a race for the same
reason — `AppSheets` waits `SHEET_EXIT_MS` plus a small buffer, because its
timer starts a hair before the transition's and would otherwise win.

**Anything `fixed` above the tab bar sizes itself from `--tab-bar-height`.**
The bar is in normal flow, the Ideas "+" button is fixed, and a hand-picked
`bottom-24` drifts the moment the bar's contents change (it did, when the tabs
gained icons). `styles/base.css` owns `--tab-bar-height` / `--tab-bar-base`;
the bar sets its height and padding from them and the button uses the
`above-tab-bar` utility, so the gap over the bar stays equal to the `right-4`
page margin. The list underneath it needs `clears-fab` (padding-bottom from
`--fab-size`) for the other half of the problem: a fixed button covers whatever
scrolls under it, which left the last card half unreachable at the bottom of
the Ideas list.

**An input that handles Enter needs `enterkeyhint`.** Chrome on Android decides
what the on-screen return key does: for a field with other fields after it, it
labels the key "Next", moves focus to the next input in the document itself, and
dispatches no keydown at all — so every `@keydown.enter` handler in the app was
dead on the phone. Enter in an ingredient row focused the Notes box.
`enterkeyhint="enter"` asks for a plain return, which does dispatch.
`components/enterKey.spec.ts` guards it as text, because happy-dom has no IME
and cannot reproduce this at all.

**Adding a row is a request to type in it.** The meal editor moves focus to the
row Enter (or "Add ingredient") creates — `IngredientRow` exposes a `focus()`
for it, and rows are addressed by key, not index, since a row can be removed
mid-edit. A row that appears without the cursor reads as the key having done
nothing, especially when the new row is below the fold. Replacing the last
deleted row deliberately does _not_ focus: nobody asked to type, and it would
pop the keyboard back up.

**Never pair `safe-top`/`safe-bottom` with a `pt-*`/`pb-*`/`py-*`/`p-*` on the
same element.** Both set the same padding property, and whichever Tailwind
generates later wins silently — this is how the header ended up with zero top
padding, jammed under the status bar. The safe utilities already include the
layout's own padding; tune it with `--safe-top-base` / `--safe-bottom-base`.
`styles/safeArea.spec.ts` guards this.

**Git Bash mangles POSIX paths passed to CLIs.** MSYS rewrites any argument
that looks like an absolute path, so `aws cloudfront create-invalidation
--paths /index.html` arrived as `C:/Program Files/Git/index.html` and was
rejected as an invalid path. `scripts/deploy.sh` exports `MSYS_NO_PATHCONV=1`
(inert on the Linux CI runner). Note the failure mode when diagnosing this: the
same command against a _nonexistent_ distribution returns `NoSuchDistribution`,
because existence is checked before paths — so a probe with a fake ID looks
like the paths are fine.

**Backslashes do not survive a bash heredoc.** Writing a file with
`cat > file <<'EOF'` collapses a doubled backslash to a single one. In a
JavaScript template literal that turns an intended word-boundary escape into
the backspace escape, so the regex matches nothing — which silently made the
first version of the safe-area guard pass while checking absolutely nothing.
(This paragraph was itself mangled that way on the first attempt.) Write files
containing regexes with the Write tool, and always prove a new guard fails when
the bug it guards is put back.

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
- **Infrastructure is CloudFormation, not CDK.** `infra/hosting.yaml` plus two
  small shell scripts, so a frontend repo gains no `aws-cdk-lib` dependency
  tree. `npm run infra` applies it; CI only ever publishes files, never changes
  infrastructure.

## Deployment

Private S3 bucket + CloudFront, defined in `infra/hosting.yaml`. Free at this
scale: CloudFront's 1 TB/month tier is perpetual, and there is deliberately no
Route 53 hosted zone (that $0.50/month is the only unavoidable cost in an AWS
static site, and the URL does not need to be friendly). The bucket is private
and reached through Origin Access Control — S3 website hosting is _not_ used,
because it requires a public bucket and cannot serve HTTPS to the origin, and
the PWA will need a secure origin.

**`vite.config.ts` `base` is `'/'`**, not `/food-organizer-app/`. That prefix
existed only for Pages.

**Three cache tiers, and the tier follows from whether the name is hashed.**
Anything Vite fingerprints into `assets/` gets an immutable year.
`index.html`, `sw.js`, `registerSW.js` and `manifest.webmanifest` keep fixed
names, so they go up `no-cache` — a service worker pinned at the edge for a
year would keep handing an installed app an old precache manifest.
`src/pwa.spec.ts` guards that list. **Files in `public/` are copied verbatim
and are therefore _not_ hashed**, which is easy to miss: `icons/*` keeps its
name across an `npm run icons`, so it gets a day, not a year. A new `public/`
asset needs a tier decided, not the default.

**Deploy order is load-bearing.** `scripts/deploy.sh` uploads hashed assets
first with a one-year `immutable` cache, then `index.html` with `no-cache`.
Reversing it publishes an entry point referencing assets that have not landed.
`--delete` belongs on the first pass only — `index.html` is excluded there, so
it survives the gap between the two passes.

**Never invalidate `/*` after a deploy.** Only the unhashed files can be stale;
a wholesale invalidation discards a year of correctly-cached assets and burns
the monthly free invalidation allowance.

CI authenticates by assuming an IAM role through GitHub's OIDC provider (which
already existed in the account — the template references it rather than
creating one, since a second provider for the same issuer is an error). No AWS
keys are stored in the repo. The role is scoped to `main` of this repository
and can only write the bucket and invalidate the one distribution.

## PWA

**A manifest is what separates an install from a bookmark.** Shipping without
one is not "the PWA feature is missing" — Chrome still offers a menu entry and
still creates a home-screen shortcut, and that shortcut opens in a browser tab.
It looks like a broken app, not an absent feature. Requires all of: a manifest
with `display: standalone`, an icon of at least 192px, and an HTTPS origin.

**Icons are generated, not hand-exported.** `npm run icons` runs
`scripts/generate-icons.mjs`, which renders the set from `--color-gray-1` and
`--color-teal-4` with a dependency-free rasterizer and PNG encoder. A committed
PNG with no source is a dead end; this way the icon cannot drift from the
theme, and rerunning it is the whole edit loop. The maskable variant shrinks
the mark to the central ~72%, because Android crops to an inscribed circle.

**iOS ignores the manifest's icons** and reads `<link rel="apple-touch-icon">`
from `index.html`. Both paths have to be kept, and `src/pwa.spec.ts` guards
that every icon referenced from either one actually exists.

`registerType: 'autoUpdate'` — one user, no release ritual, so an update prompt
would be pure friction. The service worker precaches build output only; app
data is in IndexedDB and an update never touches it.

## Not built yet

Nothing from the original plan remains.

Known open questions, deliberately unresolved pending real use: whether extras
should merge with meal ingredients; whether never-made meals should dominate the
"been a while" block; and the oddly-named large vendor chunks in the build
output (Rollup naming a shared chunk after an arbitrary module — cosmetic, but
worth tidying before precaching).
