import { roleLabels } from "./format";
import type {
  Actor,
  Answers,
  Coverage,
  DashboardData,
  InternItem,
  InternshipDetail,
  MetricComparison,
  ParticipationState,
  Question,
  ScoreSummary,
  Survey,
  SurveyResponse,
  TrafficLight,
  TrendPoint,
} from "./types";

type R = Record<string, unknown>;
type Fetcher = (path: string) => Promise<unknown>;
const rec = (value: unknown): R => value && typeof value === "object" && !Array.isArray(value) ? value as R : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const str = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const num = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const nullable = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const bool = (value: unknown, fallback = false) => typeof value === "boolean" ? value : fallback;
const date = (value: unknown, fallback = "") => str(value, fallback);
const period = (value: unknown, fallback = "") => typeof value === "number" ? `Месяц ${value}` : str(value, fallback);

const FRONT_TO_BACK: Record<string, string> = {
  "a-hr": "actor-hr",
  "a-manager": "actor-manager",
  "a-mentor": "Н-001",
  "a-intern": "СТ-001",
  "sv-intern-1": "survey-intern-1",
  "sv-intern-2": "survey-intern-2",
  "sv-intern-3": "survey-intern-3",
  "sv-intern-4": "survey-intern-4",
  "sv-intern-5": "survey-intern-5",
  "sv-intern-6": "survey-intern-6",
  "sv-mentor-1": "survey-mentor-1",
  "sv-mentor-2": "survey-mentor-2",
  "sv-mentor-3": "survey-mentor-3",
  "sv-mentor-4": "survey-mentor-4",
  "sv-mentor-5": "survey-mentor-5",
  "sv-mentor-6": "survey-mentor-6",
};
for (let index = 1; index <= 5; index++) FRONT_TO_BACK[`i-${index}`] = `internship-${String(index).padStart(2, "0")}`;
const BACK_TO_FRONT = Object.fromEntries(Object.entries(FRONT_TO_BACK).map(([front, back]) => [back, front]));
export const toBackendId = (id: string) => FRONT_TO_BACK[id] ?? id;
export const toFrontendId = (id: string) => BACK_TO_FRONT[id] ?? id;

function mapIds(value: unknown, mapper: (id: string) => string): unknown {
  if (typeof value === "string") return mapper(value);
  if (Array.isArray(value)) return value.map((item) => mapIds(item, mapper));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as R).map(([key, item]) => [key, mapIds(item, mapper)]));
  return value;
}
export function prepareRemotePath(path: string) {
  const url = new URL(path, "http://remote.local");
  url.pathname = url.pathname.split("/").map((part) => toBackendId(part)).join("/");
  for (const key of ["actor_id", "owner_id", "internship_id", "team_id"]) {
    const value = url.searchParams.get(key);
    if (value) url.searchParams.set(key, toBackendId(value));
  }
  return `${url.pathname}${url.search}`;
}
export function prepareRemoteBody(_path: string, body: unknown, _actorId: string): unknown {
  if (!body || typeof body !== "object") return body;
  const mapped = rec(mapIds(body, toBackendId));
  if (Array.isArray(mapped.questions)) mapped.questions = mapped.questions.map((question) => {
    const item = rec(question);
    if (Array.isArray(item.options) && item.options.length === 0) delete item.options;
    return item;
  });
  return mapped;
}

const actorNames = new Map<string, string>();
const internshipNames = new Map<string, string>();
const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2);
function actorName(id: unknown) {
  const raw = str(id);
  return actorNames.get(raw) ?? actorNames.get(toBackendId(raw)) ?? raw;
}
function internshipName(id: unknown) {
  const raw = str(id);
  return internshipNames.get(raw) ?? internshipNames.get(toBackendId(raw)) ?? "Стажёр";
}
function normalizeActor(value: unknown): Actor {
  const raw = rec(value);
  const backendId = str(raw.id);
  const name = str(raw.name, backendId);
  actorNames.set(backendId, name);
  if (raw.internship_id) internshipNames.set(str(raw.internship_id), name);
  const role = str(raw.role, "hr") as Actor["role"];
  return {
    id: toFrontendId(backendId), name, role,
    team_id: raw.team_id ? toFrontendId(str(raw.team_id)) : undefined,
    internship_id: raw.internship_id ? toFrontendId(str(raw.internship_id)) : undefined,
    initials: str(raw.initials, initials(name)),
    title: str(raw.title, `${roleLabels[role] ?? "Участник"}${raw.team_id ? ` · ${toFrontendId(str(raw.team_id))}` : ""}`),
  };
}
function normalizeCoverage(value: unknown, fallbackPercent = 0): Coverage {
  if (typeof value === "number") return { invited: 0, submitted: 0, people: 0, percent: value };
  const raw = rec(value);
  const invited = num(raw.invited);
  const submitted = num(raw.submitted);
  return {
    invited, submitted,
    people: num(raw.people ?? raw.unique),
    percent: num(raw.percent ?? raw.value, invited ? Math.round(submitted / invited * 100) : fallbackPercent),
  };
}
function normalizeSummary(value: unknown, fallback?: Partial<ScoreSummary>): ScoreSummary {
  const raw = rec(value);
  const percentile = rec(raw.percentile);
  const min = nullable(raw.percentile_min ?? percentile.min ?? fallback?.percentile_min);
  const max = nullable(raw.percentile_max ?? percentile.max ?? fallback?.percentile_max);
  const latest = nullable(raw.latest_score ?? raw.latestScore ?? fallback?.latest_score);
  const light = str(raw.traffic_light ?? raw.trafficLight ?? fallback?.traffic_light);
  return {
    latest_score: latest,
    overall_score: nullable(raw.overall_score ?? raw.overallScore ?? fallback?.overall_score),
    cohort_average: nullable(raw.cohort_average ?? raw.cohortAverage ?? fallback?.cohort_average),
    percentile_min: min,
    percentile_max: max,
    percentile_label: str(raw.percentile_label ?? percentile.label ?? fallback?.percentile_label, min !== null && max !== null ? `${min}–${max}` : "—"),
    traffic_light: (["green", "yellow", "red"].includes(light) ? light : (latest ?? 0) >= 4.5 ? "green" : (latest ?? 0) >= 3.5 ? "yellow" : "red") as TrafficLight,
    department: str(raw.department ?? fallback?.department, str(raw.team, "—")),
    current_period: period(raw.current_period ?? raw.period ?? fallback?.current_period, "—"),
  };
}
function normalizeIntern(value: unknown): InternItem {
  const raw = rec(value);
  const summary = normalizeSummary({ ...rec(raw.summary), ...raw });
  const id = toFrontendId(str(raw.id ?? raw.internship_id));
  const internRaw = rec(raw.intern);
  const name = str(internRaw.name ?? raw.intern_name, internshipName(raw.id ?? raw.internship_id));
  internshipNames.set(str(raw.id ?? raw.internship_id), name);
  actorNames.set(str(internRaw.id), name);
  return {
    id,
    intern: { id: toFrontendId(str(internRaw.id)), name, initials: str(internRaw.initials, initials(name)) },
    program: str(raw.program, "Стажировка МГТС"),
    cohort: str(raw.cohort, "Поток 2026"),
    team: str(raw.team, summary.department),
    team_id: toFrontendId(str(raw.team_id)),
    stage: str(raw.stage, summary.current_period),
    manager: str(raw.manager, actorName(raw.manager_id)),
    mentor: str(raw.mentor, actorName(raw.mentor_id)),
    coverage: normalizeCoverage(raw.coverage, num(raw.coverage_percent)).percent,
    last_activity: date(raw.last_activity ?? raw.updated_at),
    ...summary,
  };
}
function normalizeQuestion(value: unknown): Question {
  const raw = rec(value);
  return {
    id: str(raw.id), type: str(raw.type, "text") as Question["type"], title: str(raw.title),
    required: bool(raw.required), dimension: str(raw.dimension, "experience"),
    min: num(raw.min, 1), max: num(raw.max, 5), options: list(raw.options).map(String),
    ...(raw.version !== undefined ? { version: num(raw.version, 1) } : {}),
  };
}
function normalizeSurvey(value: unknown): Survey {
  const raw = rec(value);
  const currentPeriod = period(raw.period ?? raw.wave, "Контрольный период");
  return {
    id: toFrontendId(str(raw.id)), title: str(raw.title), description: str(raw.description),
    status: str(raw.status) === "closed" ? "closed" : "published",
    audience: str(raw.audience) === "mentor" ? "mentor" : "intern",
    period: currentPeriod,
    due_at: date(raw.due_at),
    wave: typeof raw.wave === "number" ? `Месяц ${raw.wave}` : str(raw.wave, currentPeriod),
    questions: list(raw.questions).map(normalizeQuestion),
    coverage: normalizeCoverage(raw.coverage),
    assignments: list(raw.assignments).map((item) => typeof item === "string" ? item : `${toFrontendId(str(rec(item).internship_id))} · ${str(rec(item).status, "assigned")}`),
    updated_at: date(raw.updated_at ?? raw.created_at),
  };
}
function normalizeResponse(value: unknown): SurveyResponse {
  const raw = rec(value);
  return {
    id: str(raw.id), survey_id: toFrontendId(str(raw.survey_id)),
    respondent: str(raw.respondent, actorName(raw.respondent_id)),
    role: str(raw.role, "intern") === "mentor" ? "mentor" : "intern",
    internship_id: toFrontendId(str(raw.internship_id)),
    period: period(raw.period ?? raw.wave),
    submitted_at: date(raw.submitted_at ?? raw.updated_at ?? raw.created_at),
    answers: rec(raw.answers) as Answers,
  };
}
function normalizeAssignments(value: unknown) {
  return list(value).map((item) => typeof item === "string" ? item : `${toFrontendId(str(rec(item).internship_id))} · ${str(rec(item).status, "assigned")}`);
}
const dashboardDimensionLabels: Record<string, string> = {
  clarity: "Понятность задач", support: "Поддержка наставника", workload: "Комфортность нагрузки",
  interest: "Интерес к задачам", growth: "Профессиональное развитие", team: "Взаимодействие с командой",
  satisfaction: "Удовлетворённость стажировкой", understanding: "Понимание задач", quality: "Качество задач",
  independence: "Самостоятельность", deadlines: "Соблюдение сроков", engagement: "Вовлечённость",
  communication: "Взаимодействие с командой",
};
function normalizeDashboardTrends(raw: R) {
  const dimensions = list(raw.dimension_trends);
  if (dimensions.length) return dimensions.map((item, index) => {
    const trend = rec(item);
    const dimension = str(trend.dimension);
    return {
      id: str(trend.question_id ?? trend.dimension, `trend-${index}`),
      label: dashboardDimensionLabels[dimension] ?? str(trend.label ?? trend.dimension, `Измерение ${index + 1}`),
      values: list(trend.points).map((point) => nullable(rec(point).value)),
    };
  });
  const points = list(raw.trends);
  return (["intern", "mentor"] as const).map((role) => ({
    id: role,
    label: role === "intern" ? "Стажёры" : "Наставники",
    values: points.map((point) => nullable(rec(point)[role] ?? rec(point)[`${role}_score`])),
  }));
}
function normalizeDashboard(value: unknown): DashboardData {
  const raw = rec(value);
  const metrics = rec(raw.metrics);
  const averages = rec(raw.averages);
  const items = list(raw.items).map(normalizeIntern);
  const coverageRaw = rec(raw.coverage);
  const coverage = Array.isArray(raw.coverage)
    ? raw.coverage.map((item) => ({ label: str(rec(item).label), value: num(rec(item).value ?? rec(item).percent), total: num(rec(item).total, 100) }))
    : [{ label: "Ответы стажёров и наставников", value: num(coverageRaw.percent), total: num(coverageRaw.invited) }];
  const participation = (value: unknown): ParticipationState => value === "submitted" || value === "pending" ? value : "";
  return {
    metrics: {
      interns: num(metrics.interns, items.length),
      coverage: num(metrics.coverage ?? metrics.average_coverage ?? coverageRaw.percent),
      avg_score: nullable(metrics.avg_score ?? averages.latest_score),
      attention: num(metrics.attention ?? metrics.requires_attention, items.filter((item) => item.traffic_light !== "green").length),
    },
    items,
    coverage,
    averages: {
      latest_score: nullable(averages.latest_score ?? metrics.avg_score),
      overall_score: nullable(averages.overall_score),
      cohort_average: nullable(averages.cohort_average),
    },
    trends: normalizeDashboardTrends(raw),
    updated_at: date(raw.updated_at),
    survey_participation: list(raw.survey_participation).map((item) => {
      const row = rec(item);
      return {
        internship_id: toFrontendId(str(row.internship_id)),
        name: str(row.name),
        periods: list(row.periods).map((item) => ({ intern: participation(rec(item).intern), mentor: participation(rec(item).mentor) })),
      };
    }),
  };
}
function normalizeTrendPoints(value: unknown): TrendPoint[] {
  const raw = rec(value);
  if (Array.isArray(raw.intern) || Array.isArray(raw.mentor)) {
    const labels = list(raw.labels ?? raw.periods);
    return Array.from({ length: Math.max(list(raw.intern).length, list(raw.mentor).length, 6) }, (_, index) => ({
      period: period(labels[index], `Месяц ${index + 1}`), label: period(labels[index], `Месяц ${index + 1}`),
      intern: nullable(list(raw.intern)[index]), mentor: nullable(list(raw.mentor)[index]),
    }));
  }
  const values = list(value);
  if (values.some((item) => Array.isArray(rec(item).points))) {
    const waves = new Map<string, { intern: (number | null)[]; mentor: (number | null)[] }>();
    values.forEach((series) => {
      const item = rec(series);
      const role = str(item.role ?? item.respondent_role ?? item.audience) === "mentor" ? "mentor" : "intern";
      list(item.points).forEach((point, index) => {
        const pointRaw = rec(point);
        const label = period(pointRaw.period ?? pointRaw.wave, `Месяц ${index + 1}`);
        const current = waves.get(label) ?? { intern: [], mentor: [] };
        current[role].push(nullable(pointRaw.value));
        waves.set(label, current);
      });
    });
    const mean = (items: (number | null)[]) => {
      const present = items.filter((item): item is number => item !== null);
      return present.length ? present.reduce((sum, item) => sum + item, 0) / present.length : null;
    };
    return [...waves.entries()].map(([label, scores]) => ({ period: label, label, intern: mean(scores.intern), mentor: mean(scores.mentor) }));
  }
  return values.map((item, index) => {
    const point = rec(item);
    const label = period(point.period ?? point.label ?? point.wave, `Месяц ${index + 1}`);
    return {
      period: label, label,
      intern: nullable(point.intern ?? point.intern_score ?? point.self_score ?? point.value),
      mentor: nullable(point.mentor ?? point.mentor_score),
    };
  });
}
function normalizeMetrics(value: unknown, trends: TrendPoint[]): MetricComparison[] {
  const items = list(rec(value).items ?? value);
  if (items.length) return items.map((item, index) => {
    const metric = rec(item);
    return {
      id: str(metric.id ?? metric.dimension, `metric-${index}`),
      label: str(metric.label ?? metric.title ?? metric.dimension, `Измерение ${index + 1}`),
      intern: nullable(metric.intern ?? metric.intern_score ?? metric.self_score ?? metric.value),
      mentor: nullable(metric.mentor ?? metric.mentor_score),
    };
  });
  return [{ id: "overall", label: "Средний балл", intern: trends.at(-1)?.intern ?? null, mentor: trends.at(-1)?.mentor ?? null }];
}

export async function normalizeRemote<T>(path: string, value: unknown, _fetcher: Fetcher): Promise<T> {
  const url = new URL(path, "http://remote.local");
  const parts = url.pathname.replace(/^\/api\/v1/, "").replace(/^\/+|\/+$/g, "").split("/");
  const raw = rec(value);
  if (parts[0] === "actors") return { ...raw, items: list(raw.items).map(normalizeActor) } as T;
  if (parts[0] === "bootstrap") return { ...raw, actor: normalizeActor(raw.actor), actors: list(raw.actors).map(normalizeActor) } as T;
  if (parts[0] === "dashboard") return normalizeDashboard(raw) as T;
  if (parts[0] === "interns" && parts.length === 1) return { ...raw, items: list(raw.items).map(normalizeIntern) } as T;
  if (parts[0] === "interns" && parts[1] === "options") return raw as T;
  if (parts[0] === "interns" && parts[1]) {
    const internship = normalizeIntern(raw.internship);
    const trends = normalizeTrendPoints(raw.trends);
    const result: InternshipDetail = {
      internship,
      participants: list(raw.participants).map((item) => {
        const person = rec(item);
        const name = str(person.name, actorName(person.actor_id));
        return { name, role: roleLabels[str(person.role) as Actor["role"]] ?? str(person.role), initials: str(person.initials, initials(name)) };
      }),
      metrics: normalizeMetrics(raw.metrics, trends),
      trends,
      timeline: list(raw.timeline).map((item) => {
        const event = rec(item);
        return { id: str(event.id), title: str(event.title), text: str(event.text), at: date(event.at), kind: str(event.kind) };
      }),
      responses: list(raw.responses).map(normalizeResponse),
      summary: normalizeSummary(raw.summary, internship),
      coverage: normalizeCoverage(raw.coverage, internship.coverage),
    };
    return result as T;
  }
  if (parts[0] === "internships" && parts[1]) return normalizeIntern(raw) as T;
  if (parts[0] === "surveys") {
    if (parts.length === 1 && raw.items) {
      const assignedInternships = Object.fromEntries(Object.entries(rec(raw.assigned_internships)).map(([surveyID, options]) => [
        toFrontendId(surveyID),
        list(options).map((item) => {
          const option = rec(item);
          return { internship_id: toFrontendId(str(option.internship_id)), intern_name: str(option.intern_name) };
        }),
      ]));
      return { ...raw, items: list(raw.items).map(normalizeSurvey), assigned_internships: assignedInternships } as T;
    }
    if (parts[2] === "take") return {
      survey: normalizeSurvey(raw.survey), questions: list(raw.questions).map(normalizeQuestion),
      answers: rec(rec(raw.draft).answers ?? raw.answers) as Answers,
      internship_id: toFrontendId(str(rec(raw.assignment).internship_id ?? raw.internship_id ?? url.searchParams.get("internship_id"))) || undefined,
    } as T;
    if (raw.survey) return {
      ...raw, survey: normalizeSurvey(raw.survey), questions: list(raw.questions).map(normalizeQuestion),
      coverage: normalizeCoverage(raw.coverage), responses: list(raw.responses).map(normalizeResponse), assignments: normalizeAssignments(raw.assignments),
    } as T;
    return normalizeSurvey(raw) as T;
  }
  return value as T;
}
