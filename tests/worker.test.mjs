import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  for (const name of ['migrations/0001_schema.sql', 'data/seed.sql']) {
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

test('all four packs: complete games, scoring, resume, retries and independent random samples', async () => {
  const quizzes = await api('/api/quizzes');
  assert.equal(quizzes.length, 4);
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
