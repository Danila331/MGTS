"use client";

import { cn } from "@/lib/utils";

export function LineChart({ points, labels, width = 640, height = 170, className }: { points: { id?: string; label: string; color?: string; values: (number | null)[] }[]; labels?: string[]; width?: number; height?: number; className?: string }) {
  const left = 44; const right = 18; const top = 14; const bottom = height - 28;
  const all = points.flatMap((point) => point.values).filter((value): value is number => value !== null);
  // Единая шкала оценки не растягивает небольшие изменения на весь график.
  const min = Math.min(1, ...all); const max = Math.max(5, ...all); const ticks = [max, (min + max) / 2, min];
  const waveLabels = labels ?? points[0]?.values.map((_, index) => `Месяц ${index + 1}`) ?? [];
  const labelStep = Math.max(1, Math.ceil(waveLabels.length * 53 / (width - left - right)));
  const x = (index: number, length: number) => left + (index / Math.max(1, length - 1)) * (width - left - right);
  const y = (value: number) => bottom - ((value - min) / Math.max(1, max - min)) * (bottom - top);
  const lineSegments = (values: (number | null)[]) => {
    const segments: { start: number; coordinates: string[] }[] = [];
    values.forEach((value, index) => {
      if (value === null) return;
      if (index === 0 || values[index - 1] === null) segments.push({ start: index, coordinates: [] });
      segments.at(-1)?.coordinates.push(`${x(index, values.length)},${y(value)}`);
    });
    return segments.filter(({ coordinates }) => coordinates.length > 1);
  };
  const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
  const colors = points.map((point, index) => point.color ?? palette[index % palette.length]);
  return <div className={cn("min-w-0", className)}>
    <p className="mb-1 text-[11px] text-muted-foreground">Шкала {min.toFixed(0)}–{max.toFixed(0)}</p>
    <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full overflow-visible" role="img" aria-label={`Динамика по месяцам, шкала от ${min} до ${max}`}>
      {ticks.map((tick) => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeWidth="1" /><text x={left - 7} y={y(tick) + 3} textAnchor="end" fill="var(--muted-foreground)" fontSize="11">{tick.toFixed(1)}</text></g>)}
      {points.map((point, index) => <g key={point.id ?? point.label}>{lineSegments(point.values).map(({ start, coordinates }) => <polyline key={start} points={coordinates.join(" ")} fill="none" stroke={colors[index]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}{point.values.map((value, i) => value === null ? null : <circle key={i} cx={x(i, point.values.length)} cy={y(value)} r="3" fill="var(--card)" stroke={colors[index]} strokeWidth="2"><title>{point.label}: {value.toFixed(1)}</title></circle>)}</g>)}
      {waveLabels.map((label, index) => index % labelStep === 0 && <text key={`${label}-${index}`} x={x(index, waveLabels.length)} y={height - 5} textAnchor={index === 0 ? "start" : index === waveLabels.length - 1 ? "end" : "middle"} fill="var(--muted-foreground)" fontSize="11">{label}</text>)}
    </svg>
    <div className="sr-only"><table><caption>Значения динамики по месяцам</caption><thead><tr><th>Измерение</th>{waveLabels.map((label, index) => <th key={`${label}-${index}`}>{label}</th>)}</tr></thead><tbody>{points.map((point) => <tr key={point.id ?? point.label}><th>{point.label}</th>{point.values.map((value, index) => <td key={index}>{value === null ? "Нет данных" : value.toFixed(1)}</td>)}</tr>)}</tbody></table></div>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{points.map((point, index) => <span key={point.id ?? point.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="size-2 rounded-full" style={{ background: colors[index] }} />{point.label}</span>)}</div>
  </div>;
}
export function Sparkline({ values, positive = true }: { values: number[]; positive?: boolean }) {
  const min = Math.min(...values); const max = Math.max(...values); const points = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 88 + 2},${26 - ((v - min) / Math.max(0.1, max - min)) * 20}`).join(" ");
  return <svg viewBox="0 0 92 30" className={cn("h-8 w-24", positive ? "text-success" : "text-destructive")} aria-hidden><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function ProgressBar({ value, tone = "primary", label }: { value: number; tone?: "primary" | "success" | "warning" | "danger"; label?: string }) {
  return <div className="flex items-center gap-2"><div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-dim" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? `Прогресс ${value}%`}><div className={cn("h-full rounded-full transition-[width]", tone === "primary" && "bg-primary", tone === "success" && "bg-tone-success", tone === "warning" && "bg-tone-warning", tone === "danger" && "bg-tone-danger")} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div><span className="tnum w-8 text-right text-[11px] text-muted-foreground">{value}%</span></div>;
}
export function Distribution({ items }: { items: { label: string; count: number }[] }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return <div className="space-y-3">{items.map((item) => <div key={item.label} className="grid grid-cols-[minmax(80px,140px)_1fr_28px] items-center gap-3 text-[12px]"><span className="truncate">{item.label}</span><div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${item.count / max * 100}%` }} /></div><span className="tnum text-right text-muted-foreground">{item.count}</span></div>)}</div>;
}
