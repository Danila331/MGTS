"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const fieldClass = "flex min-h-9 w-full rounded-lg border border-input bg-field px-3 py-2 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50";
export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return <label className={cn("block min-w-0", className)}><span className="mb-1.5 block text-[12px] font-medium">{label}</span>{children}{hint && !error && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}{error && <span className="mt-1 block text-[11px] text-destructive" role="alert">{error}</span>}</label>;
}
export function FormDialog({ open, onOpenChange, title, description, children, onSubmit, submitLabel = "Сохранить", busy = false, wide = false }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: React.ReactNode; onSubmit: () => void; submitLabel?: string; busy?: boolean; wide?: boolean }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={wide ? "sm:max-w-[680px]" : undefined}><DialogHeader><DialogTitle>{title}</DialogTitle>{description && <DialogDescription>{description}</DialogDescription>}</DialogHeader><form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="space-y-4">{children}<DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button><Button type="submit" disabled={busy}>{busy ? "Сохраняю…" : submitLabel}</Button></DialogFooter></form></DialogContent></Dialog>;
}
export function Segmented<T extends string>({ value, onChange, items, label, className }: { value: T; onChange: (value: T) => void; items: { value: T; label: string }[]; label: string; className?: string }) {
  return <div className={cn("inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5", className)} role="group" aria-label={label}>{items.map((item) => <button key={item.value} type="button" aria-pressed={value === item.value} onClick={() => onChange(item.value)} className={cn("min-h-8 rounded-md px-3 text-[12px] whitespace-nowrap transition-colors hover:text-foreground", value === item.value ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}>{item.label}</button>)}</div>;
}
