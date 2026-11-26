import Link from "next/link";
export default function NotFound() { return <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center"><p className="font-mono text-xs text-muted-foreground">404</p><h1 className="text-xl font-semibold">Страница не найдена</h1><Link className="text-sm underline" href="/dashboard">Вернуться к обзору</Link></main>; }
