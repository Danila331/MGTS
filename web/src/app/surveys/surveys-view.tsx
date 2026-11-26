"use client";

import { ChevronRight, ClipboardCheck, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { ProgressBar } from "@/components/charts";
import { Badge, EmptyState, ErrorState, LoadingState, Page, Panel } from "@/components/page";
import { useResource } from "@/hooks/use-resource";
import { get } from "@/lib/api";
import { formatDate, statusLabels } from "@/lib/format";
import { periods } from "@/lib/mock-data";
import type { Survey, SurveyAudience } from "@/lib/types";

function SurveyLink({ survey, actorRole }: { survey?: Survey; actorRole: string }) {
  if (!survey) return <div className="rounded-lg bg-surface p-3 text-[12px] text-muted-foreground">Форма не назначена</div>;
  const href = actorRole === "intern" ? `/surveys/${survey.id}/take` : `/surveys/${survey.id}`;
  const coverage = survey.coverage.percent || (survey.coverage.invited ? Math.round(survey.coverage.submitted / survey.coverage.invited * 100) : 0);
  return <Link href={href} className="group block rounded-lg border p-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50">
    <div className="flex items-start justify-between gap-2"><div><p className="text-[12px] font-medium group-hover:underline">{survey.audience === "intern" ? "Форма стажёра" : "Форма наставника"}</p><p className="mt-1 text-[11px] text-muted-foreground">до {formatDate(survey.due_at)}</p></div><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></div>
    <div className="mt-3"><ProgressBar value={coverage} label={`Покрытие: ${survey.title}`} /></div>
    <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[11px] text-muted-foreground">{survey.coverage.submitted} из {survey.coverage.invited} ответов</span><Badge tone={survey.status === "published" ? "success" : "neutral"}>{statusLabels[survey.status]}</Badge></div>
  </Link>;
}

export function SurveysView() {
  const { actor } = useApp();
  const { data, error, loading, reload } = useResource(() => get<{ items: Survey[]; total: number }>("/surveys"), [actor.id]);
  const byKey = new Map((data?.items ?? []).map((survey) => [`${survey.audience}:${survey.period}`, survey]));
  const audiences: SurveyAudience[] = actor.role === "intern" ? ["intern"] : actor.role === "mentor" ? ["mentor"] : ["intern", "mentor"];

  return <Page title="Анкеты" subtitle="Две формы · шесть контрольных периодов">
    <div className="space-y-4"><div><h2 className="text-[22px] font-semibold tracking-[-0.025em]">Библиотека Пульса</h2><p className="mt-1 text-[13px] text-muted-foreground">Фиксированные формы стажёра и наставника, без произвольного конструктора.</p></div>
      {loading && !data ? <LoadingState rows={6} /> : error && !data ? <ErrorState error={error} retry={reload} /> : !data?.items.length ? <EmptyState title="Анкеты пока не назначены" text="Доступные контрольные периоды появятся здесь автоматически." /> : <>
        <section className={`grid gap-3 ${audiences.length === 2 ? "md:grid-cols-2" : ""}`} aria-label="Типы форм">
          {audiences.includes("intern") && <Panel><div className="flex gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info"><UserRound className="size-4" /></span><div><h3 className="text-[14px] font-semibold">Пульс-опрос стажёра</h3><p className="mt-1 text-[12px] leading-5 text-muted-foreground">7 шкал 1–5, «Сложности за период» и «Что мешает работать и развиваться».</p></div></div></Panel>}
          {audiences.includes("mentor") && <Panel><div className="flex gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success"><UsersRound className="size-4" /></span><div><h3 className="text-[14px] font-semibold">Анкета наставника</h3><p className="mt-1 text-[12px] leading-5 text-muted-foreground">6 шкал 1–5, «Комментарий о работе за период» и «Сложности / ситуации для внимания».</p></div></div></Panel>}
        </section>
        <Panel title="Контрольные периоды" note="Структура, ответы и покрытие по каждому месяцу">
          <div className="space-y-3">{periods.map((period) => <section key={period} className="rounded-xl border bg-surface p-3"><div className="mb-3 flex items-center gap-2"><ClipboardCheck className="size-4 text-muted-foreground" /><h3 className="text-[13px] font-semibold">{period}</h3></div><div className={`grid gap-3 ${audiences.length === 2 ? "lg:grid-cols-2" : ""}`}>{audiences.map((audience) => <SurveyLink key={audience} survey={byKey.get(`${audience}:${period}`)} actorRole={actor.role} />)}</div></section>)}</div>
        </Panel>
      </>}
    </div>
  </Page>;
}
