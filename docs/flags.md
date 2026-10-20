# Country flags

The flag quiz contains 199 entries: the 193 UN member states, the Holy See
(labelled Vatican City), Palestine, Taiwan, and England, Scotland and Wales.
The United Kingdom remains a separate entry with the Union Flag.

Dependent territories, overseas regions, Crown Dependencies, special
administrative regions, Antarctica and Western Sahara are excluded. Aruba,
Curaçao and Sint Maarten, though constituent countries within the Kingdom of
the Netherlands, and the self-governing Cook Islands and Niue are outside this
quiz's scope. England, Scotland and Wales are explicit inclusions for this
children's quiz, rather than a rule to include every constituent territory.
Northern Ireland is excluded because it has no distinct current official flag;
the Union Flag would duplicate the United Kingdom, and the Ulster Banner has
no current official status.

Labels use Serbian Cyrillic. All flags, including the three UK constituent
country flags, come from the MIT-licensed
[flag-icons 7.3.2](https://github.com/lipis/flag-icons/tree/v7.3.2/flags/4x3).
Unused territory assets remain bundled so existing games can still show their
saved question snapshots. They are not available as questions or distractors in
new games.

`data/flags.json` is the source bank and `data/seed.sql` is regenerated with
`npm run content:generate`. Migration `0003_country_flags.sql` removes old
territory rows from existing databases; applying the new seed adds England,
Scotland and Wales. Neither operation rewrites saved games or high scores.
