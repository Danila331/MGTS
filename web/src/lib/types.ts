export type Role = "hr" | "manager" | "mentor" | "intern";
export type ID = string;
export type TrafficLight = "green" | "yellow" | "red";
export type SurveyAudience = "intern" | "mentor";

export interface Actor {
  id: ID;
  name: string;
  role: Role;
  team_id?: string;
  internship_id?: string;
  initials: string;
  title: string;
}

export interface ScoreSummary {
  latest_score: number | null;
  overall_score: number | null;
  cohort_average: number | null;
  percentile_min: number | null;
  percentile_max: number | null;
  percentile_label: string;
  traffic_light: TrafficLight;
  department: string;
  current_period: string;
}

export interface InternItem extends ScoreSummary {
  id: ID;
  intern: { id: ID; name: string; initials: string };
  program: string;
  cohort: string;
  team: string;
  team_id: ID;
  stage: string;
  manager: string;
  mentor: string;
  coverage: number;
  last_activity: string;
}

export interface Question {
  id: ID;
  type: "text" | "scale" | "single" | "multiple";
  title: string;
  required: boolean;
  dimension: string;
  min: number;
  max: number;
  options: string[];
  version?: number;
}

export interface Coverage {
  invited: number;
  submitted: number;
  people: number;
  percent: number;
}

export interface Survey {
  id: ID;
  title: string;
  description: string;
  status: "published" | "closed";
  audience: SurveyAudience;
  period: string;
  due_at: string;
  wave: string;
  questions: Question[];
  coverage: Coverage;
  assignments: string[];
  updated_at: string;
}

export type Answers = Record<ID, string | number | string[]>;
export interface SurveyResponse {
  id: ID;
  survey_id: ID;
  respondent: string;
  role: SurveyAudience;
  internship_id: ID;
  period: string;
  submitted_at: string;
  answers: Answers;
}

export interface DashboardData {
  metrics: { interns: number; coverage: number; avg_score: number | null; attention: number };
  items: InternItem[];
  coverage: { label: string; value: number; total: number }[];
  averages: { latest_score: number | null; overall_score: number | null; cohort_average: number | null };
  trends: { id?: string; label: string; values: (number | null)[] }[];
  updated_at: string;
}

export interface MetricComparison {
  id: string;
  label: string;
  intern: number | null;
  mentor: number | null;
}

export interface TrendPoint {
  period: string;
  label: string;
  intern: number | null;
  mentor: number | null;
}

export interface InternshipDetail {
  internship: InternItem;
  participants: { name: string; role: string; initials: string }[];
  metrics: MetricComparison[];
  trends: TrendPoint[];
  timeline: { id: ID; title: string; text: string; at: string; kind: string }[];
  responses: SurveyResponse[];
  summary: ScoreSummary;
  coverage: Coverage;
}

export interface SurveyDetail {
  survey: Survey;
  questions: Question[];
  assignments: string[];
  coverage: Coverage;
  responses: SurveyResponse[];
}

export interface SurveyTake {
  survey: Survey;
  questions: Question[];
  answers: Answers;
  internship_id?: ID;
}

export interface MockState {
  surveys: Survey[];
  responses: SurveyResponse[];
  drafts: Record<string, Answers>;
}
