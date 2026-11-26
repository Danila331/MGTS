"use client";
import { Button } from "@/components/ui/button";
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center"><h1 className="text-xl font-semibold">Не удалось открыть раздел</h1><p className="text-sm text-muted-foreground">Данные не потеряны. Повторите загрузку.</p><Button onClick={reset}>Повторить</Button></main>;
}
