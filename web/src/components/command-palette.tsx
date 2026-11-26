"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useApp } from "@/components/app-provider";
import { NAV } from "@/components/nav-items";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { roleLabels } from "@/lib/format";

export function CommandPalette({ close }: { close: () => void }) {
  const router = useRouter(); const { setTheme } = useTheme(); const { actor, actors, setActor, demo } = useApp();
  const run = (fn: () => void) => { close(); fn(); };
  return <Command className="rounded-none! bg-transparent p-1"><CommandInput placeholder="Найти раздел или выполнить команду…" /><CommandList className="max-h-[min(60vh,420px)]"><CommandEmpty>Ничего не нашлось</CommandEmpty>
    <CommandGroup heading="Разделы">{NAV.filter((item) => item.roles.includes(actor.role)).map(({ href, label, icon: Icon }) => <CommandItem key={href} value={label} onSelect={() => run(() => router.push(href))}><Icon />{label}</CommandItem>)}</CommandGroup>
    {demo && <CommandGroup heading="Демо-акторы">{actors.map((item) => <CommandItem key={item.id} value={`${item.name} ${roleLabels[item.role]}`} onSelect={() => run(() => setActor(item.id))}><span className="flex size-5 items-center justify-center rounded-full bg-secondary text-[9px]">{item.initials}</span>{item.name}<span className="ml-auto text-xs text-muted-foreground">{roleLabels[item.role]}</span></CommandItem>)}</CommandGroup>}
    <CommandGroup heading="Тема">{[{ value: "light", label: "Светлая тема", icon: Sun }, { value: "dark", label: "Тёмная тема", icon: Moon }, { value: "system", label: "Системная тема", icon: SunMoon }].map(({ value, label, icon: Icon }) => <CommandItem key={value} value={label} onSelect={() => run(() => setTheme(value))}><Icon />{label}</CommandItem>)}</CommandGroup>
  </CommandList></Command>;
}
