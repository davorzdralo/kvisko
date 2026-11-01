# Read-aloud and localisation

Serbian Cyrillic (`sr-Cyrl`) is the current language. Read-aloud uses the male
`sr-RS-NicholasNeural` voice at `-10%` speed. Players switch **Читај наглас** on
once; each newly opened question then reads its prompt and four answers in their
shuffled display order. The current answer is highlighted while it plays. The
preference is stored locally; it defaults to off. Turning it off, answering,
leaving a quiz, or hiding the page stops playback. Reading never selects answers
or delays play. Browser autoplay restrictions may require switching reading off
and on again after a reload; playback failure shows that recovery instruction.

## Stable IDs and translated text

`data/quizzes.json` and `data/{pack}.json` contain language-neutral IDs and image
paths. Keep IDs stable, even when wording changes. They are identifiers, not
English sentences that need replacing. Country codes remain valid identifiers.

`data/locales/sr-Cyrl.json` owns the Serbian text and voice configuration. Keys
include `quiz.animals.prompt` and `answer.animals.dog`. Quiz titles, descriptions,
answer labels, and audio-control copy live here. Existing page/UI copy outside
the audio controls remains Serbian; extract it into locale keys when adding UI
localisation.

`npm run content:generate` builds the Serbian D1 seed and the public locale
catalogues in `web/locales/`. Each catalogue includes a key-to-audio manifest.
Audio filenames hash the locale, voice, speed, and text, so changed wording gets
a new URL while unchanged clips remain reusable. Identical text within a locale
shares a recording. Generation does not change the existing Serbian database
content or migrate saved games.

Sessions already snapshot prompt and answer text. Playback verifies that a
saved game's displayed text matches the catalogue before using its clips. An
older game whose wording no longer matches remains playable with reading
unavailable for that question, rather than playing different text.

## Generate recordings

Generation uses the Microsoft Edge online TTS service through `edge-tts`;
playback only fetches bundled assets from this site. No speech service, key, or
Python dependency is needed on the server or during play.

```sh
python3 -m venv /tmp/kvisko-audio-venv
/tmp/kvisko-audio-venv/bin/pip install -r scripts/requirements-audio.txt
npm run content:generate
/tmp/kvisko-audio-venv/bin/python scripts/generate-audio.py --locale sr-Cyrl
npm test
```

The generator sends locale text to the service, uses three concurrent requests,
retries transient failures, and writes each recording atomically. Rerunning it
skips files already generated. To regenerate an individual recording, remove
its MP3 first. Commit the generated catalogue and audio alongside source changes.
`content:check` checks catalogue freshness and every referenced audio file.
Old unused recordings can be removed after considering saved-game compatibility.

Human recordings can replace individual MP3s at the manifest's paths without
changing playback code. Use the exact catalogue wording. A full human-recorded
voice can use a new `voice` identifier in the locale source, followed by content
generation and recording all the resulting paths. Keep volume and pacing
consistent across clips.

## Next localisation steps

Croatian UI localisation remains a separate future feature. Add locale keys for
static HTML and the remaining JavaScript/server messages, then introduce an
explicit language choice with Serbian fallback. Quiz reading does not depend on
implementing that UI work first.

For Croatian quiz content, add a complete `data/locales/hr.json` with the same
message keys, reviewed Croatian wording, and `hr-HR-SreckoNeural` as the preferred
male voice. The generator already supports additional complete catalogues, but
adding a file alone does not switch the UI or game language. Add explicit
locale selection to game creation and persist it with the session's translated
text snapshots. Keep answer IDs unchanged so scoring remains independent of
language. Resolve text and matching audio from that session locale, never from
a guessed browser voice or translated display label. Add integration tests for
mixed-language sessions and resuming after changing the preferred UI language.
