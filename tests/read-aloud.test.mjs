import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createReader, readingClips } from '../web/read-aloud.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture(play = () => Promise.resolve()) {
  const sources = [], highlights = [], states = [], errors = [];
  const audio = {
    set src(value) { sources.push(value); },
    play, pause() {}, load() {}, removeAttribute() {},
  };
  const reader = createReader({
    createAudio: () => audio,
    onHighlight: (id) => highlights.push(id),
    onPlaying: (playing) => states.push(playing),
    onError: () => errors.push(true),
  });
  return { reader, audio, sources, highlights, states, errors };
}

test('locale keys select the prompt and all four choices in displayed order', async () => {
  const catalogue = JSON.parse(await readFile('web/locales/sr-Cyrl.json', 'utf8'));
  const question = {
    prompt: catalogue.messages['quiz.animals.prompt'],
    options: ['horse', 'cat', 'dog', 'hedgehog'].map((id) => ({ id, label: catalogue.messages[`answer.animals.${id}`] })),
  };
  const clips = readingClips(catalogue, 'animals', question);
  assert.equal(clips.length, 5);
  assert.deepEqual(clips.map((clip) => clip.optionID), [null, 'horse', 'cat', 'dog', 'hedgehog']);
  assert.equal(clips[0].url, catalogue.audio['quiz.animals.prompt']);
  question.options[0].label = 'Text from an older saved game';
  assert.deepEqual(readingClips(catalogue, 'animals', question), []);
});

test('recordings play sequentially and highlight the choice being read', async () => {
  const f = fixture();
  const done = f.reader.play([{ url: '/prompt.mp3', optionID: null }, { url: '/horse.mp3', optionID: 'horse' }]);
  assert.deepEqual(f.sources, ['/prompt.mp3']);
  f.audio.onended();
  await tick();
  assert.deepEqual(f.sources, ['/prompt.mp3', '/horse.mp3']);
  assert.equal(f.highlights.at(-1), 'horse');
  f.audio.onended();
  await done;
  assert.equal(f.highlights.at(-1), null);
  assert.equal(f.states.at(-1), false);
});

test('stop cancels pending playback and prevents subsequent clips', async () => {
  const f = fixture();
  const done = f.reader.play([{ url: '/one.mp3' }, { url: '/two.mp3' }]);
  f.reader.stop();
  await done;
  assert.deepEqual(f.sources, ['/one.mp3']);
  assert.equal(f.audio.onended, null);
  assert.deepEqual(f.errors, []);
});

test('an old play rejection cannot cancel the next question', async () => {
  let rejectOld;
  let first = true;
  const f = fixture(() => {
    if (first) { first = false; return new Promise((_, reject) => { rejectOld = reject; }); }
    return Promise.resolve();
  });
  const old = f.reader.play([{ url: '/old.mp3' }, { url: '/old-answer.mp3' }]);
  const current = f.reader.play([{ url: '/new.mp3' }, { url: '/new-answer.mp3' }]);
  rejectOld(new Error('aborted'));
  await tick();
  f.audio.onended();
  await tick();
  assert.deepEqual(f.sources, ['/old.mp3', '/new.mp3', '/new-answer.mp3']);
  f.audio.onended();
  await Promise.all([old, current]);
  assert.deepEqual(f.errors, []);
});

test('blocked autoplay and missing audio report failure and clear highlighting', async () => {
  const blocked = fixture(() => Promise.reject(new Error('NotAllowedError')));
  await blocked.reader.play([{ url: '/prompt.mp3' }]);
  assert.equal(blocked.errors.length, 1);
  assert.equal(blocked.states.at(-1), false);
  const missing = fixture();
  const done = missing.reader.play([{ url: '/missing.mp3', optionID: 'horse' }]);
  missing.audio.onerror();
  await done;
  assert.equal(missing.errors.length, 1);
  assert.equal(missing.highlights.at(-1), null);
});

test('the same IDs resolve different text and audio in another locale', () => {
  const question = { prompt: 'Koja je ovo životinja?', options: [{ id: 'dog', label: 'Pas' }] };
  const catalogue = {
    messages: { 'quiz.animals.prompt': question.prompt, 'answer.animals.dog': 'Pas' },
    audio: { 'quiz.animals.prompt': '/audio/hr/question.mp3', 'answer.animals.dog': '/audio/hr/dog.mp3' },
  };
  assert.deepEqual(readingClips(catalogue, 'animals', question), [
    { url: '/audio/hr/question.mp3', optionID: null },
    { url: '/audio/hr/dog.mp3', optionID: 'dog' },
  ]);
  assert.deepEqual(readingClips(catalogue, 'animals', { ...question, prompt: 'Која је ово животиња?' }), []);
});
