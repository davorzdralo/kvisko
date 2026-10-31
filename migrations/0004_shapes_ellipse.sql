-- New games use ellipse instead of oval. Saved games keep their snapshots;
-- the three original oval SVGs remain available for those games.
DELETE FROM questions WHERE quiz_id = 'shapes-colours'
  AND id IN ('orange-oval', 'red-oval', 'yellow-oval');
