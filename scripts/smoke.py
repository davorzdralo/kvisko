#!/usr/bin/env python3
"""Exercise the running prototype without third-party packages."""
import concurrent.futures
import json
import os
from pathlib import Path
import urllib.request
import urllib.error

BASE = os.environ.get('BASE_URL', 'http://localhost:8080').rstrip('/')
ROOT = Path(__file__).resolve().parents[1]
PACKS = {
    'world-flags': ('flags', 'Заставе света', 'Коме припада ова застава?'),
    'animals': ('animals', 'Животиње', 'Која је ово животиња?'),
    'plants': ('plants', 'Воће, поврће и биљке', 'Шта је на овој слици?'),
    'dog-breeds': ('dogs', 'Расе паса', 'Које је расе овај пас?'),
}

def request(path, body=None, expected=200):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, headers={'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as err:
        response = err
    with response:
        raw = response.read()
        assert response.status == expected, (path, response.status, raw)
        if response.headers.get_content_type() == 'application/json':
            return json.loads(raw)
        return raw

assert request('/healthz')['status'] == 'ok'
quizzes = {q['id']: q for q in request('/api/quizzes')}
assert set(PACKS) <= quizzes.keys()
assert 'Квиско'.encode() in request('/')
assert 'Фотографије и извори'.encode() in request('/credits.html')
request('/api/sessions', {'quiz_id': 'missing'}, 404)
request('/api/sessions/missing', expected=404)

def check_quiz(quiz_id, filename, title, prompt):
    bank = {q['id']: q for q in json.loads((ROOT / f'data/{filename}.json').read_text())}
    quiz = quizzes[quiz_id]
    assert quiz['question_count'] == len(bank) and quiz['title'] == title
    for subject in bank.values():
        image = request(subject['image_url'])
        assert image.startswith((b'<svg', b'\xff\xd8', b'\x89PNG')), subject['image_url']
    s = request('/api/sessions', {'quiz_id': quiz_id}, 201)
    path = f"/api/sessions/{s['id']}"
    assert s['total'] == quiz['round_length']
    assert request(path) == s
    first = s['question']
    request(path + '/answers', {'question_id': first['id'], 'option_id': 'invalid'}, 400)
    assert request(path) == s
    seen = set()
    score = 0
    while not s['complete']:
        assert s['quiz_id'] == quiz_id and s['quiz_title'] == title
        q = s['question']
        assert q['id'] not in seen and q['id'] in bank
        seen.add(q['id'])
        assert 'correct_id' not in q and len(q['options']) == 4
        assert q['prompt'] == prompt
        assert all(o['label'] == bank[o['id']]['label'] for o in q['options'])
        assert len({o['id'] for o in q['options']}) == 4
        assert any(o['id'] == q['id'] for o in q['options'])
        correct = s['answered'] % 2 == 0
        choice = q['id'] if correct else next(o['id'] for o in q['options'] if o['id'] != q['id'])
        body = {'question_id': q['id'], 'option_id': choice}
        if s['answered'] == 0:
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                results = list(pool.map(lambda _: request(path + '/answers', body), range(4)))
            assert all(r == results[0] for r in results)
            result = results[0]
        else:
            result = request(path + '/answers', body)
        score += int(correct)
        assert result['correct'] == correct
        assert result['correct_id'] == q['id']
        assert result['correct_label'] == bank[q['id']]['label']
        assert request(path + '/answers', body) == result
        different = next(o['id'] for o in q['options'] if o['id'] != choice)
        request(path + '/answers', {'question_id': q['id'], 'option_id': different}, 409)
        s = result['state']
        assert s['score'] == score and s['answered'] == len(seen)
        assert request(path) == s
    assert s['answered'] == s['total'] and 'question' not in s
    starts = [request('/api/sessions', {'quiz_id': quiz_id}, 201)['question'] for _ in range(8)]
    assert len({q['id'] for q in starts}) > 1
    print(f"PASS: {quiz_id}: {s['total']}-question game, scoring, concurrent/idempotent answers, resume, assets and randomized starts")

for quiz_id, config in PACKS.items():
    check_quiz(quiz_id, *config)
