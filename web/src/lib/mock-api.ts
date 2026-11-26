import { actors, coverageFor, createSeed, interns, metricsFor, periods, trendsFor } from "./mock-data";
import { uid } from "./format";
import type {
  Actor,
  Answers,
  DashboardData,
  InternshipDetail,
  MockState,
  Role,
  Survey,
  SurveyResponse,
} from "./types";

const STORAGE_KEY = "mgts.pulse.mock.v1";
export class MockHttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const now = () => new Date().toISOString();
const clone = <T,>(value: T): T => structuredClone(value);
const average = (values: (number | null)[]) => {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length ? Math.round(present.reduce((sum, value) => sum + value, 0) / present.length * 100) / 100 : null;
};

function load(): MockState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockState;
  } catch { /* восстановим демо-данные */ }
  const seed = createSeed();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}
function save(state: MockState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("mgts:mutation"));
}
function fail(status: number, message: string): never { throw new MockHttpError(status, message); }
function bodyOf(init?: RequestInit): Record<string, unknown> {
  if (!init?.body) return {};
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}
function actorById(id: string): Actor { return actors.find((actor) => actor.id === id) ?? actors[0]; }
function allowedIntern(actor: Actor, id: string) {
  if (actor.role === "hr" || actor.role === "manager") return interns.some((item) => item.id === id);
  if (actor.role === "intern") return actor.internship_id === id;
  return ["i-1", "i-2"].includes(id);
}
function scopedInterns(actor: Actor) { return interns.filter((item) => allowedIntern(actor, item.id)); }
function requireRole(actor: Actor, roles: Role[]) { if (!roles.includes(actor.role)) fail(403, "Это действие недоступно для вашей роли"); }
function asAnswers(value: unknown): Answers { return value && typeof value === "object" ? value as Answers : {}; }
function surveyForRole(actor: Actor, survey: Survey) {
  if (actor.role === "hr" || actor.role === "manager") return true;
  return survey.audience === actor.role;
}
function responseForRole(actor: Actor, response: SurveyResponse) {
  if (actor.role === "hr" || actor.role === "manager") return true;
  return allowedIntern(actor, response.internship_id) && response.role === actor.role;
}

function dashboard(actor: Actor, state: MockState): DashboardData {
  const visible = scopedInterns(actor);
  const allTrends = visible.map((item) => trendsFor(item.id));
  const trends = (["intern", "mentor"] as const).map((role) => ({
    id: role,
    label: role === "intern" ? "Стажёры" : "Наставники",
    values: periods.map((_, month) => average(allTrends.map((trend) => trend[month]?.[role] ?? null))),
  }));
  const coverage = average(visible.map((item) => item.coverage)) ?? 0;
  return {
    metrics: {
      interns: visible.length,
      coverage: Math.round(coverage),
      avg_score: average(visible.map((item) => item.latest_score)),
      attention: visible.filter((item) => item.traffic_light !== "green").length,
    },
    items: clone(visible),
    coverage: (["intern", "mentor"] as const).map((role) => {
      const ids = new Set(visible.map((item) => item.id));
      const submitted = state.responses.filter((response) => ids.has(response.internship_id) && response.role === role && response.period === "Месяц 6").length;
      return { label: role === "intern" ? "Стажёры" : "Наставники", value: visible.length ? Math.round(submitted / visible.length * 100) : 0, total: 100 };
    }),
    averages: {
      latest_score: average(visible.map((item) => item.latest_score)),
      overall_score: average(visible.map((item) => item.overall_score)),
      cohort_average: average(visible.map((item) => item.cohort_average)),
    },
    trends,
    updated_at: now(),
    survey_participation: actor.role === "hr" ? visible.map((item) => ({
      internship_id: item.id, name: item.intern.name,
      periods: periods.map((period) => ({
        intern: mockParticipation(state, item.id, period, "intern"),
        mentor: mockParticipation(state, item.id, period, "mentor"),
      })),
    })) : [],
  };
}

function mockParticipation(state: MockState, internshipId: string, period: string, role: Survey["audience"]) {
  if (state.responses.some((response) => response.internship_id === internshipId && response.period === period && response.role === role)) return "submitted";
  return state.surveys.some((survey) => survey.period === period && survey.audience === role && survey.assignments.includes(internshipId)) ? "pending" : "";
}

function internshipDetail(id: string, actor: Actor, state: MockState): InternshipDetail {
  const internship = scopedInterns(actor).find((item) => item.id === id);
  if (!internship) fail(interns.some((item) => item.id === id) ? 403 : 404, "Стажёр недоступен в вашей области");
  const ownResponses = state.responses.filter((response) => response.internship_id === id);
  const timeline = periods.map((period, index) => {
    const monthResponses = ownResponses.filter((response) => response.period === period);
    return {
      id: `period-${index + 1}`,
      title: period,
      text: monthResponses.length === 2 ? "Получены ответы стажёра и наставника." : `Получен ${monthResponses.length} из 2 ответов.`,
      at: monthResponses.at(-1)?.submitted_at ?? internship.last_activity,
      kind: "survey",
    };
  });
  return {
    internship: clone(internship),
    participants: [
      { name: internship.intern.name, role: "Стажёр", initials: internship.intern.initials },
      { name: internship.mentor, role: "Наставник", initials: internship.mentor.split(" ").map((part) => part[0]).join("").slice(0, 2) },
      { name: internship.manager, role: "Руководитель", initials: internship.manager.split(" ").map((part) => part[0]).join("").slice(0, 2) },
    ],
    metrics: metricsFor(id),
    trends: trendsFor(id),
    timeline,
    responses: clone(ownResponses.sort((a, b) => periods.indexOf(b.period) - periods.indexOf(a.period) || a.role.localeCompare(b.role))),
    summary: {
      latest_score: internship.latest_score,
      overall_score: internship.overall_score,
      cohort_average: internship.cohort_average,
      percentile_min: internship.percentile_min,
      percentile_max: internship.percentile_max,
      percentile_label: internship.percentile_label,
      traffic_light: internship.traffic_light,
      department: internship.department,
      current_period: internship.current_period,
    },
    coverage: coverageFor(id),
  };
}

export async function mockRequest<T>(path: string, actorId: string, init?: RequestInit): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 90));
  const state = load();
  const actor = actorById(actorId);
  const method = (init?.method ?? "GET").toUpperCase();
  const url = new URL(path, "http://mock.local");
  const parts = url.pathname.replace(/^\/api\/v1/, "").replace(/^\/+|\/+$/g, "").split("/");
  const body = bodyOf(init);
  const result = (): unknown => {
    if (method === "GET" && parts[0] === "health") return { status: "fallback", version: "pulse-1", storage: "localStorage" };
    if (method === "GET" && parts[0] === "actors") return { items: clone(actors), demo: true };
    if (method === "GET" && parts[0] === "bootstrap") return { actor, actors };
    if (method === "GET" && parts[0] === "dashboard") {
      if (parts[1] === "mentors") {
        requireRole(actor, ["hr"]);
        return { mentors: [] };
      }
      requireRole(actor, ["hr", "manager", "mentor"]);
      return dashboard(actor, state);
    }
    if (method === "GET" && parts[0] === "integrations" && parts[1] === "status") {
      requireRole(actor, ["hr"]);
      return { tally: false, huntflow: false };
    }
    if (method === "GET" && parts[0] === "interns" && parts[2] === "candidate") {
      requireRole(actor, ["hr"]);
      return { enabled: false, profile: null };
    }
    if (method === "GET" && parts[0] === "interns" && parts.length === 1) {
      requireRole(actor, ["hr", "manager", "mentor"]);
      let items = scopedInterns(actor);
      const query = (url.searchParams.get("search") ?? "").trim().toLowerCase();
      const department = url.searchParams.get("department") ?? "";
      const sort = url.searchParams.get("sort") ?? "percentile";
      if (query) items = items.filter((item) => `${item.intern.name} ${item.department} ${item.mentor}`.toLowerCase().includes(query));
      if (department) items = items.filter((item) => item.department === department);
      items = [...items].sort((a, b) => sort === "name"
        ? a.intern.name.localeCompare(b.intern.name, "ru")
        : sort === "score"
          ? (b.latest_score ?? -1) - (a.latest_score ?? -1)
          : (b.percentile_max ?? -1) - (a.percentile_max ?? -1) || (b.overall_score ?? -1) - (a.overall_score ?? -1));
      return { items: clone(items), total: items.length };
    }
    if (method === "GET" && parts[0] === "interns" && parts[1]) return internshipDetail(parts[1], actor, state);
    if (parts[0] === "surveys") {
      if (method === "GET" && parts.length === 1) {
        const items = state.surveys.filter((survey) => surveyForRole(actor, survey));
        const subjects = actor.role === "intern" || actor.role === "mentor" ? scopedInterns(actor) : [];
        const assignments = Object.fromEntries(items.map((survey) => [survey.id, subjects
          .filter((item) => survey.assignments.includes(item.id))
          .map((item) => ({
            internship_id: item.id, intern_name: item.intern.name, due_at: survey.due_at,
            status: mockParticipation(state, item.id, survey.period, survey.audience) === "submitted" ? "submitted" : "assigned",
          }))]));
        return { items, total: items.length, assigned_internships: assignments };
      }
      const survey = state.surveys.find((item) => item.id === parts[1]);
      if (!survey || !surveyForRole(actor, survey)) fail(404, "Анкета не найдена или недоступна");
      if (method === "GET" && parts[2] === "tally-invites") {
        requireRole(actor, ["hr"]);
        return { enabled: false, items: [] };
      }
      if (method === "GET" && parts[2] === "take") {
        const internshipId = url.searchParams.get("internship_id") ?? actor.internship_id ?? (actor.role === "mentor" ? "i-1" : "i-1");
        if ((actor.role === "intern" || actor.role === "mentor") && !allowedIntern(actor, internshipId)) fail(403, "Эта анкета не назначена выбранному стажёру");
        const key = `${actor.id}:${survey.id}:${internshipId}`;
        const submitted = state.responses.find((response) => response.survey_id === survey.id && response.internship_id === internshipId && response.role === survey.audience);
        const draft = survey.status === "published" ? state.drafts[key] : undefined;
        return {
          survey, questions: survey.questions, answers: draft ?? submitted?.answers ?? {}, internship_id: internshipId,
          assignment_due_at: survey.due_at, assignment_status: submitted ? "submitted" : "assigned", has_draft: Boolean(draft),
        };
      }
      if (method === "PUT" && parts[2] === "draft") {
        requireRole(actor, [survey.audience]);
        if (survey.status !== "published") fail(409, "Период анкеты уже закрыт");
        const internshipId = url.searchParams.get("internship_id") ?? actor.internship_id ?? "i-1";
        if (!allowedIntern(actor, internshipId)) fail(403, "Стажёр недоступен");
        const answers = asAnswers(body.answers);
        state.drafts[`${actor.id}:${survey.id}:${internshipId}`] = answers;
        save(state);
        return { saved_at: now(), answers };
      }
      if (method === "POST" && parts[2] === "submit") {
        requireRole(actor, [survey.audience]);
        if (survey.status !== "published") fail(409, "Период анкеты уже закрыт");
        const internshipId = url.searchParams.get("internship_id") ?? actor.internship_id ?? "i-1";
        if (!allowedIntern(actor, internshipId)) fail(403, "Стажёр недоступен");
        const answers = asAnswers(body.answers);
        const missing = survey.questions.filter((question) => question.required && (answers[question.id] === undefined || answers[question.id] === ""));
        if (missing.length) fail(400, `Заполните обязательные вопросы: ${missing.map((question) => question.title).join(", ")}`);
        const response: SurveyResponse = {
          id: uid("r"), survey_id: survey.id, respondent: actor.name, role: survey.audience,
          internship_id: internshipId, period: survey.period, submitted_at: now(), answers,
        };
        const existing = state.responses.findIndex((item) => item.survey_id === survey.id && item.internship_id === internshipId && item.role === survey.audience);
        if (existing >= 0) state.responses[existing] = response; else state.responses.unshift(response);
        delete state.drafts[`${actor.id}:${survey.id}:${internshipId}`];
        save(state);
        return clone(response);
      }
      if (method === "GET" && parts.length === 2) {
        requireRole(actor, ["hr", "manager", "mentor"]);
        const visibleResponses = state.responses.filter((response) => response.survey_id === survey.id && responseForRole(actor, response));
        const invited = actor.role === "mentor" ? 2 : actor.role === "intern" ? 1 : 5;
        return {
          survey: clone(survey), questions: clone(survey.questions), assignments: clone(survey.assignments),
          coverage: { invited, submitted: visibleResponses.length, people: visibleResponses.length, percent: invited ? Math.round(visibleResponses.length / invited * 100) : 0 },
          responses: clone(visibleResponses),
        };
      }
    }
    fail(404, `Маршрут ${method} ${url.pathname} не поддержан`);
  };
  return clone(result()) as T;
}

export function resetMock() { localStorage.removeItem(STORAGE_KEY); window.dispatchEvent(new CustomEvent("mgts:mutation")); }
