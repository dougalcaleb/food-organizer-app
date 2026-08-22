# Pantry

Single-user mobile web app for a meal-ideas library, a rolling meal plan, and a
shopping list **derived** from that plan.

Three tabs — **List**, **Ideas**, **Plan**. No dates: planning is a rolling bag
of options, not a per-day schedule. Data lives in IndexedDB on the device.

## Commands

|                     |                                                                           |
| ------------------- | ------------------------------------------------------------------------- |
| `npm run dev`       | Dev server. Add `-- --host` to reach it from a phone on the same network. |
| `npm run build`     | Typecheck, then production build to `dist/`.                              |
| `npm run preview`   | Serve the production build locally.                                       |
| `npm run test`      | Unit tests (Vitest).                                                      |
| `npm run typecheck` | `vue-tsc` only.                                                           |
| `npm run lint`      | ESLint with `--fix`.                                                      |
| `npm run format`    | Prettier over `src/`.                                                     |

## Design language

The look is tuned from a token layer, not from components. Three layers, in
`src/styles/`:

1. **`primitives.css`** — raw values: the gray/teal/purple/green ramps, the two
   font families. What colors _exist_. Rarely edited.
2. **`theme.css`** — semantic roles (`--color-surface`, `--color-accent`,
   `--radius-card`) mapped onto primitives. What those colors _mean_. **This is
   the tuning surface** — retuning the whole app should mean editing this file.
3. **`components.css`** — `.btn`, `.input`, `.chip`, `.seg`, `.card`,
   `.list-row`, built against the roles.

Components reference roles (`bg-surface`, `text-muted`, `rounded-card`), never
primitives. Because the roles live in Tailwind's `@theme`, each one generates
its own utilities.

`/styleguide` (dev only) renders every component class in every state on one
page — use it as the feedback loop when retuning.

## Shopping list items

Three kinds of line, with three different lifecycles:

| Kind       | Where it comes from             | After a shopping trip                |
| ---------- | ------------------------------- | ------------------------------------ |
| Ingredient | Derived from a planned meal     | Unchecks — the meal is still planned |
| One-off    | Typed in once (paper towels)    | Deleted                              |
| Staple     | Bought regularly (milk, butter) | Returns to the Staples shelf         |

Staples never have to be retyped: they rest on a shelf at the bottom of the
List tab and are tapped onto the current list when needed. One-offs and staples
share the `extras` table, distinguished by `kind`; `active` is what puts either
on the current list. Clearing the cart confirms first and says what it will
delete.

## Notes

- **Fonts** are vendored latin-subset-only into `src/assets/fonts` and declared
  in `styles/fonts.css`. They are referenced by _relative_ path so Vite rebases
  them onto the GitHub Pages base path; absolute `/fonts/...` URLs would 404 in
  production.
- **Routing** uses hash history, because GitHub Pages has no SPA rewrite.
- **Sheets** (meal detail, editor, settings) belong in the query string, not in
  routes, so the phone's back gesture closes the sheet instead of leaving the
  app.
- Settings live behind the gear in the page header; the tab bar stays at three.

The design handoff and the original prototype are in `tmp/` (gitignored).
