import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const locales = ['sr-Cyrl', 'hr', 'en'];
const baseline = JSON.parse(await readFile(new URL('data/ui/sr-Cyrl.json', root), 'utf8'));
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
await mkdir(new URL('web/ui/', root), { recursive: true });
for (const locale of locales) {
  const messages = JSON.parse(await readFile(new URL(`data/ui/${locale}.json`, root), 'utf8'));
  if (JSON.stringify(Object.keys(messages).sort()) !== JSON.stringify(Object.keys(baseline).sort())) throw new Error(`UI keys differ: ${locale}`);
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value !== 'string' || !value.trim() || JSON.stringify(placeholders(value)) !== JSON.stringify(placeholders(baseline[key]))) throw new Error(`Invalid UI translation: ${locale}/${key}`);
  }
  const outputs = [[`web/ui/${locale}.json`, `${JSON.stringify(messages, null, 2)}\n`]];
  if (locale === 'sr-Cyrl') outputs.push(['web/ui/sr-Cyrl.js', `// Generated from data/ui/sr-Cyrl.json.\nexport default ${JSON.stringify(messages, null, 2)};\n`]);
  for (const [name, value] of outputs) {
    const target = new URL(name, root);
    if (process.argv.includes('--check')) {
      if (await readFile(target, 'utf8') !== value) throw new Error(`Stale UI: ${name}. Run npm run content:generate.`);
    } else await writeFile(target, value);
  }
}
