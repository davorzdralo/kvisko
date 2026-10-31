# Shapes and colours

**Облици и боје** asks **Који је ово облик и које је боје?** Answers name both the colour and the shape in Serbian Cyrillic, such as **Црвени троугао**, **Плави круг**, and **Зелена коцка**.

The bank has 30 pictures: triangle, circle, square, rectangle, oval, star, heart, cube, ball (sphere), and cone, each in three colours. The palette uses only red, blue, green, yellow, orange and pink. Familiar names, short answers and plain white backgrounds suit younger children; a grown-up can read the choices aloud. There are no obscure solids or fine colour distinctions. Solid shapes use shading to distinguish a ball from a flat circle and show the faces of a cube.

Each picture contains one large shape. The quiz uses the existing 20-question rounds, four shuffled choices, gentle feedback, scoring, resume and optional high scores. Pictures are local SVGs and remain fully visible on mobile.

`data/shapes.json` contains the question bank. `web/shapes/` contains original illustrations covered by the application's GPL-3.0-only licence, with no third-party assets. To regenerate the bank and illustrations, run `node scripts/generate-shapes.mjs`, then `npm run content:generate`. Apply the repeatable seed with `npm run db:local`; no schema migration is needed.
