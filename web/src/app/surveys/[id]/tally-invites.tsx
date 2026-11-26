"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/page";
import { Button } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import { get } from "@/lib/api";
import { formatDate } from "@/lib/format";

interface Invites { enabled: boolean; items: { name: string; subject: string; url: string; deadline: string }[] }

export function TallyInvites({ id }: { id: string }) {
  const { data, error, reload } = useResource(() => get<Invites>(`/surveys/${id}/tally-invites`), [id], 12000);
  if (!data && !error) return null;
  return <Panel title="Внешняя анкета Tally">
    {error ? <div className="space-y-2"><p role="status" className="text-sm text-destructive">{error.message}</p><Button variant="outline" size="sm" onClick={reload}>Повторить</Button></div>
      : !data?.enabled ? <p className="text-sm text-muted-foreground">Интеграция не подключена.</p>
        : !data.items.length ? <p className="text-sm text-muted-foreground">Нет открытых назначений без ответа.</p>
          : <ul className="space-y-2">
            {data.items.map((item) => <li key={item.url} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
              <div><p className="text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.subject} · до {formatDate(item.deadline)}</p></div>
              <Button variant="outline" size="sm" onClick={async () => {
                try { await navigator.clipboard.writeText(item.url); toast.success("Персональная ссылка скопирована"); }
                catch { toast.error("Не удалось скопировать ссылку"); }
              }}><Copy aria-hidden />Скопировать</Button>
            </li>)}
          </ul>}
  </Panel>;
}
