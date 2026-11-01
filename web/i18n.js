import serbian from './ui/sr-Cyrl.js';

export const languages = [
  { id: 'sr-Cyrl', name: 'Српски', flag: 'rs' },
  { id: 'hr', name: 'Hrvatski', flag: 'hr' },
  { id: 'en', name: 'English', flag: 'gb' },
];
export const normaliseLocale = (value) => languages.some((language) => language.id === value) ? value : 'sr-Cyrl';
export function formatMessage(messages, key, values = {}) {
  return (messages[key] ?? serbian[key] ?? key).replace(/\{(\w+)\}/g, (match, name) => String(values[name] ?? match));
}
let locale = 'sr-Cyrl';
let messages = serbian;
let version = 0;
const cache = new Map([['sr-Cyrl', serbian]]);
export const currentLocale = () => locale;
export const t = (key, values) => formatMessage(messages, key, values);
export const quizTitle = (id) => t(`quiz.${id}.title`);
export function stars(count) {
  const category = new Intl.PluralRules(locale).select(count);
  return t(`stars.${category === 'one' ? 'one' : category === 'few' ? 'few' : 'other'}`, { count });
}
function applyTranslations() {
  document.documentElement.lang = locale;
  for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
  for (const attribute of ['aria-label', 'alt', 'placeholder', 'content']) {
    for (const element of document.querySelectorAll(`[data-i18n-${attribute}]`)) {
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
    }
  }
  const selected = languages.find((language) => language.id === locale);
  for (const picker of document.querySelectorAll('.language-picker')) {
    const summary = picker.querySelector('summary');
    summary.setAttribute('aria-label', `${t('language.choose')}: ${selected.name}`);
    summary.querySelector('img').src = `/flags/${selected.flag}.svg`;
    summary.querySelector('.language-name').textContent = selected.name;
    for (const button of picker.querySelectorAll('[data-language]')) {
      if (button.dataset.language === locale) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
  }
}
export async function selectLanguage(requested) {
  const selected = normaliseLocale(requested);
  const request = ++version;
  try {
    if (!cache.has(selected)) {
      const response = await fetch(`/ui/${selected}.json`);
      if (!response.ok) throw new Error('UI translation unavailable');
      cache.set(selected, await response.json());
    }
    if (request !== version) return;
    locale = selected;
    messages = cache.get(selected);
    const status = document.querySelector('#language-status');
    if (status) status.textContent = '';
    try { localStorage.setItem('kvisko-language', locale); } catch { /* In-memory language choice still works. */ }
    applyTranslations();
    document.dispatchEvent(new CustomEvent('languagechange'));
  } catch {
    if (request === version) {
      const status = document.querySelector('#language-status');
      if (status) status.textContent = t('error.network');
    }
  }
}
export async function initializeLanguage() {
  const header = document.querySelector('.site-header');
  const picker = document.createElement('details');
  picker.className = 'language-picker';
  const summary = document.createElement('summary');
  const flag = document.createElement('img');
  flag.alt = '';
  flag.width = 24;
  flag.height = 18;
  const name = document.createElement('span');
  name.className = 'language-name';
  summary.append(flag, name, document.createTextNode(' ▾'));
  const options = document.createElement('div');
  options.className = 'language-options';
  for (const language of languages) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.language = language.id;
    button.lang = language.id;
    const image = document.createElement('img');
    image.src = `/flags/${language.flag}.svg`;
    image.alt = '';
    image.width = 24;
    image.height = 18;
    button.append(image, document.createTextNode(language.name));
    button.addEventListener('click', async () => {
      await selectLanguage(language.id);
      picker.open = false;
      summary.focus();
    });
    options.append(button);
  }
  const status = document.createElement('span');
  status.id = 'language-status';
  status.className = 'sr-only';
  status.setAttribute('role', 'status');
  picker.append(summary, options, status);
  (header.querySelector('.header-actions') || header).append(picker);
  document.addEventListener('click', (event) => { if (!picker.contains(event.target)) picker.open = false; });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && picker.open) { picker.open = false; summary.focus(); }
  });
  applyTranslations();
  let preferred;
  try { preferred = localStorage.getItem('kvisko-language'); } catch { /* Default to Serbian. */ }
  await selectLanguage(preferred);
}
