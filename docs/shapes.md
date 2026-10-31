# Shapes and colours

**Облици и боје** asks **Који је ово облик и које је боје?** Answers name both the colour and the shape in Serbian Cyrillic, such as **Црвени троугао**, **Плави круг**, and **Зелена коцка**.

The bank has **135 pictures: all 15 shapes in all nine colours**. Shapes are triangle (троугао), circle (круг), square (квадрат), rectangle (правоугаоник), ellipse (елипса), star (звезда), heart (срце), cube (коцка), ball/sphere (лопта), cone (купа), pyramid (пирамида), rhombus (ромб), trapezium (трапез), cuboid (квадар), and cylinder (ваљак). Colours are red, blue, green, yellow, orange, pink, brown (браон), black (црна), and white (бела). Colour adjectives agree with the shape's gender; браон is unchanged.

Each picture contains one large shape on white. White shapes have a grey outline so their silhouette stays visible. Solid shapes use shading and face edges; the sphere differs from the flat circle, and the cuboid is visibly longer than the cube.

Every question offers four shuffled choices forming a two-colour, two-shape grid. For a red triangle, these might be red triangle, blue triangle, red square and blue square. Exactly two choices share the pictured colour and exactly two share its shape, so children must recognise both. Distractors come from the full bank, not just the current round.

The quiz retains 20-question rounds, gentle feedback, scoring, resume and optional high scores. The round can be configured up to the existing 100-question maximum; 135 is the bank size, not the default round length. Pictures are local SVGs and remain fully visible on mobile. A grown-up can read the choices aloud.

`data/shapes.json` contains the question bank. `web/shapes/` contains original illustrations covered by the application's GPL-3.0-only licence, with no third-party assets. To regenerate the bank and illustrations, run `node scripts/generate-shapes.mjs`, then `npm run content:generate`. Apply the repeatable seed with `npm run db:local`; migration `0004_shapes_ellipse.sql` removes the three old oval entries from new games. Existing games keep their original snapshots, and the original oval SVGs remain bundled for them.
