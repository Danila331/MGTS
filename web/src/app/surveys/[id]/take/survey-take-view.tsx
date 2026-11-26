"use client";

import { ArrowLeft, Check, CheckCircle2, Clock3, Save, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { ProgressBar } from "@/components/charts";
import { fieldClass } from "@/components/forms";
import { Badge, ErrorState, LoadingState, Page, Panel } from "@/components/page";
import { Button } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import { get, post, put } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Actor, Answers, InternItem, Question, Survey, SurveyTake } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SurveyTakeView({ id }: { id: string }) {
  const { actor } = useApp();
  const [internshipId, setInternshipId] = useState(actor.internship_id ?? "i-1");
  const query = `?internship_id=${encodeURIComponent(internshipId)}`;
  const { data, error, loading, reload } = useResource(async () => {
    const [take, interns] = await Promise.all([
      get<SurveyTake>(`/surveys/${id}/take${query}`),
      actor.role === "mentor" ? get<{ items: InternItem[] }>("/interns?sort=name") : Promise.resolve({ items: [] }),
    ]);
    return { ...take, interns: interns.items };
  }, [id, actor.id, query]);
  return <Page title={data?.survey.title ?? "Прохождение анкеты"} subtitle={data ? `${data.survey.period} · Ответить до ${formatDate(data.survey.due_at)}` : undefined}>
    {loading && !data ? <div className="mx-auto max-w-2xl"><LoadingState rows={5} /></div> : error && !data ? <ErrorState error={error} retry={reload} /> : data && <div className="mx-auto max-w-2xl">
      {actor.role === "mentor" && data.interns.length > 1 && <label className="mb-4 block text-[12px] font-medium">Стажёр<select className={`${fieldClass} mt-1.5 min-h-11`} value={internshipId} onChange={(event) => setInternshipId(event.target.value)}>{data.interns.map((item) => <option key={item.id} value={item.id}>{item.intern.name}</option>)}</select></label>}
      <TakeForm key={`${id}:${internshipId}`} survey={data.survey} questions={data.questions} initial={data.answers} internshipId={internshipId} actor={actor} />
    </div>}
  </Page>;
}

function TakeForm({ survey, questions, initial, internshipId, actor }: { survey: Survey; questions: Question[]; initial: Answers; internshipId: string; actor: Actor }) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const readOnly = survey.status !== "published" || actor.role !== survey.audience;
  const query = `?internship_id=${encodeURIComponent(internshipId)}`;
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
    <div className="mt-4 space-y-3">{questions.map((question, index) => <Panel key={question.id} className="scroll-mt-24"><div id={`question-${question.id}`}><fieldset disabled={readOnly}><legend className="w-full text-[14px] leading-6 font-medium"><span className="tnum mr-2 text-muted-foreground">{index + 1}.</span>{question.title}{question.required && <span className="ml-1 text-destructive" aria-label="обязательный вопрос">*</span>}</legend><div className="mt-4">
      {question.type === "scale" && <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={question.title}>{Array.from({ length: question.max - question.min + 1 }, (_, index) => question.min + index).map((score) => <label key={score} className={cn("flex min-h-11 cursor-pointer items-center justify-center rounded-lg border text-[14px] transition-colors hover:bg-muted has-focus-visible:ring-2", answers[question.id] === score ? "border-primary bg-primary text-primary-foreground" : "bg-background", readOnly && "cursor-default")}><input type="radio" className="sr-only" name={question.id} value={score} checked={answers[question.id] === score} onChange={() => update(question, score)} disabled={readOnly} />{score}</label>)}</div>}
      {question.type === "scale" && <div className="mt-2 flex justify-between gap-3 text-[11px] text-muted-foreground"><span>{survey.audience === "intern" ? "1 · совсем не согласен" : "1 · низкий результат"}</span><span className="text-right">{survey.audience === "intern" ? "5 · полностью согласен" : "5 · высокий результат"}</span></div>}
      {question.type === "text" && <textarea className="min-h-28 w-full rounded-lg border border-input bg-field p-3 text-[14px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-70" value={String(answers[question.id] ?? "")} onChange={(event) => update(question, event.target.value)} placeholder="Введите развёрнутый ответ" disabled={readOnly} />}
      {["single", "multiple"].includes(question.type) && <div className="space-y-2">{question.options.map((option) => { const multiple = question.type === "multiple"; const current = answers[question.id]; const checked = multiple ? Array.isArray(current) && current.includes(option) : current === option; return <label key={option} className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-[13px] hover:bg-muted has-focus-visible:ring-2", checked && "border-ring bg-muted")}><input type={multiple ? "checkbox" : "radio"} name={question.id} className="size-4 accent-current" checked={checked} disabled={readOnly} onChange={() => { if (multiple) { const list = Array.isArray(current) ? current : []; update(question, list.includes(option) ? list.filter((item) => item !== option) : [...list, option]); } else update(question, option); }} />{option}</label>; })}</div>}
    </div></fieldset></div></Panel>)}</div>
    <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] leading-4 text-muted-foreground">Черновик виден только вам.<br />После отправки ответ попадёт в текущий контрольный период.</p><Button size="lg" className="min-h-11" onClick={submit} disabled={busy || !questions.length || readOnly}><Send />{busy ? "Отправляю…" : readOnly ? "Отправка недоступна" : "Отправить ответ"}</Button></div>
  </div>;
}
