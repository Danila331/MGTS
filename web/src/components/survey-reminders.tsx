"use client";

import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { Panel } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import { get, getApiMode } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { toFrontendId } from "@/lib/remote";

type SurveyReminder = { survey_id: string; internship_id: string; survey_title: string; intern_name: string; due_at: string };

export function SurveyReminders() {
  const { actor } = useApp();
  if ((actor.role !== "intern" && actor.role !== "mentor") || getApiMode() === "mock") return null;
  return <ReminderList key={actor.id} mentor={actor.role === "mentor"} />;
}

function ReminderList({ mentor }: { mentor: boolean }) {
  const { data } = useResource(() => get<{ items: SurveyReminder[] }>("/survey-reminders"), [], 12000);
  if (!data?.items.length) return null;
  return <Panel title="Напоминания по анкетам">
    <ul className="divide-y">
      {data.items.map((item) => <li key={`${item.survey_id}:${item.internship_id}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
        <div><p className="text-sm font-medium">{item.survey_title}</p>
          <p className="text-xs text-muted-foreground">{mentor && <>{item.intern_name} · </>}Срок · {formatDate(item.due_at)}</p>
        </div>
        <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/surveys/${encodeURIComponent(toFrontendId(item.survey_id))}/take?${new URLSearchParams({ internship_id: toFrontendId(item.internship_id) })}`}>Ответить</Link>
      </li>)}
    </ul>
  </Panel>;
}
