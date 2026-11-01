"""Generate missing static recordings after npm run content:generate.

Install scripts/requirements-audio.txt in a virtual environment first.
Only locale text is sent to Microsoft's online speech service; no game data.
"""
import argparse
import asyncio
import json
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent


async def generate(locale_name):
    locale = json.loads((ROOT / f'web/locales/{locale_name}.json').read_text())
    jobs = {
        url: locale['messages'][key]
        for key, url in locale['audio'].items()
    }
    remaining = [
        (url, text) for url, text in jobs.items()
        if not (ROOT / 'web' / url.lstrip('/')).exists()
    ]
    print(f'{locale_name}: {len(remaining)} missing / {len(jobs)} unique clips', flush=True)
    semaphore = asyncio.Semaphore(3)
    completed = 0
    scratch = ROOT / '.wrangler/audio-generation' / locale_name
    scratch.mkdir(parents=True, exist_ok=True)

    async def record(url, text):
        nonlocal completed
        async with semaphore:
            target = ROOT / 'web' / url.lstrip('/')
            target.parent.mkdir(parents=True, exist_ok=True)
            # Keep in-progress files outside the watched/public asset directory.
            temporary = scratch / target.with_suffix('.tmp').name
            for attempt in range(6):
                try:
                    await asyncio.wait_for(edge_tts.Communicate(
                        text, locale['voice'], rate=locale['rate'],
                    ).save(str(temporary)), timeout=45)
                    if temporary.stat().st_size < 1000:
                        raise RuntimeError('Empty or truncated speech response')
                    temporary.replace(target)
                    completed += 1
                    if completed % 10 == 0 or completed == len(remaining):
                        print(f'{completed}/{len(remaining)} generated', flush=True)
                    return
                except Exception:
                    temporary.unlink(missing_ok=True)
                    if attempt == 5:
                        print(f'Failed: {text}', flush=True)
                        raise
                    await asyncio.sleep(min(2 ** attempt, 15))

    await asyncio.gather(*(record(url, text) for url, text in remaining))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--locale', default='sr-Cyrl')
    args = parser.parse_args()
    asyncio.run(generate(args.locale))
