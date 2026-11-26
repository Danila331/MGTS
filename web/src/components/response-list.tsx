import { EmptyState } from "@/components/page";
import { formatDate } from "@/lib/format";
import { internQuestions, mentorQuestions } from "@/lib/mock-data";
import type { SurveyResponse } from "@/lib/types";

const titles = new Map([...internQuestions, ...mentorQuestions].map((question) => [question.id, question.title]));

export function ResponseList({ responses, questionTitles, textOnly = false, emptyTitle = "Ответов пока нет", emptyText = "Ответы появятся после прохождения контрольного периода." }: { responses: SurveyResponse[]; questionTitles?: ReadonlyMap<string, string>; textOnly?: boolean; emptyTitle?: string; emptyText?: string }) {
  if (!responses.length) return <EmptyState title={emptyTitle} text={emptyText} />;
  return <div className="space-y-3">{responses.map((response) => {
    const entries = Object.entries(response.answers).filter(([, value]) => textOnly ? typeof value === "string" : true);
    if (!entries.length) return null;
    return <article key={response.id} className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-[13px] font-medium">{response.respondent}</h3><p className="mt-0.5 text-[11px] text-muted-foreground">{response.role === "intern" ? "Стажёр" : "Наставник"} · {response.period || "Контрольный период"}</p></div><time className="text-[11px] text-muted-foreground">{formatDate(response.submitted_at, true)}</time></div>
      <dl className="mt-3 space-y-3">{entries.map(([key, value]) => <div key={key} className={typeof value === "number" ? "grid grid-cols-[minmax(0,1fr)_32px] gap-3 text-[12px]" : "rounded-lg bg-surface p-3 text-[12px]"}><dt className={typeof value === "number" ? "text-muted-foreground" : "leading-5 text-muted-foreground"}>{questionTitles?.get(key) ?? titles.get(key) ?? key}</dt><dd className={typeof value === "number" ? "tnum text-right font-medium" : "mt-1.5 wrap-anywhere leading-5 text-foreground"}>{Array.isArray(value) ? value.join(", ") : String(value)}{typeof value === "number" ? " / 5" : ""}</dd></div>)}</dl>
    </article>;
  })}</div>;
}
