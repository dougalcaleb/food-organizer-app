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
| `npm run icons`     | Regenerate the app icon set from the theme colors.                        |
| `npm run infra`     | Create/update the AWS hosting stack. Rarely needed.                       |
| `npm run deploy`    | Build and publish to AWS by hand. CI does this on push to `main`.         |
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
  them onto whatever base path the build targets; absolute `/fonts/...` URLs
  would break if the app were ever served from a subpath.
- **Routing** uses hash history. CloudFront does provide an SPA rewrite, so
  path history would work; hash is kept because it also behaves correctly
  inside an installed PWA.
- **Sheets** (meal detail, editor, settings) belong in the query string, not in
  routes, so the phone's back gesture closes the sheet instead of leaving the
  app.
- Settings live behind the gear in the page header; the tab bar stays at three.

The design handoff and the original prototype are in `tmp/` (gitignored).

## Install

Installable as a PWA: the manifest lives in the `VitePWA` block in
`vite.config.ts`, and the icons are generated from the theme's own colors by
`npm run icons` rather than exported by hand. Without a manifest Chrome offers
only a bookmark shortcut that opens in a browser tab, so `src/pwa.spec.ts`
guards that the icons a manifest points at actually exist.

Updates apply on their own — there is one user and no release ritual. The
service worker caches build output only; your data is in IndexedDB and is never
touched by an update.

## Hosting

A private S3 bucket behind CloudFront, defined in `infra/hosting.yaml` and
deployed with `npm run infra`. There is no Route 53 hosted zone and no
certificate: the assigned `*.cloudfront.net` domain is free and already serves
HTTPS, and the URL does not need to be memorable. At one user's traffic this
sits inside CloudFront's perpetual 1 TB/month free tier, so it costs nothing.

Pushing to `main` builds and publishes via `.github/workflows/deploy.yml`,
which assumes an IAM role through GitHub's OIDC provider -- there are no AWS
keys in the repository. The role's ARN goes in the `AWS_DEPLOY_ROLE` repository
variable; `npm run infra` prints it.

Hashed assets are uploaded with a one-year `immutable` cache and `index.html`
with `no-cache`, in that order, so the entry point is never live while pointing
at assets that have not landed. See `scripts/deploy.sh`.
