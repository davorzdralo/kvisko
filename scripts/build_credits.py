#!/usr/bin/env python3
"""Build local photo credits from the reviewed source manifests (no network)."""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKS = [('animals', 'Животиње', 'animal'), ('plants', 'Воће, поврће и биљке', 'plant'), ('dogs', 'Расе паса', 'dog'), ('traffic', 'Саобраћај', 'traffic'), ('sports', 'Спортови', 'sport')]

def plain(value):
    return ' '.join(html.unescape(re.sub('<[^>]+>', ' ', value)).split())

def build():
    messages = json.loads((ROOT / 'data/locales/sr-Cyrl.json').read_text())['messages']
    quizzes = json.loads((ROOT / 'data/quizzes.json').read_text())
    quiz_ids = {quiz['file']: quiz['id'] for quiz in quizzes}
    sections = []
    esc = html.escape
    for pack, title, prefix in PACKS:
        sources = json.loads((ROOT / f'docs/{prefix}-sources.json').read_text())
        subjects = {s['id']: s for s in json.loads((ROOT / f'data/{pack}.json').read_text())}
        assert len(sources) == len(subjects)
        credits = []
        for source in sources:
            subject = subjects[source['id']]
            subject['label'] = messages[f'answer.{quiz_ids[pack]}.{subject["id"]}']
            meta = source['metadata']
            license_name = meta['LicenseShortName']['value']
            assert license_name.startswith(('CC BY ', 'CC BY-SA ')) or license_name in ('Public domain', 'CC0')
            author = plain(meta.get('Attribution', meta.get('Artist', {})).get('value', ''))
            license_url = meta.get('LicenseUrl', {}).get('value') or (
                'https://creativecommons.org/publicdomain/zero/1.0/' if license_name == 'CC0'
                else 'https://creativecommons.org/publicdomain/mark/1.0/')
            credits.append(
                f'<article class="credit" id="{esc(pack)}-{esc(subject["id"])}" data-quiz="{esc(quiz_ids[pack])}" data-subject="{esc(subject["id"])}">'
                f'<img src="{esc(subject["image_url"])}" alt="{esc(subject["label"])}" loading="lazy">'
                f'<h3>{esc(subject["label"])}</h3><p>{esc(source["filename"])}</p>'
                f'<p><span data-i18n="credits.author">Аутор</span>: {esc(author)}</p>'
                f'<p><a href="{esc(source["source_url"])}" rel="noopener" data-i18n="credits.source">Изворна датотека</a> · '
                f'<a href="{esc(license_url)}" rel="noopener">{esc(license_name)}</a></p></article>')
        sections.append(f'<section class="credits-section" id="{esc(pack)}"><h2 data-i18n="quiz.{esc(quiz_ids[pack])}.title">{esc(title)}</h2>'
                        '<div class="credit-grid">' + '\n'.join(credits) + '</div></section>')
    page = '''<!doctype html>
<html lang="sr-Cyrl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title data-i18n="credits.title">Фотографије и извори — Квиско</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/style.css"><script type="module" src="/credits.js"></script></head><body><header class="site-header"><a class="brand" href="/">Квиско</a><nav class="header-actions"><a class="text-button" href="/" data-i18n="nav.all">← Сви квизови</a></nav></header><main class="credits"><a class="text-button" href="/" data-i18n="nav.all">← Назад на квизове</a><h1 data-i18n="credits.title">Фотографије и извори</h1><p class="credits-intro" data-i18n="credits.intro">Хвала фотографима који нам помажу да упознамо животиње, биљке и спортове! Фотографије су преузете са Викимедијине оставе. Овде су наведени аутори, изворне датотеке и лиценце. Преузете су у мањој резолуцији; на питањима се приказују без додатног исецања или обраде. Називи у квизу су прилагођени деци. Саобраћајни знакови су изворне SVG илустрације са Викимедијине оставе; семафоре и зебру нацртали су аутори Квиска и објавили под лиценцом CC0. Облици у боји су оригиналне илустрације Квиска под лиценцом GPL-3.0-only.</p><nav><a href="#animals" data-i18n="quiz.animals.title">Животиње</a> · <a href="#plants" data-i18n="quiz.plants.title">Воће, поврће и биљке</a> · <a href="#dogs" data-i18n="quiz.dog-breeds.title">Расе паса</a> · <a href="#traffic" data-i18n="quiz.traffic-signs.title">Саобраћај</a> · <a href="#sports" data-i18n="quiz.sports.title">Спортови</a></nav>'''
    page += '\n'.join(sections)
    page += '''<p class="credits-intro"><span data-i18n="credits.flags">Заставе</span>: <a href="https://github.com/lipis/flag-icons/tree/v7.3.2">flag-icons 7.3.2</a>, Panayiotis Lipiridis, <a href="/flags/LICENSE.txt" data-i18n="credits.mit">лиценца MIT</a>.</p></main></body></html>\n'''
    (ROOT / 'web/credits.html').write_text(page)
    print('Built credits for', sum(len(json.loads((ROOT / f'data/{p}.json').read_text())) for p, _, _ in PACKS), 'images')

if __name__ == '__main__':
    build()
