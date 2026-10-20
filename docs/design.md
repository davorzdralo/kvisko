# Kvisko design

## Product

One image, a short prompt and four large answer buttons. Each game draws a random subset without replacement from a larger question bank. Four packs currently provide 401 subjects: 249 flags, 40 animals, 72 plants/produce and 40 dog breeds. Labels use Serbian Cyrillic and familiar child-friendly categories. There is no timer, penalty, login or collection of children's personal details. Mouse/touch and keys 1–4 select answers; Enter continues after gentle feedback.

## Cloudflare architecture

A TypeScript Worker implements the API; D1 stores quiz content and games. Workers Static Assets serves HTML/CSS/vanilla JavaScript and all pictures directly. Only `/api/*` and `/healthz` invoke the Worker first, keeping picture requests outside the Worker request quota. Static headers live in `web/_headers`; API responses use `no-store` and security headers in code. The frontend API contract is unchanged from the original Go/Postgres prototype.

Wrangler uses the local Workers runtime and a persistent local D1 database for development. The same Worker and migrations are used locally and in Cloudflare. Docker is an optional wrapper for local development, not the production deployment format. No separate Postgres service or cloud connection is needed for local play.

## Data and consistency

- `quizzes`: stable slug, title, prompt and description.
- `questions`: quiz slug, stable subject ID, unique label and image URL. Other subjects in the same bank supply distractors.
- `sessions`: random opaque 128-bit ID; quiz slug/title snapshot; ordered round snapshots in JSON; revision counter; creation and expiry timestamps (Unix seconds).

Starting a game reads its bank, samples without replacement, chooses three distinct distractors and shuffles four options. A single INSERT stores the whole game atomically. The maximum is 100 rounds, well below D1's row-size limit for current content. Correct answers and future questions stay server-side. The current subject ID follows the original API convention, so answer IDs and image filenames are not intended to provide cheat resistance.

Each answer loads the session, checks the offered option and the first unanswered question, then conditionally updates its JSON using `WHERE id=? AND revision=? AND expires_at>?`. The revision increments in that same UPDATE. A competing request reloads and revalidates after a lost update attempt. Repeating an accepted answer returns feedback without another write; changing an accepted answer conflicts. This preserves scoring across multiple Worker instances without process locks or Postgres transactions. State responses explicitly select public fields, never serialize stored rounds wholesale.

Reading sessions filters out expired records immediately. A daily 03:00 UTC Cron Trigger deletes up to 10,000 expired sessions using an expiry index; delayed cleanup cannot make an expired game playable. Expiry is fixed at creation (30 days by default). Browser-local IDs for expired games are cleared when resuming returns 404. Scheduled cleanup runs in Cloudflare; to test it locally use Wrangler's scheduled-event endpoint (see deployment guide).

Source JSON generates idempotent SQL upserts in `data/seed.sql`. Schema migrations and content seeding are explicit deployment steps, never executed on API requests. Existing sessions snapshot titles, labels and options, so content updates do not change games in progress. Original Postgres game records are not imported.

## API

- `GET /healthz`: database/schema availability.
- `GET /api/quizzes`: available quizzes, bank sizes and configured round lengths.
- `POST /api/sessions` with `{"quiz_id":"world-flags"}`: create a game and return its current state (201).
- `GET /api/sessions/{id}`: quiz identity, current question, score, answered count, total and completion.
- `POST /api/sessions/{id}/answers` with `{"question_id":"rs","option_id":"fr"}`: return correct-answer feedback and the next state.

JSON bodies are capped at 4 KiB while streaming. Required fields must be nonempty strings; unknown fields and malformed JSON are rejected. Invalid choices return 400; missing/expired games 404; conflicting/out-of-order answers 409; oversized bodies 413. Parameters are bound, not interpolated. API responses are never cached. The browser only displays the next question after the child continues.

## Operations and future work

Free-tier quotas are shared across the account. D1 meters scanned rows, writes and index maintenance; starting games scans a bank, while answering/resuming uses an indexed single-session lookup. One answer normally uses one read and one write, with extra reads on retries. Measure real usage/CPU in a deployed preview before estimating public capacity. Session storage grows with games played until expiry; tune retention to stay below the 500 MB free single-database limit.

Session URLs are bearer credentials. There are no accounts or leaderboards. For a public audience, configure Cloudflare rate limiting/abuse controls appropriate to traffic and monitor quotas; application-level per-IP throttling is not implemented. HTTPS is supplied by Cloudflare. D1 Time Travel provides limited recovery; export backups separately before risky migrations. See `cloudflare.md` for setup and backup commands.

Future work includes voice prompts/playback, localization, parent-selected difficulty/round lengths, additional curated packs and an authoring workflow. GitHub CI deployment will be configured once the repository and Cloudflare account/database exist.
