"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { actors as mockActors } from "@/lib/mock-data";
import { get, setApiActor } from "@/lib/api";
import type { Actor, Role } from "@/lib/types";
import { Button } from "@/components/ui/button";

const ACTOR_KEY = "mgts.hr.actor";
interface AppContextValue { actor: Actor; actors: Actor[]; setActor: (id: string) => void; ready: boolean; can: (...roles: Role[]) => boolean; }
const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [actor, setCurrentActor] = useState<Actor>(mockActors[0]);
  const [actorList, setActorList] = useState<Actor[]>(mockActors);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const saved = localStorage.getItem(ACTOR_KEY) ?? "a-hr";
    setApiActor("a-hr");
    get<{ items: Actor[] }>("/actors").then(({ items }) => {
      if (!active) return;
      const next = items.find((item) => item.id === saved) ?? items.find((item) => item.id === "a-hr") ?? items[0];
      setActorList(items); setCurrentActor(next); setApiActor(next.id); setReady(true);
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Не удалось загрузить акторов"); });
    return () => { active = false; };
  }, []);
  const value = useMemo<AppContextValue>(() => ({
    actor, actors: actorList, ready,
    setActor: (id) => {
      const next = actorList.find((item) => item.id === id) ?? actorList[0];
      setCurrentActor(next); setApiActor(next.id); localStorage.setItem(ACTOR_KEY, next.id);
    },
    can: (...roles) => roles.includes(actor.role),
  }), [actor, actorList, ready]);
  if (error) return <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-6 text-center"><h1 className="text-lg font-semibold">Не удалось подключиться к API</h1><p className="max-w-md text-sm text-muted-foreground">{error}</p><Button onClick={() => window.location.reload()}>Повторить</Button></div>;
  return <AppContext.Provider value={value}>{ready ? children : <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground" role="status">Загружаю профиль…</div>}</AppContext.Provider>;
}
export function useApp() { const value = useContext(AppContext); if (!value) throw new Error("useApp must be used inside AppProvider"); return value; }
