"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { fieldClass } from "@/components/forms";
import { Badge, InsufficientData, Panel } from "@/components/page";
import { Button } from "@/components/ui/button";
import { getApiMode, post } from "@/lib/api";
import type { DashboardData, ParticipationState } from "@/lib/types";
import { cn } from "@/lib/utils";

const stateLabel = { submitted: "Заполнено", pending: "Нет ответа", "": "Не назначено" } as const;

function missingStatus(intern: ParticipationState, mentor: ParticipationState) {
  if (intern === "pending" && mentor === "pending") return "Ждём оба ответа";
  return intern === "pending" ? "Ждём стажёра" : "Ждём наставника";
}

export function FeedbackCoverage({ data }: { data: DashboardData }) {
  const [month, setMonth] = useState<number | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const entries = data.survey_participation ?? [];
  const latestMonth = entries.reduce((latest, entry) => Math.max(latest, entry.periods.findLastIndex((period) => period.intern || period.mentor)), 0);
  const latestPending = entries.reduce((latest, entry) => Math.max(latest, entry.periods.findLastIndex((period) => period.intern === "pending" || period.mentor === "pending")), -1);
  const selected = month ?? (latestPending >= 0 ? latestPending : latestMonth);
  const periods = entries.map((entry) => {
    const { intern = "", mentor = "" } = entry.periods[selected] ?? {};
    return { ...entry, intern, mentor };
  });
  const rows = periods.flatMap((entry) => {
    const pending = Number(entry.intern === "pending") + Number(entry.mentor === "pending");
    return pending || (showCompleted && (entry.intern || entry.mentor)) ? [{ ...entry, pending }] : [];
  });
  rows.sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name, "ru"));
  const assigned = periods.some((entry) => entry.intern || entry.mentor);

  async function remind(internshipID: string) {
    setSending(internshipID);
    try {
      const result = await post<{ sent: number }>("/survey-reminders", { internship_id: internshipID, wave: selected + 1 });
      if (result.sent > 0) toast.success(`Напоминаний в Пульсе · ${result.sent}`);
      else toast.info("Напоминание уже есть или анкета больше не ожидает ответа");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Не удалось напомнить.");
    } finally {
      setSending(null);
    }
  }

  return (
    <Panel title="Кто ещё не отправил анкету" note="Назначения в Пульсе за выбранный контрольный месяц" className="mb-4" action={
      <select
        aria-label="Контрольный месяц обратной связи"
        value={selected}
        onChange={(event) => setMonth(Number(event.target.value))}
        className={cn(fieldClass, "block h-9 w-28 max-w-full shrink-0 py-1 text-xs focus-visible:ring-0 focus-visible:inset-ring-2 focus-visible:inset-ring-ring")}
      >
        {Array.from({ length: 6 }, (_, index) => <option key={index} value={index}>Месяц {index + 1}</option>)}
      </select>
    }>
      {assigned && <label className="mb-2 flex w-fit items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" className="size-4 accent-primary" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} />Показать также полученные ответы</label>}
      {rows.length === 0
        ? <InsufficientData text={assigned ? "Все назначенные анкеты за этот период отправлены." : "За этот период анкеты пока не назначены."} />
        : <ul className="max-h-60 divide-y overflow-y-auto" aria-label="Неотправленные анкеты по стажёрам">
          {rows.map((row) => {
            const { intern, mentor } = row;
            return <li key={row.internship_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <div>
                <Link href={`/interns/${row.internship_id}`} className="text-[13px] font-medium hover:underline">{row.name}</Link>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Стажёр · {stateLabel[intern]} / Наставник · {stateLabel[mentor]}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={row.pending ? "warning" : "success"}>{row.pending ? missingStatus(intern, mentor) : "Получено"}</Badge>
                {row.pending > 0 && getApiMode() !== "mock" && <Button size="sm" variant="outline" type="button" onClick={() => remind(row.internship_id)} disabled={sending !== null}>{sending === row.internship_id ? "Отправляю…" : "Напомнить в Пульсе"}</Button>}
              </div>
            </li>;
          })}
        </ul>}
    </Panel>
  );
}
