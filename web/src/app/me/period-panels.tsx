"use client";

import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { formatScore } from "@/components/intern-directory";
import { InsufficientData, Panel } from "@/components/page";
import { ResponseList } from "@/components/response-list";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Question, SurveyResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { averageScores, mentorUnderstanding, pulseScale, pulseScore, trackedMetrics } from "./dashboard-data";

const scoreLabels = new Map<string, string>([
  ["intern_clarity", "Понятность задач"],
  ["intern_support", "Поддержка наставника"],
  ["intern_workload", "Комфортность нагрузки"],
  ["intern_interest", "Интерес к задачам"],
  ["intern_growth", "Профессиональный рост"],
  ["intern_team", "Взаимодействие с командой"],
  ["intern_satisfaction", "Удовлетворённость стажировкой"],
  ["task_clarity", "Понятность задач"],
  ["mentor_support", "Поддержка наставника"],
  ["workload_comfort", "Комфортность нагрузки"],
  ["task_interest", "Интерес к задачам"],
  ["professional_growth", "Профессиональный рост"],
  ["team_interaction", "Взаимодействие с командой"],
  ["satisfaction", "Удовлетворённость стажировкой"],
  ["mentor_understanding", "Понимание задач"],
  ["mentor_quality", "Качество работы"],
  ["mentor_independence", "Самостоятельность"],
  ["mentor_deadlines", "Соблюдение сроков"],
  ["mentor_engagement", "Инициативность"],
  ["mentor_communication", "Взаимодействие с командой"],
]);

const feedbackLabels = new Map<string, string>([
  ["intern_difficulties", "Сложности за период"],
  ["intern_blockers", "Что мешает работать и развиваться"],
  ["difficulties", "Сложности за период"],
  ["obstacles", "Что мешает работать и развиваться"],
  ["mentor_comment", "Комментарий о работе за период"],
  ["mentor_attention", "Ситуации, которые требуют внимания"],
  ["work_comment", "Комментарий о работе за период"],
  ["attention_situations", "Ситуации, которые требуют внимания"],
]);

const scores = [1, 2, 3, 4, 5];
const feedbackGroups = [
  { role: "intern", label: "Мои ответы" },
  { role: "mentor", label: "Комментарии наставника" },
] as const;

interface PeriodPanelsProps {
  period: string;
  responses: SurveyResponse[];
  questionsBySurvey: ReadonlyMap<string, Question[]>;
}

export function PeriodPanels({ period, responses, questionsBySurvey }: PeriodPanelsProps) {
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const selfResponses = responses.filter((response) => response.role === "intern");
  const mentorResponses = responses.filter((response) => response.role === "mentor");
  const questionTitles = new Map([...scoreLabels, ...feedbackLabels]);

  for (const response of responses) {
    for (const question of questionsBySurvey.get(response.survey_id) ?? []) {
      questionTitles.set(question.id, question.title);
    }
  }

  const distribution = selfResponses.flatMap((response) => {
    const questions = questionsBySurvey.get(response.survey_id);
    return Object.entries(response.answers).flatMap(([id, value]) => {
      const question = questions?.find((item) => item.id === id);
      if ((question && (question.type !== "scale" || question.min !== 1 || question.max !== 5)) || !pulseScale(value)) return [];
      return [{ id: `${response.id}:${id}`, value, label: scoreLabels.get(id) ?? questionTitles.get(id) ?? id }];
    });
  });
  const distributionRows = scores.map((score) => ({ score, entries: distribution.filter(({ value }) => value === score) }));
  const largestCount = Math.max(...distributionRows.map(({ entries }) => entries.length));
  const breakdown = distributionRows.find(({ score }) => score === selectedScore)?.entries ?? [];
  const selfScore = averageScores(selfResponses.map((response) => pulseScore(response, trackedMetrics[0].aliases, questionsBySurvey.get(response.survey_id))));
  const mentorScore = averageScores(mentorResponses.map((response) => pulseScore(response, mentorUnderstanding, questionsBySurvey.get(response.survey_id))));

  return <>
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Распределение оценок" note="Мои ответы по шкале 1–5">
        {largestCount ? (
          <ul className="flex flex-col gap-1">
            {distributionRows.map(({ score, entries }) => (
              <li key={score}>
                {entries.length ? (
                  <button
                    type="button"
                    aria-expanded={selectedScore === score}
                    onClick={() => setSelectedScore(selectedScore === score ? null : score)}
                    className="grid min-h-8 w-full grid-cols-[1rem_minmax(0,1fr)_1.25rem] items-center gap-3 rounded-md px-2 text-left text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted"
                    aria-label={`Оценка ${score}. Ответов ${entries.length}`}
                  >
                    <span className="tnum">{score}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span className={cn("block h-full rounded-full", score <= 2 ? "bg-tone-warning" : "bg-tone-info")} style={{ width: `${entries.length / largestCount * 100}%` }} />
                    </span>
                    <span className="tnum text-right text-muted-foreground">{entries.length}</span>
                  </button>
                ) : (
                  <div className="grid min-h-8 grid-cols-[1rem_minmax(0,1fr)_1.25rem] items-center gap-3 px-2 text-xs text-muted-foreground">
                    <span className="tnum">{score}</span><span className="h-2 rounded-full bg-muted" /><span className="tnum text-right">0</span>
                  </div>
                )}
                {breakdown.length > 0 && selectedScore === score && <ul className="my-1 space-y-1.5 rounded-md bg-surface px-3 py-2 text-xs text-muted-foreground">
                  {breakdown.map(({ id, label }) => <li key={id}>{label}</li>)}
                </ul>}
              </li>
            ))}
          </ul>
        ) : <InsufficientData text="За этот период пока нет самооценок по шкале 1–5." />}
      </Panel>

      <Panel title="Понимание задач" note="Самооценка и оценка наставника по близким вопросам">
        {selfScore === null && mentorScore === null ? <InsufficientData text="Оценки появятся после отправки анкет за этот период." /> : (
          <dl className="space-y-4">
            {[{ label: "Моя оценка", value: selfScore, color: "bg-chart-1" }, { label: "Оценка наставника", value: mentorScore, color: "bg-chart-3" }].map(({ label, value, color }) => (
              <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="contents">
                  <span className="tnum text-sm font-medium">{value === null ? "Нет оценки" : `${formatScore(value)} / 5`}</span>
                  <span className="col-span-2 block h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                    {value !== null && <span className={cn("block h-full rounded-full", color)} style={{ width: `${value * 20}%` }} />}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>
    </div>

    <Dialog>
      <Panel title="Темы обратной связи" note="Открытые ответы за выбранный период" action={responses.length > 0 && (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>Открыть ответы <ArrowUpRight /></DialogTrigger>
      )}>
        <div className="grid gap-4 sm:grid-cols-2">
          {feedbackGroups.map(({ role, label }) => {
            const entries = responses.filter((response) => response.role === role).flatMap((response) => {
              const questions = questionsBySurvey.get(response.survey_id);
              return Object.entries(response.answers).flatMap(([id, value]) => {
                const question = questions?.find((item) => item.id === id);
                if ((question && question.type !== "text") || typeof value !== "string" || !value.trim()) return [];
                return [{ id: `${response.id}:${id}`, label: feedbackLabels.get(id) ?? question?.title ?? "Комментарий", value: value.trim() }];
              });
            });
            return <div key={role} className="min-w-0 rounded-lg border bg-surface p-3">
              <h3 className="mb-2 text-[13px] font-medium">{label}</h3>
              {entries.length === 0 ? <p className="text-xs text-muted-foreground">Пока нет открытых ответов.</p> : (
                <dl className="space-y-3">
                  {entries.map(({ id, label, value }) => <div key={id}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-[13px] leading-5 wrap-anywhere whitespace-pre-wrap">{value}</dd>
                  </div>)}
                </dl>
              )}
            </div>;
          })}
        </div>
      </Panel>
      <DialogContent className="gap-4 sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>Ответы за период</DialogTitle>
          <DialogDescription>{period}</DialogDescription>
        </DialogHeader>
        <ResponseList responses={responses} questionTitles={questionTitles} />
      </DialogContent>
    </Dialog>
  </>;
}
