const $ = (id) => document.getElementById(id);
let state = null;
let pendingState = null;
let busy = false;
let answered = false;
let quizzes = new Map();
let view = 'home';
let savingScore = false;
const savedScores = new Set();
const storageKey = 'kvisko-session';
const startButtons = [...document.querySelectorAll('[data-start]')];
const resumeButtons = [...document.querySelectorAll('[data-resume]')];

function stars(count) {
  const last = count % 10;
  const lastTwo = count % 100;
  return `${count} ${last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'звездице' : 'звездица'}`;
}
function remembered(quizID) {
  try { return localStorage.getItem(`${storageKey}:${quizID}`) || (quizID === 'world-flags' ? localStorage.getItem(storageKey) : null); }
  catch { return null; }
}
function remember(quizID, id) {
  try {
    const key = `${storageKey}:${quizID}`;
    if (id) localStorage.setItem(key, id); else localStorage.removeItem(key);
    if (quizID === 'world-flags') localStorage.removeItem(storageKey);
  } catch { /* Play still works without browser storage. */ }
}
function updateResumes() { resumeButtons.forEach((button) => button.hidden = !remembered(button.dataset.resume)); }
function show(name) {
  view = name;
  for (const id of ['home', 'game', 'result']) $(id).hidden = id !== name;
  $('error').hidden = true;
}
function error(message) { $('error').textContent = message; $('error').hidden = false; }
async function api(path, body) {
  let response;
  try {
    response = await fetch(path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new Error('Веза није успела. Покушај поново.'); }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const problem = new Error(data.error || 'Веза није успела. Покушај поново.');
    problem.status = response.status;
    throw problem;
  }
  return response.json();
}
function render(nextState) {
  state = nextState;
  pendingState = null;
  answered = false;
  const photoQuiz = state.quiz_id !== 'world-flags';
  $('game').classList.toggle('photo-game', photoQuiz);
  $('quiz-title').textContent = state.quiz_title;
  if (state.complete) {
    show('result');
    // Keep the finished game resumable until its optional score is saved.
    $('high-score-form').hidden = savedScores.has(state.id);
    $('player-name').value = '';
    $('score-saved').hidden = !savedScores.has(state.id);
    $('score-saved').textContent = 'Твој резултат је сачуван!';
    $('save-high-score').disabled = false;
    updateResumes();
    $('final-score').textContent = state.score;
    $('final-total').textContent = `од укупно ${state.total}`;
    $('result-subtitle').textContent = {
      'world-flags': 'Пут око света, заставу по заставу.',
      animals: 'Упознајемо животињски свет, слику по слику.',
      plants: 'Од баште до ливаде, слику по слику.',
      'dog-breeds': 'Упознајемо псе, расу по расу.'
    }[state.quiz_id] || 'Још једна пустоловина пуна открића.';
    $('result-message').textContent = state.score === state.total ? 'Сви одговори су тачни! Радозналост те је одвела далеко.' : 'Свако питање је прилика да научиш нешто ново. Хоћемо ли у још једну пустоловину?';
    $('result-title').focus();
    return;
  }
  show('game');
  $('position').textContent = `Питање ${state.answered + 1} од ${state.total}`;
  $('progress').max = state.total;
  $('progress').value = state.answered;
  $('score').textContent = `✦ ${stars(state.score)}`;
  $('question-title').textContent = state.question.prompt;
  $('image-error').hidden = true;
  $('question-image').src = state.question.image_url;
  $('feedback').hidden = true;
  $('next').hidden = true;
  $('options').replaceChildren();
  state.question.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.className = 'option';
    button.dataset.id = option.id;
    button.setAttribute('aria-keyshortcuts', String(index + 1));
    const number = document.createElement('span');
    number.className = 'option-number';
    number.textContent = index + 1;
    number.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = option.label;
    button.append(number, label);
    button.addEventListener('click', () => answer(option.id));
    $('options').append(button);
  });
  $('question-title').focus();
}
async function start(quizID) {
  if (busy || savingScore || !quizzes.has(quizID)) return;
  busy = true;
  startButtons.forEach((b) => b.disabled = true);
  $('again').disabled = true;
  $('error').hidden = true;
  try {
    const nextState = await api('/api/sessions', { quiz_id: quizID });
    remember(quizID, nextState.id);
    render(nextState);
  } catch (err) { error(err.message); }
  finally {
    busy = false;
    startButtons.forEach((b) => b.disabled = !quizzes.has(b.dataset.start));
    $('again').disabled = false;
  }
}
async function resume(quizID) {
  const id = remembered(quizID);
  if (busy || !id) return;
  busy = true;
  try { render(await api(`/api/sessions/${encodeURIComponent(id)}`)); }
  catch (err) {
    if (err.status === 404) { remember(quizID, null); updateResumes(); }
    error(err.message);
  } finally { busy = false; }
}
async function answer(optionID) {
  if (busy || answered || view !== 'game') return;
  busy = true;
  $('error').hidden = true;
  const buttons = [...$('options').children];
  buttons.forEach((b) => b.disabled = true);
  try {
    const feedback = await api(`/api/sessions/${encodeURIComponent(state.id)}/answers`, { question_id: state.question.id, option_id: optionID });
    answered = true;
    pendingState = feedback.state;
    buttons.forEach((button) => {
      if (button.dataset.id === feedback.correct_id) { button.classList.add('correct'); button.firstChild.textContent = '✓'; }
      else if (button.dataset.id === optionID) { button.classList.add('wrong'); button.firstChild.textContent = '↗'; }
    });
    $('score').textContent = `✦ ${stars(feedback.state.score)}`;
    $('progress').value = feedback.state.answered;
    $('feedback').className = `feedback${feedback.correct ? '' : ' try'}`;
    $('feedback').textContent = feedback.correct ? `Браво! Тачан одговор: ${feedback.correct_label}.` : `Ново откриће! Тачан одговор: ${feedback.correct_label}.`;
    $('feedback').hidden = false;
    $('next').replaceChildren(document.createTextNode(feedback.state.complete ? 'Погледај мој резултат →' : 'Следећа слика →'));
    $('next').hidden = false;
    $('next').focus();
  } catch (err) {
    error(err.message);
    buttons.forEach((b) => b.disabled = false);
  } finally { busy = false; }
}
function advance() { if (!busy && pendingState) render(pendingState); }
function home() {
  show('home');
  updateResumes();
  (startButtons.find((b) => b.dataset.start === state?.quiz_id) || $('start')).focus();
}
startButtons.forEach((b) => b.addEventListener('click', () => start(b.dataset.start)));
resumeButtons.forEach((b) => b.addEventListener('click', () => resume(b.dataset.resume)));
$('again').addEventListener('click', () => { if (!savingScore) start(state.quiz_id); });
$('high-score-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (savingScore || !state?.complete) return;
  const name = $('player-name').value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!name || Array.from(name).length > 30) { error('Унеси име или надимак од 1 до 30 знакова.'); return; }
  const game = state;
  savingScore = true;
  $('save-high-score').disabled = true;
  $('again').disabled = true;
  $('error').hidden = true;
  try {
    const entry = await api(`/api/sessions/${encodeURIComponent(game.id)}/high-score`, { name });
    savedScores.add(game.id);
    remember(game.quiz_id, null);
    updateResumes();
    if (state.id === game.id && view === 'result') {
      $('high-score-form').hidden = true;
      $('score-saved').textContent = `Браво, ${entry.name}! Твој резултат је сачуван.`;
      $('score-saved').hidden = false;
    }
  } catch (err) { if (state.id === game.id && view === 'result') error(err.message); }
  finally {
    savingScore = false;
    $('save-high-score').disabled = false;
    $('again').disabled = false;
  }
});
$('next').addEventListener('click', advance);
$('back').addEventListener('click', home);
$('result-home').addEventListener('click', home);
$('question-image').addEventListener('error', () => $('image-error').hidden = false);
document.addEventListener('keydown', (event) => {
  if (view !== 'game' || busy || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (/^[1-4]$/.test(event.key) && !answered) {
    event.preventDefault();
    const option = state.question.options[Number(event.key) - 1];
    if (option) answer(option.id);
  } else if (event.key === 'Enter' && answered) { event.preventDefault(); advance(); }
});
async function initialize() {
  try {
    quizzes = new Map((await api('/api/quizzes')).map((q) => [q.id, q]));
    for (const button of startButtons) {
      const quiz = quizzes.get(button.dataset.start);
      if (!quiz) { button.textContent = 'Ускоро'; continue; }
      const count = document.querySelector(`[data-count="${quiz.id}"]`);
      const noun = quiz.round_length % 10 === 1 && quiz.round_length % 100 !== 11 ? 'питање' : 'питања';
      const forms = { animals: ['животиња', 'животиње', 'животиња'], 'world-flags': ['застава', 'заставе', 'застава'], plants: ['појам', 'појма', 'појмова'], 'dog-breeds': ['раса', 'расе', 'раса'] }[quiz.id];
      const last = quiz.question_count % 10, lastTwo = quiz.question_count % 100;
      const form = last === 1 && lastTwo !== 11 ? 0 : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? 1 : 2;
      count.textContent = `${quiz.round_length} ${noun} · ${quiz.question_count} ${forms[form]}`;
      button.replaceChildren(document.createTextNode('Хајде да играмо'), Object.assign(document.createElement('span'), { textContent: '↗' }));
      button.disabled = false;
    }
    updateResumes();
  } catch (err) {
    startButtons.forEach((button) => button.textContent = 'Поново учитај страницу');
    error(err.message);
  }
}
initialize();
