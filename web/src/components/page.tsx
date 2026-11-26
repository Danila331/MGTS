"use client";

import { AlertCircle, ArrowLeft, Inbox, LockKeyhole, RefreshCw } from "lucide-react";
import Link from "next/link";
import { AppShell, PageBar } from "@/components/app-shell";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Page({ title, subtitle, actions, children, roles = ["hr", "manager", "mentor", "intern"], wide = false }: { title: React.ReactNode; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; roles?: Role[]; wide?: boolean }) {
  const { actor } = useApp();
  return <AppShell><PageBar title={title} subtitle={subtitle}>{actions}</PageBar>{roles.includes(actor.role) ? <div className="min-h-0 flex-1 overflow-y-auto"><div className={cn("mx-auto w-full p-3 sm:p-5 lg:p-6", wide ? "max-w-[1600px]" : "max-w-[1280px]")}>{children}</div></div> : <Forbidden />}</AppShell>;
}
export function Panel({ title, note, action, children, className }: { title?: React.ReactNode; note?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={cn("min-w-0 rounded-xl border bg-card", className)}>{(title || action) && <header className="flex min-h-12 items-start justify-between gap-3 border-b px-4 py-3"><div>{title && <h2 className="text-[14px] leading-5 font-semibold">{title}</h2>}{note && <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground">{note}</p>}</div>{action}</header>}<div className="p-4">{children}</div></section>;
}
export function Metric({ label, value, delta, note }: { label: string; value: string | number; delta?: number; note?: string }) {
  return <div className="min-w-0 border-b border-r p-4 even:border-r-0 nth-3:border-b-0 nth-4:border-b-0 sm:border-b-0 sm:last:border-r-0"><p className="text-[12px] text-muted-foreground">{label}</p><div className="mt-2 flex items-baseline gap-2"><span className="tnum text-[26px] leading-none font-medium tracking-[-0.03em]">{value}</span>{delta !== undefined && <span className={cn("tnum text-[12px]", delta >= 0 ? "text-success" : "text-destructive")}>{delta > 0 ? "+" : ""}{delta.toFixed(1)}</span>}</div>{note && <p className="mt-2 text-[11px] text-muted-foreground">{note}</p>}</div>;
}
export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" | "brand" }) {
  const tones = { neutral: "bg-secondary text-secondary-foreground", success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", danger: "bg-destructive-soft text-destructive", info: "bg-info-soft text-info", brand: "bg-brand-soft text-brand-text" };
  return <span className={cn("inline-flex min-h-5 shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap", tones[tone])}>{children}</span>;
}
export function Avatar({ name, initials, className }: { name?: string; initials: string; className?: string }) { return <span title={name} className={cn("flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-medium text-secondary-foreground", className)}>{initials}</span>; }
export function LoadingState({ rows = 5 }: { rows?: number }) { return <div className="space-y-3" role="status" aria-label="Загрузка данных"><Skeleton className="h-5 w-44" />{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>; }
export function EmptyState({ title = "Здесь пока пусто", text, action }: { title?: string; text: string; action?: React.ReactNode }) { return <div className="flex min-h-48 flex-col items-center justify-center px-5 py-10 text-center"><Inbox className="size-5 text-muted-foreground" /><h3 className="mt-3 text-[14px] font-medium">{title}</h3><p className="mt-1 max-w-md text-[13px] text-muted-foreground">{text}</p>{action && <div className="mt-4">{action}</div>}</div>; }
export function ErrorState({ error, retry }: { error: ApiError | Error | null; retry?: () => void }) { return <div className="m-4 rounded-xl border border-destructive/30 bg-destructive-soft p-5"><AlertCircle className="size-5 text-destructive" /><h2 className="mt-3 text-sm font-semibold">Не удалось загрузить данные</h2><p className="mt-1 text-[13px] text-muted-foreground">{error?.message ?? "Неизвестная ошибка"}. Сохранённые черновики не потеряны.</p>{retry && <Button className="mt-4" variant="outline" size="sm" onClick={retry}><RefreshCw />Повторить</Button>}</div>; }
export function Forbidden() { const { actor, demo } = useApp(); const home = actor.role === "intern" ? "/me" : "/dashboard"; return <div className="flex flex-1 flex-col items-center justify-center p-6 text-center"><LockKeyhole className="size-6 text-muted-foreground" /><h2 className="mt-4 text-base font-semibold">Недостаточно прав</h2><p className="mt-2 max-w-sm text-[13px] text-muted-foreground">{demo ? "Раздел скрыт для текущей демо-роли. Переключите актора в нижней части боковой панели." : "Этот раздел недоступен для вашей учётной записи."}</p><Link href={home} className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm hover:bg-muted"><ArrowLeft className="size-4" />{actor.role === "intern" ? "Моя стажировка" : "К обзору"}</Link></div>; }
export function InsufficientData({ text = "Нужны минимум две сопоставимые волны для изменения и три — для тренда." }: { text?: string }) { return <div className="rounded-lg bg-muted px-3 py-2.5 text-[12px] text-muted-foreground" role="note">{text}</div>; }
