# Sports

**Спортови** asks **Који је ово спорт?** and contains 45 familiar sports and visually distinct sporting events, with Serbian Cyrillic labels. Each game samples 20 questions without repeats and uses the existing shuffled answers, feedback, scoring, resume and optional high scores.

The selection covers ball games, racket sports, swimming and water sports, winter sports, gymnastics, athletics, combat sports, and familiar recreational activities. Running, hurdles, long jump and high jump are separate recognizable events rather than a single ambiguous athletics answer. Swimming strokes, cycling disciplines, equipment variants and individual gymnastics apparatus are not separate questions. Indoor and beach volleyball have distinct settings; artistic and rhythmic gymnastics have distinct equipment. Football means association football; American football is named explicitly. Kayaking shows a seated paddler with a double-bladed paddle rather than a canoe.

Photos show people taking part, with equipment or surroundings that help identify the activity. Sports are depicted as organized activities; combat-sport images show competition without graphic injury. This is a broad children's picture quiz rather than a list of every Olympic discipline: obscure sports and distinctions requiring specialist knowledge are omitted. Some sports may be new to younger players, who can learn their names through the answer feedback.

Images are bundled in `web/sports/` and displayed in full without additional cropping during play. `sport-sources.json` records each source file, original and thumbnail URLs, author and license metadata. The shared credits page is generated with `python3 scripts/build_credits.py`; preserve attribution and the individual image licenses when redistributing.
