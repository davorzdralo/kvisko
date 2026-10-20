# Traffic quiz

`traffic-signs` contains 40 subjects: 34 European road signs used in Serbia and six original illustrations (red/yellow/green vehicle lights, red/green pedestrian signals, and a zebra crossing). Each game draws 30 subjects without repeats, using the existing configurable quiz length, four-choice answers, resume and high-score flow.

The Serbian Cyrillic labels name familiar symbols in simple language. This is a recognition game, not a driving test: lights are named by colour rather than telling children to walk or drive. Warning signs retain their European red triangle, prohibitions their circular design, and pedestrian crossings their blue square. The STOP lettering is part of the real sign. Only one speed limit (40) is included; the bank avoids near-identical variants that mostly test reading numbers. The zebra road marking and crossing sign have separate, explicit labels.

## Assets and attribution

- `data/traffic.json` is the question bank; `data/quizzes.json` supplies quiz metadata.
- `web/traffic/*.svg` are local assets. No third-party image requests are needed during play.
- `docs/traffic-sources.json` records each original file, source page, author and licence. Road signs are original, unmodified Wikimedia Commons SVGs (public domain or CC BY-SA); source pages document the exact terms. Some originals contain inert Adobe Illustrator `foreignObject` metadata; they have no displayed content.
- Kvisko's six original illustrations are dedicated to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). This applies to those six images, not the application's GPL licence.
- `python3 scripts/build_credits.py` regenerates the public credits, including every traffic image. `npm run content:generate` regenerates the repeatable D1 seed. Deployment seeds the new bank without a schema migration.

References: [Serbian sign collection](https://commons.wikimedia.org/wiki/Category:SVG_road_signs_in_Serbia), [pedestrian crossing source](https://commons.wikimedia.org/wiki/File:Serbia_road_sign_III-6.svg), [UNECE Vienna Convention on Road Signs and Signals](https://unece.org/DAM/trans/conventn/Conv_road_signs_2006v_EN.pdf).
