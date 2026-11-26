"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

export function useResource<T>(loader: () => Promise<T>, dependencies: readonly unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const loaderRef = useRef(loader);
  useEffect(() => { loaderRef.current = loader; }, [loader]);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      loaderRef.current().then((value) => { if (active) setData(value); }).catch((reason: unknown) => {
        if (active) setError(reason instanceof ApiError ? reason : new ApiError(500, reason instanceof Error ? reason.message : "Не удалось загрузить данные"));
      }).finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; clearTimeout(timer); };
    // Список зависимостей задаёт экран; loader всегда берётся актуальный.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, version]);
  return { data, error, loading, reload, setData };
}
