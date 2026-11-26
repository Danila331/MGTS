"use client";

import { ArrowLeft, ChevronRight, ClipboardCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { Distribution, ProgressBar } from "@/components/charts";
import { Badge, EmptyState, InsufficientData, ErrorState, LoadingState, Page, Panel } from "@/components/page";
import { ResponseList } from "@/components/response-list";
import { Button } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import { get } from "@/lib/api";
import { formatDate, statusLabels } from "@/lib/format";
import type { SurveyDetail } from "@/lib/types";

export function SurveyDetailView({ id }: { id: string }) {
  const { actor } = useApp();
  const { data, error, loading, reload } = useResource(() => get<SurveyDetail>(`/surveys/${id}`), [id, actor.id]);
  const canTake = data?.survey.audience === actor.role && data.survey.status === "published";
  return <Page title={<span className="flex items-center gap-1.5"><Link href="/surveys" className="text-muted-foreground hover:text-foreground">Анкеты</Link><ChevronRight className="size-3.5 text-muted-foreground" /><span className="truncate">{data?.survey.title ?? "Структура формы"}</span></span>} roles={["hr", "manager", "mentor"]} actions={canTake ? <Link href={`/surveys/${id}/take`}><Button size="sm"><ClipboardCheck />Открыть мою анкету</Button></Link> : undefined}>
    {loading && !data ? <LoadingState rows={7} /> : error && !data ? <ErrorState error={error} retry={reload} /> : data && <div className="space-y-4">
      <Link href="/surveys" className="inline-flex min-h-11 items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Библиотека</Link>
      <section className="rounded-xl border bg-card p-4 sm:p-5"><div className="flex flex-wrap items-center gap-2"><h2 className="text-[20px] font-semibold">{data.survey.title}</h2><Badge tone={data.survey.status === "published" ? "success" : "neutral"}>{statusLabels[data.survey.status]}</Badge></div><p className="mt-2 max-w-3xl text-[13px] leading-5 text-muted-foreground">{data.survey.description}</p><p className="mt-3 text-[12px] text-muted-foreground">{data.survey.audience === "intern" ? "Стажёр" : "Наставник"} · {data.survey.period} · ответить до {formatDate(data.survey.due_at)}</p></section>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]"><div className="space-y-4">
        <Panel title="Структура формы" note={`${data.questions.filter((question) => question.type === "scale").length} шкал · ${data.questions.filter((question) => question.type === "text").length} открытых вопроса`}>
          <ol className="space-y-3">{data.questions.map((question, index) => <li key={question.id} className="flex gap-3 rounded-lg bg-surface p-3"><span className="tnum mt-0.5 w-5 shrink-0 text-[12px] text-muted-foreground">{index + 1}</span><div><h3 className="text-[13px] leading-5 font-medium">{question.title}</h3><p className="mt-1 text-[11px] text-muted-foreground">{question.type === "scale" ? `Шкала ${question.min}–${question.max}` : "Свободный текст"}{question.required ? " · обязательный" : " · необязательный"}</p></div></li>)}</ol>
        </Panel>
        <Panel title={`Ответы · ${data.responses.length}`} note="Числовые оценки и текстовые комментарии">
          <ResponseList responses={data.responses} emptyText="В этом контрольном периоде ещё нет доступных ответов." />
        </Panel>
      </div><aside className="space-y-4">
        <Panel title="Покрытие"><div className="flex items-end justify-between gap-3"><div><p className="tnum text-[28px] font-medium">{data.coverage.percent}%</p><p className="mt-1 text-[12px] text-muted-foreground">{data.coverage.submitted} из {data.coverage.invited} приглашённых</p></div><UsersRound className="size-6 text-muted-foreground" /></div><div className="mt-4"><ProgressBar value={data.coverage.percent} /></div></Panel>
        <Panel title="Распределение оценок" note="Все числовые ответы формы">
          {data.responses.length ? <Distribution items={[1, 2, 3, 4, 5].map((score) => ({ label: `${score} из 5`, count: data.responses.reduce((sum, response) => sum + Object.values(response.answers).filter((value) => value === score).length, 0) }))} /> : <InsufficientData text="Для распределения пока недостаточно ответов." />}
        </Panel>
        <Panel title="Назначение">{data.assignments.length ? <div className="space-y-2 text-[12px]">{data.assignments.map((assignment) => <p key={assignment} className="rounded-lg bg-surface px-3 py-2">{assignment}</p>)}</div> : <EmptyState title="Назначения не показаны" text="Состав назначения определяется ролью и контрольным периодом." />}</Panel>
      </aside></div>
    </div>}
  </Page>;
}
