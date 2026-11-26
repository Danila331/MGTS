import { cn } from "@/lib/utils";
export function BrandMark({ className }: { className?: string }) {
  return <span aria-hidden className={cn("flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-brand text-[11px] font-bold text-white", className)}>П</span>;
}
export function BrandLockup() {
  return <span className="flex min-w-0 items-center gap-2"><BrandMark className="size-[22px]" /><span className="truncate text-[14px] leading-none font-semibold tracking-[-0.01em]">Пульс<span className="ml-1.5 font-normal text-muted-foreground">МГТС</span></span></span>;
}
