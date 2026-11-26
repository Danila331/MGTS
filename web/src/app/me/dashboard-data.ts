import type { Question, SurveyResponse } from "@/lib/types";

export const trackedMetrics = [
  { value: "clarity", label: "Понятность задач", color: "var(--chart-1)", aliases: ["clarity", "intern_clarity", "task_clarity"] },
  { value: "support", label: "Поддержка", color: "var(--chart-2)", aliases: ["support", "intern_support", "mentor_support"] },
  { value: "workload", label: "Нагрузка", color: "var(--chart-3)", aliases: ["workload", "intern_workload", "workload_comfort"] },
] as const;

export const mentorUnderstanding = ["mentor_understanding", "task_understanding"];

const calendarMonth = new Intl.DateTimeFormat("ru-RU", { month: "short", year: "numeric", timeZone: "Europe/Moscow" });
const calendarKey = new Intl.DateTimeFormat("sv-SE", { month: "2-digit", year: "numeric", timeZone: "Europe/Moscow" });

export type PeriodMode = "stage" | "calendar";

export function dashboardPeriods(responses: SurveyResponse[], mode: PeriodMode, surveyPeriods: string[]) {
  const periods = new Map<string, { value: string; label: string; responses: SurveyResponse[] }>();
  if (mode === "stage") {
    const labels = new Set([...Array.from({ length: 6 }, (_, index) => `Месяц ${index + 1}`), ...surveyPeriods]);
    for (const label of labels) if (label) periods.set(label, { value: label, label, responses: [] });
  }
  for (const response of responses) {
    const date = new Date(response.submitted_at);
    if (mode === "calendar" && !Number.isFinite(date.getTime())) continue;
    const value = mode === "stage" ? response.period : calendarKey.format(date);
    if (!value) continue;
    const label = mode === "stage" ? value : calendarMonth.format(date).replace(/\s*г\.$/, "");
    if (!periods.has(value)) periods.set(value, { value, label, responses: [] });
    periods.get(value)?.responses.push(response);
  }
  return [...periods.values()].sort((a, b) => a.value.localeCompare(b.value, "ru", { numeric: true }));
}

export function pulseScore(response: SurveyResponse, aliases: readonly string[], questions?: Question[]) {
  const question = questions?.find((item) => item.type === "scale" && aliases.includes(item.dimension));
  if (question && (question.min !== 1 || question.max !== 5)) return null;
  const score = question ? response.answers[question.id] : aliases.map((id) => response.answers[id]).find(pulseScale);
  return pulseScale(score) ? score : null;
}

export function pulseScale(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function averageScores(values: (number | null)[]) {
  const scores = values.filter((value) => value !== null);
  return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
}
