import { useEffect, useRef, useState } from "react";
import { LineChart } from "@/components/charts";
import { feedbackTopic, formatMentorScore, mentorMetrics, mentorRanks, mentorScore, periodKey } from "./mentor-overview-data";
import type { MentorMetric, MentorRow, OverviewDataset, OverviewMode, OverviewPeriod } from "./mentor-overview-data";

export function MentorRanking({ rows, page, setPage, onSelect }: {
  rows: MentorRow[];
  page: number;
  setPage: (page: number) => void;
  onSelect: (row: MentorRow) => void;
}) {
  const [sort, setSort] = useState<{ metric: MentorMetric; ascending: boolean }>({ metric: "support", ascending: false });
  const sorted = [...rows].sort((a, b) => {
    const first = a.scores[sort.metric];
    const second = b.scores[sort.metric];
    if (first === null && second !== null) return 1;
    if (second === null && first !== null) return -1;
    const diff = (first ?? 0) - (second ?? 0);
    return (sort.ascending ? diff : -diff) || a.profile.name.localeCompare(b.profile.name, "ru");
  });
  const size = 10;
  const pageCount = Math.max(1, Math.ceil(sorted.length / size));
  const activePage = Math.min(page, pageCount);
  const start = (activePage - 1) * size;

  return (
    <section className="ranking-section" aria-labelledby="mentor-ranking-title">
      <div className="queue-head"><div><h3 id="mentor-ranking-title">Все наставники</h3><p>{rows.length} в выборке · оценки стажёров за выбранный период</p></div></div>
      <div className="rank-legend" aria-label="Группы перцентилей">
        {mentorRanks.map((rank) => <span key={rank.style} className={`rank-key ${rank.style}`}>{rank.label}</span>)}
      </div>
      <p className="rank-note">Перцентиль рассчитан по поддержке и обратной связи. Остальные показатели описывают опыт стажировки.</p>
      {sorted.length === 0 ? <p className="empty">В выборке пока нет наставников.</p> : (
        <div className="ranking-scroll" role="region" aria-labelledby="mentor-ranking-title" tabIndex={0}>
          <table className="ranking-table">
            <thead><tr><th scope="col">Наставник</th><th scope="col">Направление</th><th scope="col">Ответы</th>
              {mentorMetrics.map(({ key, label }) => (
                <th key={key} scope="col" aria-sort={sort.metric === key ? (sort.ascending ? "ascending" : "descending") : undefined}>
                  <button type="button" onClick={() => { setSort({ metric: key, ascending: sort.metric === key && !sort.ascending }); setPage(1); }}>
                    {label}{sort.metric === key ? (sort.ascending ? " ↑" : " ↓") : " ↕"}
                  </button>
                </th>
              ))}<th scope="col">Перцентиль</th></tr></thead>
            <tbody>{sorted.slice(start, start + size).map((row) => {
              const percentile = row.percentile;
              const rank = percentile === null ? undefined : mentorRanks.find(({ floor }) => percentile >= floor);
              const submitted = row.feedback.filter((entry) => entry.submitted).length;
              return (
                <tr key={row.profile.id} className={rank?.style}>
                  <td><button type="button" onClick={() => onSelect(row)}>{row.profile.name}</button></td>
                  <td>{row.profile.departments.join(", ") || "—"}</td>
                  <td>{submitted} из {row.feedback.length}</td>
                  {mentorMetrics.map(({ key }) => <td key={key}>{formatMentorScore(row.scores[key])}</td>)}
                  <td>{rank && percentile !== null ? <span className={`rank-badge ${rank.style}`}>{Math.round(percentile)} · {rank.label}</span> : "—"}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
      {pageCount > 1 && (
        <nav className="ranking-pagination" aria-label="Страницы рейтинга наставников">
          <p role="status">{start + 1}–{Math.min(start + size, sorted.length)} из {sorted.length} · Страница {activePage} из {pageCount}</p>
          <div className="pagination-buttons">
            <button type="button" disabled={activePage === 1} onClick={() => setPage(activePage - 1)}>Назад</button>
            <button type="button" disabled={activePage === pageCount} onClick={() => setPage(activePage + 1)}>Далее</button>
          </div>
        </nav>
      )}
    </section>
  );
}

function storedNote(key: string) {
  try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
}

export function MentorDetails({ row, dataset, mode, period, periods, onClose }: {
  row: MentorRow;
  dataset: OverviewDataset;
  mode: OverviewMode;
  period: OverviewPeriod | undefined;
  periods: OverviewPeriod[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const key = `mgts/dashboard/mentor-review/${JSON.stringify([dataset, row.profile.id, mode, period?.key])}`;
  const [note, setNote] = useState(() => storedNote(key));
  const [draft, setDraft] = useState(note);
  const [status, setStatus] = useState("");
  const submitted = row.feedback.filter((entry) => entry.submitted);
  const history = period ? periods.slice(0, periods.findIndex(({ key }) => key === period.key) + 1) : periods;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog ref={ref} aria-labelledby="mentor-case-title" onClose={onClose} onClick={(event) => {
      const dialog = event.currentTarget;
      if (event.target === dialog && event.clientX < dialog.getBoundingClientRect().left) dialog.close();
    }}>
      <header className="drawer-head">
        <div><p className="meta">{period?.label} · {row.profile.departments.join(", ")}</p><h3 id="mentor-case-title">{row.profile.name}</h3></div>
        <button type="button" className="close" aria-label="Закрыть карточку наставника" onClick={() => ref.current?.close()}>×</button>
      </header>
      <div className="drawer-content">
        <div className="numbers"><span>Оценка поддержки <strong>{formatMentorScore(row.scores.support)}</strong></span><span>Стажёры <strong>{row.profile.interns}</strong></span><span>Ответы <strong>{submitted.length} из {row.feedback.length}</strong></span></div>
        <section className="drawer-block">
          <h4>Поддержка и обратная связь</h4>
          <div className="metric-list">
            {mentorMetrics.map(({ key, label }) => (
              <div key={key} className={`metric${key === "support" ? " mentor-support" : ""}`}>
                <span>{label}</span><div className="metric-track" aria-hidden="true"><div className="metric-bar" style={{ width: `${(row.scores[key] ?? 0) * 20}%` }} /></div>
                <strong>{formatMentorScore(row.scores[key])}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="drawer-block evidence">
          <h4>Исходные ответы за период</h4>
          {submitted.length === 0 ? <p className="insight-empty">За выбранный период ответов пока нет.</p> : submitted.map((entry) => (
            <details key={`${entry.internship_id}:${entry.wave}`}>
              <summary>{entry.intern} · Месяц {entry.wave} · поддержка {formatMentorScore(entry.scores?.support ?? null)}</summary>
              {(entry.comments ?? []).map((comment, index) => <blockquote key={`${comment.dimension}:${index}`}><small>{feedbackTopic(comment)}</small><p>{comment.text}</p></blockquote>)}
              {dataset === "live" && <a className="mentor-source" href={`/interns/${encodeURIComponent(entry.internship_id)}`}>Карточка стажёра</a>}
            </details>
          ))}
        </section>
        <section className="drawer-block case-history">
          <h4>Динамика по оценкам стажёров</h4>
          <div className="history-charts">
            {mentorMetrics.map(({ key, label, color }) => {
              const values = history.map((point) => mentorScore(row.profile.feedback.filter((entry) => periodKey(entry, mode) === point.key), key));
              return <figure key={key} className="history-chart"><figcaption>{label}</figcaption>
                {values.some((value) => value !== null) ? <LineChart className="mentor-line" points={[{ label, color, values }]} labels={history.map((point) => point.shortLabel)} width={290} height={125} /> : <p className="insight-empty">Нет оценок</p>}
              </figure>;
            })}
          </div>
        </section>
        {period && <section className="drawer-block followup">
          <h4>Действия HR</h4>
          {note && <p className="review-note">{note}</p>}
          <details><summary>{note ? "Изменить запись" : "Обсудить"}</summary>
            <form onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (!text) return;
              setNote(text);
              try { localStorage.setItem(key, text); setStatus("Запись сохранена в этом браузере."); }
              catch { setStatus("Запись сохранена до закрытия карточки."); }
            }}>
              <label>Следующий шаг<textarea required maxLength={400} value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
              <button type="submit">Сохранить запись</button>
            </form>
          </details>
          {status && <p className="save-status" role="status">{status}</p>}
        </section>}
      </div>
    </dialog>
  );
}
