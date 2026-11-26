export const analyticsMarkup = `
<style>
:host {
  display: block;
  container-type: inline-size;
  --ink: var(--foreground);
  --white: var(--card);
  --page: var(--surface);
  --blue: var(--info);
  --rust: var(--destructive);
  --analytics-clarity: var(--chart-1);
  --analytics-support: var(--chart-4);
  --analytics-workload: var(--chart-2);
  color: var(--foreground);
  font: 400 14px/1.45 var(--font-geist), ui-sans-serif, system-ui, sans-serif;
}
*, *::before, *::after { box-sizing: border-box; }

button { font: inherit; cursor: pointer; }
button:disabled { cursor: default; }
button:focus-visible, summary:focus-visible, a:focus-visible { outline: 2px solid var(--ring); outline-offset: 3px; }
[hidden] { display: none !important; }
h2, h3, h4, p, figure, blockquote { margin: 0; }
svg { display: block; }
small { font-size: .8125rem; }
.page { padding-block: 0 24px; }
.page-head { margin-bottom: 16px; }
.page-head h2 { font-size: 22px; line-height: 1.2; font-weight: 650; letter-spacing: -.025em; }
.page-head p { margin-top: 5px; color: var(--muted-foreground); font-size: 13px; }
.visuals { display: grid; grid-template-columns: minmax(0, 1.68fr) minmax(0, 1fr); gap: 16px; align-items: stretch; }
h3 { font-size: 15px; line-height: 1.35; font-weight: 650; letter-spacing: -.01em; }
.chart-head { display: flex; justify-content: space-between; align-items: start; gap: 16px; }
.chart-head p { margin-top: 7px; font-size: .86rem; color: var(--muted-foreground); }

.scale-note { flex: none; border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; color: var(--muted-foreground); font-size: .75rem; }
.queue { margin-top: 29px; }
.queue-head { display: flex; justify-content: space-between; align-items: end; gap: 10px; margin-bottom: 12px; }
.queue-head p { font-size: .82rem; color: var(--muted-foreground); text-align: right; }
.queue-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.queue-button { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 11px; align-content: start; min-width: 0; text-align: left; background: var(--white); color: var(--ink); border: 1px solid var(--border); border-radius: 11px; padding: 13px 15px; }
.queue-button:hover { border-color: var(--ring); background: var(--accent); }
.queue-button span { font-size: .86rem; }
.queue-button strong { font-size: .94rem; }
.queue-button small { color: var(--muted-foreground); grid-column: 1 / -1; }
.queue-button .queue-score { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }
.stages { margin-bottom: 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--white); }
.queue-groups { display: grid; gap: 15px; }
.queue-group h4 { font-size: .875rem; font-weight: 650; margin-bottom: 6px; }
.queue-group[data-kind="issue"] h4, .queue-meta-issue { color: var(--rust); }
.queue-group[data-kind="growth"] h4 { color: var(--success); }
.queue-group[data-kind="growth"] .queue-button { border-inline-start: 3px solid var(--tone-success); }
.queue-group[data-kind="issue"] .queue-button { border-inline-start: 3px solid var(--tone-danger); }
.queue-button .queue-status { grid-column: 1 / -1; font-size: .75rem; font-weight: 650; }
.ai-quotes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 9px; }
.ai-quotes blockquote { margin-top: 5px; border-left: 2px solid var(--border); padding-left: 8px; font-size: .83rem; }
.ai .meta { margin-top: 6px; }
.followup summary { cursor: pointer; color: var(--blue); font-weight: 650; }
.followup label { display: grid; gap: 5px; margin-block: 10px; font-size: .875rem; }
.followup textarea { background: var(--field); resize: vertical; width: 100%; min-height: 75px; padding: 8px; font: inherit; border: 1px solid var(--input); border-radius: 7px; color: var(--ink); }
.followup button { background: var(--primary); border: 0; border-radius: 7px; color:var(--primary-foreground); padding: 8px 12px; font-size: .875rem; }
.review-note { margin-top: 7px; font-size: .875rem; white-space: pre-wrap; overflow-wrap: anywhere; }
.save-status { color: var(--muted-foreground); font-size: .82rem; }
@container (max-width: 560px) {
  .ai-quotes { grid-template-columns: 1fr; gap: 5px; }
}
.empty { background: var(--white); border: 1px solid var(--border); padding: 15px; border-radius: 11px; color: var(--muted-foreground); grid-column: 1/-1; font-size: .875rem; }
dialog { margin: 0 0 0 auto; position: fixed; inset: 0 0 0 auto; width: min(590px, 100%); max-width: none; max-height: 100%; height: 100%; border: 0; background: var(--surface); color: var(--ink); padding: 0; overscroll-behavior: contain; }
dialog[open] { border-inline-start: 1px solid var(--border); box-shadow: var(--shadow-pop); }
dialog::backdrop { background: rgb(0 0 0 / 0.45); }

.drawer-head { position: sticky; top: 0; z-index: 1; background: var(--white); border-bottom: 1px solid var(--border); padding: 16px 25px; display: flex; justify-content: space-between; gap: 10px; align-items: start; }
.drawer-head h3 { margin-top: 3px; font-size: 20px; }
.drawer-head .meta, .drawer-block .meta { color: var(--muted-foreground); font-size: .8rem; }
.close { display: grid; place-items: center; width: 42px; height: 42px; border: 1px solid var(--border); border-radius: 8px; background: var(--white); color: var(--ink); font-size: 1.4rem; line-height: 1; }
.close:hover { background: var(--page); }
.drawer-content { padding: 19px 25px 31px; display: grid; gap: 15px; }
.numbers { display: flex; flex-wrap: wrap; gap: 8px 15px; color: var(--muted-foreground); font-size: .86rem; }
.numbers strong { color: var(--ink); font-size: 1.1rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.drawer-block { background: var(--white); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
.ai { background: var(--info-soft); border-color: var(--border); }
.drawer-block h4 { font-size: 1.08rem; font-weight: 700; }
.ai .ai-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.ai-lead { font-size: 1.13rem; letter-spacing: -.025em; font-weight: 700; line-height: 1.25; }
.ai-body, .ai-action { margin-top: 8px; font-size: .9rem; }
.ai-action { border-top: 1px solid var(--border); padding-top: 9px; }
.ai-action strong { font-weight: 700; }
.metric-key { margin: 5px 0 10px; color: var(--muted-foreground); font-size: .78rem; }
.metric-list { display: grid; gap: 6px; }
.metric { display: grid; grid-template-columns: minmax(6.5rem, 1.15fr) minmax(3rem, 1fr) 1.4rem; align-items: center; gap: 9px; font-size: .77rem; }
.metric-track { height: 7px; border-radius: 4px; position: relative; background: var(--dim); }
.metric-bar { height: 100%; border-radius: 4px; background: var(--analytics-clarity); }
.metric.is-signal .metric-bar { background: var(--tone-danger); }
.metric-reference { position: absolute; top: -3px; height: 13px; width: 2px; transform: translateX(-1px); background: var(--foreground); }
.metric strong { justify-self: end; font-variant-numeric: tabular-nums; }
.evidence h4 { margin-bottom: 8px; }
.evidence details + details { border-top: 1px solid var(--border); }
.evidence summary { padding: 9px 0; cursor: pointer; font-size: .86rem; font-weight: 600; }
.evidence blockquote { border-left: 2px solid var(--border); padding-left: 10px; font-size: .88rem; margin: 0 0 10px; }
.evidence small { display: block; color: var(--muted-foreground); margin-top: 5px; }
.case-history svg { width: 100%; margin-top: 8px; }

.metric-chart, .insight-panel { min-width:0; background:var(--card); border:1px solid var(--border); border-radius:12px; padding:16px; }
.metric-chart .chart-head p, .insight-sub { color:var(--muted-foreground); font-size:13px; margin-top:5px; }
.metric-controls { display:flex; flex-wrap:wrap; gap:6px; margin:20px 0 12px; }
.metric-controls button { border:1px solid var(--border); border-radius:7px; background:var(--card); color:var(--ink); padding:8px 10px; font-size:.8rem; }
.metric-dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:6px; background:var(--analytics-clarity); }
.metric-dot.support { background:var(--analytics-support); }
.metric-dot.workload { background:var(--analytics-workload); }
.primary-figure svg { width:100%; height:auto; display:block; }
.primary-figure figcaption { color:var(--muted-foreground); font-size:.78rem; text-align:right; }
.chart-foot { border-top:1px solid var(--border); padding-top:12px; margin-top:14px; color:var(--muted-foreground); font-size:.8rem; }
.insight-section { padding:15px 0; border-bottom:1px solid var(--border); }
.insight-section:last-child { border-bottom:0; }
.insight-section h4 { font-size:.88rem; margin-bottom:7px; }
.insight-toggle { width:100%; display:flex; justify-content:space-between; gap:10px; align-items:center; background:none; border:0; border-radius:6px; padding:7px 0; text-align:left; color:var(--ink); font-size:.85rem; }
.insight-toggle strong { white-space:nowrap; font-variant-numeric:tabular-nums; }
.insight-toggle:hover { color:var(--blue); }
.insight-list { display:grid; gap:5px; padding:4px 0 8px; }
.insight-person { text-align:left; background:var(--surface); color:var(--ink); border:0; border-radius:6px; padding:8px 10px; font-size:.83rem; }
.insight-person:hover { background:var(--accent); }
.insight-empty { color:var(--muted-foreground); font-size:.83rem; }
.case-select { width:100%; margin-top:9px; border:1px solid var(--border); border-radius:6px; padding:8px; font:inherit; color:var(--ink); background:var(--card); }
@container (max-width: 790px) { .metric-chart, .insight-panel { padding:14px; } }

.additional-charts { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:16px; margin-top:16px; }
.data-panel { min-width:0; background:var(--card); border:1px solid var(--border); border-radius:12px; padding:16px; }
.data-panel .chart-head p { margin-top:7px; color:var(--muted-foreground); font-size:13px; }
.distribution-legend { display:flex; flex-wrap:wrap; gap:10px 16px; margin:18px 0 22px; color:var(--muted-foreground); font-size:.78rem; }
.distribution-legend span { display:inline-flex; align-items:center; gap:6px; }
.distribution-legend i { width:9px; height:9px; border-radius:50%; background:var(--muted); }
.distribution-legend i.low { background:var(--tone-danger); }
.distribution-legend i.high { background:var(--info); }
.distribution-row { margin-bottom:17px; }
.distribution-row h4 { margin-bottom:6px; font-size:.85rem; font-weight:600; }
.distribution-bars { display:flex; height:35px; border-radius:7px; overflow:hidden; background:var(--surface); }
.distribution-bars button { min-width:38px; border:0; border-right:2px solid var(--card); background:var(--muted); color:var(--foreground); font-size:.8rem; font-weight:700; }
.distribution-bars button[data-value="1"], .distribution-bars button[data-value="2"] { background:var(--destructive-soft); color:var(--destructive); }
.distribution-bars button[data-value="4"], .distribution-bars button[data-value="5"] { background:var(--info-soft); color:var(--info); }
.distribution-bars button[aria-expanded="true"] { box-shadow:inset 0 0 0 3px var(--foreground); }
.distribution-bars button:focus-visible { outline-offset: -3px; }
.distribution-values { display:flex; gap:8px; min-height:24px; flex-wrap:wrap; margin-top:7px; }
.distribution-values button { border:0; border-radius:5px; background:var(--accent); color:var(--ink); padding:4px 8px; font-size:.78rem; }
.chart-caption { color:var(--muted-foreground); font-size:.78rem; margin-top:12px; }
.comparison-legend { display:flex; gap:16px; flex-wrap:wrap; margin:18px 0 10px; font-size:.78rem; color:var(--muted-foreground); }
.comparison-legend span { display:flex; align-items:center; gap:6px; }
.comparison-legend i { width:10px; height:10px; border-radius:50%; background:var(--info); }
.comparison-legend i.mentor { border-radius:2px; background:var(--analytics-support); }
.comparison-row { width:100%; display:grid; grid-template-columns:65px minmax(0,1fr) 60px; gap:10px; align-items:center; padding:6px 0; border:0; background:transparent; color:var(--ink); text-align:left; font-size:.8rem; }
.comparison-row:hover { color:var(--blue); }
.comparison-axis { position:relative; height:28px; margin:0 8px; background:repeating-linear-gradient(to right, var(--border) 0 1px, transparent 1px 25%); }
.comparison-connector { position:absolute; top:13px; height:2px; background:var(--ring); }
.comparison-point { position:absolute; top:7px; width:14px; height:14px; transform:translateX(-50%); border-radius:50%; background:var(--info); border:2px solid var(--card); }
.comparison-point.mentor { top:12px; border-radius:3px; background:var(--analytics-support); }
.comparison-ticks { display:grid; grid-template-columns:65px minmax(0,1fr) 60px; gap:10px; color:var(--muted-foreground); font-size:.72rem; }
.comparison-ticks div { display:flex; justify-content:space-between; margin:0 8px; }
.comparison-values { text-align:right; font-variant-numeric:tabular-nums; }
.comparison-more { margin-top:10px; border:1px solid var(--border); border-radius:6px; padding:7px 10px; background:var(--card); color:var(--blue); font:inherit; font-size:.8rem; }
@container (max-width:790px) { .additional-charts { grid-template-columns:1fr; } .data-panel { padding:14px; } }

.toolbar { display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px 18px; margin-bottom:8px; }
.view-switch, .dataset-switch { display:flex; gap:6px; flex-wrap:wrap; }
.view-switch button, .dataset-switch button { border:1px solid var(--border); border-radius:7px; background:var(--card); color:var(--ink); padding:8px 12px; font-size:13px; }
.date-disclaimer { color:var(--muted-foreground); font-size:.78rem; margin-bottom:12px; }
.calendar-periods { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); padding:7px; gap:4px; }
.calendar-periods button { min-height:40px; border:1px solid transparent; border-radius:7px; background:transparent; color:var(--ink); font:inherit; font-size:.85rem; }
.calendar-periods button[aria-pressed="true"] { background:var(--accent); border-color:var(--border); color:var(--foreground); font-weight:700; }
.calendar-periods button:hover { background:var(--accent); }
@container (max-width:560px) { .calendar-periods { grid-template-columns:repeat(3,minmax(0,1fr)); } }

.topic-chart, .department-chart { display:grid; gap:8px; margin-top:22px; }
.topic-row, .department-row { display:grid; grid-template-columns:minmax(125px, 1.15fr) minmax(70px, 1fr) auto; align-items:center; gap:10px; width:100%; border:0; border-radius:6px; padding:8px 4px; background:transparent; color:var(--ink); font:inherit; font-size:.83rem; text-align:left; }
.topic-row:hover, .department-row:hover { background:var(--surface); }
.topic-row[aria-expanded="true"], .department-row[aria-expanded="true"] { background:var(--accent); }
.topic-bar, .department-bar { height:9px; background:var(--muted); border-radius:6px; overflow:hidden; }
.topic-bar i, .department-bar i { display:block; height:100%; border-radius:6px; background:var(--analytics-clarity); }
.topic-row strong, .department-row strong { white-space:nowrap; font-size:.8rem; font-variant-numeric:tabular-nums; }
.topic-people, .department-people { display:flex; flex-wrap:wrap; gap:6px; padding:3px 0 8px; }
.topic-people button, .department-people button { border:0; border-radius:5px; padding:6px 9px; background:var(--accent); color:var(--ink); font-size:.8rem; }
@container (max-width:400px) { .topic-row, .department-row { grid-template-columns:minmax(95px, 1fr) minmax(45px, 1fr) auto; } }

.ranking-section { margin-top:32px; }
.ranking-section .queue-head p { text-align:left; margin-top:5px; }
.rank-legend { display:flex; flex-wrap:wrap; gap:6px; margin:16px 0 6px; }
.rank-key { font-size:.75rem; font-weight:700; border-radius:5px; padding:4px 8px; }
.rank-5 { background:var(--success-soft); color:var(--success); }
.rank-key.rank-5, .rank-badge.rank-5 { box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--success) 45%, transparent); }
.rank-4 { background:var(--success-soft); color:var(--success); }
.rank-3 { background:var(--info-soft); color:var(--info); }
.rank-2 { background:var(--warning-soft); color:var(--warning); }
.rank-1 { background:var(--destructive-soft); color:var(--destructive); }
.rank-note { color:var(--muted-foreground); font-size:.78rem; margin-bottom:12px; }
.ranking-scroll { max-width:100%; overflow-x:auto; border:1px solid var(--border); border-radius:12px; background:var(--card); }
.ranking-table { border-collapse:collapse; min-width:1020px; width:100%; font-size:13px; font-variant-numeric:tabular-nums; }
.ranking-table th, .ranking-table td { text-align:left; padding:12px 10px; border-bottom:1px solid var(--border); white-space:nowrap; }
.ranking-table th { color:var(--muted-foreground); font-size:.75rem; font-weight:600; vertical-align:bottom; }
.ranking-table th button { border:0; background:transparent; padding:0; color:inherit; text-align:left; font:inherit; }
.ranking-table th[aria-sort] button { color:var(--blue); }
.ranking-table td button { border:0; background:transparent; padding:0; color:var(--blue); font:inherit; font-weight:700; }
.ranking-table tbody tr:last-child td { border-bottom:0; }
.ranking-table tbody tr.rank-5 { background:color-mix(in srgb, var(--success) 8%, var(--card)); }
.ranking-table tbody tr.rank-4 { background:color-mix(in srgb, var(--success) 4%, var(--card)); }
.ranking-table tbody tr.rank-3 { background:color-mix(in srgb, var(--info) 3%, var(--card)); }
.ranking-table tbody tr.rank-2 { background:color-mix(in srgb, var(--warning) 5%, var(--card)); }
.ranking-table tbody tr.rank-1 { background:color-mix(in srgb, var(--destructive) 5%, var(--card)); }
.ranking-table .rank-badge { display:inline-block; border-radius:5px; padding:4px 7px; font-weight:700; }
.topic-bar { display:flex; background:transparent; gap:2px; }
.topic-bar i.topic-negative { background:var(--tone-danger); }
.topic-bar i.topic-positive { background:var(--tone-success); }
.topic-legend { display:flex; gap:16px; flex-wrap:wrap; font-size:.78rem; color:var(--muted-foreground); margin-top:15px; }
.topic-legend span { display:flex; align-items:center; gap:6px; }
.topic-legend i { width:9px; height:9px; border-radius:50%; background:var(--tone-danger); }
.topic-legend i.positive { background:var(--tone-success); }

@container (max-width: 1080px) {
  .visuals { grid-template-columns: minmax(0, 1.42fr) minmax(0, 1fr); }
  .queue-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container (max-width: 790px) {
  .visuals { grid-template-columns: minmax(0, 1fr); }
}
@container (max-width: 560px) {
  .chart-head { flex-wrap: wrap; gap: 7px; }
  .queue-list { grid-template-columns: minmax(0, 1fr); }
  .drawer-head, .drawer-content { padding-inline: 15px; }
  .primary-figure svg text { font-size: 20px; }
  .primary-figure svg .count-label { font-size: 17px; }
  .case-history svg text { font-size: 14px; }
}

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; } }
.dataset-switch button, .view-switch button, .metric-controls button {
  min-height: 36px;
  transition: background-color .15s;
}
.dataset-switch button:hover, .view-switch button:hover, .metric-controls button:hover { background: var(--accent); }
.dataset-switch button[aria-pressed="true"], .view-switch button[aria-pressed="true"],
.metric-controls button[aria-pressed="true"] {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-foreground);
  font-weight: 650;
}
.metric-controls button[aria-pressed="true"] .metric-dot { outline: 1px solid currentColor; }
.ranking-table td { color: var(--foreground); }
.ranking-table th button, .ranking-table td button { min-height: 26px; }
.rank-key, .rank-badge { font-variant-numeric: tabular-nums; }
.ranking-scroll:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.dialog-field-label { display: block; color: var(--muted-foreground); margin-top: 8px; }
</style>
<div class="page">
  <div class="page-head">
    <h2>Аналитика стажировок</h2>
    <p id="population-caption" aria-live="polite">Историческая выборка организаторов · 5 стажёров</p>
  </div>
  <div class="toolbar">
    <div class="dataset-switch" role="group" aria-label="Выбор данных">
      <button type="button" data-dataset="organizers" aria-pressed="true">Организаторы · 5</button>
      <button type="button" data-dataset="demo" aria-pressed="false">Демо · 50</button>
    </div>
    <div class="view-switch" role="group" aria-label="Режим дашборда">
      <button type="button" data-view="calendar" aria-pressed="true">По календарю</button>
      <button type="button" data-view="stage" aria-pressed="false">По этапам</button>
    </div>
  </div>
  <p class="date-disclaimer" id="dataset-note">Оценки и ответы взяты из материалов организаторов. Даты начала и отправки анкет демонстрационные.</p>
  <nav class="stages" aria-label="Период дашборда" id="period-navigation"></nav>
  <div class="visuals">
    <section class="metric-chart" aria-labelledby="metric-title">
      <div class="chart-head"><div><h3 id="metric-title">Как проходит стажировка</h3>
        <p id="chart-description">Оценки стажёров по датам ответа · среднее по каждому вопросу</p></div><span class="scale-note">Шкала 1–5</span></div>
      <div class="metric-controls" role="group" aria-label="Выбор показателя">
        <button type="button" data-metric="all" aria-pressed="true">Все показатели</button>
        <button type="button" data-metric="0" aria-pressed="false"><i class="metric-dot clarity"></i>Понятность задач</button>
        <button type="button" data-metric="1" aria-pressed="false"><i class="metric-dot support"></i>Поддержка</button>
        <button type="button" data-metric="2" aria-pressed="false"><i class="metric-dot workload"></i>Нагрузка</button>
      </div>
      <figure class="primary-figure"><div id="primary-chart"></div><figcaption id="chart-axis">Календарный месяц</figcaption></figure>
      <p class="chart-foot" id="coverage"></p>
    </section>
    <aside class="insight-panel" aria-labelledby="insight-title">
      <h3 id="insight-title">Что проверить</h3>
      <p class="insight-sub" id="insight-period"></p>
      <div id="insights"></div>
    </aside>
  </div>
  <div class="additional-charts">
    <section class="data-panel" aria-labelledby="distribution-title">
      <div class="chart-head"><div><h3 id="distribution-title">Распределение оценок</h3>
        <p>Ответы стажёров за выбранный период</p></div></div>
      <div id="score-distribution"></div>
      <p class="chart-caption">Выберите оценку, чтобы увидеть стажёров</p>
    </section>
    <section class="data-panel" aria-labelledby="comparison-title">
      <div class="chart-head"><div><h3 id="comparison-title">Понимание задач</h3>
        <p>Ответы стажёра и наставника за выбранный период</p></div></div>
      <div id="comparison-chart"></div>
      <p class="chart-caption">Вопросы близкие по смыслу, формулировки различаются</p>
    </section>
  </div>
  <div class="additional-charts">
    <section class="data-panel" aria-labelledby="themes-title">
      <div class="chart-head"><div><h3 id="themes-title">Темы обратной связи</h3>
        <p>Подтверждённые цитатами темы за выбранный период</p></div></div>
      <div id="themes-chart"></div>
      <p class="chart-caption">Выберите тему, чтобы увидеть стажировки</p>
    </section>
    <section class="data-panel" aria-labelledby="departments-title">
      <div class="chart-head"><div><h3 id="departments-title">Направления и поддержка</h3>
        <p>Оценка поддержки наставника по ответам стажёров</p></div></div>
      <div id="departments-chart"></div>
      <p class="chart-caption">Число ответов указано рядом. Выберите направление, чтобы открыть стажировки</p>
    </section>
  </div>
  <section class="queue" aria-labelledby="queue-title">
    <div class="queue-head"><h3 id="queue-title">Темы в анкетах</h3><p id="queue-meta" aria-live="polite"></p></div>
    <div class="queue-groups" id="queue-list"></div>
  </section>
  <section class="ranking-section" aria-labelledby="ranking-title">
    <div class="queue-head"><div><h3 id="ranking-title">Все стажёры</h3>
      <p id="ranking-summary">Оценки наставников за выбранный период</p></div></div>
    <div class="rank-legend" aria-label="Группы перцентилей">
      <span class="rank-key rank-5">90–100</span><span class="rank-key rank-4">70–90</span>
      <span class="rank-key rank-3">50–70</span><span class="rank-key rank-2">20–50</span>
      <span class="rank-key rank-1">0–20</span>
    </div>
    <p class="rank-note" id="ranking-explanation"></p>
    <div class="ranking-scroll" role="region" aria-labelledby="ranking-title" tabindex="0"><table class="ranking-table">
      <thead id="ranking-head"></thead><tbody id="ranking-body"></tbody>
    </table></div>
  </section>
</div>
<dialog id="drawer" aria-labelledby="case-title">
  <header class="drawer-head">
    <div><p class="meta" id="case-meta"></p><h3 id="case-title"></h3></div>
    <button type="button" class="close" id="close-case" aria-label="Закрыть карточку" autofocus>×</button>
  </header>
  <div class="drawer-content" id="case-content"></div>
</dialog>
`;
