import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatMessage, normaliseLocale } from '../web/i18n.js';
import { localiseQuestion, answerText } from '../web/localised-content.js';
import { readingClips } from '../web/read-aloud.js';

const read = async (name) => JSON.parse(await readFile(name, 'utf8'));
const locales = ['sr-Cyrl', 'hr', 'en'];

test('all UI and every quiz answer have complete translations in all three languages', async () => {
  const packs = await read('data/quizzes.json');
  const baseline = await read('data/ui/sr-Cyrl.json');
  for (const locale of locales) {
    const ui = await read(`data/ui/${locale}.json`);
    assert.deepEqual(Object.keys(ui).sort(), Object.keys(baseline).sort());
    const content = await read(`web/locales/${locale}.json`);
    for (const pack of packs) {
      for (const field of ['title', 'description', 'prompt']) assert.ok(content.messages[`quiz.${pack.id}.${field}`]);
      const subjects = await read(`data/${pack.file}.json`);
      const labels = subjects.map((item) => content.messages[`answer.${pack.id}.${item.id}`]);
      assert.ok(labels.every((label) => typeof label === 'string' && label.trim()));
      assert.equal(new Set(labels).size, labels.length, `${locale}/${pack.id} has ambiguous duplicate labels`);
    }
    for (const file of ['index.html', 'high-scores.html', 'credits.html']) {
      const html = await readFile(`web/${file}`, 'utf8');
      for (const match of html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) assert.ok(ui[match[1]], `Missing ${locale}/${match[1]}`);
    }
    const expectedVoice = { 'sr-Cyrl': 'sr-RS-NicholasNeural', hr: 'hr-HR-SreckoNeural', en: 'en-GB-RyanNeural' }[locale];
    assert.equal(content.voice, expectedVoice);
    const spokenKeys = Object.keys(content.messages).filter((key) => key.startsWith('answer.') || key.startsWith('quiz.') && key.endsWith('.prompt'));
    assert.deepEqual(Object.keys(content.audio).sort(), spokenKeys.sort());
    for (const url of Object.values(content.audio)) assert.ok(url.startsWith(`/audio/${locale}/`), `Wrong language audio: ${url}`);
  }
});

test('language changes translate the same shuffled answers without mutating saved game state', async () => {
  const question = { id: 'horse', prompt: 'Која је ово животиња?', options: [{ id: 'dog', label: 'Пас' }, { id: 'horse', label: 'Коњ' }] };
  const original = structuredClone(question);
  const english = await read('web/locales/en.json');
  const croatian = await read('web/locales/hr.json');
  const en = localiseQuestion(english, 'animals', question);
  const hr = localiseQuestion(croatian, 'animals', question);
  assert.equal(en.prompt, 'Which animal is this?');
  assert.deepEqual(en.options, [{ id: 'dog', label: 'Dog' }, { id: 'horse', label: 'Horse' }]);
  assert.deepEqual(hr.options.map((option) => option.label), ['Pas', 'Konj']);
  assert.deepEqual(en.options.map((option) => option.id), question.options.map((option) => option.id));
  assert.deepEqual(question, original);
  assert.deepEqual(readingClips(english, 'animals', en).map((clip) => clip.url), [english.audio['quiz.animals.prompt'], english.audio['answer.animals.dog'], english.audio['answer.animals.horse']]);
  assert.deepEqual(readingClips(croatian, 'animals', hr).map((clip) => clip.url), [croatian.audio['quiz.animals.prompt'], croatian.audio['answer.animals.dog'], croatian.audio['answer.animals.horse']]);
  assert.deepEqual(readingClips(english, 'animals', hr), [], 'Croatian text cannot play English recordings');
});

test('Serbian snapshots and retired content keep their original wording', async () => {
  const serbian = await read('web/locales/sr-Cyrl.json');
  const english = await read('web/locales/en.json');
  assert.equal(answerText(serbian, 'animals', 'dog', 'Стари назив'), 'Стари назив');
  assert.equal(answerText(english, 'shapes-colours', 'red-oval', 'Црвени овал'), 'Црвени овал');
});

test('unsupported language choices fall back to Serbian and messages preserve literal player input', () => {
  assert.equal(normaliseLocale('hr'), 'hr');
  assert.equal(normaliseLocale('en'), 'en');
  for (const value of [null, 'de', '../en', '']) assert.equal(normaliseLocale(value), 'sr-Cyrl');
  assert.equal(formatMessage({ saved: 'Well done, {name}!' }, 'saved', { name: '<b>{count}</b>' }), 'Well done, <b>{count}</b>!');
});
