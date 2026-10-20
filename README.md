# Kvisko

Little questions, big discoveries. A picture quiz for children using **Cloudflare Workers (TypeScript), D1 (SQLite), and plain HTML/CSS/JavaScript**.

Five quizzes are included: **249 world flags, 40 familiar animals, 72 fruit/vegetables/plants, 40 dog breeds, and 40 traffic signs/signals**. The traffic pack uses European designs from Serbia, plus traffic lights, pedestrian signals and a zebra crossing; see [traffic content notes](docs/traffic.md). Each game samples 30 questions without repeats and gives four shuffled choices per question. Play by touch, mouse, or keys **1–4**; **Enter** advances after feedback. The UI and content use Serbian Cyrillic with a simple Arial font. Images are bundled locally, with no external requests during play.

Play at **[kvisko.davorzdralo.workers.dev](https://kvisko.davorzdralo.workers.dev/)**. Pushes and merges to `master` run tests, migrate D1 and deploy automatically through GitHub Actions. Pull requests run tests only.

## High scores

After finishing a quiz, players can optionally enter a name or nickname and save their score. The name is displayed publicly; the form encourages a nickname without a surname. No account or identity verification is needed. The [high-score page](https://kvisko.net/high-scores.html) starts with all quizzes and can filter by quiz. It shows the top 100 entries, ranked by percentage correct, then correct-answer count, then earliest submission (with entry ID breaking exact ties).

Scores are computed from the finished game on the server. Each game can submit once; retrying the same name is safe, and another name cannot overwrite it. Saved scores outlive the 30-day game expiry. Finished games remain resumable until their optional score is saved, so a reload need not lose the submission opportunity. New games and leaving without saving remain available.

## Run locally

Use Node.js **24 LTS** (minimum 22.18) and npm:

```sh
npm ci
npm run db:local
npm run dev
```

Open [localhost:8080](http://localhost:8080). Wrangler runs the Worker and D1 locally; a Cloudflare account is not needed for local play. After installation, local play can work offline. Local database files persist under `.wrangler/`, independently of production. Restarting the app does not erase saved games. Run `db:local` after schema/content changes; schema migrations apply once and content upserts are repeatable.

For a different round length:

```sh
npm run dev -- --var QUIZ_LENGTH:10
```

`QUIZ_LENGTH` accepts 1–100 (default 30), capped to the bank size. `SESSION_TTL_DAYS` accepts 1–365 (default 30). Invalid values fall back to defaults. Both are configured in `wrangler.jsonc` and affect new games only. Existing games retain their questions, labels, progress, and expiry. Games expire a fixed number of days after creation.

### Docker alternative

```sh
docker compose up --build -d
```

This runs the same local Worker/D1 runtime, with database files in the `d1_data` named volume:

```sh
QUIZ_LENGTH=10 PORT=8081 docker compose up --build -d
docker compose logs -f app
docker compose down            # retain local data
# docker compose down -v       # DELETE the local D1 database
```

The previous Postgres volume is not migrated or deleted. Old Postgres sessions cannot resume in D1; start new games. All quiz content is preserved. If upgrading from the old Compose setup, stop its containers before rebuilding; the old database container can remain stopped until you choose to remove it.

## Verify

```sh
npm test
```

Checks generated content and image paths, TypeScript, a Cloudflare deployment dry run, and integration tests against real local D1/Workers via Miniflare. Tests cover complete games in every pack, random selections, scoring, persistence, duplicate and competing concurrent answers, input validation, out-of-order submissions, and expiry. Test databases are isolated from local development data.

With the app running, check the public API and every bundled quiz image:

```sh
python3 scripts/smoke.py
# BASE_URL=http://localhost:8081 python3 scripts/smoke.py
```

This creates games in the selected database. `npm run build` only bundles and validates; it does not deploy.

## Content and layout

- `src/index.ts`: Worker routing, D1 access, random games, atomic answer updates and expiry cleanup.
- `migrations/`: ordered D1 schema migrations. Never edit a migration already applied in production; add a new numbered file.
- `data/quizzes.json`, `data/{flags,animals,plants,dogs,traffic}.json`: source content.
- `data/seed.sql`: generated, repeatable content upserts, applied separately from schema migrations.
- `web/`: frontend, photos, flags, traffic illustrations, credits and static security headers.
- `tests/`: local Workers/D1 integration tests.
- `docs/design.md`: architecture and API; `docs/cloudflare.md`: production deployment and GitHub Actions setup.

After editing content, run `npm run content:generate`, `npm run db:local`, then `npm test`. The generator checks unique IDs/labels and local image paths. Upserts add/update subjects; removing subjects requires an explicit migration to remove their database rows. Existing games keep their snapshots. A new quiz also needs a card in `web/index.html` and matching UI copy in `web/app.js`.

See `docs/animals.md`, `docs/plants.md`, `docs/dogs.md` and `docs/traffic.md` for content scope. Photo attributions remain accessible from the footer and in the source manifests under `docs/`. Flags come from [flag-icons 7.3.2](https://github.com/lipis/flag-icons/tree/v7.3.2), under its bundled MIT license. Preserve image credits and licenses when redistributing.

There are no accounts, analytics, advertising, or external fonts. Session IDs are bearer credentials stored per quiz in the browser. Voice, proper localization and parent controls remain future work.

## License

The application code is licensed under the GNU General Public License v3.0; see [LICENSE](LICENSE). Third-party assets retain their original licenses: flags use the bundled MIT license, photographs and road-sign SVGs use the individual licenses listed on the credits page and in the source manifests under `docs/`. The six original traffic-light/crossing illustrations are CC0 (see `docs/traffic.md`). The application license does not replace those asset licenses.
