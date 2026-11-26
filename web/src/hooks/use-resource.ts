"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

export function useResource<T>(loader: () => Promise<T>, dependencies: readonly unknown[] = [], refreshInterval = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const loaderRef = useRef(loader);
  const pending = useRef(false);
  useEffect(() => { loaderRef.current = loader; }, [loader]);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    pending.current = true;
    const timer = setTimeout(() => {
      setLoading(true);
      Promise.resolve().then(() => loaderRef.current()).then((value) => {
        if (active) { setData(value); setError(null); }
      }).catch((reason: unknown) => {
        if (active) setError(reason instanceof ApiError ? reason : new ApiError(500, reason instanceof Error ? reason.message : "Не удалось загрузить данные"));
      }).finally(() => {
        if (active) { pending.current = false; setLoading(false); }
      });
    }, 0);
    return () => { active = false; clearTimeout(timer); };
    // Список зависимостей задаёт экран; loader всегда берётся актуальный.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, version]);
  useEffect(() => {
    if (!refreshInterval) return;
    const refresh = () => {
      if (!pending.current && document.visibilityState === "visible") reload();
    };
    const timer = window.setInterval(refresh, refreshInterval);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refreshInterval, reload]);
  return { data, error, loading, reload, setData };
}
