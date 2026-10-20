# Animal quiz

**Животиње** is aimed at preschoolers. The bank contains 40 familiar animals: mostly mammals, plus snake, turtle/tortoise, crocodile, lizard and frog. No obscure invertebrates or scientific species names. The labels deliberately mix everyday groups (snake, monkey, bear) with recognizable animals (lion, tiger, elephant). A photographed species is only an example of that everyday category. There are no overlapping options such as elephant versus African elephant, or turtle versus tortoise. Birds and additional categories can be added later.

Each round draws the configured number of distinct animals (default 30), just like flags. Distractors come only from the animal bank. The question is **Која је ово животиња?**; all labels and feedback are Serbian Cyrillic. The full photo fits inside the question area without cropping its identifying features. Flags and animals have separate browser resume entries; the original flag-session key is still recognized.

## Photos

All 40 photographs are bundled locally in `web/animals/`; gameplay makes no requests to Wikimedia. Source files, original/thumbnail URLs, authors and license metadata are recorded in `docs/animal-sources.json`. `web/credits.html` exposes the attribution information via the footer. Photos are public domain, CC0, CC BY or CC BY-SA, retaining their individual licenses. Downloaded Wikimedia thumbnails are resized versions; no extra edits are applied to question photos. The home-card preview uses CSS cropping. Preserve the credits, source links and applicable image licenses when redistributing.

To extend the pack, add a licensed photo and attribution, then add an ID, Cyrillic label and local image URL to `data/animals.json`. Choose an unambiguous child-friendly category and visually inspect the photo. Do not add a more specific category that could also be a correct answer for an existing broad category. Unit tests check all packs; `scripts/smoke.py` completes all quiz types and verifies their API metadata, scoring, selections and image files.
