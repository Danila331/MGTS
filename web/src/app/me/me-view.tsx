"use client";

import { ArrowRight, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { LineChart } from "@/components/charts";
import { formatScore } from "@/components/intern-directory";
import { Avatar, ErrorState, InsufficientData, LoadingState, Page, Panel } from "@/components/page";
import { ResponseList } from "@/components/response-list";
import { Button } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import { get } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { InternshipDetail, Survey, TrendPoint } from "@/lib/types";

const emptyTrend = (month: number): TrendPoint => ({ period: `Месяц ${month}`, label: `Месяц ${month}`, intern: null, mentor: null });

export function MeView() {
  const { actor } = useApp();
  const id = actor.internship_id ?? "i-1";
  const { data, error, loading, reload } = useResource(async () => {
    const [detail, surveys] = await Promise.all([get<InternshipDetail>(`/interns/${id}`), get<{ items: Survey[] }>("/surveys")]);
    return { detail, surveys: surveys.items.filter((survey) => survey.audience === "intern") };
  }, [actor.id, id]);
  const trends = Array.from({ length: 6 }, (_, index) => data?.detail.trends.find((point) => point.period === `Месяц ${index + 1}` || point.label === `Месяц ${index + 1}`) ?? data?.detail.trends[index] ?? emptyTrend(index + 1));
  const ownResponses = data?.detail.responses.filter((response) => response.internship_id === id && response.role === "intern") ?? [];
  const mentorResponses = data?.detail.responses.filter((response) => response.internship_id === id && response.role === "mentor") ?? [];
  const nextSurvey = data?.surveys.find((survey) => survey.status === "published") ?? data?.surveys[0];

  return <Page title="Мой Пульс" subtitle="Личный кабинет стажёра" roles={["intern"]}>
    {loading && !data ? <LoadingState rows={6} /> : error && !data ? <ErrorState error={error} retry={reload} /> : data && <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4 sm:p-5"><div className="flex items-center gap-4"><Avatar initials={actor.initials} className="size-12 text-[15px]" /><div className="min-w-0"><h2 className="text-[22px] font-semibold tracking-[-0.025em]">{actor.name}</h2><p className="mt-1 text-[13px] text-muted-foreground">{data.detail.summary.department} · {data.detail.internship.cohort} · {data.detail.summary.current_period}</p></div></div></section>
      <section className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4" aria-label="Мои показатели">
        {[["Текущий средний", formatScore(data.detail.summary.latest_score)], ["Общий средний", formatScore(data.detail.summary.overall_score)], ["Средний по когорте", formatScore(data.detail.summary.cohort_average)], ["Мой перцентиль", data.detail.summary.percentile_label]].map(([label, value]) => <div key={label} className="border-b border-r p-4 nth-3:border-b-0 nth-4:border-b-0 even:border-r-0 lg:border-b-0 lg:last:border-r-0"><p className="text-[11px] text-muted-foreground">{label}</p><p className="tnum mt-2 text-[24px] font-medium">{value}</p>{label === "Мой перцентиль" && <p className="mt-1 text-[11px] leading-4 text-muted-foreground">диапазон относительно других стажёров</p>}</div>)}
      </section>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-4">
        <Panel title="Моя прогрессия" note="Средняя самооценка по семи шкалам · 6 месяцев">
          {trends.some((point) => point.intern !== null) ? <LineChart points={[{ id: "me", label: "Мой средний балл", values: trends.map((point) => point.intern) }]} labels={trends.map((point) => point.label)} /> : <InsufficientData text="Прогрессия появится после первого отправленного пульс-опроса." />}
        </Panel>
        <Panel title="Комментарии наставника" note="Видны только ваши контрольные периоды">
          <ResponseList responses={mentorResponses} textOnly emptyTitle="Комментариев пока нет" emptyText="Здесь появятся комментарии наставника о вашей работе и ситуациях для внимания." />
        </Panel>
        <Panel title="Мой последний ответ" note={ownResponses[0]?.period ?? "Пульс-опрос стажёра"}>
          <ResponseList responses={ownResponses.slice(0, 1)} emptyTitle="Вы ещё не отправили ответ" emptyText="Откройте следующую анкету: черновик сохраняется автоматически." />
        </Panel>
      </div><aside className="space-y-4">
        <Panel title="Следующая анкета" note="7 шкал и 2 открытых вопроса">
          {nextSurvey ? <div><span className="flex size-9 items-center justify-center rounded-lg bg-info-soft text-info"><ClipboardCheck className="size-4" /></span><h3 className="mt-3 text-[14px] font-medium">{nextSurvey.title}</h3><p className="mt-2 text-[12px] leading-5 text-muted-foreground">Ответить до {formatDate(nextSurvey.due_at)}. Черновик сохраняется автоматически.</p><Link href={`/surveys/${nextSurvey.id}/take`} className="mt-4 inline-block"><Button>Перейти к анкете<ArrowRight /></Button></Link></div> : <InsufficientData text="Доступных анкет пока нет. Новый контрольный период появится здесь." />}
        </Panel>
        <Panel title="Как читать показатели"><div className="space-y-3 text-[12px] leading-5 text-muted-foreground"><p>Все шкалы имеют диапазон от 1 до 5. Общий средний учитывает ваши контрольные периоды.</p><p>Перцентиль показан только диапазоном, чтобы не создавать ложную точность сравнения в небольшой когорте.</p></div></Panel>
        <Panel title="Мой наставник"><div className="flex items-center gap-3"><Avatar initials={data.detail.internship.mentor.split(" ").map((part) => part[0]).join("").slice(0, 2)} /><div><p className="text-[13px] font-medium">{data.detail.internship.mentor}</p><p className="text-[11px] text-muted-foreground">Наставник</p></div></div></Panel>
      </aside></div>
    </div>}
  </Page>;
}
