"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { fieldClass } from "@/components/forms";
import { Badge, ErrorState, InsufficientData, LoadingState, Panel } from "@/components/page";
import { useResource } from "@/hooks/use-resource";
import { getAs } from "@/lib/api";
import type { DashboardData, ParticipationState } from "@/lib/types";

const stateLabel = { submitted: "Заполнено", pending: "Нет ответа", "": "Не назначено" } as const;

function combined(intern: ParticipationState, mentor: ParticipationState) {
  if (!intern || !mentor) return { label: "Анкеты назначены не обеим сторонам", tone: "neutral" } as const;
  if (intern === "submitted" && mentor === "submitted") return { label: "Заполнено обоими", tone: "success" } as const;
  if (intern === "submitted") return { label: "Пропущено наставником", tone: "warning" } as const;
  if (mentor === "submitted") return { label: "Пропущено стажёром", tone: "warning" } as const;
  return { label: "Пропущено обоими", tone: "danger" } as const;
}

export function FeedbackCoverage() {
  const { actor } = useApp();
  const { data, error, reload } = useResource(() => getAs<DashboardData>(actor.id, "/dashboard"), [actor.id]);
  const [month, setMonth] = useState<number | null>(null);
  const entries = data?.survey_participation ?? [];
  const latestMonth = entries.reduce((latest, entry) => Math.max(latest, entry.periods.findLastIndex((period) => period.intern || period.mentor)), 0);
  const selected = month ?? latestMonth;
  const rows = entries.map((entry) => ({ ...entry, ...entry.periods[selected] }));
  rows.sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return (
    <Panel title="Кто предоставил обратную связь" className="mb-4" action={
      <select aria-label="Контрольный месяц обратной связи" value={selected} onChange={(event) => setMonth(Number(event.target.value))} className={`${fieldClass} min-h-8 w-auto py-1 text-[12px]`}>
        {Array.from({ length: 6 }, (_, index) => <option key={index} value={index}>Месяц {index + 1}</option>)}
      </select>
    }>
      {!data ? error ? <ErrorState error={error} retry={reload} /> : <LoadingState rows={2} /> : rows.length === 0
        ? <InsufficientData text="Пока нет данных о заполнении анкет." />
        : <ul className="max-h-60 divide-y overflow-y-auto" aria-label="Заполнение анкет по стажёрам">
          {rows.map((row) => {
            const intern = row.intern ?? "";
            const mentor = row.mentor ?? "";
            const { label, tone } = combined(intern, mentor);
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
