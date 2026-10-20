const $ = (id) => document.getElementById(id);
let requestVersion = 0;
let retry = initialize;
async function get(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Резултати нису могли да се учитају. Покушај поново.');
  return response.json();
}
async function loadScores() {
  const version = ++requestVersion;
  retry = loadScores;
  const quizID = $('quiz-filter').value;
  const query = quizID ? `?quiz_id=${encodeURIComponent(quizID)}` : '';
  history.replaceState(null, '', `/high-scores.html${query}`);
  $('scores-status').textContent = 'Учитавање резултата…';
  $('scores-table-wrap').hidden = true;
  $('scores-retry').hidden = true;
  try {
    const entries = await get(`/api/high-scores${query}`);
    if (version !== requestVersion) return;
    $('scores-rows').replaceChildren();
    entries.forEach((entry, index) => {
      const row = document.createElement('tr');
      const date = new Date(entry.created_at * 1000).toLocaleDateString('sr-Cyrl-RS');
      for (const [column, value] of [index + 1, entry.name, `${entry.score} / ${entry.total} · ${Math.round(entry.score / entry.total * 100)}%`, entry.quiz_title, date].entries()) {
        const cell = document.createElement('td');
        cell.textContent = value;
        if (column === 1) {
          const quiz = document.createElement('span');
          quiz.className = 'score-quiz-mobile';
          quiz.textContent = entry.quiz_title;
          cell.append(quiz);
        }
        row.append(cell);
      }
      $('scores-rows').append(row);
    });
    $('scores-table-wrap').hidden = entries.length === 0;
    $('scores-status').textContent = entries.length ? `Приказано резултата: ${entries.length}.` : 'Још нема резултата. Одиграј квиз и буди међу првима!';
  } catch {
    if (version !== requestVersion) return;
    $('scores-status').textContent = 'Резултати нису могли да се учитају. Покушај поново.';
    $('scores-retry').hidden = false;
  }
}
async function initialize() {
  retry = initialize;
  $('scores-retry').hidden = true;
  try {
    const quizzes = await get('/api/quizzes');
    $('quiz-filter').replaceChildren(new Option('Сви квизови', ''));
    for (const quiz of quizzes) $('quiz-filter').append(new Option(quiz.title, quiz.id));
    const requested = new URL(location.href).searchParams.get('quiz_id');
    $('quiz-filter').value = quizzes.some((quiz) => quiz.id === requested) ? requested : '';
    await loadScores();
  } catch {
    $('scores-status').textContent = 'Резултати нису могли да се учитају. Покушај поново.';
    $('scores-retry').hidden = false;
  }
}
$('quiz-filter').addEventListener('change', loadScores);
$('scores-retry').addEventListener('click', () => retry());
initialize();
