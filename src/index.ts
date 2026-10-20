interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  QUIZ_LENGTH: string;
  SESSION_TTL_DAYS: string;
}
interface Subject { id: string; label: string; image_url: string }
interface Option { id: string; label: string }
interface Round {
  id: string;
  prompt: string;
  image_url: string;
  options: Option[];
  correct_id: string;
  selected_id?: string;
}
interface Session {
  id: string;
  quiz_id: string;
  quiz_title: string;
  rounds: string;
  revision: number;
}
class Problem extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const missing = () => new Problem(404, 'Квиз или игра нису пронађени.');
const invalid = () => new Problem(400, 'Изабери један од четири понуђена одговора.');
const conflict = () => new Problem(409, 'На ово питање је већ одговорено или још није на реду. Поново учитај страницу за наставак.');
const now = () => Math.floor(Date.now() / 1000);

function integer(value: string, fallback: number, max: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : fallback;
}
function shuffle<T>(items: T[]): T[] {
  // Quiz order is not a security boundary; session credentials use crypto.randomUUID.
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
function buildRounds(bank: Subject[], count: number, prompt: string): Round[] {
  if (bank.length < 4) throw missing();
  return shuffle([...bank]).slice(0, count).map((subject) => {
    // Partial shuffle selects three distractors without shuffling the entire bank per question.
    const other = bank.filter((item) => item.id !== subject.id);
    for (let i = 0; i < 3; i++) {
      const j = i + Math.floor(Math.random() * (other.length - i));
      [other[i], other[j]] = [other[j], other[i]];
    }
    const options = shuffle([subject, ...other.slice(0, 3)].map(({ id, label }) => ({ id, label })));
    return { id: subject.id, prompt, image_url: subject.image_url, options, correct_id: subject.id };
  });
}
function state(session: Session, rounds: Round[]) {
  const answered = rounds.filter((round) => round.selected_id !== undefined).length;
  const current = rounds.find((round) => round.selected_id === undefined);
  return {
    id: session.id, quiz_id: session.quiz_id, quiz_title: session.quiz_title,
    total: rounds.length, answered,
    score: rounds.filter((round) => round.selected_id === round.correct_id).length,
    complete: answered === rounds.length,
    ...(current ? { question: {
      id: current.id, prompt: current.prompt, image_url: current.image_url, options: current.options,
    } } : {}),
  };
}
async function load(db: D1Database, id: string): Promise<Session> {
  const session = await db.prepare('SELECT id,quiz_id,quiz_title,rounds,revision FROM sessions WHERE id=?1 AND expires_at>?2')
    .bind(id, now()).first<Session>();
  if (!session) throw missing();
  return session;
}
async function start(env: Env, quizID: string) {
  const quiz = await env.DB.prepare('SELECT title,prompt FROM quizzes WHERE id=?1').bind(quizID)
    .first<{ title: string; prompt: string }>();
  if (!quiz) throw missing();
  const bank = await env.DB.prepare('SELECT id,label,image_url FROM questions WHERE quiz_id=?1 ORDER BY id')
    .bind(quizID).all<Subject>();
  const rounds = buildRounds(bank.results, integer(env.QUIZ_LENGTH, 30, 100), quiz.prompt);
  const session: Session = {
    id: crypto.randomUUID().replaceAll('-', ''), quiz_id: quizID, quiz_title: quiz.title,
    rounds: JSON.stringify(rounds), revision: 0,
  };
  const created = now();
  await env.DB.prepare('INSERT INTO sessions(id,quiz_id,quiz_title,rounds,created_at,expires_at) VALUES (?1,?2,?3,?4,?5,?6)')
    .bind(session.id, quizID, quiz.title, session.rounds, created,
      created + integer(env.SESSION_TTL_DAYS, 30, 365) * 86400).run();
  return state(session, rounds);
}
async function answer(db: D1Database, id: string, questionID: string, optionID: string) {
  // A conditional single-row update replaces Postgres row locks. On a race, reload
  // the winning version and revalidate: same answer is idempotent; a different one conflicts.
  for (let attempt = 0; attempt < 3; attempt++) {
    const session = await load(db, id);
    const rounds: Round[] = JSON.parse(session.rounds);
    const round = rounds.find((item) => item.id === questionID);
    if (!round || !round.options.some((option) => option.id === optionID)) throw invalid();
    if (round.selected_id !== undefined && round.selected_id !== optionID) throw conflict();
    if (round.selected_id === undefined) {
      if (rounds.find((item) => item.selected_id === undefined) !== round) throw conflict();
      round.selected_id = optionID;
      const result = await db.prepare('UPDATE sessions SET rounds=?1,revision=revision+1 WHERE id=?2 AND revision=?3 AND expires_at>?4')
        .bind(JSON.stringify(rounds), id, session.revision, now()).run();
      if (result.meta.changes !== 1) continue;
    }
    return {
      correct: optionID === round.correct_id,
      correct_id: round.correct_id,
      correct_label: round.options.find((option) => option.id === round.correct_id)!.label,
      state: state(session, rounds),
    };
  }
  throw conflict();
}
async function saveHighScore(db: D1Database, sessionID: string, input: string) {
  const name = input.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!name || Array.from(name).length > 30 || /[\p{Cc}\p{Cf}]/u.test(input)) {
    throw new Problem(400, 'Унеси име или надимак од 1 до 30 знакова.');
  }
  // Compute the score from stored answers and gate on completion/expiry in the
  // same INSERT. A unique session key makes concurrent retries idempotent.
  await db.prepare(`INSERT INTO high_scores(session_id,quiz_id,player_name,score,total,created_at)
    SELECT s.id,s.quiz_id,?2,
      (SELECT count(*) FROM json_each(s.rounds) r WHERE json_extract(r.value,'$.selected_id')=json_extract(r.value,'$.correct_id')),
      json_array_length(s.rounds),?3
    FROM sessions s WHERE s.id=?1 AND s.expires_at>?3
      AND NOT EXISTS (SELECT 1 FROM json_each(s.rounds) r WHERE json_extract(r.value,'$.selected_id') IS NULL)
    ON CONFLICT(session_id) DO NOTHING`).bind(sessionID, name, now()).run();
  const entry = await db.prepare('SELECT id,player_name FROM high_scores WHERE session_id=?1')
    .bind(sessionID).first<{ id: number; player_name: string }>();
  if (entry) {
    if (entry.player_name !== name) throw new Problem(409, 'Резултат ове игре је већ сачуван.');
    return { id: entry.id, name: entry.player_name };
  }
  await load(db, sessionID); // Distinguish missing/expired from unfinished games.
  throw new Problem(409, 'Прво заврши квиз да сачуваш резултат.');
}
async function highScores(db: D1Database, quizID: string) {
  if (quizID && !await db.prepare('SELECT id FROM quizzes WHERE id=?1').bind(quizID).first()) throw missing();
  const result = await db.prepare(`SELECT h.id,h.player_name AS name,h.quiz_id,q.title AS quiz_title,h.score,h.total,h.created_at
    FROM high_scores h JOIN quizzes q ON q.id=h.quiz_id
    ${quizID ? 'WHERE h.quiz_id=?1' : ''}
    ORDER BY h.accuracy DESC,h.score DESC,h.created_at,h.id LIMIT 100`);
  return (await (quizID ? result.bind(quizID) : result).all()).results;
}
async function body(request: Request, fields: string[]): Promise<Record<string, string>> {
  const bad = () => new Problem(400, 'Захтев није исправан.');
  // Bound the actual stream, not just the untrusted Content-Length header.
  const reader = request.body?.getReader();
  if (!reader) throw bad();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4096) { await reader.cancel(); throw new Problem(413, 'Захтев је превелик.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw bad(); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw bad();
  const record = parsed as Record<string, unknown>;
  if (Object.keys(record).some((key) => !fields.includes(key)) ||
      fields.some((key) => typeof record[key] !== 'string' || !record[key] || (record[key] as string).length > 100)) throw bad();
  return record as Record<string, string>;
}
function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  } });
}
async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/api/high-scores' && request.method === 'GET') {
    return json(await highScores(env.DB, url.searchParams.get('quiz_id') || ''));
  }
  const scoreMatch = /^\/api\/sessions\/([a-f0-9]{32})\/high-score$/.exec(path);
  if (scoreMatch && request.method === 'POST') {
    const input = await body(request, ['name']);
    return json(await saveHighScore(env.DB, scoreMatch[1], input.name));
  }
  if (path === '/healthz' && request.method === 'GET') {
    await env.DB.prepare('SELECT 1 FROM quizzes LIMIT 1').first();
    return json({ status: 'ok' });
  }
  if (path === '/api/quizzes' && request.method === 'GET') {
    const result = await env.DB.prepare(`SELECT q.id,q.title,q.description,count(i.id) AS question_count
      FROM quizzes q JOIN questions i ON i.quiz_id=q.id GROUP BY q.id HAVING count(i.id)>=4 ORDER BY q.title`).all<{ question_count: number }>();
    return json(result.results.map((quiz) => ({ ...quiz, round_length: Math.min(integer(env.QUIZ_LENGTH, 30, 100), quiz.question_count) })));
  }
  if (path === '/api/sessions' && request.method === 'POST') {
    const input = await body(request, ['quiz_id']);
    return json(await start(env, input.quiz_id), 201);
  }
  const match = /^\/api\/sessions\/([a-f0-9]{32})(\/answers)?$/.exec(path);
  if (match && !match[2] && request.method === 'GET') {
    const session = await load(env.DB, match[1]);
    return json(state(session, JSON.parse(session.rounds)));
  }
  if (match?.[2] && request.method === 'POST') {
    const input = await body(request, ['question_id', 'option_id']);
    return json(await answer(env.DB, match[1], input.question_id, input.option_id));
  }
  if (path.startsWith('/api/') || path === '/healthz') throw new Problem(404, 'Није пронађено.');
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try { return await route(request, env); }
    catch (error) {
      if (error instanceof Problem) return json({ error: error.message }, error.status);
      // Avoid logging session credentials or submitted content.
      console.error('Database or internal request failure', error instanceof Error ? error.message : 'unknown error');
      return json({ error: 'Нешто није у реду. Покушај поново.' }, 500);
    }
  },
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    // Bound cleanup work per run; expire reads immediately even if deletion is delayed.
    await env.DB.prepare('DELETE FROM sessions WHERE id IN (SELECT id FROM sessions WHERE expires_at<=?1 ORDER BY expires_at LIMIT 10000)')
      .bind(now()).run();
  },
} satisfies ExportedHandler<Env>;
