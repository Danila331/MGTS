"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { fieldClass } from "@/components/forms";
import { Badge, ErrorState, InsufficientData, LoadingState, Panel } from "@/components/page";
import { useResource } from "@/hooks/use-resource";
import { getAs } from "@/lib/api";
import type { DashboardData, ParticipationState } from "@/lib/types";
import { cn } from "@/lib/utils";

const stateLabel = { submitted: "Заполнено", pending: "Нет ответа", "": "Не назначено" } as const;

function missingStatus(intern: ParticipationState, mentor: ParticipationState) {
  if (intern === "pending" && mentor === "pending") return { label: "Пропущено обоими", tone: "danger" } as const;
  if (intern === "pending") return { label: "Пропущено стажёром", tone: "warning" } as const;
  return { label: "Пропущено наставником", tone: "warning" } as const;
}

export function FeedbackCoverage() {
  const { actor } = useApp();
  const { data, error, reload } = useResource(() => getAs<DashboardData>(actor.id, "/dashboard"), [actor.id]);
  const [month, setMonth] = useState<number | null>(null);
  const entries = data?.survey_participation ?? [];
  const latestMonth = entries.reduce((latest, entry) => Math.max(latest, entry.periods.findLastIndex((period) => period.intern || period.mentor)), 0);
  const latestPending = entries.reduce((latest, entry) => Math.max(latest, entry.periods.findLastIndex((period) => period.intern === "pending" || period.mentor === "pending")), -1);
  const selected = month ?? (latestPending >= 0 ? latestPending : latestMonth);
  const periods = entries.map((entry) => {
    const { intern = "", mentor = "" } = entry.periods[selected] ?? {};
    return { ...entry, intern, mentor };
  });
  const rows = periods.flatMap((entry) => {
    const pending = Number(entry.intern === "pending") + Number(entry.mentor === "pending");
    return pending ? [{ ...entry, pending }] : [];
  });
  rows.sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name, "ru"));
  const assigned = periods.some((entry) => entry.intern || entry.mentor);

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
      {!data ? error ? <ErrorState error={error} retry={reload} /> : <LoadingState rows={2} /> : rows.length === 0
        ? <InsufficientData text={assigned ? "Все назначенные анкеты за этот период отправлены." : "За этот период анкеты пока не назначены."} />
        : <ul className="max-h-60 divide-y overflow-y-auto" aria-label="Неотправленные анкеты по стажёрам">
          {rows.map((row) => {
            const { intern, mentor } = row;
            const { label, tone } = missingStatus(intern, mentor);
            return <li key={row.internship_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <div>
                <Link href={`/interns/${row.internship_id}`} className="text-[13px] font-medium hover:underline">{row.name}</Link>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Стажёр · {stateLabel[intern]} / Наставник · {stateLabel[mentor]}</p>
              </div>
              <Badge tone={tone}>{label}</Badge>
            </li>;
          })}
        </ul>}
    </Panel>
  );
}
