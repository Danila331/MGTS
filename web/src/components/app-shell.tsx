"use client";

import { Check, ChevronsUpDown, Menu, Moon, PanelLeft, Search, Sun, SunMoon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/app-provider";
import { BrandLockup } from "@/components/brand";
import { NAV } from "@/components/nav-items";
import { CommandPalette } from "@/components/command-palette";
import { Shortcut } from "@/components/shortcut";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/use-media-query";
import { roleLabels } from "@/lib/format";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "mgts.sidebar.collapsed";
export const SIDEBAR_ITEM = "group/item flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] text-sidebar-foreground/90 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-foreground";
const ICON = "size-4 shrink-0 text-muted-foreground group-hover/item:text-sidebar-foreground";
interface ShellState { desktop: boolean; sidebarOpen: boolean; setSidebarOpen: (open: boolean) => void; openPalette: () => void; }
const ShellContext = createContext<ShellState>({ desktop: true, sidebarOpen: true, setSidebarOpen: () => {}, openPalette: () => {} });
export const useShell = () => useContext(ShellContext);

function ActorMenu() {
  const { actor, actors, setActor } = useApp();
  const { theme, setTheme } = useTheme();
  return <DropdownMenu>
    <DropdownMenuTrigger render={<button type="button" className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/50" />}>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-medium">{actor.initials}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] leading-tight font-medium">{actor.name}</span><span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">{roleLabels[actor.role]} · демо</span></span>
      <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
    </DropdownMenuTrigger>
    <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-[248px]">
      <DropdownMenuGroup>
        <DropdownMenuLabel>Демо-актор</DropdownMenuLabel>
        {actors.map((item) => <DropdownMenuItem key={item.id} onClick={() => setActor(item.id)} closeOnClick={false}><span className="flex size-6 items-center justify-center rounded-full bg-secondary text-[10px]">{item.initials}</span><span className="min-w-0 flex-1"><span className="block truncate">{item.name}</span><span className="block text-[11px] text-muted-foreground">{roleLabels[item.role]}</span></span>{actor.id === item.id && <Check className="ml-auto" />}</DropdownMenuItem>)}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Внешний вид</DropdownMenuLabel>
        {[{ value: "light", label: "Светлая", icon: Sun }, { value: "dark", label: "Тёмная", icon: Moon }, { value: "system", label: "Системная", icon: SunMoon }].map(({ value, label, icon: Icon }) => <DropdownMenuItem key={value} onClick={() => setTheme(value)} closeOnClick={false}><Icon />{label}{theme === value && <Check className="ml-auto" />}</DropdownMenuItem>)}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { desktop, setSidebarOpen, openPalette } = useShell();
  const { actor } = useApp();
  const items = NAV.filter((item) => item.roles.includes(actor.role));
  const groups = [...new Set(items.map((item) => item.group))];
  return <div className="flex h-full min-h-0 flex-col">
    <div className="flex h-12 shrink-0 items-center gap-2 pr-2 pl-3">
      <Link href={actor.role === "intern" ? "/me" : "/dashboard"} className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50" onClick={onNavigate}><BrandLockup /></Link>
      {desktop && <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-sm" className="ml-auto size-7 text-muted-foreground hover:bg-sidebar-accent" onClick={() => setSidebarOpen(false)} aria-label="Скрыть боковую панель" />}><PanelLeft /></TooltipTrigger><TooltipContent>Скрыть панель <Shortcut keys={["mod", "B"]} /></TooltipContent></Tooltip>}
    </div>
    <div className="shrink-0 px-2 pt-1"><button type="button" className={SIDEBAR_ITEM} onClick={() => { onNavigate?.(); openPalette(); }}><Search className={ICON} /><span className="flex-1 text-left">Поиск и команды</span><Shortcut keys={["mod", "K"]} /></button></div>
    <nav className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Разделы платформы">
      {groups.map((group) => <div key={group} className="mb-3"><SidebarLabel>{group}</SidebarLabel>{items.filter((item) => item.group === group).map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={onNavigate} aria-current={pathname.startsWith(href) ? "page" : undefined} className={SIDEBAR_ITEM}><Icon className={ICON} />{label}</Link>)}</div>)}
    </nav>
    <div className="shrink-0 border-t border-sidebar-border p-2"><ActorMenu /></div>
  </div>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const width = 256;
  const desktop = useMediaQuery("(min-width: 1024px)", true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const router = useRouter();
  useEffect(() => { const timer = setTimeout(() => setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"), 0); return () => clearTimeout(timer); }, []);
  const sidebarOpen = desktop ? !collapsed : mobileOpen;
  const setSidebarOpen = useCallback((open: boolean) => { if (desktop) { setCollapsed(!open); localStorage.setItem(COLLAPSE_KEY, open ? "0" : "1"); } else setMobileOpen(open); }, [desktop]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "k" && !event.shiftKey) { event.preventDefault(); setPalette((value) => !value); }
      if (key === "b" && !event.shiftKey) { event.preventDefault(); setSidebarOpen(!sidebarOpen); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [router, setSidebarOpen, sidebarOpen]);
  const state = useMemo(() => ({ desktop, sidebarOpen, setSidebarOpen, openPalette: () => setPalette(true) }), [desktop, sidebarOpen, setSidebarOpen]);
  return <ShellContext.Provider value={state}><div className="flex h-dvh min-h-0 w-full overflow-hidden">
    {desktop ? <aside className={cn("h-full shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 max-lg:hidden", !sidebarOpen && "border-r-0")} style={{ width: sidebarOpen ? width : 0 }} inert={!sidebarOpen}><div className="h-full" style={{ width }}><SidebarBody /></div></aside>
      : <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetContent side="left" showCloseButton={false} className="w-[288px] max-w-[85vw] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground data-[side=left]:w-[288px]"><SheetTitle className="sr-only">Навигация</SheetTitle><SidebarBody onNavigate={() => setMobileOpen(false)} /></SheetContent></Sheet>}
    <main className="relative flex min-w-0 flex-1 flex-col bg-background">{children}</main>
  </div><Dialog open={palette} onOpenChange={setPalette}><DialogContent showCloseButton={false} className="top-[16vh] translate-y-0 gap-0 overflow-hidden rounded-xl! p-0 sm:max-w-[580px]"><DialogHeader className="sr-only"><DialogTitle>Поиск и команды</DialogTitle><DialogDescription>Разделы, демо-акторы и внешний вид</DialogDescription></DialogHeader>{palette && <CommandPalette close={() => setPalette(false)} />}</DialogContent></Dialog></ShellContext.Provider>;
}

export function PageBar({ title, subtitle, children, className }: { title?: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  const { sidebarOpen, setSidebarOpen, desktop } = useShell();
  return <div className={cn("flex min-h-12 shrink-0 items-center gap-2 border-b border-transparent px-2 sm:px-3", className)}>
    {!sidebarOpen && <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-sm" className="size-9 text-muted-foreground" onClick={() => setSidebarOpen(true)} aria-label="Показать боковую панель" />}>{desktop ? <PanelLeft /> : <Menu />}</TooltipTrigger><TooltipContent>Показать панель</TooltipContent></Tooltip>}
    <div className="flex min-w-0 flex-1 items-baseline gap-2 pl-1">{typeof title === "string" ? <h1 className="truncate text-[14px] font-medium">{title}</h1> : title}{subtitle && <span className="hidden truncate text-[13px] text-muted-foreground md:inline">{subtitle}</span>}</div>
    {children && <div className="flex shrink-0 items-center gap-1">{children}</div>}
  </div>;
}
export function SidebarLabel({ children }: { children: React.ReactNode }) { return <div className="flex h-7 items-center px-2 text-[12px] font-medium text-muted-foreground">{children}</div>; }
