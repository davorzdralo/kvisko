#!/usr/bin/env python3
"""Build local photo credits from the reviewed source manifests (no network)."""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKS = [('animals', 'Животиње', 'animal'), ('plants', 'Воће, поврће и биљке', 'plant'), ('dogs', 'Расе паса', 'dog'), ('traffic', 'Саобраћај', 'traffic')]

def plain(value):
    return ' '.join(html.unescape(re.sub('<[^>]+>', ' ', value)).split())

def build():
    sections = []
    esc = html.escape
    for pack, title, prefix in PACKS:
        sources = json.loads((ROOT / f'docs/{prefix}-sources.json').read_text())
        subjects = {s['id']: s for s in json.loads((ROOT / f'data/{pack}.json').read_text())}
        assert len(sources) == len(subjects)
        credits = []
        for source in sources:
            subject = subjects[source['id']]
            meta = source['metadata']
            license_name = meta['LicenseShortName']['value']
            assert license_name.startswith(('CC BY ', 'CC BY-SA ')) or license_name in ('Public domain', 'CC0')
            author = plain(meta.get('Attribution', meta.get('Artist', {})).get('value', ''))
            license_url = meta.get('LicenseUrl', {}).get('value') or (
                'https://creativecommons.org/publicdomain/zero/1.0/' if license_name == 'CC0'
                else 'https://creativecommons.org/publicdomain/mark/1.0/')
            credits.append(
                f'<article class="credit" id="{esc(pack)}-{esc(subject["id"])}">'
                f'<img src="{esc(subject["image_url"])}" alt="{esc(subject["label"])}" loading="lazy">'
                f'<h3>{esc(subject["label"])}</h3><p>{esc(source["filename"])}</p>'
                f'<p>Аутор: {esc(author)}</p>'
                f'<p><a href="{esc(source["source_url"])}" rel="noopener">Изворна датотека</a> · '
                f'<a href="{esc(license_url)}" rel="noopener">{esc(license_name)}</a></p></article>')
        sections.append(f'<section class="credits-section" id="{esc(pack)}"><h2>{esc(title)}</h2>'
                        '<div class="credit-grid">' + '\n'.join(credits) + '</div></section>')
    page = '''<!doctype html>
<html lang="sr-Cyrl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Фотографије и извори — Квиско</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/style.css"></head><body><main class="credits"><a class="text-button" href="/">← Назад на квизове</a><h1>Фотографије и извори</h1><p class="credits-intro">Хвала фотографима који нам помажу да упознамо свет животиња и биљака! Фотографије су преузете са Викимедијине оставе. Овде су наведени аутори, изворне датотеке и лиценце. Преузете су у мањој резолуцији; на питањима се приказују без додатног исецања или обраде. Називи у квизу су прилагођени деци. Саобраћајни знакови су изворне SVG илустрације са Викимедијине оставе; семафоре и зебру нацртали су аутори Квиска и објавили под лиценцом CC0.</p><nav><a href="#animals">Животиње</a> · <a href="#plants">Воће, поврће и биљке</a> · <a href="#dogs">Расе паса</a> · <a href="#traffic">Саобраћај</a></nav>'''
    page += '\n'.join(sections)
    page += '''<p class="credits-intro">Заставе: <a href="https://github.com/lipis/flag-icons/tree/v7.3.2">flag-icons 7.3.2</a>, Panayiotis Lipiridis, <a href="/flags/LICENSE.txt">лиценца MIT</a>.</p></main></body></html>\n'''
    (ROOT / 'web/credits.html').write_text(page)
    print('Built credits for', sum(len(json.loads((ROOT / f'data/{p}.json').read_text())) for p, _, _ in PACKS), 'images')

if __name__ == '__main__':
    build()
