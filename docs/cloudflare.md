# Cloudflare deployment

## One-time setup

Local development works before a Cloudflare account or GitHub repository exists. `wrangler.jsonc` intentionally contains a placeholder database UUID. Before the first deployment:

1. Create a Cloudflare account with Workers Free enabled.
2. From this project, run:

```sh
npx wrangler login
npx wrangler d1 create kvisko
```

3. Put the returned `database_id` into `wrangler.jsonc`. The database ID is configuration, not a secret; keep it in the repository. Keep credentials/API tokens out of source control.
4. Validate, initialize the remote database, and deploy:

```sh
npm ci
npm test
npm run db:remote
npm run deploy
```

`db:remote` applies ordered schema migrations and upserts the content. `deploy` uploads the Worker, assets and Cron Trigger. Check `/healthz`, all four quiz cards, play/resume and the credits page at the returned Workers URL. A custom domain is optional; domain registration is a separate cost. No real deployment or Cloudflare resources are created by the local porting work.

## Future GitHub automation

Once the GitHub repo exists, add an Actions workflow triggered by pushes/merges to **master**, plus a PR workflow that only validates. The intended order is:

1. Check out source; set up Node 24 with npm caching; run `npm ci`.
2. Run `npm test` (no Cloudflare token needed).
3. On master only: run `npm run db:remote`, then `npm run deploy`.

Store a least-privilege Cloudflare API token as `CLOUDFLARE_API_TOKEN`, scoped to the intended account with **Workers Scripts: Edit** and **D1: Edit** permissions. Provide `CLOUDFLARE_ACCOUNT_ID` through repository variables/environment. Do not expose deployment secrets to fork PR builds. Serialize production deployments with an Actions concurrency group and `cancel-in-progress: false` so a migration cannot be interrupted by a newer push. Prefer a protected production environment if approval gates are desired.

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
