/*
The bearer token for the cloud backup endpoint, and the only place it lives.

It is not a secret. Vite compiles it into the public bundle, so it is served to
anyone who loads the app -- see the "Cloud backup" section of CLAUDE.md for
what that does and does not protect, and why the trade was accepted.

It is a source file rather than a `.env` for one reason: `.env` is the single
most-scraped filename on public GitHub, and this repo is public. Nothing about
the value changes -- it is equally readable either way -- but it stops being
something a crawler finds without looking. It is also honestly what it is: a
build-time constant, not configuration that varies by environment.

`npm run infra` reads this file, deploys the value as the stack's BackupToken,
and writes a generated one back here when it is empty. Empty means the cloud
backup is off and its UI hides itself, which is a working state: the app is
unchanged from before the feature existed.

Keep the line below as one single-quoted assignment -- `scripts/infra.sh`
matches it as text, and `cloudBackupInfra.spec.ts` guards that shape.
*/
export const BACKUP_TOKEN = ''
