import { initializeLanguage, currentLocale, t, quizTitle, stars } from './i18n.js';
import { localiseQuestion, answerText } from './localised-content.js';
import { createReader, readingClips } from './read-aloud.js';

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
let catalogue = null;
let catalogueVersion = 0;
let lastFeedback = null;
let lastErrorCode = null;
const readToggle = $('read-aloud');
try { readToggle.checked = localStorage.getItem('kvisko-read-aloud') === 'true'; }
catch { /* The toggle still works without browser storage. */ }
const audioStatus = $('audio-status');
const reader = createReader({
  onHighlight(optionID) {
    for (const button of $('options').children) {
      button.classList.toggle('reading', button.dataset.id === optionID);
    }
  },
  onPlaying(playing) { $('read-aloud-label').classList.toggle('is-reading', playing); },
  onError() {
    audioStatus.textContent = t('audio.unavailable');
    audioStatus.hidden = false;
  },
});
function updateReading(autoRead = false) {
  const clips = catalogue && state?.question ? readingClips(catalogue, state.quiz_id, localiseQuestion(catalogue, state.quiz_id, state.question)) : [];
  readToggle.disabled = !clips.length;
  audioStatus.hidden = !!clips.length;
  audioStatus.textContent = t(catalogue && !catalogue.voice ? 'audio.pending' : 'audio.unsupported');
  if (autoRead && readToggle.checked && clips.length && !answered && !document.hidden) reader.play(clips);
}
readToggle.addEventListener('change', () => {
  try { localStorage.setItem('kvisko-read-aloud', String(readToggle.checked)); }
  catch { /* The preference lasts for this page when storage is unavailable. */ }
  reader.stop();
  updateReading(readToggle.checked);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) reader.stop(); });
window.addEventListener('pagehide', () => reader.stop());
async function loadCatalogue() {
  const version = ++catalogueVersion;
  const language = currentLocale();
  reader.stop();
  catalogue = null;
  readToggle.disabled = true;
  try {
    const response = await fetch(`/locales/${language}.json`);
    if (!response.ok) throw new Error('Locale unavailable');
    const nextCatalogue = await response.json();
    if (version !== catalogueVersion) return;
    catalogue = nextCatalogue;
  } catch { /* Saved-game text remains available if translations cannot load. */ }
  if (version !== catalogueVersion) return;
  updateUIText();
  if (state?.question && view === 'game') updateReading(true);
}
const startButtons = [...document.querySelectorAll('[data-start]')];
const resumeButtons = [...document.querySelectorAll('[data-resume]')];

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
  reader.stop();
  view = name;
  for (const id of ['home', 'game', 'result']) $(id).hidden = id !== name;
  $('error').hidden = true;
}
function error(message, code = null) { lastErrorCode = code; $('error').textContent = message; $('error').hidden = false; }
async function api(path, body) {
  let response;
  try {
    response = await fetch(path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  } catch { throw Object.assign(new Error(t('error.network')), { code: 'network' }); }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const problem = new Error(data.code ? t(`error.${data.code}`) : t('error.network'));
    problem.status = response.status;
    problem.code = data.code || 'network';
    throw problem;
  }
  return response.json();
}
function render(nextState) {
  reader.stop();
  state = nextState;
  pendingState = null;
  answered = false;
  lastFeedback = null;
  const photoQuiz = !['world-flags', 'traffic-signs', 'shapes-colours'].includes(state.quiz_id);
  $('game').classList.toggle('sign-game', state.quiz_id === 'traffic-signs');
  $('game').classList.toggle('photo-game', photoQuiz);
  $('game').classList.toggle('shape-game', state.quiz_id === 'shapes-colours');
  $('quiz-title').textContent = quizTitle(state.quiz_id);
  if (state.complete) {
    show('result');
    // Keep the finished game resumable until its optional score is saved.
    $('high-score-form').hidden = savedScores.has(state.id);
    $('player-name').value = '';
    $('score-saved').hidden = !savedScores.has(state.id);
    $('score-saved').textContent = t('score.saved');
    $('save-high-score').disabled = false;
    updateResumes();
    $('final-score').textContent = state.score;
    $('final-total').textContent = t('result.total', { total: state.total });
    updateUIText();
    $('result-title').focus();
    return;
  }
  show('game');
  $('position').textContent = t('game.position', { current: state.answered + 1, total: state.total });
  $('progress').max = state.total;
  $('progress').value = state.answered;
  $('score').textContent = `✦ ${stars(state.score)}`;
  $('question-title').textContent = localiseQuestion(catalogue, state.quiz_id, state.question).prompt;
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
    label.textContent = answerText(catalogue, state.quiz_id, option.id, option.label);
    button.append(number, label);
    button.addEventListener('click', () => answer(option.id));
    $('options').append(button);
  });
  updateReading(true);
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
  } catch (err) { error(err.message, err.code); }
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
    error(err.message, err.code);
  } finally { busy = false; }
}
async function answer(optionID) {
  if (busy || answered || view !== 'game') return;
  reader.stop();
  busy = true;
  $('error').hidden = true;
  const buttons = [...$('options').children];
  buttons.forEach((b) => b.disabled = true);
  try {
    const feedback = await api(`/api/sessions/${encodeURIComponent(state.id)}/answers`, { question_id: state.question.id, option_id: optionID });
    answered = true;
    lastFeedback = feedback;
    pendingState = feedback.state;
    buttons.forEach((button) => {
      if (button.dataset.id === feedback.correct_id) { button.classList.add('correct'); button.firstChild.textContent = '✓'; }
      else if (button.dataset.id === optionID) { button.classList.add('wrong'); button.firstChild.textContent = '↗'; }
    });
    $('score').textContent = `✦ ${stars(feedback.state.score)}`;
    $('progress').value = feedback.state.answered;
    $('feedback').className = `feedback${feedback.correct ? '' : ' try'}`;
    $('feedback').textContent = t(feedback.correct ? 'game.correct' : 'game.incorrect', { answer: answerText(catalogue, state.quiz_id, feedback.correct_id, feedback.correct_label) });
    $('feedback').hidden = false;
    $('next').replaceChildren(document.createTextNode(t(feedback.state.complete ? 'game.results' : 'game.next')));
    $('next').hidden = false;
    $('next').focus();
  } catch (err) {
    error(err.message, err.code);
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
  if (!name || Array.from(name).length > 30) { error(t('error.name'), 'name'); return; }
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
      $('score-saved').textContent = t('score.savedName', { name: entry.name });
      $('score-saved').hidden = false;
    }
  } catch (err) { if (state.id === game.id && view === 'result') error(err.message, err.code); }
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
  if (event.target.closest('input, select, textarea, .language-picker')) return;
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
      if (!quiz) { button.textContent = t('home.soon'); continue; }
      const count = document.querySelector(`[data-count="${quiz.id}"]`);
      count.textContent = t('home.count', { rounds: quiz.round_length, count: quiz.question_count });
      button.replaceChildren(document.createTextNode(t('home.play')), Object.assign(document.createElement('span'), { textContent: '↗' }));
      button.disabled = false;
    }
    updateResumes();
  } catch (err) {
    startButtons.forEach((button) => button.textContent = t('home.reload'));
    error(err.message, err.code);
  }
}
function updateUIText() {
  if (lastErrorCode && !$('error').hidden) $('error').textContent = t(`error.${lastErrorCode}`);
  $('read-aloud-text').textContent = t('audio.enabled');
  for (const button of startButtons) {
    const quiz = quizzes.get(button.dataset.start);
    if (!quiz) continue;
    document.querySelector(`[data-count="${quiz.id}"]`).textContent = t('home.count', { rounds: quiz.round_length, count: quiz.question_count });
    button.replaceChildren(document.createTextNode(t('home.play')), Object.assign(document.createElement('span'), { textContent: '↗' }));
  }
  if (!state) return;
  $('quiz-title').textContent = quizTitle(state.quiz_id);
  $('score').textContent = `✦ ${stars(lastFeedback ? lastFeedback.state.score : state.score)}`;
  $('position').textContent = t('game.position', { current: state.answered + 1, total: state.total });
  if (state.question) {
    $('question-title').textContent = localiseQuestion(catalogue, state.quiz_id, state.question).prompt;
    for (const button of $('options').children) {
      const option = state.question.options.find((item) => item.id === button.dataset.id);
      button.lastChild.textContent = answerText(catalogue, state.quiz_id, option.id, option.label);
    }
  }
  if (lastFeedback) {
    $('feedback').textContent = t(lastFeedback.correct ? 'game.correct' : 'game.incorrect', { answer: answerText(catalogue, state.quiz_id, lastFeedback.correct_id, lastFeedback.correct_label) });
    $('next').textContent = t(lastFeedback.state.complete ? 'game.results' : 'game.next');
  }
  $('final-total').textContent = t('result.total', { total: state.total });
  $('result-subtitle').textContent = t('result.subtitle');
  $('result-message').textContent = t(state.score === state.total ? 'result.perfect' : 'result.message');
  if (savedScores.has(state.id)) $('score-saved').textContent = t('score.saved');
}
await initializeLanguage();
document.addEventListener('languagechange', () => { loadCatalogue(); });
await loadCatalogue();
initialize();
