"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { getApiMode, post, postAs } from "@/lib/api";
import type { SurveyAudience } from "@/lib/types";

type SurveyContext = { surveyID: string; internshipID: string; actorID?: string };

export function SurveyVisibility({ audience }: { audience: SurveyAudience }) {
  const readers = audience === "intern"
    ? "HR, пользователи с ролью руководителя и ваш наставник"
    : "HR, пользователи с ролью руководителя, назначенный наставник и стажёр, о котором заполнена анкета";
  return <aside className="mt-4 rounded-lg border bg-surface px-3 py-2.5 text-[13px]">
    <strong>Кто увидит ответ</strong>
    <p className="mt-1 text-muted-foreground">После отправки ответы и комментарии смогут прочитать {readers}. Ответ связан с вашим профилем.</p>
  </aside>;
}

export function ContactHR({ surveyID, internshipID, actorID }: SurveyContext) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  if (getApiMode() === "mock") return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    setError("");
    try {
      const payload = { survey_id: surveyID, internship_id: internshipID, message };
      if (actorID) await postAs(actorID, "/hr-contacts", payload);
      else await post("/hr-contacts", payload);
      setMessage("");
      setStatus("sent");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить сообщение.");
      setStatus("idle");
    }
  }
  return <details className="mt-4 rounded-lg border bg-card px-3 py-2.5">
    <summary className="cursor-pointer text-sm font-medium">Связаться с HR</summary>
    <p className="mt-2 text-[13px] text-muted-foreground">Получатель — команда HR. Обращение содержит ваше имя и не входит в ответ анкеты.</p>
    {status === "sent"
      ? <p role="status" className="mt-2 text-sm text-success">Сообщение появилось во входящих HR.</p>
      : <form onSubmit={submit} className="mt-3 space-y-2">
        <label className="block text-sm">Сообщение для HR
          <textarea className="mt-1 block min-h-24 w-full rounded-lg border bg-field p-3" value={message} onChange={(event) => setMessage(event.target.value)} required maxLength={2000} disabled={status === "sending"} />
        </label>
        <Button type="submit" size="sm" disabled={!message.trim() || status === "sending"}>{status === "sending" ? "Отправляю…" : "Отправить HR"}</Button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </form>}
  </details>;
}

export function MentorCommentAdvice({ surveyID, internshipID, actorID, questionID, text }: SurveyContext & { questionID: string; text: string }) {
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<{ text: string; source?: string; questions?: string[]; error?: string }>();
  if (getApiMode() === "mock") return null;
  async function suggest() {
    setBusy(true);
    setProposal(undefined);
    try {
      const path = `/surveys/${encodeURIComponent(surveyID)}/comment-advice?${new URLSearchParams({ internship_id: internshipID })}`;
      const payload = { question_id: questionID, text };
      type Result = { source: "ai" | "template"; questions: string[] };
      const result = actorID ? await postAs<Result>(actorID, path, payload) : await post<Result>(path, payload);
      setProposal({ text, ...result });
    } catch (reason) {
      setProposal({ text, error: reason instanceof Error ? reason.message : "Подсказка недоступна." });
    } finally {
      setBusy(false);
    }
  }
  const current = proposal?.text === text ? proposal : undefined;
  return <div className="mt-2 space-y-2">
    <Button type="button" variant="outline" size="sm" onClick={suggest} disabled={busy || !text.trim() || text.length > 2000}>{busy ? "Готовлю подсказку…" : "Уточнить комментарий с ИИ"}</Button>
    <p className="text-xs text-muted-foreground">Если подключена модель, по нажатию она получит черновик комментария. Редактируете и отправляете ответ вы.</p>
    {current?.error && <p role="alert" className="text-sm text-destructive">{current.error}</p>}
    {current?.questions && <div className="rounded-md bg-surface p-3 text-sm" aria-live="polite">
      <p className="font-medium">{current.source === "ai" ? "Вопросы от ИИ" : "Вопросы по шаблону"}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">{current.questions.map((question, index) => <li key={index}>{question}</li>)}</ul>
    </div>}
  </div>;
}
