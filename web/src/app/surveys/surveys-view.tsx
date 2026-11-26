"use client";

import { ArrowRight, ChevronRight, ClipboardCheck, Copy, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { ProgressBar } from "@/components/charts";
import { Badge, EmptyState, ErrorState, LoadingState, Page, Panel } from "@/components/page";
import { Button, buttonVariants } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import { get } from "@/lib/api";
import { formatDate, statusLabels } from "@/lib/format";
import { periods } from "@/lib/mock-data";
import type { AssignedSurveyList, Survey, SurveyAssignmentOption, SurveyAudience } from "@/lib/types";
import { SurveyReminders } from "@/components/survey-reminders";
import { SurveyFiles } from "./survey-files";

const formCards = {
  intern: { title: "Пульс-опрос стажёра", recipient: "стажёра", description: "7 шкал 1–5, «Сложности за период» и «Что мешает работать и развиваться».", icon: UserRound, tone: "bg-info-soft text-info" },
  mentor: { title: "Анкета наставника", recipient: "наставника", description: "6 шкал 1–5, «Комментарий о работе за период» и «Сложности / ситуации для внимания».", icon: UsersRound, tone: "bg-success-soft text-success" },
} satisfies Record<SurveyAudience, { title: string; recipient: string; description: string; icon: typeof UserRound; tone: string }>;

function SurveyFormCard({ audience, canCopy, canOpen }: { audience: SurveyAudience; canCopy: boolean; canOpen: boolean }) {
  const { title, recipient, description, icon: Icon, tone } = formCards[audience];
  const href = `/forms/${audience}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).href);
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не удалось скопировать ссылку. Откройте форму и скопируйте адрес из браузера.");
    }
  };

  return <Panel><div className="flex gap-3">
    <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="size-4" aria-hidden /></span>
    <div>
      <h3 className="text-[14px] font-semibold">{title}</h3><p className="mt-1 text-[12px] leading-5 text-muted-foreground">{description}</p>
      {(canOpen || canCopy) && <div className="mt-3 flex flex-wrap gap-2">
        {canOpen && <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>Открыть форму {recipient}<ArrowRight aria-hidden /></Link>}
        {canCopy && <Button variant="ghost" size="sm" onClick={copyLink} aria-label={`Скопировать ссылку на форму ${recipient}`}><Copy aria-hidden />Скопировать ссылку</Button>}
      </div>}
    </div>
  </div></Panel>;
}

function SurveyLink({ survey, actorRole, assignments }: { survey?: Survey; actorRole: string; assignments?: SurveyAssignmentOption[] }) {
  if (!survey) return <div className="rounded-lg bg-surface p-3 text-[12px] text-muted-foreground">Форма не назначена</div>;
  const personal = actorRole === survey.audience;
  const href = personal ? `/surveys/${survey.id}/take` : `/surveys/${survey.id}`;
  const assignmentsCount = assignments?.length ?? 0;
  const assignment = assignmentsCount === 1 ? assignments?.[0] : undefined;
  const coverage = survey.coverage.percent || (survey.coverage.invited ? Math.round(survey.coverage.submitted / survey.coverage.invited * 100) : 0);
  return <Link href={href} className="group block rounded-lg border p-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50">
    <div className="flex items-start justify-between gap-2"><div><p className="text-[12px] font-medium group-hover:underline">{survey.audience === "intern" ? "Форма стажёра" : "Форма наставника"}</p>
      {assignment?.due_at && assignment.status !== "submitted" && <p className="mt-1 text-[11px] text-muted-foreground">Срок · {formatDate(assignment.due_at)}</p>}
    </div><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></div>
    {!personal && <div className="mt-3"><ProgressBar value={coverage} label={`Покрытие: ${survey.title}`} /></div>}
    <div className="mt-2 flex items-center justify-between gap-2">
      {!personal && <span className="text-[11px] text-muted-foreground">{survey.coverage.submitted} из {survey.coverage.invited} ответов</span>}
      {personal && assignmentsCount > 1 && <span className="text-[11px] text-muted-foreground">Ответили по {assignments?.filter((item) => item.status === "submitted").length} из {assignmentsCount} назначений</span>}
      <Badge tone={assignment?.status === "submitted" ? "success" : "neutral"}>{assignment?.status === "submitted" ? "Ответ получен" : statusLabels[survey.status]}</Badge>
    </div>
  </Link>;
}

export function SurveysView() {
  const { actor, demo } = useApp();
  const { data, error, loading, reload } = useResource(() => get<AssignedSurveyList>("/surveys"), [actor.id]);
  const byKey = new Map((data?.items ?? []).map((survey) => [`${survey.audience}:${survey.period}`, survey]));
  const audiences: SurveyAudience[] = actor.role === "intern" ? ["intern"] : actor.role === "mentor" ? ["mentor"] : ["intern", "mentor"];

  return <Page title="Анкеты" subtitle="Две формы · шесть контрольных периодов">
    <div className="space-y-4"><div><h2 className="text-[22px] font-semibold tracking-[-0.025em]">Библиотека Пульса</h2><p className="mt-1 text-[13px] text-muted-foreground">Фиксированные формы стажёра и наставника, без произвольного конструктора.</p></div>
      <SurveyReminders />
      {actor.role === "hr" && <SurveyFiles key={actor.id} onImport={reload} />}
      <section className={`grid gap-3 ${audiences.length === 2 ? "md:grid-cols-2" : ""}`} aria-label="Типы форм">
        {audiences.map((audience) => <SurveyFormCard key={audience} audience={audience} canCopy={actor.role === "hr"} canOpen={demo || actor.role === audience} />)}
      </section>
      {loading && !data ? <LoadingState rows={6} /> : error && !data ? <ErrorState error={error} retry={reload} /> : !data?.items.length ? <EmptyState title="Анкеты пока не назначены" text="Доступные контрольные периоды появятся здесь автоматически." /> :
        <Panel title="Контрольные периоды" note="Структура, ответы и покрытие по каждому месяцу">
          <div className="space-y-3">{periods.map((period) => <section key={period} className="rounded-xl border bg-surface p-3"><div className="mb-3 flex items-center gap-2"><ClipboardCheck className="size-4 text-muted-foreground" /><h3 className="text-[13px] font-semibold">{period}</h3></div><div className={`grid gap-3 ${audiences.length === 2 ? "lg:grid-cols-2" : ""}`}>{audiences.map((audience) => {
            const survey = byKey.get(`${audience}:${period}`);
            return <SurveyLink key={audience} survey={survey} actorRole={actor.role} assignments={survey && data.assigned_internships?.[survey.id]} />;
          })}</div></section>)}</div>
        </Panel>
      }
    </div>
  </Page>;
}
