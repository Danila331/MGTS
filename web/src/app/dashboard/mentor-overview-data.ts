import { createDemoPopulation } from "./demo-population";

export const mentorMetrics = [
  { key: "support", label: "Поддержка и обратная связь", color: "var(--analytics-support)" },
  { key: "clarity", label: "Понятность задач", color: "var(--analytics-clarity)" },
  { key: "workload", label: "Комфортность нагрузки", color: "var(--analytics-workload)" },
  { key: "interest", label: "Интерес к задачам", color: "var(--chart-3)" },
  { key: "growth", label: "Профессиональный рост", color: "var(--chart-2)" },
  { key: "team", label: "Взаимодействие с командой", color: "var(--chart-5)" },
  { key: "satisfaction", label: "Удовлетворённость стажировкой", color: "var(--chart-6)" },
] as const;

export type MentorMetric = typeof mentorMetrics[number]["key"];
export type OverviewMode = "calendar" | "stage";
export type OverviewDataset = "live" | "demo";

interface MentorComment {
  dimension: string;
  text: string;
  topic?: string;
}

export interface MentorFeedback {
  internship_id: string;
  intern: string;
  department: string;
  wave: number;
  at: string;
  submitted: boolean;
  scores?: Partial<Record<MentorMetric, number>>;
  comments?: MentorComment[];
}

export interface MentorProfile {
  id: string;
  name: string;
  departments: string[];
  interns: number;
  feedback: MentorFeedback[];
}

export interface MentorRow {
  profile: MentorProfile;
  feedback: MentorFeedback[];
  scores: Record<MentorMetric, number | null>;
  percentile: number | null;
}

export interface OverviewPeriod {
  key: string;
  label: string;
  shortLabel: string;
}

const calendarFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit" });
const calendarLabel = new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", year: "numeric", month: "long" });
const shortCalendarLabel = new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", month: "short" });
const numberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

export function formatMentorScore(value: number | null) {
  return value === null ? "—" : numberFormat.format(value);
}

export function periodKey(entry: MentorFeedback, mode: OverviewMode) {
  if (mode === "stage") return String(entry.wave);
  const date = new Date(entry.at);
  if (Number.isNaN(date.getTime())) return "";
  const parts = calendarFormat.formatToParts(date);
  return `${parts.find(({ type }) => type === "year")?.value}-${parts.find(({ type }) => type === "month")?.value}`;
}

export function mentorPeriods(profiles: MentorProfile[], mode: OverviewMode, dataset: OverviewDataset): OverviewPeriod[] {
  if (mode === "stage") return Array.from({ length: 6 }, (_, index) => ({ key: String(index + 1), label: `Месяц ${index + 1}`, shortLabel: String(index + 1) }));
  const keys = dataset === "demo"
    ? ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]
    : [...new Set(profiles.flatMap((profile) => profile.feedback.map((entry) => periodKey(entry, mode))).filter(Boolean))].sort().slice(-6);
  return keys.map((key) => {
    const date = new Date(`${key}-01T00:00:00Z`);
    return { key, label: calendarLabel.format(date).replace(/\sг\.$/, ""), shortLabel: shortCalendarLabel.format(date) };
  });
}

export function mentorScore(entries: MentorFeedback[], metric: MentorMetric): number | null {
  const values = entries.flatMap((entry) => {
    const value = entry.scores?.[metric];
    return entry.submitted && value !== undefined ? [value] : [];
  });
  return values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : null;
}

export function mentorRows(profiles: MentorProfile[], mode: OverviewMode, key: string): MentorRow[] {
  const rows = profiles.map((profile) => {
    const feedback = profile.feedback.filter((entry) => periodKey(entry, mode) === key);
    const scores = Object.fromEntries(mentorMetrics.map(({ key }) => [key, mentorScore(feedback, key)])) as MentorRow["scores"];
    return { profile, feedback, scores };
  });
  const scores = rows.flatMap(({ scores }) => scores.support === null ? [] : [scores.support]);
  return rows.map((row) => ({ ...row, percentile: percentile(row.scores.support, scores) }));
}

function percentile(value: number | null, scores: number[]) {
  if (value === null || !scores.length) return null;
  const lower = scores.filter((score) => score < value).length;
  const tied = scores.filter((score) => score === value).length;
  return 100 * (lower + tied / 2) / scores.length;
}

export const mentorRanks = [
  { floor: 90, label: "90–100", style: "rank-5" },
  { floor: 70, label: "70–90", style: "rank-4" },
  { floor: 50, label: "50–70", style: "rank-3" },
  { floor: 20, label: "20–50", style: "rank-2" },
  { floor: 0, label: "0–20", style: "rank-1" },
];

export function feedbackTopic(comment: MentorComment) {
  return comment.topic ?? (comment.dimension === "blockers" ? "Что мешает работать" : "Сложности за период");
}

export function createDemoMentors(): MentorProfile[] {
  const surveyOrder: MentorMetric[] = ["clarity", "support", "workload", "interest", "growth", "team", "satisfaction"];
  return createDemoPopulation().map((person, index) => ({
    id: `demo-mentor-${index + 1}`,
    name: `Демо-наставник ${String(index + 1).padStart(2, "0")}`,
    departments: [person.department],
    interns: 1,
    feedback: person.intern.map((round, period) => {
      const model = person.ai[period];
      return {
        internship_id: person.id,
        intern: person.name,
        department: person.department,
        wave: period + 1,
        at: new Date(Date.UTC(2026, 5 + person.startMonth + period, 1)).toISOString(),
        submitted: true,
        scores: Object.fromEntries(surveyOrder.map((key, index) => [key, round[index]])),
        comments: person.texts[period].intern.map((text, index) => ({
          dimension: index === 0 ? "difficulties" : "blockers",
          text,
          topic: model?.answer.s.status !== "none" && model?.answer.s.quotes.some((quote) => text.includes(quote)) ? model.topic : undefined,
        })),
      };
    }),
  }));
}
