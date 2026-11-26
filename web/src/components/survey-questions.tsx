"use client";

import { Panel } from "@/components/page";
import { MentorCommentAdvice } from "@/components/survey-guidance";
import type { Answers, Question, SurveyAudience } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SurveyQuestions({ audience, answers, questions, readOnly = false, advice, update }: {
  audience: SurveyAudience;
  answers: Answers;
  questions: Question[];
  readOnly?: boolean;
  advice?: { surveyID: string; internshipID: string; actorID?: string };
  update: (question: Question, value: string | number | string[]) => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      {questions.map((question, index) => {
        const answer = answers[question.id];
        const label = `label-${question.id}`;
        const multiple = question.type === "multiple";
        const selected = Array.isArray(answer) ? answer : [];
        return (
          <Panel key={question.id} className="scroll-mt-24">
            <fieldset id={`question-${question.id}`} disabled={readOnly}>
              <legend id={label} className="w-full text-[14px] leading-6 font-medium">
                <span className="tnum mr-2 text-muted-foreground">{index + 1}.</span>{question.title}
                {question.required && <span className="ml-1 text-destructive" aria-label="обязательный вопрос">*</span>}
              </legend>
              <div className="mt-4">
                {question.type === "scale" && <>
                  <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-labelledby={label}>
                    {Array.from({ length: question.max - question.min + 1 }, (_, index) => question.min + index).map((score) => (
                      <label key={score} className={cn("flex min-h-11 cursor-pointer items-center justify-center rounded-lg border text-[14px] transition-colors hover:bg-muted has-focus-visible:ring-2", answer === score ? "border-primary bg-primary text-primary-foreground" : "bg-background", readOnly && "cursor-default")}>
                        <input type="radio" className="sr-only" name={question.id} value={score} checked={answer === score} onChange={() => update(question, score)} />
                        {score}
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between gap-3 text-[11px] text-muted-foreground">
                    <span>{audience === "intern" ? "1 · совсем не согласен" : "1 · низкий результат"}</span>
                    <span className="text-right">{audience === "intern" ? "5 · полностью согласен" : "5 · высокий результат"}</span>
                  </div>
                </>}
                {question.type === "text" && <>
                  <textarea
                    aria-labelledby={label}
                    className="min-h-28 w-full rounded-lg border border-input bg-field p-3 text-[14px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-70"
                    value={String(answer ?? "")}
                    onChange={(event) => update(question, event.target.value)}
                    placeholder="Введите развёрнутый ответ"
                  />
                  {audience === "mentor" && advice && !readOnly && <MentorCommentAdvice {...advice} questionID={question.id} text={String(answer ?? "")} />}
                </>}
                {(question.type === "single" || multiple) && (
                  <div className="space-y-2">
                    {question.options.map((option) => {
                      const checked = multiple ? selected.includes(option) : answer === option;
                      return (
                        <label key={option} className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-[13px] hover:bg-muted has-focus-visible:ring-2", checked && "border-ring bg-muted")}>
                          <input
                            type={multiple ? "checkbox" : "radio"}
                            name={question.id}
                            className="size-4 accent-current"
                            checked={checked}
                            onChange={() => update(question, multiple ? (checked ? selected.filter((item) => item !== option) : [...selected, option]) : option)}
                          />
                          {option}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </fieldset>
          </Panel>
        );
      })}
    </div>
  );
}
