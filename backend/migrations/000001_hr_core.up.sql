CREATE TABLE actors (
    id text PRIMARY KEY,
    name text NOT NULL,
    role text NOT NULL CHECK (role IN ('hr','manager','mentor','intern')),
    team_id text,
    internship_id text,
    initials text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE teams (id text PRIMARY KEY, name text NOT NULL);
CREATE TABLE cohorts (id text PRIMARY KEY, name text NOT NULL, program text NOT NULL, started_at date, ends_at date);
CREATE TABLE internships (
    id text PRIMARY KEY,
    intern_actor_id text NOT NULL REFERENCES actors(id),
    cohort_id text NOT NULL REFERENCES cohorts(id),
    team_id text NOT NULL REFERENCES teams(id),
    manager_actor_id text NOT NULL REFERENCES actors(id),
    mentor_actor_id text NOT NULL REFERENCES actors(id),
    stage text NOT NULL,
    progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    last_activity timestamptz NOT NULL
);
CREATE TABLE surveys (
    id text PRIMARY KEY, title text NOT NULL, description text NOT NULL DEFAULT '',
    status text NOT NULL CHECK (status IN ('draft','published','closed')),
    audience text NOT NULL CHECK (audience IN ('intern','mentor','manager')),
    period text NOT NULL, due_at timestamptz, wave integer NOT NULL CHECK (wave > 0),
    created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE TABLE survey_questions (
    id text NOT NULL, survey_id text NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    position integer NOT NULL, type text NOT NULL CHECK (type IN ('text','scale','single','multiple')),
    title text NOT NULL, required boolean NOT NULL DEFAULT false, dimension text,
    scale_min integer, scale_max integer, options jsonb NOT NULL DEFAULT '[]'::jsonb,
    PRIMARY KEY (survey_id,id)
);
CREATE TABLE survey_assignments (
    id text PRIMARY KEY, survey_id text NOT NULL REFERENCES surveys(id),
    internship_id text NOT NULL REFERENCES internships(id), respondent_actor_id text NOT NULL REFERENCES actors(id),
    status text NOT NULL, due_at timestamptz, submitted_at timestamptz,
    UNIQUE (survey_id,internship_id,respondent_actor_id)
);
CREATE TABLE survey_responses (
    id text PRIMARY KEY, survey_id text NOT NULL REFERENCES surveys(id), assignment_id text NOT NULL REFERENCES survey_assignments(id),
    internship_id text NOT NULL REFERENCES internships(id), respondent_actor_id text NOT NULL REFERENCES actors(id),
    answers jsonb NOT NULL, status text NOT NULL, external_id text, version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
    UNIQUE (external_id,version)
);
CREATE TABLE metric_points (
    id text PRIMARY KEY, response_id text NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
    internship_id text NOT NULL REFERENCES internships(id), dimension text NOT NULL,
    value double precision NOT NULL, actor_role text NOT NULL, wave integer NOT NULL, created_at timestamptz NOT NULL
);
CREATE TABLE signals (
    id text PRIMARY KEY, internship_id text NOT NULL REFERENCES internships(id), title text NOT NULL,
    dimension text, urgency text NOT NULL, evidence_strength text NOT NULL, status text NOT NULL,
    summary text NOT NULL, rule text NOT NULL, evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
    owner_actor_id text REFERENCES actors(id), due_at timestamptz, history jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE TABLE signal_actions (
    id text PRIMARY KEY, signal_id text NOT NULL REFERENCES signals(id), title text NOT NULL,
    owner_actor_id text NOT NULL REFERENCES actors(id), status text NOT NULL, result text NOT NULL DEFAULT '',
    comment text NOT NULL DEFAULT '', due_at timestamptz, created_at timestamptz NOT NULL, completed_at timestamptz
);
CREATE TABLE feedback (
    id text PRIMARY KEY, internship_id text NOT NULL REFERENCES internships(id), author_actor_id text NOT NULL REFERENCES actors(id),
    recipient_actor_id text NOT NULL REFERENCES actors(id), relation text, frequency text, sentiment text,
    strengths text NOT NULL DEFAULT '', growth text NOT NULL DEFAULT '', text text NOT NULL DEFAULT '', status text NOT NULL,
    created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, published_at timestamptz
);
CREATE TABLE feedback_requests (
    id text PRIMARY KEY, internship_id text NOT NULL REFERENCES internships(id), requester_actor_id text NOT NULL REFERENCES actors(id),
    recipient_actor_id text NOT NULL REFERENCES actors(id), message text NOT NULL DEFAULT '', status text NOT NULL, created_at timestamptz NOT NULL
);
CREATE TABLE reviews (
    id text PRIMARY KEY, internship_id text NOT NULL REFERENCES internships(id), kind text NOT NULL,
    author_actor_id text NOT NULL REFERENCES actors(id), text text NOT NULL DEFAULT '', manager_reasoning text NOT NULL DEFAULT '',
    score double precision, recommended_level text, calibrated_level text, final_level text, status text NOT NULL,
    analysis jsonb NOT NULL DEFAULT '{}'::jsonb, announced_at timestamptz, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE TABLE diagnostics (
    id text PRIMARY KEY, internship_id text NOT NULL REFERENCES internships(id), kind integer NOT NULL CHECK (kind IN (180,270,360)),
    status text NOT NULL, required_roles jsonb NOT NULL, completed_roles jsonb NOT NULL, quorum boolean NOT NULL DEFAULT false,
    results jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL, completed_at timestamptz
);
CREATE TABLE development_goals (
    id text PRIMARY KEY, internship_id text NOT NULL REFERENCES internships(id), owner_actor_id text NOT NULL REFERENCES actors(id),
    title text NOT NULL, description text NOT NULL DEFAULT '', due_at timestamptz NOT NULL,
    progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100), status text NOT NULL,
    result text NOT NULL DEFAULT '', created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE TABLE integrations (
    id text PRIMARY KEY, kind text NOT NULL, name text NOT NULL, status text NOT NULL,
    last_sync_at timestamptz, items_synced integer NOT NULL DEFAULT 0, config jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE integration_journal (
    id text PRIMARY KEY, integration_id text NOT NULL REFERENCES integrations(id), event text NOT NULL,
    status text NOT NULL, message text NOT NULL DEFAULT '', items integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL
);
CREATE TABLE settings (
    id integer PRIMARY KEY CHECK (id=1), show_feedback_to_intern boolean NOT NULL DEFAULT true,
    signal_thresholds jsonb NOT NULL DEFAULT '{"low":2.5,"positive":4.5}'::jsonb,
    scale_min integer NOT NULL DEFAULT 1, scale_max integer NOT NULL DEFAULT 5,
    updated_at timestamptz NOT NULL, updated_by text REFERENCES actors(id)
);
CREATE TABLE ai_logs (
    id text PRIMARY KEY, actor_id text NOT NULL REFERENCES actors(id), kind text NOT NULL,
    model text NOT NULL, prompt_version text NOT NULL, context_id text, created_at timestamptz NOT NULL
);
CREATE TABLE notifications (
    id text PRIMARY KEY, actor_id text NOT NULL REFERENCES actors(id), kind text NOT NULL,
    message text NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL
);
-- app_state is the transactional JSONB aggregate used by the runtime adapter.
-- The normalized tables above define the integration/reporting schema for the domain.
CREATE TABLE app_state (
    id integer PRIMARY KEY CHECK (id=1), state jsonb NOT NULL,
    revision bigint NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX responses_internship_idx ON survey_responses(internship_id,updated_at DESC);
CREATE INDEX metrics_dimension_idx ON metric_points(internship_id,dimension,wave);
CREATE INDEX signals_queue_idx ON signals(status,urgency,owner_actor_id);
CREATE INDEX actions_owner_idx ON signal_actions(owner_actor_id,status);
CREATE INDEX feedback_visibility_idx ON feedback(internship_id,status,published_at);
