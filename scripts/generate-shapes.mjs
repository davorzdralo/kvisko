// Original geometric illustrations. Run with node scripts/generate-shapes.mjs.
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const colours = {
  red: ['#e53935', 'Црвени', 'Црвена', 'Црвено'],
  blue: ['#1976d2', 'Плави', 'Плава', 'Плаво'],
  green: ['#2eaa4f', 'Зелени', 'Зелена', 'Зелено'],
  yellow: ['#f5cf16', 'Жути', 'Жута', 'Жуто'],
  orange: ['#f58220', 'Наранџасти', 'Наранџаста', 'Наранџасто'],
  pink: ['#ef78ad', 'Ружичасти', 'Ружичаста', 'Ружичасто'],
  brown: ['#8b4513', 'Браон', 'Браон', 'Браон'],
  black: ['#161616', 'Црни', 'Црна', 'Црно'],
  white: ['#ffffff', 'Бели', 'Бела', 'Бело'],
};
// Every shape appears in every colour; answers name both attributes.
const shapes = [
  ['triangle', 'троугао', 1, '<path d="M160 45 285 265H35Z"/>'],
  ['circle', 'круг', 1, '<circle cx="160" cy="160" r="115"/>'],
  ['square', 'квадрат', 1, '<rect x="55" y="55" width="210" height="210"/>'],
  ['rectangle', 'правоугаоник', 1, '<rect x="25" y="90" width="270" height="140"/>'],
  ['ellipse', 'елипса', 2, '<ellipse cx="160" cy="160" rx="135" ry="85"/>'],
  ['star', 'звезда', 2, '<path d="m160 30 38 82 90 11-67 62 18 92-79-46-79 46 18-92-67-62 90-11Z"/>'],
  ['heart', 'срце', 3, '<path d="M160 275 49 167C-20 97 83 0 160 86 237 0 340 97 271 167Z"/>'],
  ['cube', 'коцка', 2, '<path d="m160 35 110 60v130l-110 60-110-60V95Z"/><path d="m50 95 110 60 110-60-110-60Z" fill="white" fill-opacity=".2"/><path d="m160 155 110-60v130l-110 60Z" fill="black" fill-opacity=".18"/><path d="m50 95 110 60 110-60m-110 60v130" fill="none" stroke="black" stroke-opacity=".15" stroke-width="2"/>'],
  ['sphere', 'лопта', 2, '<defs><radialGradient id="ball" cx="32%" cy="28%" r="75%"><stop stop-color="white" stop-opacity=".65"/><stop offset=".4" stop-color="white" stop-opacity="0"/><stop offset="1" stop-color="black" stop-opacity=".28"/></radialGradient></defs><circle cx="160" cy="155" r="112"/><circle cx="160" cy="155" r="112" fill="url(#ball)"/>'],
  ['cone', 'купа', 2, '<defs><linearGradient id="cone"><stop stop-color="white" stop-opacity=".35"/><stop offset=".45" stop-color="white" stop-opacity="0"/><stop offset="1" stop-color="black" stop-opacity=".22"/></linearGradient></defs><path d="M160 30 275 248C275 292 45 292 45 248Z"/><path d="M160 30 275 248C275 292 45 292 45 248Z" fill="url(#cone)"/><path d="M45 248c0 44 230 44 230 0" fill="none" stroke="black" stroke-opacity=".15" stroke-width="2"/>'],
  ['pyramid', 'пирамида', 2, '<path d="m160 30 130 210-130 50L30 240Z"/><path d="m160 30 130 210-130 50Z" fill="black" fill-opacity=".18"/><path d="M160 30v260" fill="none" stroke="black" stroke-opacity=".2" stroke-width="2"/>'],
  ['rhombus', 'ромб', 1, '<path d="m160 25 100 135-100 135L60 160Z"/>'],
  ['trapezium', 'трапез', 1, '<path d="M95 65h130l65 190H30Z"/>'],
  ['cuboid', 'квадар', 1, '<path d="m25 115 185-60 85 45v120l-185 60-85-45Z"/><path d="m25 115 185-60 85 45-185 60Z" fill="white" fill-opacity=".2"/><path d="m110 160 185-60v120l-185 60Z" fill="black" fill-opacity=".18"/><path d="m25 115 85 45 185-60m-185 60v120" fill="none" stroke="black" stroke-opacity=".15" stroke-width="2"/>'],
  ['cylinder', 'ваљак', 1, '<defs><linearGradient id="cylinder"><stop stop-color="black" stop-opacity=".16"/><stop offset=".35" stop-color="white" stop-opacity=".2"/><stop offset="1" stop-color="black" stop-opacity=".2"/></linearGradient></defs><path d="M60 75a100 35 0 0 1 200 0v170a100 35 0 0 1-200 0Z"/><path d="M60 75a100 35 0 0 1 200 0v170a100 35 0 0 1-200 0Z" fill="url(#cylinder)"/><ellipse cx="160" cy="75" rx="100" ry="35" fill="white" fill-opacity=".2"/><ellipse cx="160" cy="75" rx="100" ry="35" fill="none" stroke="black" stroke-opacity=".2" stroke-width="2"/>'],
];

await mkdir(new URL('web/shapes/', root), { recursive: true });
const bank = [];
const localeURL = new URL('data/locales/sr-Cyrl.json', root);
const locale = JSON.parse(await readFile(localeURL, 'utf8'));
for (const [shape, noun, gender, drawing] of shapes) {
  for (const colour of Object.keys(colours)) {
    const id = `${colour}-${shape}`;
    const label = `${colours[colour][gender]} ${noun}`;
    const shadow = ['cube', 'sphere', 'cone', 'pyramid', 'cuboid', 'cylinder'].includes(shape)
      ? '<ellipse cx="160" cy="290" rx="105" ry="10" fill="black" fill-opacity=".08"/>' : '';
    // An outline keeps white shapes visible against the white stage.
    const outline = colour === 'white' ? ' stroke="#737373" stroke-width="2.5" stroke-linejoin="round"' : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320"><!-- Original Kvisko illustration. --><rect width="320" height="320" fill="white"/>${shadow}<g fill="${colours[colour][0]}"${outline}>${drawing}</g></svg>\n`;
    await writeFile(new URL(`web/shapes/${id}.svg`, root), svg);
    locale.messages[`answer.shapes-colours.${id}`] = label;
    bank.push({ id, image_url: `/shapes/${id}.svg` });
  }
}
await writeFile(new URL('data/shapes.json', root), `${JSON.stringify(bank, null, 2)}\n`);
await writeFile(localeURL, `${JSON.stringify(locale, null, 2)}\n`);
