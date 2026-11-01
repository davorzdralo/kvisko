import { currentLocale, initializeLanguage } from './i18n.js';
let version = 0;
async function translateSubjects() {
  const request = ++version;
  try {
    const response = await fetch(`/locales/${currentLocale()}.json`);
    if (!response.ok) return;
    const { messages } = await response.json();
    if (request !== version) return;
    for (const article of document.querySelectorAll('[data-subject]')) {
      const label = messages[`answer.${article.dataset.quiz}.${article.dataset.subject}`];
      if (!label) continue;
      article.querySelector('h3').textContent = label;
      article.querySelector('img').alt = label;
    }
  } catch { /* Keep the server-rendered credit labels on a connection failure. */ }
}
document.addEventListener('languagechange', translateSubjects);
await initializeLanguage();
