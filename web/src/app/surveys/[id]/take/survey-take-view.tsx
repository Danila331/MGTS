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
import { Button } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import { get, post, put } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Actor, Answers, InternItem, Question, Survey, SurveyDetail, SurveyTake } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SurveyTakeView({ id }: { id: string }) {
  const { actor } = useApp();
  return <AssignedSurvey key={`${actor.id}:${id}`} id={id} actor={actor} />;
}

function AssignedSurvey({ id, actor }: { id: string; actor: Actor }) {
  const [selectedInternship, setSelectedInternship] = useState(actor.internship_id);
  const query = internshipQuery(selectedInternship);
  const { data, error, loading, reload } = useResource(async () => {
    const [take, mentorScope] = await Promise.all([
      get<SurveyTake>(`/surveys/${id}/take${query}`),
      actor.role === "mentor" ? Promise.all([
        get<{ items: InternItem[] }>("/interns?sort=name"),
        get<SurveyDetail>(`/surveys/${id}`),
      ]) : Promise.resolve(null),
    ]);
    if (!mentorScope) return { ...take, interns: [] };
    const [roster, detail] = mentorScope;
    const labels = new Map(roster.items.map((item) => [item.id, item.intern.name]));
    const ids = new Set(detail.assignments.filter((assignment) => assignment.includes(" · ") || labels.has(assignment)).map((assignment) => assignment.split(" · ")[0]));
    if (take.internship_id) ids.add(take.internship_id);
    const interns = [...ids].map((intern) => ({ id: intern, name: labels.get(intern) ?? intern }));
    interns.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    return { ...take, interns };
  }, [id, actor.id, query]);
  const current = data && (!selectedInternship || data.internship_id === selectedInternship) ? data : null;
  return <Page title={current?.survey.title ?? "Прохождение анкеты"} subtitle={current ? `${current.survey.period} · Ответить до ${formatDate(current.survey.due_at)}` : undefined}>
    {!current && (loading || !error) ? <div className="mx-auto max-w-2xl"><LoadingState rows={5} /></div> : !current ? <ErrorState error={error} retry={reload} /> : <div className="mx-auto max-w-2xl">
      {actor.role === "mentor" && current.interns.length > 1 && <label className="mb-4 block text-[12px] font-medium">Стажёр<select className={`${fieldClass} mt-1.5 min-h-11`} value={current.internship_id} onChange={(event) => setSelectedInternship(event.target.value)}>{current.interns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <TakeForm key={current.internship_id ?? id} survey={current.survey} questions={current.questions} initial={current.answers} internshipId={current.internship_id} actor={actor} />
    </div>}
  </Page>;
}

function internshipQuery(internshipId?: string) {
  return internshipId ? `?internship_id=${encodeURIComponent(internshipId)}` : "";
}

function TakeForm({ survey, questions, initial, internshipId, actor }: { survey: Survey; questions: Question[]; initial: Answers; internshipId?: string; actor: Actor }) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const readOnly = survey.status !== "published" || actor.role !== survey.audience;
  const query = internshipQuery(internshipId);
  useEffect(() => {
    if (!dirty.current || readOnly) return;
    const timer = setTimeout(() => {
      setSaveState("saving");
      put(`/surveys/${survey.id}/draft${query}`, { answers }).then(() => { dirty.current = false; setSaveState("saved"); }).catch(() => setSaveState("error"));
    }, 700);
    return () => clearTimeout(timer);
  }, [answers, survey.id, query, readOnly]);
  const update = (question: Question, value: string | number | string[]) => {
    if (readOnly) return;
    dirty.current = true;
    setSaveState("dirty");
    setAnswers((current) => ({ ...current, [question.id]: value }));
  };
  const answered = questions.filter((question) => answers[question.id] !== undefined && answers[question.id] !== "" && (!Array.isArray(answers[question.id]) || (answers[question.id] as string[]).length > 0)).length;
  const submit = async () => {
    if (readOnly) return;
    const missing = questions.filter((question) => question.required && (answers[question.id] === undefined || answers[question.id] === "" || (Array.isArray(answers[question.id]) && (answers[question.id] as string[]).length === 0)));
    if (missing.length) {
      toast.error(`Заполните обязательные вопросы: ${missing.length}`);
      document.getElementById(`question-${missing[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    try {
      await post(`/surveys/${survey.id}/submit${query}`, { answers });
      dirty.current = false;
      setSubmitted(true);
      toast.success("Ответ отправлен");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Не удалось отправить"); } finally { setBusy(false); }
  };
  if (submitted) return <div className="mx-auto flex max-w-xl flex-col items-center py-12 text-center"><span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-6" /></span><h2 className="mt-5 text-[22px] font-semibold">Спасибо, ответ сохранён</h2><p className="mt-2 text-[14px] leading-6 text-muted-foreground">Ответ учтён в покрытии контрольного периода.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><Link href="/surveys"><Button>Вернуться к анкетам</Button></Link><Link href={actor.role === "intern" ? "/me" : "/dashboard"}><Button variant="outline">{actor.role === "intern" ? "Мой Пульс" : "К рейтингу"}</Button></Link></div></div>;
  return <div><Link href="/surveys" className="inline-flex min-h-11 items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Все анкеты</Link><div className="mt-4"><div className="flex flex-wrap items-center gap-2"><Badge tone="info">{survey.period}</Badge>{readOnly && <Badge>{survey.status === "closed" ? "Период закрыт" : "Просмотр"}</Badge>}<span className="text-[12px] text-muted-foreground">Ответить до {formatDate(survey.due_at)}</span></div><h2 className="mt-3 text-[24px] font-semibold tracking-[-0.025em]">{survey.title}</h2><p className="mt-2 text-[14px] leading-6 text-muted-foreground">{survey.description}</p></div>
    <div className="sticky top-0 z-10 mt-5 rounded-xl border bg-card p-3 shadow-[var(--shadow-float)]"><div className="mb-2 flex items-center justify-between gap-3 text-[11px]"><span className="tnum text-muted-foreground">Отвечено {answered} из {questions.length}</span><span className={cn("flex items-center gap-1.5", saveState === "error" ? "text-destructive" : "text-muted-foreground")} role="status">{readOnly ? "Только просмотр" : saveState === "saving" ? <><Clock3 className="size-3" />Сохраняю…</> : saveState === "dirty" ? <><Save className="size-3" />Есть изменения</> : saveState === "error" ? "Не сохранено · измените ответ для повтора" : <><Check className="size-3 text-success" />Черновик сохранён</>}</span></div><ProgressBar value={questions.length ? Math.round(answered / questions.length * 100) : 0} /></div>
    <SurveyQuestions audience={survey.audience} answers={answers} questions={questions} readOnly={readOnly} update={update} />
    <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] leading-4 text-muted-foreground">Черновик виден только вам.<br />После отправки ответ попадёт в текущий контрольный период.</p><Button size="lg" className="min-h-11" onClick={submit} disabled={busy || !questions.length || readOnly}><Send />{busy ? "Отправляю…" : readOnly ? "Отправка недоступна" : "Отправить ответ"}</Button></div>
  </div>;
}
