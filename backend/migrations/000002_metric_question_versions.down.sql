DROP INDEX IF EXISTS metric_scale_compatibility_idx;
ALTER TABLE metric_points DROP COLUMN IF EXISTS scale_signature;
ALTER TABLE metric_points DROP COLUMN IF EXISTS scale_max;
ALTER TABLE metric_points DROP COLUMN IF EXISTS scale_min;
ALTER TABLE metric_points DROP COLUMN IF EXISTS question_version;
ALTER TABLE metric_points DROP COLUMN IF EXISTS question_id;
ALTER TABLE survey_questions DROP COLUMN IF EXISTS question_version;
