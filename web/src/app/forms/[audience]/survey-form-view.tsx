"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { BrandLockup } from "@/components/brand";
import { fieldClass } from "@/components/forms";
import { Badge, ErrorState, LoadingState, Panel } from "@/components/page";
import { SurveyQuestions } from "@/components/survey-questions";
import { Button } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import { getAs, postAs } from "@/lib/api";
import { roleLabels } from "@/lib/format";
import type { Actor, Answers, AssignedSurveyList, Survey, SurveyAudience } from "@/lib/types";

const formInfo = {
  intern: { title: "Пульс-опрос стажёра", prompt: "Выберите себя в списке стажёров, чтобы открыть свою анкету." },
  mentor: { title: "Анкета наставника", prompt: "Выберите себя и стажёра, которого оцениваете." },
} as const;

export function SurveyFormView({ audience }: { audience: SurveyAudience }) {
  const { data, loading, error, reload } = useResource(() => getAs<{ items: Actor[] }>("a-hr", "/actors"), []);
  const [actorID, setActorID] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const actors = (data?.items ?? []).filter((actor) => actor.role === audience);
  const actor = actors.find((item) => item.id === actorID);
  const { title, prompt } = formInfo[audience];

  return (
    <main className="min-h-dvh bg-surface px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <BrandLockup />
        <header className="mt-7 space-y-2">
          <h1 className="text-[24px] font-semibold tracking-[-0.025em] sm:text-[28px]">{title}</h1>
          {!sent && <p className="text-[13px] leading-6 text-muted-foreground">{prompt}</p>}
        </header>
        {sent ? (
          <Panel className="mt-5">
            <div className="flex items-center gap-2 text-[15px] font-semibold"><CheckCircle2 className="size-5 text-success" aria-hidden />Ответ отправлен</div>
            <p className="mt-2 text-[13px] text-muted-foreground">Ответ учтён в контрольном периоде.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setActorID(""); setSent(false); }}>Заполнить другую анкету</Button>
          </Panel>
        ) : (
          <div className="mt-5">
            {loading && !data ? <LoadingState rows={2} /> : error && !data ? <ErrorState error={error} retry={reload} /> : <>
              <Panel>
                <label className="block text-[13px] font-medium">
                  {roleLabels[audience]}
                  <select className={`${fieldClass} mt-1.5 min-h-11`} disabled={submitting} value={actorID} onChange={(event) => setActorID(event.target.value)}>
                    <option value="">{audience === "intern" ? "Выберите стажёра" : "Выберите наставника"}</option>
                    {actors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
              </Panel>
              {actor && <AssignedForm key={actor.id} actor={actor} audience={audience} submitting={submitting} setSubmitting={setSubmitting} onSent={() => setSent(true)} />}
            </>}
          </div>
        )}
      </div>
    </main>
  );
}

function AssignedForm({ actor, audience, submitting, setSubmitting, onSent }: {
  actor: Actor;
  audience: SurveyAudience;
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
  onSent: () => void;
}) {
  const { data, loading, error, reload } = useResource(() => getAs<AssignedSurveyList>(actor.id, "/surveys"), []);
  const [subject, setSubject] = useState("");
  const surveys = (data?.items ?? [])
    .filter((survey) => survey.audience === audience && survey.status === "published" && survey.questions.length)
    .sort((a, b) => b.wave.localeCompare(a.wave, "ru", { numeric: true }));
  const assignmentByInternship = new Map<string, { survey: Survey; name: string }>();
  for (const survey of surveys) {
    for (const assignment of data?.assigned_internships[survey.id] ?? []) {
      if (!assignmentByInternship.has(assignment.internship_id)) {
        assignmentByInternship.set(assignment.internship_id, { survey, name: assignment.intern_name });
      }
    }
  }

  if (loading && !data) return <div className="mt-4"><LoadingState rows={2} /></div>;
  if (error && !data) return <ErrorState error={error} retry={reload} />;
  if (!assignmentByInternship.size) return <p className="mt-4 text-[13px] text-muted-foreground" role="status">Открытых назначений пока нет.</p>;

  const internshipID = audience === "mentor" ? subject : actor.internship_id && assignmentByInternship.has(actor.internship_id)
    ? actor.internship_id : assignmentByInternship.keys().next().value ?? "";
  const assignment = assignmentByInternship.get(internshipID);
  return <>
    {audience === "mentor" && (
      <Panel className="mt-3">
        <label className="block text-[13px] font-medium">
          Кого оцениваете
          <select className={`${fieldClass} mt-1.5 min-h-11`} disabled={submitting} value={subject} onChange={(event) => setSubject(event.target.value)}>
            <option value="">Выберите стажёра</option>
            {[...assignmentByInternship].sort(([, a], [, b]) => a.name.localeCompare(b.name, "ru")).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}
          </select>
        </label>
      </Panel>
    )}
    {assignment && <ResponseForm key={`${actor.id}:${assignment.survey.id}:${internshipID}`} actorID={actor.id} internshipID={internshipID} survey={assignment.survey} submitting={submitting} setSubmitting={setSubmitting} onSent={onSent} />}
  </>;
}

function ResponseForm({ actorID, internshipID, survey, submitting, setSubmitting, onSent }: {
  actorID: string;
  internshipID: string;
  survey: Survey;
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
  onSent: () => void;
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const missing = survey.questions.find((question) => {
      const answer = answers[question.id];
      return question.required && (answer === undefined || (typeof answer === "string" && !answer.trim()) || (Array.isArray(answer) && !answer.length));
    });
    if (missing) {
      setError("Заполните обязательные вопросы.");
      document.getElementById(`question-${missing.id}`)?.querySelector<HTMLElement>("input,textarea")?.focus();
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await postAs(actorID, `/surveys/${survey.id}/submit?${new URLSearchParams({ internship_id: internshipID })}`, { answers });
      onSent();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить ответ.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="mt-5" onSubmit={submit}>
      <Badge tone="info">{survey.period}</Badge>
      <SurveyQuestions audience={survey.audience} questions={survey.questions} answers={answers} readOnly={submitting} update={(question, value) => setAnswers((current) => ({ ...current, [question.id]: value }))} />
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={submitting}><Send aria-hidden />{submitting ? "Отправляю…" : "Отправить ответ"}</Button>
        {error && <p className="text-[13px] text-destructive" role="alert">{error}</p>}
      </div>
    </form>
  );
}
