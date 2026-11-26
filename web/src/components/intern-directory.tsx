"use client";

import { ChevronRight, Search, X } from "lucide-react";
import Link from "next/link";
import { ProgressBar } from "@/components/charts";
import { fieldClass } from "@/components/forms";
import { Avatar, Badge, EmptyState } from "@/components/page";
import { Button } from "@/components/ui/button";
import { departments } from "@/lib/mock-data";
import type { InternItem, TrafficLight } from "@/lib/types";

export type InternSort = "percentile" | "score" | "name";
export const formatScore = (value: number | null) => value === null ? "—" : value.toFixed(1);

const trafficLabels: Record<TrafficLight, string> = { green: "Стабильно", yellow: "Внимание", red: "Риск" };
export function TrafficLightBadge({ value }: { value: TrafficLight }) {
  const tone = value === "green" ? "success" : value === "yellow" ? "warning" : "danger";
  return <Badge tone={tone}><span className="mr-1.5 size-1.5 rounded-full bg-current" aria-hidden />{trafficLabels[value]}</Badge>;
}
export function PercentileRange({ item }: { item: Pick<InternItem, "percentile_label" | "percentile_min" | "percentile_max"> }) {
  const label = item.percentile_label !== "—" ? item.percentile_label : item.percentile_min !== null && item.percentile_max !== null ? `${item.percentile_min}–${item.percentile_max}` : "—";
  return <span className="tnum whitespace-nowrap">{label}</span>;
}

interface Props {
  items: InternItem[];
  search: string;
  department: string;
  sort: InternSort;
  onSearch: (value: string) => void;
  onDepartment: (value: string) => void;
  onSort?: (value: InternSort) => void;
  onReset: () => void;
}

export function InternDirectory({ items, search, department, sort, onSearch, onDepartment, onSort, onReset }: Props) {
  return <div className="space-y-4">
    <div className="flex flex-col gap-2 rounded-xl border bg-surface p-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-0 flex-1 sm:min-w-56">
        <Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" />
        <input value={search} onChange={(event) => onSearch(event.target.value)} className={`${fieldClass} min-h-11 pr-10 pl-9`} placeholder="Имя или наставник" aria-label="Поиск стажёров" />
        {search && <button type="button" onClick={() => onSearch("")} className="absolute top-1 right-1 flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Очистить поиск"><X className="size-4" /></button>}
      </div>
      <select className={`${fieldClass} min-h-11 sm:w-auto sm:min-w-44`} value={department} onChange={(event) => onDepartment(event.target.value)} aria-label="Фильтр по блоку">
        <option value="">Все блоки</option>
        {departments.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      {onSort && <select className={`${fieldClass} min-h-11 sm:w-auto sm:min-w-44`} value={sort} onChange={(event) => onSort(event.target.value as InternSort)} aria-label="Сортировка стажёров">
        <option value="percentile">По перцентилю</option>
        <option value="score">По среднему баллу</option>
        <option value="name">По имени</option>
      </select>}
    </div>

    {items.length === 0 ? <EmptyState title="Стажёры не найдены" text="Измените поисковый запрос или сбросьте фильтр по блоку." action={<Button variant="outline" onClick={onReset}>Сбросить фильтры</Button>} /> : <>
      <div className="hidden overflow-x-auto rounded-xl border bg-card xl:block">
        <table className="w-full min-w-[1080px] border-collapse text-left">
          <thead><tr className="border-b bg-surface text-[11px] font-medium text-muted-foreground">
            <th className="px-4 py-2.5">Стажёр</th><th className="px-3 py-2.5">Блок</th><th className="px-3 py-2.5">Текущий месяц</th><th className="px-3 py-2.5">Средний балл</th><th className="px-3 py-2.5">Перцентиль</th><th className="px-3 py-2.5">Светофор</th><th className="px-3 py-2.5">Наставник</th><th className="px-3 py-2.5">Покрытие</th><th className="w-8"><span className="sr-only">Открыть</span></th>
          </tr></thead>
          <tbody>{items.map((item) => <tr key={item.id} className="group border-b last:border-0 hover:bg-muted/60">
            <td className="px-4 py-3"><Link href={`/interns/${item.id}`} className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><Avatar initials={item.intern.initials} name={item.intern.name} /><span className="text-[13px] font-medium group-hover:underline">{item.intern.name}</span></Link></td>
            <td className="px-3 py-3 text-[12px]">{item.department}</td>
            <td className="px-3 py-3 text-[12px] whitespace-nowrap">{item.current_period}</td>
            <td className="tnum px-3 py-3 text-[13px] font-medium">{formatScore(item.latest_score)}</td>
            <td className="px-3 py-3 text-[12px]"><PercentileRange item={item} /></td>
            <td className="px-3 py-3"><TrafficLightBadge value={item.traffic_light} /></td>
            <td className="px-3 py-3 text-[12px]">{item.mentor}</td>
            <td className="min-w-28 px-3 py-3"><ProgressBar value={item.coverage} label={`Покрытие ${item.intern.name}`} /></td>
            <td className="px-3"><Link href={`/interns/${item.id}`} aria-label={`Открыть карточку: ${item.intern.name}`} className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronRight className="size-4" /></Link></td>
          </tr>)}</tbody>
        </table>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:hidden">{items.map((item) => <Link key={item.id} href={`/interns/${item.id}`} className="block rounded-xl border bg-card p-4 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50">
        <div className="flex items-start gap-3"><Avatar initials={item.intern.initials} /><div className="min-w-0 flex-1"><h3 className="truncate text-[14px] font-medium">{item.intern.name}</h3><p className="mt-0.5 text-[12px] text-muted-foreground">{item.department} · {item.current_period}</p></div><TrafficLightBadge value={item.traffic_light} /></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]"><div><dt className="text-muted-foreground">Средний балл</dt><dd className="tnum mt-1 text-[16px] font-medium">{formatScore(item.latest_score)}</dd></div><div><dt className="text-muted-foreground">Перцентиль</dt><dd className="mt-1 text-[16px] font-medium"><PercentileRange item={item} /></dd></div></dl>
        <div className="mt-4 border-t pt-3"><div className="mb-2 flex justify-between gap-3 text-[11px] text-muted-foreground"><span className="truncate">{item.mentor}</span><span>Покрытие</span></div><ProgressBar value={item.coverage} label={`Покрытие ${item.intern.name}`} /></div>
      </Link>)}</div>
    </>}
  </div>;
}
