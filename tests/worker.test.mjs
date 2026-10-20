import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import worker from '../.worker-build/index.js';

let mf, db;
before(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    scriptPath: '.worker-build/index.js',
    compatibilityDate: '2026-10-20',
    d1Databases: ['DB'],
    bindings: { QUIZ_LENGTH: '30', SESSION_TTL_DAYS: '30' },
  }));
  db = await mf.getD1Database('DB');
  const migrations = (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort();
  for (const name of [...migrations.map((name) => `migrations/${name}`), 'data/seed.sql']) {
    const sql = (await readFile(name, 'utf8')).replace(/^--.*$/gm, '');
    const statements = sql.split(/;\s*(?:\n|$)/).filter((statement) => statement.trim());
    await db.batch(statements.map((statement) => db.prepare(statement)));
  }
});
after(async () => { await mf?.dispose(); });

async function api(path, body, expected = 200) {
  const response = await mf.dispatchFetch(`http://local${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  return result;
}

test('country flag bank upgrades remove territories without changing saved games', async () => {
  const flags = JSON.parse(await readFile('data/flags.json', 'utf8'));
  assert.equal(flags.length, 199);
  const ids = new Set(flags.map((flag) => flag.id));
  for (const id of ['us', 'gb', 'gb-eng', 'gb-sct', 'gb-wls', 'ps', 'tw', 'va']) {
    assert.ok(ids.has(id), `Missing country: ${id}`);
  }
  for (const id of ['um', 'aq', 'gg', 'gb-nir', 'hk', 'aw', 'cw', 'sx', 'ck', 'nu', 'eh']) {
    assert.ok(!ids.has(id), `Unexpected entry: ${id}`);
  }

  // Simulate upgrading a database containing territory questions and a saved game.
  const session = await api('/api/sessions', { quiz_id: 'world-flags' }, 201);
  const { rounds } = await db.prepare('SELECT rounds FROM sessions WHERE id=?').bind(session.id).first();
  const savedRounds = JSON.parse(rounds);
  savedRounds[0].id = 'um';
  const snapshot = JSON.stringify(savedRounds);
  await db.batch([
    db.prepare('UPDATE sessions SET rounds=? WHERE id=?').bind(snapshot, session.id),
    ...['um', 'aq', 'gg'].map((id) => db.prepare(
      'INSERT INTO questions(quiz_id,id,label,image_url) VALUES (?,?,?,?)',
    ).bind('world-flags', id, `Legacy ${id}`, `/flags/${id}.svg`)),
  ]);
  const migration = await readFile('migrations/0003_country_flags.sql', 'utf8');
  await db.prepare(migration).run();
  const { results } = await db.prepare("SELECT id FROM questions WHERE quiz_id='world-flags'").all();
  assert.deepEqual(new Set(results.map((row) => row.id)), ids);
  assert.equal((await db.prepare('SELECT rounds FROM sessions WHERE id=?').bind(session.id).first()).rounds, snapshot);
  assert.equal((await api(`/api/sessions/${session.id}`)).question.id, 'um');
});

test('all five packs: complete games, scoring, resume, retries and independent random samples', async () => {
  const quizzes = await api('/api/quizzes');
  assert.equal(quizzes.length, 5);
  for (const quiz of quizzes) {
    let state = await api('/api/sessions', { quiz_id: quiz.id }, 201);
    const path = `/api/sessions/${state.id}`;
    assert.equal(state.total, 30);
    assert.deepEqual(await api(path), state);
    const seen = new Set();
    let score = 0;
    while (!state.complete) {
      const q = state.question;
      assert.equal('correct_id' in q, false);
      assert.equal('selected_id' in q, false);
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options.map((o) => o.id)).size, 4);
      assert.ok(!seen.has(q.id));
      seen.add(q.id);
      const correct = state.answered % 2 === 0;
      const choice = correct ? q.id : q.options.find((o) => o.id !== q.id).id;
      const input = { question_id: q.id, option_id: choice };
      const result = await api(`${path}/answers`, input);
      assert.equal(result.correct, correct);
      assert.equal(result.correct_id, q.id);
      score += Number(correct);
      assert.equal(result.state.score, score);
      assert.equal(result.state.answered, seen.size);
      assert.deepEqual(await api(`${path}/answers`, input), result);
      const different = q.options.find((o) => o.id !== choice).id;
      await api(`${path}/answers`, { question_id: q.id, option_id: different }, 409);
      state = result.state;
      assert.deepEqual(await api(path), state);
    }
    assert.equal(state.answered, state.total);
    assert.equal('question' in state, false);
    const starts = await Promise.all(Array.from({ length: 6 }, () => api('/api/sessions', { quiz_id: quiz.id }, 201)));
    assert.ok(new Set(starts.map((s) => s.question.id)).size > 1);
  }
});

test('simultaneous identical and competing submissions never double count or overwrite', async () => {
  for (const competing of [false, true]) {
    const session = await api('/api/sessions', { quiz_id: 'animals' }, 201);
    const path = `/api/sessions/${session.id}`;
    const q = session.question;
    const choices = [q.id, competing ? q.options.find((o) => o.id !== q.id).id : q.id];
    const results = await Promise.all(choices.map(async (option_id) => {
      const response = await mf.dispatchFetch(`http://local${path}/answers`, {
        method: 'POST', body: JSON.stringify({ question_id: q.id, option_id }),
      });
      return { status: response.status, body: await response.json() };
    }));
    assert.deepEqual(results.map((r) => r.status).sort(), competing ? [200, 409] : [200, 200]);
    const latest = await api(path);
    assert.equal(latest.answered, 1);
    assert.equal(latest.score, results.find((r) => r.status === 200).body.state.score);
    const row = await db.prepare('SELECT revision FROM sessions WHERE id=?').bind(session.id).first();
    assert.equal(row.revision, 1);
  }
});

test('invalid, out-of-order, expired and malformed requests cannot mutate games', async () => {
  await api('/api/sessions', { quiz_id: 'missing' }, 404);
  await api('/api/sessions', { quiz_id: 'animals', extra: 'unexpected' }, 400);
  await api('/api/sessions', [], 400);
  await api('/api/sessions', { quiz_id: null }, 400);
  const session = await api('/api/sessions', { quiz_id: 'plants' }, 201);
  const path = `/api/sessions/${session.id}`;
  await api(`${path}/answers`, { question_id: session.question.id, option_id: 'invalid' }, 400);
  const raw = await db.prepare('SELECT rounds FROM sessions WHERE id=?').bind(session.id).first();
  const future = JSON.parse(raw.rounds)[1];
  await api(`${path}/answers`, { question_id: future.id, option_id: future.correct_id }, 409);
  assert.deepEqual(await api(path), session);
  for (const payload of ['{invalid', JSON.stringify({ quiz_id: 'x'.repeat(5000) })]) {
    const response = await mf.dispatchFetch('http://local/api/sessions', { method: 'POST', body: payload });
    assert.equal(response.status, payload.startsWith('{invalid') ? 400 : 413);
    await response.text();
  }
  await db.prepare('UPDATE sessions SET expires_at=0 WHERE id=?').bind(session.id).run();
  await api(path, undefined, 404);
  await api(`${path}/answers`, { question_id: session.question.id, option_id: session.question.id }, 404);
});

test('session snapshots survive content updates', async () => {
  const session = await api('/api/sessions', { quiz_id: 'dog-breeds' }, 201);
  const path = `/api/sessions/${session.id}`;
  const original = await db.prepare("SELECT title FROM quizzes WHERE id='dog-breeds'").first();
  await db.prepare("UPDATE quizzes SET title='Нови назив' WHERE id='dog-breeds'").run();
  assert.deepEqual(await api(path), session);
  await db.prepare("UPDATE quizzes SET title=? WHERE id='dog-breeds'").bind(original.title).run();
});

test('configured length caps to the bank, invalid settings fall back, expiry is fixed at creation', async () => {
  for (const [length, days, expectedLength, expectedDays] of [['100', '1', 40, 1], ['bad', '0', 30, 30]]) {
    const response = await worker.fetch(new Request('http://local/api/sessions', {
      method: 'POST', body: JSON.stringify({ quiz_id: 'animals' }),
    }), { DB: db, QUIZ_LENGTH: length, SESSION_TTL_DAYS: days });
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.total, expectedLength);
    const row = await db.prepare('SELECT created_at,expires_at FROM sessions WHERE id=?').bind(result.id).first();
    assert.equal(row.expires_at - row.created_at, expectedDays * 86400);
  }
});

test('scheduled cleanup deletes expired games and preserves unexpired games', async () => {
  const expired = await api('/api/sessions', { quiz_id: 'animals' }, 201);
  const active = await api('/api/sessions', { quiz_id: 'animals' }, 201);
  await db.prepare('UPDATE sessions SET expires_at=0 WHERE id=?').bind(expired.id).run();
  await worker.scheduled({}, { DB: db });
  assert.equal(await db.prepare('SELECT id FROM sessions WHERE id=?').bind(expired.id).first(), null);
  assert.deepEqual(await api(`/api/sessions/${active.id}`), active);
});

async function finishedGame(quizID = 'animals', length = 3, correctCount = length) {
  const response = await worker.fetch(new Request('http://local/api/sessions', {
    method: 'POST', body: JSON.stringify({ quiz_id: quizID }),
  }), { DB: db, QUIZ_LENGTH: String(length), SESSION_TTL_DAYS: '30' });
  assert.equal(response.status, 201);
  let game = await response.json();
  while (!game.complete) {
    const q = game.question;
    const choice = game.answered < correctCount ? q.id : q.options.find((o) => o.id !== q.id).id;
    game = (await api(`/api/sessions/${game.id}/answers`, { question_id: q.id, option_id: choice })).state;
  }
  return game;
}

test('high scores use stored results, rank across lengths, filter quizzes and outlive session cleanup', async () => {
  assert.deepEqual(await api('/api/high-scores'), []);
  const games = [await finishedGame('animals', 3, 2), await finishedGame('plants', 2, 2), await finishedGame('animals', 3, 3)];
  for (const [i, game] of games.entries()) {
    const path = `/api/sessions/${game.id}/high-score`;
    const saved = await api(path, { name: `  Играч   ${i}  ` });
    assert.equal(saved.name, `Играч ${i}`);
    assert.deepEqual(await api(path, { name: `Играч ${i}` }), saved);
    await api(path, { name: 'Друго име' }, 409);
    await api(path, { name: 'Лажно', score: 999 }, 400);
  }
  const all = await api('/api/high-scores');
  assert.deepEqual(all.map((entry) => [entry.name, entry.score, entry.total]), [['Играч 2', 3, 3], ['Играч 1', 2, 2], ['Играч 0', 2, 3]]);
  assert.ok(all.every((entry) => !('session_id' in entry) && entry.quiz_title && entry.quiz_id));
  const animals = await api('/api/high-scores?quiz_id=animals');
  assert.deepEqual(animals.map((entry) => entry.name), ['Играч 2', 'Играч 0']);
  assert.deepEqual(await api('/api/high-scores?quiz_id=dog-breeds'), []);
  await api('/api/high-scores?quiz_id=missing', undefined, 404);
  await db.prepare('UPDATE sessions SET expires_at=0 WHERE id=?').bind(games[0].id).run();
  await worker.scheduled({}, { DB: db });
  assert.deepEqual(await api('/api/high-scores'), all);
});

test('unfinished/expired games and invalid names cannot add high scores', async () => {
  const unfinished = await api('/api/sessions', { quiz_id: 'animals' }, 201);
  const path = `/api/sessions/${unfinished.id}/high-score`;
  await api(path, { name: 'Меда' }, 409);
  const complete = await finishedGame();
  for (const name of ['', '   ', 'а'.repeat(31), 'Неко\nиме', '\u200bМеда']) {
    await api(`/api/sessions/${complete.id}/high-score`, { name }, 400);
  }
  await db.prepare('UPDATE sessions SET expires_at=0 WHERE id=?').bind(complete.id).run();
  await api(`/api/sessions/${complete.id}/high-score`, { name: 'Меда' }, 404);
  await api(`/api/sessions/${'0'.repeat(32)}/high-score`, { name: 'Меда' }, 404);
});

test('concurrent score submissions create one immutable entry; plain text names stay plain text', async () => {
  const game = await finishedGame();
  const path = `/api/sessions/${game.id}/high-score`;
  const name = '<b>Меда</b>';
  const results = await Promise.all(Array.from({ length: 4 }, () => api(path, { name })));
  assert.ok(results.every((entry) => entry.id === results[0].id && entry.name === name));
  const row = await db.prepare('SELECT count(*) AS count FROM high_scores WHERE session_id=?').bind(game.id).first();
  assert.equal(row.count, 1);
  assert.equal((await api('/api/high-scores')).find((entry) => entry.id === results[0].id).name, name);
  const competing = await finishedGame();
  const statuses = await Promise.all(['Меда', 'Лав'].map(async (name) => {
    const response = await mf.dispatchFetch(`http://local/api/sessions/${competing.id}/high-score`, {
      method: 'POST', body: JSON.stringify({ name }),
    });
    await response.text();
    return response.status;
  }));
  assert.deepEqual(statuses.sort(), [200, 409]);
});

test('leaderboards are bounded and equal scores keep their original submission order', async () => {
  await db.batch(Array.from({ length: 105 }, (_, index) => db.prepare(
    'INSERT INTO high_scores(session_id,quiz_id,player_name,score,total,created_at) VALUES (?1,?2,?3,?4,?5,?6)',
  ).bind(`limit-test-${index}`, 'world-flags', `Играч ${index}`, 1, 1, 1000 + index)));
  const scores = await api('/api/high-scores?quiz_id=world-flags');
  assert.equal(scores.length, 100);
  assert.equal(scores[0].name, 'Играч 0');
  assert.equal(scores.at(-1).name, 'Играч 99');
  assert.equal((await api('/api/high-scores')).length, 100);
});
