"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app-provider";
import { LineChart, ProgressBar } from "@/components/charts";
import { fieldClass } from "@/components/forms";
import { formatScore, InternDirectory, type InternSort } from "@/components/intern-directory";
import { Badge, EmptyState, ErrorState, InsufficientData, LoadingState, Metric, Page, Panel } from "@/components/page";
import { SurveyReminders } from "@/components/survey-reminders";
import { Button } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import { get, getApiMode } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { DashboardData } from "@/lib/types";
import { FeedbackCoverage } from "./feedback-coverage";

export function DashboardView() {
  const { actor } = useApp();
  if (actor.role === "intern") return <Page title="Пульс" roles={["hr", "manager", "mentor"]}>{null}</Page>;
  return <DashboardDataView key={actor.id} />;
}

export function DashboardDataView({ embedded = false }: { embedded?: boolean }) {
  const { actor } = useApp();
  const { data, error, loading, reload } = useResource(() => get<DashboardData>("/dashboard"), [actor.id], 12000);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [sort, setSort] = useState<InternSort>("percentile");
  const [series, setSeries] = useState("");
  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.items ?? []).filter((item) => (!department || item.department === department) && (!query || `${item.intern.name} ${item.department} ${item.mentor}`.toLowerCase().includes(query))).sort((a, b) => sort === "name"
      ? a.intern.name.localeCompare(b.intern.name, "ru")
      : sort === "score"
        ? (b.latest_score ?? -1) - (a.latest_score ?? -1)
        : (b.percentile_max ?? -1) - (a.percentile_max ?? -1) || (b.overall_score ?? -1) - (a.overall_score ?? -1));
  }, [data, search, department, sort]);
  const trends = (data?.trends ?? []).filter((trend) => trend.values.some((value) => value !== null));
  const selectedTrend = trends.find((trend) => (trend.id ?? trend.label) === series);
  const overviewTrends = trends.filter((trend) => trend.dimension && ["clarity", "support", "workload"].includes(trend.dimension)).slice(0, 3);
  const visibleTrends = selectedTrend ? [selectedTrend] : overviewTrends.length ? overviewTrends : trends.slice(0, 3);
  const trendLabels = Array.from({ length: Math.max(0, ...visibleTrends.map((trend) => trend.values.length)) }, (_, index) => `Месяц ${index + 1}`);

  const refresh = <Button variant="ghost" size="icon-lg" disabled={loading} onClick={reload} aria-label="Обновить данные"><RefreshCw /></Button>;
  const content = <>
    {loading && !data ? <LoadingState rows={7} /> : error && !data ? <ErrorState error={error} retry={reload} /> : data && <div className="space-y-4">
      {actor.role === "mentor" && <SurveyReminders />}
      {getApiMode() === "mock" && <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">Локальные демо-данные</p>}
      {error && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[12px] text-warning" role="status"><span>Не удалось обновить данные. Показана предыдущая версия.</span><button className="min-h-9 underline" onClick={reload}>Повторить</button></div>}
      {actor.role === "hr" && <>
        <FeedbackCoverage data={data} />
        {data.attention_queue && <Panel title="Требуют внимания">
          {data.attention_queue?.length ? <ul className="max-h-72 divide-y overflow-y-auto">
            {data.attention_queue.map((item) => <li key={item.internship_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <Link className="text-sm font-medium hover:underline" href={`/interns/${item.internship_id}`}>{item.name}<span className="block text-xs font-normal text-muted-foreground">{item.title} · месяц {item.wave}</span></Link>
              <Badge tone={item.severity === "critical" ? "danger" : "warning"}>{item.status === "done" ? "Шаг выполнен" : item.status === "in_progress" ? "В работе" : item.severity === "critical" ? "Срочно" : "Проверить"}</Badge>
            </li>)}
          </ul> : <InsufficientData text="В последних анкетах нет сигналов, требующих внимания." />}
        </Panel>}
      </>}
      <div className="flex items-end justify-between gap-3"><div><h2 className="text-[22px] font-semibold tracking-[-0.025em]">Рейтинг стажёров</h2><p className="mt-1 text-[13px] text-muted-foreground">Результаты шести контрольных периодов и текущее покрытие.</p></div><span className="hidden text-[11px] text-muted-foreground sm:block">Обновлено {formatDate(data.updated_at, true)}</span></div>
      <section className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4" aria-label="Ключевые показатели">
        <Metric label="Стажёры" value={data.metrics.interns} note={actor.role === "mentor" ? "закрепленные за вами" : "все участники программы"} />
        <Metric label="Средний балл" value={formatScore(data.metrics.avg_score)} note="текущий контрольный период" />
        <Metric label="Покрытие" value={data.coverage.length ? `${data.metrics.coverage}%` : "—"} note="ответы обеих сторон" />
        <Metric label="Требуют внимания" value={data.metrics.attention} note="жёлтый или красный светофор" />
      </section>
      <Panel title="Стажёры" note={`${items.length} из ${data.items.length} · сортировка и фильтры применяются к рейтингу`}>
        <InternDirectory items={items} search={search} department={department} sort={sort} onSearch={setSearch} onDepartment={setDepartment} onSort={setSort} onReset={() => { setSearch(""); setDepartment(""); setSort("percentile"); }} />
      </Panel>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
        <Panel title="Динамика когорты" note="Средние оценки по шести месяцам">
          {visibleTrends.length ? <>
            {trends.length > 1 && <label className="mb-3 block text-sm">Показатель<select aria-label="Показатель" className={`${fieldClass} mt-1 block w-full sm:max-w-sm`} value={selectedTrend ? series : ""} onChange={(event) => setSeries(event.target.value)}>
              <option value="">Основные показатели</option>
              {trends.map((trend) => <option key={trend.id ?? trend.label} value={trend.id ?? trend.label}>{trend.label}</option>)}
            </select></label>}
            <LineChart points={visibleTrends} labels={trendLabels} />
          </> : <InsufficientData text="Динамика появится после получения сопоставимых ответов стажёров и наставников." />}
        </Panel>
        <div className="space-y-4">
          <Panel title="Покрытие анкет" note="Доля отправленных ответов">
            {data.coverage.length ? <div className="space-y-4">{data.coverage.map((item) => <div key={item.label}><div className="mb-2 flex justify-between text-[12px]"><span>{item.label}</span><span className="tnum text-muted-foreground">{item.value}%</span></div><ProgressBar value={item.value} tone={item.value < 60 ? "danger" : item.value < 80 ? "warning" : "success"} label={`Покрытие: ${item.label}`} /></div>)}</div> : <EmptyState title="Нет данных о покрытии" text="Покрытие появится после назначения контрольного периода." />}
          </Panel>
          <Panel title="Средние показатели" note="Шкала от 1 до 5">
            <dl className="divide-y text-[12px]">{[["Текущий средний", data.averages.latest_score], ["Общий средний", data.averages.overall_score], ["Средний по когорте", data.averages.cohort_average]].map(([label, value]) => <div key={String(label)} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"><dt className="text-muted-foreground">{label}</dt><dd className="tnum text-[14px] font-medium">{formatScore(value as number | null)}</dd></div>)}</dl>
          </Panel>
        </div>
      </div>
    </div>}
  </>;
  if (embedded) return <div className="space-y-3"><div className="flex justify-end">{refresh}</div>{content}</div>;
  return <Page title="Пульс" subtitle={actor.role === "mentor" ? "Мои стажёры" : "Стажировка МГТС"} roles={["hr", "manager", "mentor"]} actions={refresh}>{content}</Page>;
}
