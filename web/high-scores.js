import { initializeLanguage, currentLocale, t, quizTitle } from './i18n.js';
const $ = (id) => document.getElementById(id);
let requestVersion = 0;
let initializationVersion = 0;
let retry = initialize;
async function get(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(t('scores.error'));
  return response.json();
}
async function loadScores() {
  const version = ++requestVersion;
  retry = loadScores;
  const quizID = $('quiz-filter').value;
  const query = quizID ? `?quiz_id=${encodeURIComponent(quizID)}` : '';
  history.replaceState(null, '', `/high-scores.html${query}`);
  $('scores-status').textContent = t('scores.loading');
  $('scores-table-wrap').hidden = true;
  $('scores-retry').hidden = true;
  try {
    const entries = await get(`/api/high-scores${query}`);
    if (version !== requestVersion) return;
    $('scores-rows').replaceChildren();
    entries.forEach((entry, index) => {
      const row = document.createElement('tr');
      const date = new Date(entry.created_at * 1000).toLocaleDateString(currentLocale());
      for (const [column, value] of [index + 1, entry.name, `${entry.score} / ${entry.total} · ${Math.round(entry.score / entry.total * 100)}%`, quizTitle(entry.quiz_id), date].entries()) {
        const cell = document.createElement('td');
        cell.textContent = value;
        if (column === 1) {
          const quiz = document.createElement('span');
          quiz.className = 'score-quiz-mobile';
          quiz.textContent = quizTitle(entry.quiz_id);
          cell.append(quiz);
        }
        row.append(cell);
      }
      $('scores-rows').append(row);
    });
    $('scores-table-wrap').hidden = entries.length === 0;
    $('scores-status').textContent = entries.length ? t('scores.count', { count: entries.length }) : t('scores.empty');
  } catch {
    if (version !== requestVersion) return;
    $('scores-status').textContent = t('scores.error');
    $('scores-retry').hidden = false;
  }
}
async function initialize() {
  const version = ++initializationVersion;
  requestVersion += 1;
  retry = initialize;
  $('scores-retry').hidden = true;
  try {
    const quizzes = await get('/api/quizzes');
    if (version !== initializationVersion) return;
    $('quiz-filter').replaceChildren(new Option(t('scores.all'), ''));
    for (const quiz of quizzes) $('quiz-filter').append(new Option(quizTitle(quiz.id), quiz.id));
    const requested = new URL(location.href).searchParams.get('quiz_id');
    $('quiz-filter').value = quizzes.some((quiz) => quiz.id === requested) ? requested : '';
    await loadScores();
  } catch {
    if (version !== initializationVersion) return;
    $('scores-status').textContent = t('scores.error');
    $('scores-retry').hidden = false;
  }
}
$('quiz-filter').addEventListener('change', loadScores);
$('scores-retry').addEventListener('click', () => retry());
await initializeLanguage();
document.addEventListener('languagechange', () => initialize());
initialize();
