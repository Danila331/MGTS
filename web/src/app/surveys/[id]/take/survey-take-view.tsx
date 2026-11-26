"use client";

import { ArrowLeft, Check, CheckCircle2, Clock3, Save, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { ProgressBar } from "@/components/charts";
import { fieldClass } from "@/components/forms";
import { Badge, ErrorState, LoadingState, Page } from "@/components/page";
import { SurveyQuestions } from "@/components/survey-questions";
import { ContactHR, SurveyVisibility } from "@/components/survey-guidance";
import { Button, buttonVariants } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import { get, getApiActor, post, put } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Actor, Answers, AssignedSurveyList, Question, Survey, SurveyTake } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SurveyTakeView({ id, internshipId }: { id: string; internshipId?: string }) {
  const { actor } = useApp();
  return <AssignedSurvey key={`${actor.id}:${id}:${internshipId ?? ""}`} id={id} actor={actor} requestedInternship={internshipId} />;
}

function AssignedSurvey({ id, actor, requestedInternship }: { id: string; actor: Actor; requestedInternship?: string }) {
  const [selectedInternship, setSelectedInternship] = useState(requestedInternship ?? actor.internship_id);
  const query = internshipQuery(selectedInternship);
  const { data, error, loading, reload } = useResource(async () => {
    const [take, mentorScope] = await Promise.all([
      get<SurveyTake>(`/surveys/${id}/take${query}`),
      actor.role === "mentor" ? get<AssignedSurveyList>("/surveys") : Promise.resolve(null),
    ]);
    if (!mentorScope) return { ...take, interns: [] };
    const interns = (mentorScope.assigned_internships[take.survey.id] ?? [])
      .map((option) => ({ id: option.internship_id, name: option.intern_name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    return { ...take, interns };
  }, [id, actor.id, query]);
  const current = data && (!selectedInternship || data.internship_id === selectedInternship) ? data : null;
  return <Page title={current?.survey.title ?? "Прохождение анкеты"} subtitle={current?.survey.period} roles={["intern", "mentor"]}>
    {!current && (loading || !error) ? <div className="mx-auto max-w-2xl"><LoadingState rows={5} /></div> : !current ? <ErrorState error={error} retry={reload} /> : <div className="mx-auto max-w-2xl">
      {actor.role === "mentor" && current.interns.length > 1 && <label className="mb-4 block text-[12px] font-medium">Стажёр<select className={`${fieldClass} mt-1.5 min-h-11`} value={current.internship_id} onChange={(event) => setSelectedInternship(event.target.value)}>{current.interns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <TakeForm key={current.internship_id ?? id} survey={current.survey} questions={current.questions} initial={current.answers}
        internshipId={current.internship_id} actor={actor} dueAt={current.assignment_due_at ?? current.survey.due_at}
        initiallySubmitted={current.assignment_status === "submitted"} hasDraft={current.has_draft ?? false} />
    </div>}
  </Page>;
}

function internshipQuery(internshipId?: string) {
  return internshipId ? `?internship_id=${encodeURIComponent(internshipId)}` : "";
}

function TakeForm({ survey, questions, initial, internshipId, actor, dueAt, initiallySubmitted, hasDraft }: { survey: Survey; questions: Question[]; initial: Answers; internshipId?: string; actor: Actor; dueAt: string; initiallySubmitted: boolean; hasDraft: boolean }) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const [openedAt] = useState(() => Date.now());
  const [saveState, setSaveState] = useState<"initial" | "saved" | "dirty" | "saving" | "error">(hasDraft ? "saved" : "initial");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const revision = useRef(0);
  const submitting = useRef(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftWrite = useRef(Promise.resolve());
  const readOnly = survey.status !== "published" || actor.role !== survey.audience;
  const query = internshipQuery(internshipId);
  useEffect(() => {
    if (!dirty.current || readOnly || busy || submitted) return;
    const editedAt = revision.current;
    let cancelled = false;
    const timer = setTimeout(() => {
      draftWrite.current = draftWrite.current.then(async () => {
        if (cancelled || submitting.current || editedAt !== revision.current || getApiActor() !== actor.id) return;
        setSaveState("saving");
        try {
          await put(`/surveys/${survey.id}/draft${query}`, { answers });
          if (editedAt === revision.current) {
            dirty.current = false;
            setSaveState("saved");
          }
        } catch {
          if (editedAt === revision.current) setSaveState("error");
        }
      });
    }, 700);
    draftTimer.current = timer;
    return () => { cancelled = true; clearTimeout(timer); };
  }, [answers, actor.id, survey.id, query, readOnly, busy, submitted]);
  const update = (question: Question, value: string | number | string[]) => {
    if (readOnly || submitting.current) return;
    revision.current++;
    dirty.current = true;
    setSaveState("dirty");
    setAnswers((current) => ({ ...current, [question.id]: value }));
  };
  const answered = questions.filter((question) => answers[question.id] !== undefined && answers[question.id] !== "" && (!Array.isArray(answers[question.id]) || (answers[question.id] as string[]).length > 0)).length;
  const submit = async () => {
    if (readOnly || submitting.current) return;
    const missing = questions.filter((question) => question.required && (answers[question.id] === undefined || answers[question.id] === "" || (Array.isArray(answers[question.id]) && (answers[question.id] as string[]).length === 0)));
    if (missing.length) {
      toast.error(`Заполните обязательные вопросы: ${missing.length}`);
      document.getElementById(`question-${missing[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    submitting.current = true;
    if (draftTimer.current !== null) clearTimeout(draftTimer.current);
    setBusy(true);
    try {
      await draftWrite.current;
      if (getApiActor() !== actor.id) return;
      await post(`/surveys/${survey.id}/submit${query}`, { answers });
      dirty.current = false;
      setSubmitted(true);
      toast.success("Ответ отправлен");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Не удалось отправить"); } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  if (submitted) return <div className="mx-auto flex max-w-xl flex-col items-center py-12 text-center" role="status"><span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-6" /></span><h2 className="mt-5 text-[22px] font-semibold">Спасибо, ответ сохранён</h2><p className="mt-2 text-[14px] leading-6 text-muted-foreground">Ответ учтён в покрытии контрольного периода.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><Link href="/surveys" className={buttonVariants()}>Вернуться к анкетам</Link><Link href={actor.role === "intern" ? "/me" : "/dashboard"} className={buttonVariants({ variant: "outline" })}>{actor.role === "intern" ? "Мой Пульс" : "К обзору"}</Link></div></div>;
  const overdue = Date.parse(dueAt) < openedAt;
  return <div><Link href="/surveys" className="inline-flex min-h-11 items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Все анкеты</Link><div className="mt-4"><div className="flex flex-wrap items-center gap-2"><Badge tone="info">{survey.period}</Badge>{initiallySubmitted && <Badge tone="success">Ответ получен</Badge>}{readOnly && <Badge>{survey.status === "closed" ? "Период закрыт" : "Просмотр"}</Badge>}{!initiallySubmitted && overdue && !readOnly && <Badge tone="warning">Срок прошёл</Badge>}<span className="text-[12px] text-muted-foreground">Срок · {formatDate(dueAt)}</span></div><h2 className="mt-3 text-[24px] font-semibold tracking-[-0.025em]">{survey.title}</h2><p className="mt-2 text-[14px] leading-6 text-muted-foreground">{survey.description}</p></div>
    <div className="sticky top-0 z-10 mt-5 rounded-xl border bg-card p-3 shadow-[var(--shadow-float)]"><div className="mb-2 flex items-center justify-between gap-3 text-[11px]"><span className="tnum text-muted-foreground">Отвечено {answered} из {questions.length}</span><span className={cn("flex items-center gap-1.5", saveState === "error" ? "text-destructive" : "text-muted-foreground")} role="status">{readOnly ? "Только просмотр" : saveState === "saving" ? <><Clock3 className="size-3" />Сохраняю…</> : saveState === "dirty" ? <><Save className="size-3" />Есть изменения</> : saveState === "error" ? "Не сохранено · измените ответ для повтора" : saveState === "saved" ? <><Check className="size-3 text-success" />Черновик сохранён</> : null}</span></div><ProgressBar value={questions.length ? Math.round(answered / questions.length * 100) : 0} /></div>
    <SurveyVisibility audience={survey.audience} />
    {internshipId && <ContactHR surveyID={survey.id} internshipID={internshipId} />}
    <SurveyQuestions audience={survey.audience} answers={answers} questions={questions} readOnly={readOnly || busy} advice={internshipId ? { surveyID: survey.id, internshipID: internshipId } : undefined} update={update} />
    {!readOnly && <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] leading-4 text-muted-foreground">Черновик виден только вам.<br />После отправки ответ попадёт в этот контрольный период.</p><Button size="lg" className="min-h-11" onClick={submit} disabled={busy || !questions.length || (initiallySubmitted && saveState === "initial")}><Send />{busy ? "Отправляю…" : initiallySubmitted ? "Отправить исправление" : "Отправить ответ"}</Button></div>}
  </div>;
}
