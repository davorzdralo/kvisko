# Cloudflare deployment

## One-time setup

This repository is configured for production at **https://kvisko.davorzdralo.workers.dev**. The production D1 database is `kvisko`, created in Western Europe. Its UUID is committed in `wrangler.jsonc`; the local preview ID remains separate so existing local games are preserved.

For a fork or a different Cloudflare account, create your own database and replace the production UUID:

1. Create a Cloudflare account with Workers Free enabled.
2. From this project, run:

```sh
npx wrangler login
# If the browser callback cannot reach localhost, use: npx wrangler login --device
npx wrangler d1 create kvisko --update-config=false
```

3. Put the returned `database_id` into `wrangler.jsonc`. The database ID is configuration, not a secret; keep it in the repository. Keep credentials/API tokens out of source control.
4. Validate, initialize the remote database, and deploy:

```sh
npm ci
npm test
npm run db:remote
npm run deploy
```

`db:remote` applies ordered schema migrations and upserts the content. `deploy` uploads the Worker, assets and Cron Trigger. Check `/healthz`, all four quiz cards, play/resume and the credits page at the returned Workers URL. A custom domain is optional; domain registration is a separate cost.

## GitHub Actions

`.github/workflows/deploy.yml` runs on pull requests targeting **master**, pushes to **master**, and manual dispatch. GitHub Actions is the only automatic deployment system; leave Workers Builds disconnected.

1. The validation job installs locked dependencies on Node 24 and runs `npm test`, including local D1 integration tests and a deployment dry run. It receives no Cloudflare credentials.
2. After validation succeeds, master pushes and manual master runs apply migrations and content upserts, then deploy the Worker, static assets and Cron Trigger.
3. The deployment checks `/healthz`, then exercises all four production quizzes and every bundled quiz image using `scripts/smoke.py`. These checks create test games in production; they expire normally.

Deployments share a concurrency group with `cancel-in-progress: false` so migrations and deployments never overlap. Official checkout/setup-node actions are pinned to commit SHAs. The workflow has read-only repository permissions. Pull requests cannot deploy or access Cloudflare credentials. The deployed URL appears in the workflow summary.

Configure both repository **Actions secrets**:

- `CLOUDFLARE_ACCOUNT_ID`: the target account ID.
- `CLOUDFLARE_API_TOKEN`: the dedicated account-owned deployment token.

The currently selected legacy permissions are **Workers Scripts Write**, **D1 Write**, and **Account Settings Read**. These remain supported. For a new token using Cloudflare's granular roles, use Workers Editor scoped to the existing `kvisko` Worker, plus database permissions needed to execute migrations/seed SQL. Creating a new Worker requires Workers product-level Admin; deploying an existing one requires Editor. Never commit token values.

The workflow can be rerun from the Actions page after fixing a configuration/permission problem. Manual runs deploy only when master is selected. No custom domain or zone-routing permissions are needed for the workers.dev address.

Schema changes must remain compatible with the previously deployed Worker while migrations run. A failed deploy can leave a migrated database behind; code rollback does not roll back schema or seed changes. Add new migration files instead of modifying applied files. Content upserts are repeatable; existing sessions retain their snapshots. Avoid enabling both Workers Builds and Actions deployment for the same branch.

## Configuration and storage

- `QUIZ_LENGTH`: 1–100; default 30.
- `SESSION_TTL_DAYS`: 1–365; default 30; fixed lifetime from game creation.
- Static files go directly to Workers Static Assets; do not enable `run_worker_first` for all paths.
- The daily cleanup deletes up to 10,000 expired sessions. Cloudflare schedules Cron Triggers; local `wrangler dev` does not run them automatically.

Test the scheduled handler while the local app is running:

```sh
curl 'http://localhost:8080/cdn-cgi/local/scheduled?cron=0+3+*+*+*&format=json'
```

A 30-question round stores a small JSON document rather than 30 separately indexed answer rows. This lowers D1 write usage, but still requires retention and quota monitoring at public scale. The free plan currently limits each D1 database to 500 MB. Image bytes live in Static Assets, not D1.

Export a remote backup before database changes:

```sh
npx wrangler d1 export kvisko --remote --output /path/outside/repo/kvisko-backup.sql
```

Backups include bearer session credentials; store them privately. D1 also supplies seven days of Time Travel on Free. Local development data lives under `.wrangler/`; Docker uses a separate named volume. Neither is automatically synchronized with production. Replacing the old Postgres service does not import its saved games or remove its Docker volume.

References: [Workers configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), [D1 local development](https://developers.cloudflare.com/d1/best-practices/local-development/), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), [D1 recovery](https://developers.cloudflare.com/d1/reference/time-travel/).
