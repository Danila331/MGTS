"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/app-provider";
import { InternDirectory, type InternSort } from "@/components/intern-directory";
import { ErrorState, LoadingState, Page, Panel } from "@/components/page";
import { useResource } from "@/hooks/use-resource";
import { get } from "@/lib/api";
import type { InternItem } from "@/lib/types";

const validSort = (value: string | null): InternSort => value === "score" || value === "name" ? value : "percentile";

export function InternsView() {
  const { actor } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const search = params.get("search") ?? "";
  const department = params.get("department") ?? "";
  const sort = validSort(params.get("sort"));
  const query = `/interns?search=${encodeURIComponent(search)}&department=${encodeURIComponent(department)}&sort=${sort}`;
  const { data, error, loading, reload } = useResource(() => get<{ items: InternItem[]; total: number }>(query), [query, actor.id]);
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  return <Page title="Стажёры" subtitle={data ? `${data.total} в области доступа` : "Рейтинг программы"} roles={["hr", "manager", "mentor"]}>
    <div className="space-y-4"><div><h2 className="text-[22px] font-semibold tracking-[-0.025em]">Все стажёры</h2><p className="mt-1 text-[13px] text-muted-foreground">{actor.role === "mentor" ? "Только закреплённые за вами участники." : "Полный список участников с одинаковыми данными для HR и руководителя."}</p></div>
      {loading && !data ? <LoadingState rows={6} /> : error && !data ? <ErrorState error={error} retry={reload} /> : <Panel title="Рейтинг" note="Перцентиль показан диапазоном, без излишней точности">
        <InternDirectory items={data?.items ?? []} search={search} department={department} sort={sort} onSearch={(value) => setFilter("search", value)} onDepartment={(value) => setFilter("department", value)} onSort={(value) => setFilter("sort", value)} onReset={() => router.replace(pathname)} />
      </Panel>}
    </div>
  </Page>;
}
