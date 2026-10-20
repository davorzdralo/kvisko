-- Remove territories and other non-country entries from new flag games.
-- Existing sessions store their own question snapshots and remain resumable.
DELETE FROM questions
WHERE quiz_id = 'world-flags'
  AND id IN (
    'ai', 'aq', 'as', 'aw', 'ax', 'bl', 'bm', 'bq', 'bv', 'cc', 'ck', 'cw', 'cx', 'eh', 'fk', 'fo', 'gf', 'gg', 'gi', 'gl', 'gp', 'gs', 'gu', 'hk', 'hm', 'im', 'io', 'je', 'ky', 'mf', 'mo', 'mp', 'mq', 'ms', 'nc', 'nf', 'nu', 'pf', 'pm', 'pn', 'pr', 're', 'sh', 'sj', 'sx', 'tc', 'tf', 'tk', 'um', 'vg', 'vi', 'wf', 'yt'
  );
