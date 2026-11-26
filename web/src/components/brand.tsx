import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return <span aria-hidden className={cn("grid size-6 shrink-0 place-items-center rounded-[7px] bg-foreground text-background", className)}>
    <span className="size-3.5 bg-current [clip-path:polygon(0_62%,28%_62%,53%_12%,67%_12%,81%_40%,100%_40%,100%_57%,70%_57%,61%_39%,39%_82%,0_82%)]" />
  </span>;
}

export function BrandLockup() {
  return <span className="flex min-w-0 items-center gap-2"><BrandMark className="size-[22px]" /><span className="truncate text-[13px] leading-none font-semibold tracking-[0.025em]">МГТС ПУЛЬС</span></span>;
}
