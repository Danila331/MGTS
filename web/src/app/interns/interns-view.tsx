"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/app-provider";
import { InternDirectory } from "@/components/intern-directory";
import { ErrorState, LoadingState, Page, Panel } from "@/components/page";
import { useResource } from "@/hooks/use-resource";
import { get } from "@/lib/api";
import type { InternItem } from "@/lib/types";
import { AddIntern } from "./add-intern";

export function InternsView() {
  const { actor } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const search = params.get("search") ?? "";
  const department = params.get("department") ?? "";
  const query = `/interns?search=${encodeURIComponent(search)}&department=${encodeURIComponent(department)}&sort=percentile`;
  const { data, error, loading, reload } = useResource(() => get<{ items: InternItem[]; total: number }>(query), [query, actor.id]);
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.delete("sort");
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  return <Page title="Стажёры" subtitle={data ? `${data.total} в области доступа` : "Рейтинг программы"} roles={["hr", "manager", "mentor"]} actions={actor.role === "hr" ? <AddIntern actorID={actor.id} onAdded={(id) => router.push(`/interns/${id}`)} /> : undefined}>
    <div className="space-y-4"><h2 className="text-[22px] font-semibold tracking-[-0.025em]">Стажёры по перцентилю</h2>
      {loading && !data ? <LoadingState rows={6} /> : error && !data ? <ErrorState error={error} retry={reload} /> : <Panel>
        <InternDirectory items={data?.items ?? []} search={search} department={department} sort="percentile" onSearch={(value) => setFilter("search", value)} onDepartment={(value) => setFilter("department", value)} onReset={() => router.replace(pathname)} />
      </Panel>}
    </div>
  </Page>;
}
