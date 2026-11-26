ALTER TABLE survey_questions ADD COLUMN question_version integer NOT NULL DEFAULT 1;
ALTER TABLE metric_points ADD COLUMN question_id text;
ALTER TABLE metric_points ADD COLUMN question_version integer NOT NULL DEFAULT 1;
ALTER TABLE metric_points ADD COLUMN scale_min integer;
ALTER TABLE metric_points ADD COLUMN scale_max integer;
ALTER TABLE metric_points ADD COLUMN scale_signature text;
CREATE INDEX metric_scale_compatibility_idx ON metric_points(internship_id, dimension, scale_signature, wave);
