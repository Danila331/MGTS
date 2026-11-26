"use client";

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/components/app-provider";
import { LineChart } from "@/components/charts";
import { useResource } from "@/hooks/use-resource";
import { getAs } from "@/lib/api";
import { plural } from "@/lib/format";
import { analyticsStyles } from "./analytics-markup";
import { createDemoMentors, feedbackTopic, formatMentorScore, mentorMetrics, mentorPeriods, mentorRows, mentorScore, periodKey } from "./mentor-overview-data";
import type { MentorMetric, MentorProfile, MentorRow, OverviewDataset, OverviewMode } from "./mentor-overview-data";
import { MentorDetails, MentorRanking } from "./mentor-panels";

const extraStyles = `
.mentor-line > p, .mentor-line > div:last-child { display: none; }
.mentor-line > .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.mentor-line svg { width: 100%; height: auto; }
.primary-figure .mentor-line svg text { font-size: 13px; }
@container (max-width: 560px) { .primary-figure .mentor-line svg text { font-size: 19px; } }
.mentor-comparison { grid-template-columns: minmax(85px, 1.05fr) minmax(40px, 1fr) 66px; }
.mentor-comparison strong { overflow-wrap: anywhere; }
.mentor-source { display: inline-block; margin-bottom: 8px; color: var(--blue); font-size: .8rem; }
.mentor-support { font-weight: 650; }
.mentor-preview { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }
.mentor-queue-item { grid-template-columns: minmax(0, 1fr) auto; }
.mentor-comparison-list { max-block-size: 19rem; overflow-y: auto; padding-inline-end: 4px; }
.mentor-empty { margin-block: 12px; }
`;

const trackedMetrics = mentorMetrics.slice(0, 3);
const grades = [1, 2, 3, 4, 5];
const demo = createDemoMentors();
type ChooseMentor = (row: MentorRow) => void;

export default function MentorAnalytics() {
  const { actor, demo } = useApp();
  const { data, error, loading, reload } = useResource(() => getAs<{ mentors: MentorProfile[] }>(actor.id, "/dashboard/mentors"), [actor.id], 12000);
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  const connect = useCallback((host: HTMLDivElement | null) => {
    if (host) setRoot(host.shadowRoot ?? host.attachShadow({ mode: "open" }));
  }, []);

  return <>
    <div ref={connect} />
    {root && createPortal(<><style>{analyticsStyles + extraStyles}</style><MentorOverview demoEnabled={demo} profiles={data?.mentors ?? []} loading={loading} error={error?.message} reload={reload} /></>, root)}
  </>;
}

function MentorOverview({ demoEnabled, profiles, loading, error, reload }: { demoEnabled: boolean; profiles: MentorProfile[]; loading: boolean; error?: string; reload: () => void }) {
  const [dataset, setDataset] = useState<OverviewDataset>("live");
  const [mode, setMode] = useState<OverviewMode>("stage");
  const [selected, setSelected] = useState("");
  const [metric, setMetric] = useState<MentorMetric | "all">("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<MentorRow | null>(null);
  const mentors = dataset === "demo" ? demo : profiles;
  const periods = useMemo(() => mentorPeriods(mentors, mode, dataset), [mentors, mode, dataset]);
  const feedback = useMemo(() => mentors.flatMap((profile) => profile.feedback), [mentors]);
  const entriesByPeriod = useMemo(() => groupBy(feedback, (entry) => periodKey(entry, mode)), [feedback, mode]);
  const active = periods.find((period) => period.key === selected)
    ?? periods.findLast((period) => entriesByPeriod.get(period.key)?.some(({ submitted }) => !submitted))
    ?? periods.findLast((period) => entriesByPeriod.get(period.key)?.some(({ submitted }) => submitted))
    ?? periods.findLast((period) => entriesByPeriod.has(period.key))
    ?? periods[0];
  const rows = mentorRows(mentors, mode, active?.key ?? "");
  const entries = entriesByPeriod.get(active?.key ?? "") ?? [];
  const submitted = entries.filter((entry) => entry.submitted);
  const visiblePeriods = active ? periods.slice(0, periods.indexOf(active) + 1) : [];
  const points = trackedMetrics.filter(({ key }) => metric === "all" || metric === key).map(({ key, label, color }) => ({
    id: key, label, color, values: visiblePeriods.map((period) => mentorScore(entriesByPeriod.get(period.key) ?? [], key)),
  }));
  const hasChart = points.some((point) => point.values.some((value) => value !== null));
  const low = rows.map((row) => ({ row, count: row.feedback.filter((entry) => entry.submitted && (entry.scores?.support ?? 5) <= 2).length }))
    .filter(({ count }) => count > 0);
  const pending = rows.map((row) => ({ row, count: row.feedback.filter(({ submitted }) => !submitted).length }))
    .filter(({ count }) => count > 0).sort((a, b) => b.count - a.count);
  const viewKey = `${dataset}:${mode}:${active?.key}`;

  const resetPeriod = () => { setSelected(""); setPage(1); setOpen(null); };
  return (
    <div className="page">
      <div className="page-head">
        <h2>Аналитика наставников</h2>
        <p>{dataset === "demo" ? "50 вымышленных наставников · демонстрационные данные" : "Обратная связь стажёров о закреплённых наставниках"}</p>
      </div>
      <div className="toolbar">
        <div className="dataset-switch" role="group" aria-label="Выбор данных наставников">
          <button type="button" aria-pressed={dataset === "live"} onClick={() => { setDataset("live"); resetPeriod(); }}>{profiles.length ? `Из базы · ${profiles.length}` : "Из базы"}</button>
          {demoEnabled && <button type="button" aria-pressed={dataset === "demo"} onClick={() => { setDataset("demo"); resetPeriod(); }}>Демо · 50</button>}
        </div>
        <div className="view-switch" role="group" aria-label="Режим дашборда наставников">
          <button type="button" aria-pressed={mode === "calendar"} onClick={() => { setMode("calendar"); resetPeriod(); }}>По календарю</button>
          <button type="button" aria-pressed={mode === "stage"} onClick={() => { setMode("stage"); resetPeriod(); }}>По этапам</button>
          {dataset === "live" && <button type="button" onClick={reload} disabled={loading}>Обновить</button>}
        </div>
      </div>
      <p className="date-disclaimer">{dataset === "demo" ? "Оценки и комментарии вымышленные. Темы с цитатами получены от Haiku." : "Оценка наставника — поддержка и обратная связь. Другие ответы показывают контекст стажировки."}</p>
      {dataset === "live" && loading && profiles.length === 0 ? <p className="empty" role="status">Загружаем отзывы наставникам…</p> :
        dataset === "live" && error && profiles.length === 0 ? <p className="empty" role="alert">Не удалось загрузить отзывы. {error}</p> : <>
          {dataset === "live" && error && <p className="empty mentor-empty" role="status">Обновление не удалось. Показаны предыдущие данные.</p>}
          {periods.length > 0 && <nav className="stages calendar-periods" aria-label="Период дашборда наставников">
            {periods.map((period) => <button key={period.key} type="button" aria-pressed={active?.key === period.key} onClick={() => { setSelected(period.key); setPage(1); }}>{period.label}</button>)}
          </nav>}
          <div className="visuals">
            <section className="metric-chart" aria-labelledby="mentor-metric-title">
              <div className="chart-head"><div><h3 id="mentor-metric-title">Как стажёры оценивают наставников</h3><p>{mode === "calendar" ? "Средние оценки по календарным месяцам ответа" : "Средние оценки по контрольным месяцам"}</p></div><span className="scale-note">Шкала 1–5</span></div>
              <div className="metric-controls" role="group" aria-label="Выбор показателя наставников">
                <button type="button" aria-pressed={metric === "all"} onClick={() => setMetric("all")}>Все показатели</button>
                {trackedMetrics.map(({ key, label, color }) => <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)}><i className="metric-dot" style={{ backgroundColor: color }} />{label}</button>)}
              </div>
              <figure className="primary-figure">
                {hasChart ? <LineChart className="mentor-line" points={points} labels={visiblePeriods.map((period) => period.shortLabel)} height={260} /> : <p className="empty">За этот период ещё нет оценок.</p>}
                <figcaption>{mode === "calendar" ? "Календарный месяц" : "Месяц стажировки"}</figcaption>
              </figure>
              <p className="chart-foot">{active?.label ?? "Период не выбран"} · Стажёры ответили {submitted.length} из {entries.length}</p>
            </section>
            <aside className="insight-panel" aria-labelledby="mentor-insight-title">
              <h3 id="mentor-insight-title">Что проверить</h3><p className="insight-sub">{active?.label ?? "Выбранный период"}</p>
              <div className="insight-section"><h4>Низкие оценки поддержки</h4>
                {low.length ? <div className="insight-list" role="region" aria-label="Наставники с низкими оценками поддержки" tabIndex={0}>
                  {low.map(({ row, count }) => <button className="insight-person" key={row.profile.id} type="button" onClick={() => setOpen(row)}>{row.profile.name} · {count} {plural(count, ["ответ", "ответа", "ответов"])} с оценкой 1–2</button>)}
                </div> : <p className="insight-empty">Оценок 1–2 пока нет.</p>}
              </div>
              <div className="insight-section"><h4>Ожидаем обратную связь</h4>
                {pending.length ? <div className="insight-list" role="region" aria-label="Наставники, по которым ждём отзывы" tabIndex={0}>
                  {pending.map(({ row, count }) => <button className="insight-person" key={row.profile.id} type="button" onClick={() => setOpen(row)}>{row.profile.name} · не отправлено {count}</button>)}
                </div> : <p className="insight-empty">Нет ожидающих ответов за этот период.</p>}
              </div>
            </aside>
          </div>
          <div className="additional-charts">
            <MentorDistribution key={viewKey} rows={rows} onSelect={setOpen} />
            <MentorComparison rows={rows} mean={mentorScore(submitted, "support")} onSelect={setOpen} />
          </div>
          <div className="additional-charts">
            <MentorGroups key={viewKey} rows={rows} onSelect={setOpen} />
          </div>
          <MentorComments rows={rows} onSelect={setOpen} />
          <MentorRanking rows={rows} page={page} setPage={setPage} onSelect={setOpen} />
        </>}
      {open && <MentorDetails key={`${viewKey}:${open.profile.id}`} row={open} dataset={dataset} mode={mode} period={active} periods={periods} onClose={() => setOpen(null)} />}
    </div>
  );
}

function MentorDistribution({ rows, onSelect }: { rows: MentorRow[]; onSelect: ChooseMentor }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <section className="data-panel" aria-labelledby="mentor-distribution-title">
      <div className="chart-head"><div><h3 id="mentor-distribution-title">Распределение оценок</h3><p>Ответы стажёров за выбранный период</p></div></div>
      <div className="distribution-legend"><span><i className="low" />1–2</span><span><i />3</span><span><i className="high" />4–5</span></div>
      {trackedMetrics.map(({ key, label }) => (
        <div className="distribution-row" key={key}><h4>{label}</h4>
          <div className="distribution-bars">{grades.map((grade) => {
            const id = `${key}:${grade}`;
            const buckets = rows.map((row) => ({ row, count: row.feedback.filter((entry) => entry.submitted && Math.round(entry.scores?.[key] ?? 0) === grade).length }));
            const count = buckets.reduce((sum, item) => sum + item.count, 0);
            return count ? <button key={grade} type="button" data-value={grade} aria-label={`${label}, оценка ${grade}: ${count} ответов`} aria-expanded={expanded === id} style={{ flex: count }} onClick={() => setExpanded(expanded === id ? null : id)}>{grade} · {count}</button> : null;
          })}</div>
          {expanded?.startsWith(`${key}:`) && <div className="distribution-values">
            {rows.filter(({ feedback }) => feedback.some((entry) => entry.submitted && Math.round(entry.scores?.[key] ?? 0) === Number(expanded.split(":")[1])))
              .map((row) => <button type="button" key={row.profile.id} onClick={() => onSelect(row)}>{row.profile.name}</button>)}
          </div>}
        </div>
      ))}
    </section>
  );
}

function MentorComparison({ rows, mean, onSelect }: { rows: MentorRow[]; mean: number | null; onSelect: ChooseMentor }) {
  const position = (value: number) => (value - 1) * 25;
  const available = rows.filter((row) => row.scores.support !== null);
  return (
    <section className="data-panel" aria-labelledby="mentor-comparison-title">
      <div className="chart-head"><div><h3 id="mentor-comparison-title">Сравнение поддержки</h3><p>Оценка наставника и средняя по всем ответам</p></div></div>
      <div className="comparison-legend"><span><i />Наставник</span><span><i className="mentor" />Вся выборка</span></div>
      {mean === null ? <p className="insight-empty">Пока нет оценок поддержки.</p> : <div className="mentor-comparison-list" role="region" aria-label="Сравнение оценок поддержки" tabIndex={0}>
        {available.map((row) => {
          const individual = position(row.scores.support!);
          const overall = position(mean);
          return <button className="comparison-row mentor-comparison" type="button" key={row.profile.id} onClick={() => onSelect(row)}>
            <strong>{row.profile.name}</strong><span className="comparison-axis" aria-hidden="true">
              <i className="comparison-connector" style={{ left: `${Math.min(individual, overall)}%`, width: `${Math.abs(individual - overall)}%` }} />
              <i className="comparison-point" style={{ left: `${individual}%` }} /><i className="comparison-point mentor" style={{ left: `${overall}%` }} />
            </span><span className="comparison-values">{formatMentorScore(row.scores.support)} / {formatMentorScore(mean)}</span>
          </button>;
        })}
      </div>}
    </section>
  );
}

function groupBy<T>(items: T[], keyOf: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

function MentorGroups({ rows, onSelect }: { rows: MentorRow[]; onSelect: ChooseMentor }) {
  const entries = rows.flatMap((row) => row.feedback.filter(({ submitted }) => submitted).map((entry) => ({ row, entry })));
  const topics = groupBy(entries.flatMap(({ row, entry }) => (entry.comments ?? []).map((comment) => ({ row, topic: feedbackTopic(comment) }))), ({ topic }) => topic);
  const departments = groupBy(entries, ({ entry }) => entry.department);
  const maxTopic = Math.max(1, ...[...topics.values()].map((items) => items.length));
  return <>
    <MentorGroupPanel title="Темы обратной связи" subtitle="Открытые ответы стажёров за выбранный период" onSelect={onSelect}
      groups={[...topics.entries()].sort((a, b) => b[1].length - a[1].length).map(([label, items]) => ({ label, caption: String(items.length), width: items.length / maxTopic * 100, rows: items.map(({ row }) => row) }))} />
    <MentorGroupPanel title="Направления и поддержка" subtitle="Средняя оценка поддержки по подразделениям" onSelect={onSelect}
      groups={[...departments.entries()].sort(([a], [b]) => a.localeCompare(b, "ru")).map(([label, items]) => {
        const score = mentorScore(items.map(({ entry }) => entry), "support");
        return { label, caption: `${formatMentorScore(score)} · ${items.length} отв.`, width: (score ?? 0) * 20, rows: items.map(({ row }) => row) };
      })} />
  </>;
}

function MentorGroupPanel({ title, subtitle, groups, onSelect }: { title: string; subtitle: string; groups: { label: string; caption: string; width: number; rows: MentorRow[] }[]; onSelect: ChooseMentor }) {
  const [open, setOpen] = useState<string | null>(null);
  return <section className="data-panel">
    <div className="chart-head"><div><h3>{title}</h3><p>{subtitle}</p></div></div>
    <div className="topic-chart">
      {groups.length === 0 && <p className="insight-empty">За этот период данных пока нет.</p>}
      {groups.map(({ label, caption, width, rows }) => <div key={label}>
        <button type="button" className="topic-row" aria-expanded={open === label} onClick={() => setOpen(open === label ? null : label)}>
          <span>{label || "—"}</span><span className="topic-bar" aria-hidden="true"><i style={{ width: `${width}%` }} /></span><strong>{caption}</strong>
        </button>
        {open === label && <div className="topic-people">{[...new Map(rows.map((row) => [row.profile.id, row])).values()].map((row) => <button type="button" key={row.profile.id} onClick={() => onSelect(row)}>{row.profile.name}</button>)}</div>}
      </div>)}
    </div>
  </section>;
}

function MentorComments({ rows, onSelect }: { rows: MentorRow[]; onSelect: ChooseMentor }) {
  const comments = rows.map((row) => ({ row, items: row.feedback.filter(({ submitted }) => submitted).flatMap((entry) => entry.comments ?? []) }))
    .filter(({ items }) => items.length > 0).sort((a, b) => (a.row.scores.support ?? 6) - (b.row.scores.support ?? 6));
  return <section className="queue" aria-labelledby="mentor-comments-title">
    <div className="queue-head"><h3 id="mentor-comments-title">Темы в анкетах</h3><p>{comments.length} {plural(comments.length, ["наставник", "наставника", "наставников"])} с комментариями</p></div>
    <div className="queue-list">
      {comments.length === 0 && <p className="empty">За этот период комментариев пока нет.</p>}
      {comments.map(({ row, items }) => <button className="queue-button mentor-queue-item" type="button" key={row.profile.id} onClick={() => onSelect(row)}>
        <strong>{row.profile.name}</strong><span className="queue-score">{formatMentorScore(row.scores.support)}</span>
        <small>{items.length} {plural(items.length, ["комментарий", "комментария", "комментариев"])} · {feedbackTopic(items[0])}</small><small className="mentor-preview">{items[0].text}</small>
      </button>)}
    </div>
  </section>;
}
