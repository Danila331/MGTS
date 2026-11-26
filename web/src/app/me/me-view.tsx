"use client";

import { ArrowRight, ClipboardCheck, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { LineChart } from "@/components/charts";
import { SurveyReminders } from "@/components/survey-reminders";
import { Segmented } from "@/components/forms";
import { formatScore } from "@/components/intern-directory";
import { Avatar, Badge, EmptyState, ErrorState, InsufficientData, LoadingState, Page, Panel } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useResource } from "@/hooks/use-resource";
import { get } from "@/lib/api";
import { formatDate, initials } from "@/lib/format";
import type { Actor, AssignedSurveyList, InternshipDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { averageScores, dashboardPeriods, pulseScore, trackedMetrics, type PeriodMode } from "./dashboard-data";
import { PeriodPanels } from "./period-panels";

type MetricFilter = "all" | (typeof trackedMetrics)[number]["value"];

const modes = [
  { value: "stage", label: "По этапам" },
  { value: "calendar", label: "По календарю" },
] satisfies { value: PeriodMode; label: string }[];

export function MeView() {
  const { actor } = useApp();

  return (
    <Page title="Мой Пульс" subtitle="Личный кабинет стажёра" roles={["intern"]}>
      {actor.role === "intern" && (actor.internship_id
        ? <InternDashboard key={`${actor.id}:${actor.internship_id}`} actor={actor} internshipId={actor.internship_id} />
        : <EmptyState title="Стажировка пока не назначена" text="Дашборд появится после привязки профиля к стажировке." />)}
    </Page>
  );
}

function InternDashboard({ actor, internshipId }: { actor: Actor; internshipId: string }) {
  const { data, error, reload } = useResource(async () => {
    const [detail, surveys] = await Promise.all([
      get<InternshipDetail>(`/interns/${encodeURIComponent(internshipId)}`),
      get<AssignedSurveyList>("/surveys"),
    ]);
    return { detail, surveys };
  });

  if (!data) return error ? <ErrorState error={error} retry={reload} /> : <LoadingState rows={6} />;

  return <div className="space-y-4"><SurveyReminders /><DashboardContent actor={actor} detail={data.detail} surveys={data.surveys} /></div>;
}

function DashboardContent({ actor, detail, surveys: surveyList }: { actor: Actor; detail: InternshipDetail; surveys: AssignedSurveyList }) {
  const compact = useMediaQuery("(max-width: 639px)");
  const [mode, setMode] = useState<PeriodMode>("stage");
  const [selection, setSelection] = useState<Partial<Record<PeriodMode, string>>>({});
  const [metric, setMetric] = useState<MetricFilter>("all");

  const surveys = surveyList.items.filter((survey) => survey.audience === "intern").map((survey) => {
    const assignment = surveyList.assigned_internships?.[survey.id]?.find((item) => item.internship_id === detail.internship.id);
    return { ...survey, due_at: assignment?.due_at || survey.due_at };
  });
  const responses = detail.responses
    .filter((response) => response.internship_id === detail.internship.id)
    .sort((a, b) => Date.parse(b.submitted_at) - Date.parse(a.submitted_at));
  const periods = dashboardPeriods(responses, mode, surveys.map((survey) => survey.period));
  const active = periods.find((period) => period.value === selection[mode])
    ?? periods.findLast((period) => period.responses.length > 0)
    ?? periods.find((period) => period.value === detail.summary.current_period)
    ?? periods[0];
  const activeIndex = periods.indexOf(active);
  const questionsBySurvey = new Map(surveys.map((survey) => [survey.id, survey.questions]));
  const points = trackedMetrics.map((item) => ({
    id: item.value,
    label: item.label,
    color: item.color,
    values: periods.map((period) => period.responses
      .filter((response) => response.role === "intern")
      .map((response) => pulseScore(response, item.aliases, questionsBySurvey.get(response.survey_id)))),
  }));
  const visiblePoints = points.filter((point) => metric === "all" || point.id === metric).map((point) => ({
    ...point,
    values: point.values.map((scores, index) => index <= activeIndex ? averageScores(scores) : null),
  }));
  const activeScores = points.map((point) => ({
    id: point.id,
    label: point.label,
    score: Math.min(Infinity, ...(point.values[activeIndex] ?? []).filter((score) => score !== null)),
  }));
  const lowPoints = activeScores.filter((point) => point.score <= 2);
  const submitted = new Set(responses.filter((response) => response.role === "intern").map((response) => response.survey_id));
  const nextSurvey = surveys
    .filter((survey) => survey.status === "published" && !submitted.has(survey.id))
    .sort((a, b) => (Date.parse(a.due_at) || Infinity) - (Date.parse(b.due_at) || Infinity))[0];
  const { summary, internship } = detail;
  const hasSelfScore = summary.latest_score !== null && summary.latest_score >= 1;
  const stats = [
    { label: "Последняя самооценка", value: formatScore(hasSelfScore ? summary.latest_score : null) },
    { label: "Мой средний балл", value: formatScore(hasSelfScore ? summary.overall_score : null) },
    { label: "Средний по когорте", value: formatScore(summary.cohort_average || null) },
    { label: "Мой перцентиль", value: hasSelfScore ? summary.percentile_label : "—", note: "Диапазон в когорте" },
  ];

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <Avatar initials={actor.initials} className="size-11 text-[14px]" />
          <div className="min-w-0">
            <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.025em]">{actor.name}</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{summary.department} · {internship.cohort}</p>
          </div>
        </div>
        {summary.current_period && summary.current_period !== "—" && <Badge>{summary.current_period}</Badge>}
      </section>

      <section className="grid grid-cols-2 rounded-xl border bg-card lg:grid-cols-4" aria-label="Мои показатели">
        {stats.map(({ label, value, note }) => (
          <div key={label} className="min-w-0 border-r p-4 even:border-r-0 max-lg:nth-[-n+2]:border-b lg:even:border-r lg:last:border-r-0">
            <p className="text-[12px] text-muted-foreground">{label}</p>
            <p className="tnum mt-2 text-[25px] leading-none font-medium tracking-[-0.03em]">{value}</p>
            {note && <p className="mt-2 text-[11px] text-muted-foreground">{note}</p>}
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <Segmented value={mode} onChange={setMode} items={modes} label="Режим дашборда" />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Период дашборда">
          {periods.map((period) => (
            <button
              key={period.value}
              type="button"
              aria-pressed={active?.value === period.value}
              className={buttonVariants({
                size: "sm",
                variant: active?.value === period.value ? "secondary" : "ghost",
                className: cn("max-sm:min-h-11", active?.value !== period.value && "text-muted-foreground"),
              })}
              onClick={() => setSelection((previous) => ({ ...previous, [mode]: period.value }))}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Panel title="Как проходит стажировка" note={mode === "stage" ? "Самооценки по контрольным месяцам" : "Самооценки по месяцам отправки анкет"}>
          <div className="mb-4">
            <Segmented value={metric} onChange={setMetric} label="Выбор показателя" className="max-sm:grid max-sm:grid-cols-2 max-sm:[&_button]:px-1.5 max-sm:[&_button]:whitespace-normal" items={[
              { value: "all", label: "Все показатели" },
              ...trackedMetrics.map(({ value, label }) => ({ value, label })),
            ]} />
          </div>
          {visiblePoints.some((point) => point.values.some((score) => score !== null))
            ? <LineChart points={visiblePoints} labels={periods.map((period) => period.label)} width={compact ? 410 : 640} height={compact ? 150 : 190} />
            : <InsufficientData text="График появится после первой анкеты с оценками по этим показателям." />}
        </Panel>

        <aside className="grid gap-4 md:grid-cols-2 xl:grid-cols-1" aria-label="Задачи и поддержка">
          <Panel title="Следующая анкета">
            {nextSurvey ? (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info"><ClipboardCheck className="size-4" aria-hidden /></span>
                  <div>
                    <p className="text-[13px] font-medium">{nextSurvey.title}</p>
                    {Number.isFinite(Date.parse(nextSurvey.due_at)) && <p className="mt-0.5 text-[12px] text-muted-foreground">До {formatDate(nextSurvey.due_at)}</p>}
                  </div>
                </div>
                <Link href={`/surveys/${nextSurvey.id}/take`} className={buttonVariants({ size: "sm", className: "max-sm:min-h-11" })}>
                  Перейти к анкете <ArrowRight aria-hidden />
                </Link>
              </div>
            ) : <p className="text-[13px] text-muted-foreground">Нет анкет, ожидающих вашего ответа.</p>}
          </Panel>

          <Panel title="Что обсудить" note={active?.label}>
            {lowPoints.length > 0 ? (
              <ul className="divide-y">
                {lowPoints.map((point) => (
                  <li key={point.id} className="flex items-center justify-between gap-2 py-2 text-[13px] first:pt-0 last:pb-0">
                    {point.label}<Badge tone="warning">{point.score} / 5</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[13px] text-muted-foreground">
              {activeScores.some((point) => Number.isFinite(point.score))
                ? "В этом периоде нет оценок 1 или 2 по трём показателям."
                : "За этот период пока нет ваших оценок по этим показателям."}
            </p>}
            {internship.mentor && internship.mentor !== "—" && (
              <div className="mt-3 flex items-center gap-2.5 border-t pt-3">
                <Avatar initials={initials(internship.mentor)} className="size-7" />
                <div className="min-w-0">
                  <p className="text-[12px] font-medium">{internship.mentor}</p>
                  <p className="text-[11px] text-muted-foreground">Наставник</p>
                </div>
              </div>
            )}
          </Panel>
        </aside>
      </div>

      {active ? <PeriodPanels key={`${mode}:${active.value}`} period={active.label} responses={active.responses} questionsBySurvey={questionsBySurvey} /> : (
        <Panel title="Темы обратной связи">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <MessageSquare className="size-4" aria-hidden /> Анкеты появятся после отправки первого ответа.
          </div>
        </Panel>
      )}
    </div>
  );
}
