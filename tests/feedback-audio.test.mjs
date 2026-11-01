import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { feedbackClips } from '../web/read-aloud.js';

const catalogue = async (locale) => JSON.parse(await readFile(`web/locales/${locale}.json`, 'utf8'));

test('dings play for correct and incorrect answers with reading disabled or no catalogue', () => {
  assert.deepEqual(feedbackClips(null, 'animals', { correct: true }, false), [{ url: '/audio/effects/correct.wav', optionID: null }]);
  assert.deepEqual(feedbackClips(null, 'animals', { correct: false }, true), [{ url: '/audio/effects/incorrect.wav', optionID: null }]);
});

test('all three localised praise variants follow the positive ding', async () => {
  for (const locale of ['sr-Cyrl', 'hr', 'en']) {
    const c = await catalogue(locale);
    for (const [random, key] of [[0, 'bravo'], [0.5, 'correct'], [0.999, 'right']]) {
      const clips = feedbackClips(c, 'animals', { correct: true }, true, () => random);
      assert.equal(clips[0].url, '/audio/effects/correct.wav');
      assert.equal(clips[1].url, c.audio[`feedback.${key}`]);
      assert.ok(clips[1].url.startsWith(`/audio/${locale}/`));
      assert.equal(clips.length, 2);
    }
  }
});

test('incorrect feedback reads the localised prefix and correct answer after the negative ding', async () => {
  for (const locale of ['sr-Cyrl', 'hr', 'en']) {
    const c = await catalogue(locale);
    const feedback = { correct: false, correct_id: 'dog', correct_label: c.messages['answer.animals.dog'] };
    assert.deepEqual(feedbackClips(c, 'animals', feedback, true), [
      { url: '/audio/effects/incorrect.wav', optionID: null },
      { url: c.audio['feedback.correctAnswer'], optionID: null },
      { url: c.audio['answer.animals.dog'], optionID: 'dog' },
    ]);
    assert.equal(feedbackClips(c, 'animals', feedback, false).length, 1);
    assert.equal(feedbackClips(c, 'animals', { ...feedback, correct_label: 'A different saved label' }, true).length, 1);
    assert.equal(feedbackClips(c, 'animals', { ...feedback, correct_id: 'retired-subject' }, true).length, 1);
  }
});
