"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { LineChart, ProgressBar } from "@/components/charts";
import { Segmented } from "@/components/forms";
import { formatScore, TrafficLightBadge } from "@/components/intern-directory";
import { Avatar, ErrorState, InsufficientData, LoadingState, Page, Panel } from "@/components/page";
import { ResponseList } from "@/components/response-list";
import { useResource } from "@/hooks/use-resource";
import { get } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Actor, InternshipDetail, TrendPoint } from "@/lib/types";
import { SurveySignals } from "./survey-signals";
import { CandidatePanel, SurveyAnalysisPanel } from "./survey-analysis";
import { FinalRecap } from "./final-recap";

type Tab = "overview" | "responses";
const emptyTrend = (month: number): TrendPoint => ({ period: `Месяц ${month}`, label: `Месяц ${month}`, intern: null, mentor: null });

export function InternshipView({ id }: { id: string }) {
  const { actor } = useApp();
  return <InternshipCard key={`${actor.id}:${id}`} actor={actor} id={id} />;
}

function InternshipCard({ actor, id }: { actor: Actor; id: string }) {
  const { data, error, loading, reload } = useResource(() => get<InternshipDetail>(`/interns/${id}`), [id, actor.id], actor.role === "hr" ? 12000 : 0);
  const [tab, setTab] = useState<Tab>("overview");
  const trends = Array.from({ length: 6 }, (_, index) => data?.trends.find((point) => point.period === `Месяц ${index + 1}` || point.label === `Месяц ${index + 1}`) ?? data?.trends[index] ?? emptyTrend(index + 1));
  const hasTrend = trends.some((point) => point.intern !== null || point.mentor !== null);

  return <Page title={<span className="flex items-center gap-1.5"><Link href="/interns" className="text-muted-foreground hover:text-foreground">Стажёры</Link><ChevronRight className="size-3.5 text-muted-foreground" /><span className="truncate">{data?.internship.intern.name ?? "Карточка"}</span></span>} roles={["hr", "manager", "mentor"]}>
    {loading && !data ? <LoadingState rows={7} /> : error && !data ? <ErrorState error={error} retry={reload} /> : data && <div className="space-y-4">
      <Link href="/interns" className="inline-flex min-h-11 items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Все стажёры</Link>
      <section className="rounded-xl border bg-card p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><Avatar initials={data.internship.intern.initials} className="size-12 text-[15px]" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-[22px] font-semibold tracking-[-0.025em]">{data.internship.intern.name}</h2><TrafficLightBadge value={data.summary.traffic_light} /></div><p className="mt-1 text-[13px] text-muted-foreground">{data.summary.department} · {data.internship.cohort} · {data.summary.current_period}</p></div><div className="text-[12px] text-muted-foreground"><p>Наставник</p><p className="mt-1 text-[13px] font-medium text-foreground">{data.internship.mentor}</p></div></div></section>
      <section className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4" aria-label="Показатели стажёра">
        {[["Текущий средний", formatScore(data.summary.latest_score)], ["Общий средний", formatScore(data.summary.overall_score)], ["Средний когорты", formatScore(data.summary.cohort_average)], ["Перцентиль", data.summary.percentile_label]].map(([label, value]) => <div key={label} className="border-b border-r p-4 nth-3:border-b-0 nth-4:border-b-0 even:border-r-0 lg:border-b-0 lg:last:border-r-0"><p className="text-[11px] text-muted-foreground">{label}</p><p className="tnum mt-2 text-[24px] font-medium">{value}</p>{label === "Перцентиль" && <p className="mt-1 text-[11px] text-muted-foreground">диапазон в когорте</p>}</div>)}
      </section>
      {actor.role === "hr" && data.survey_analysis && <SurveyAnalysisPanel id={id} analysis={data.survey_analysis} responses={data.responses} reload={reload} />}
      {actor.role === "hr" && !data.survey_analysis && data.survey_signals && <SurveySignals signals={data.survey_signals} responses={data.responses} refreshing={loading} refreshFailed={Boolean(error)} onRefresh={reload} />}
      {actor.role === "hr" && <FinalRecap internshipID={id} />}
      <Segmented value={tab} onChange={setTab} label="Разделы карточки стажёра" items={[{ value: "overview", label: "Динамика и оценки" }, { value: "responses", label: `Ответы · ${data.responses.length}` }]} />
      {tab === "overview" ? <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-4">
        <Panel title="Динамика за 6 месяцев" note="Средние оценки стажёра и наставника по соответствующим формам">
          {hasTrend ? <LineChart points={[{ id: "intern", label: "Оценка стажёра", values: trends.map((point) => point.intern) }, { id: "mentor", label: "Оценка наставника", values: trends.map((point) => point.mentor) }]} labels={trends.map((point) => point.label)} /> : <InsufficientData text="Для графика пока нет сопоставимых ответов. Проверьте покрытие контрольных периодов." />}
        </Panel>
        <Panel title="Сравнение текущих оценок" note={data.summary.current_period}>
          {data.metrics.length ? <div className="space-y-4">{data.metrics.map((metric) => <div key={metric.id}><div className="mb-2 flex items-center justify-between gap-3 text-[12px]"><span>{metric.label}</span><span className="tnum text-muted-foreground">{formatScore(metric.intern)} / {formatScore(metric.mentor)}</span></div><div className="grid grid-cols-2 gap-2"><div className="h-1.5 overflow-hidden rounded-full bg-dim" aria-label={`Оценка стажёра: ${formatScore(metric.intern)}`}><div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${(metric.intern ?? 0) * 20}%` }} /></div><div className="h-1.5 overflow-hidden rounded-full bg-dim" aria-label={`Оценка наставника: ${formatScore(metric.mentor)}`}><div className="h-full rounded-full bg-[var(--chart-2)]" style={{ width: `${(metric.mentor ?? 0) * 20}%` }} /></div></div></div>)}</div> : <InsufficientData text="Недостаточно данных для сравнения оценок стажёра и наставника." />}
          <div className="mt-4 flex gap-4 border-t pt-3 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--chart-1)]" />Стажёр</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--chart-2)]" />Наставник</span></div>
        </Panel>
        <Panel title="Контрольные периоды"><ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.timeline.map((event) => <li key={event.id} className="rounded-lg bg-surface p-3"><div className="flex items-baseline justify-between gap-2"><h3 className="text-[12px] font-medium">{event.title}</h3><time className="text-[10px] text-muted-foreground">{formatDate(event.at)}</time></div><p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">{event.text}</p></li>)}</ol></Panel>
      </div><aside className="space-y-4">{actor.role === "hr" && <CandidatePanel id={id} candidateId={data.candidate_id} />}<Panel title="Покрытие"><p className="tnum text-[28px] font-medium">{data.coverage.percent}%</p><p className="mt-1 text-[12px] text-muted-foreground">{data.coverage.submitted} из {data.coverage.invited || 12} ответов за 6 месяцев</p><div className="mt-4"><ProgressBar value={data.coverage.percent} /></div></Panel><Panel title="Участники"><div className="space-y-3">{data.participants.map((person) => <div key={`${person.role}-${person.name}`} className="flex items-center gap-3"><Avatar initials={person.initials} /><div><p className="text-[13px] font-medium">{person.name}</p><p className="text-[11px] text-muted-foreground">{person.role}</p></div></div>)}</div></Panel></aside></div> : <Panel title="Числовые ответы и комментарии" note="Обе стороны · от новых периодов к предыдущим"><ResponseList responses={data.responses} /></Panel>}
    </div>}
  </Page>;
}
