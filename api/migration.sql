CREATE TABLE IF NOT EXISTS juli_plans (
 id text PRIMARY KEY, title text NOT NULL, subtitle text NOT NULL DEFAULT '',
 items jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS juli_schedule (
 id integer PRIMARY KEY CHECK(id=1), weekdays jsonb NOT NULL, revision integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS juli_sessions (
 id uuid PRIMARY KEY, workout_date date NOT NULL, plan_id text NOT NULL,
 title text NOT NULL, items jsonb NOT NULL, marks jsonb NOT NULL DEFAULT '{}',
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 duration_seconds integer NOT NULL DEFAULT 0, UNIQUE(workout_date,plan_id)
);
CREATE INDEX IF NOT EXISTS juli_sessions_date_idx ON juli_sessions(workout_date DESC);
CREATE TABLE IF NOT EXISTS juli_operations (
 id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES juli_sessions(id), created_at timestamptz NOT NULL DEFAULT now()
);
