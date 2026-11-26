"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { Badge, ErrorState, LoadingState, Page } from "@/components/page";
import { SurveyQuestions } from "@/components/survey-questions";
import { useResource } from "@/hooks/use-resource";
import { get } from "@/lib/api";
import { internQuestions, mentorQuestions } from "@/lib/mock-data";
import type { Answers, Question, Survey, SurveyAudience } from "@/lib/types";
import { SurveyTakeView } from "@/app/surveys/[id]/take/survey-take-view";

const formTitle = { intern: "Пульс-опрос стажёра", mentor: "Анкета наставника" } as const;

export function SurveyFormView({ audience }: { audience: SurveyAudience }) {
  const { actor } = useApp();
  return <SurveyForm key={`${actor.id}:${audience}`} audience={audience} respondent={actor.role === audience} />;
}

function SurveyForm({ audience, respondent }: { audience: SurveyAudience; respondent: boolean }) {
  const { data, loading, error, reload } = useResource(() => get<{ items: Survey[] }>("/surveys"), []);
  const title = formTitle[audience];
  const available = data?.items.filter((survey) => survey.audience === audience && survey.questions.length > 0) ?? [];
  const latest = available.sort((a, b) => b.period.localeCompare(a.period, "ru", { numeric: true }));
  const assigned = latest.find((survey) => survey.status === "published");
  if (respondent && assigned) return <SurveyTakeView id={assigned.id} />;

  const questions = (assigned ?? latest[0])?.questions ?? (audience === "intern" ? internQuestions : mentorQuestions);
  return <Page title={title}>
    <div className="mx-auto max-w-2xl">
      <Link href="/surveys" className="inline-flex min-h-11 items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Все анкеты</Link>
      {loading && !data ? <LoadingState rows={5} /> : error && respondent && !data ? <ErrorState error={error} retry={reload} /> : <BlankForm title={title} audience={audience} questions={questions} respondent={respondent} />}
    </div>
  </Page>;
}

function BlankForm({ title, audience, questions, respondent }: { title: string; audience: SurveyAudience; questions: Question[]; respondent: boolean }) {
  const [answers, setAnswers] = useState<Answers>({});
  return <>
    <div className="mt-4 space-y-2">
      <Badge tone="info">Предпросмотр</Badge>
      <h2 className="text-[24px] font-semibold tracking-[-0.025em]">{title}</h2>
      <p className="text-[13px] leading-6 text-muted-foreground">
        {respondent ? "Открытых назначений пока нет. Ответы в предпросмотре не сохраняются." : "Можно попробовать заполнить форму. Для отправки выберите роль участника, которому назначена анкета."}
      </p>
    </div>
    <SurveyQuestions audience={audience} answers={answers} questions={questions} update={(question, value) => setAnswers((current) => ({ ...current, [question.id]: value }))} />
  </>;
}
