INSERT INTO app_state (id, state, revision, updated_at)
VALUES (1, $1::jsonb, $2, now())
ON CONFLICT (id) DO UPDATE
SET state = EXCLUDED.state, revision = EXCLUDED.revision, updated_at = now();
