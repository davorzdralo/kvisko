# Fruit, vegetables and familiar plants

**Воће, поврће и биљке** contains 72 subjects in a mixed picture-recognition quiz for children, covering familiar fruit, vegetables, nuts, crops, flowers and a few recognizable plants and trees. Use everyday Serbian Cyrillic names; never ask for a cultivar, a Latin botanical name or a particular color variety. Tomatoes, cucumbers and similar foods follow everyday kitchen terminology. The edible mushroom is included as familiar produce, not as a botanical claim that fungi are plants.

A game uses the same four-choice format and server-configured random round length as the other quizzes (30 by default). Distractors come only from this bank. All photo questions use the full image without CSS cropping. Each quiz keeps its own resumable game.

Choose clear edible parts for fruit/vegetables and nuts, recognizable flowers for flower labels, corn cobs for corn, and ears of wheat for wheat. Photos may show a whole item together with a cut item to make recognition easier. Do not add separate questions for close cultivars such as different apples or grapes. Common names and kitchen forms can differ from botanical taxonomy: dry beans and green bean pods are distinct familiar foods here.

Reviewed photo provenance and license metadata are stored in `plant-sources.json`. Photos are bundled under `web/plants/`, so play requires no external image service. The shared footer links to photo attribution, source and license information. To regenerate that page after editing the reviewed manifests, run `python3 scripts/build_credits.py` (standard library only; no network). Preserve per-image licenses and attribution when redistributing.
