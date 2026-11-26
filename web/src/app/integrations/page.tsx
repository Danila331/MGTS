"use client";

import { Badge, ErrorState, LoadingState, Page, Panel } from "@/components/page";
import { useApp } from "@/components/app-provider";
import { useResource } from "@/hooks/use-resource";
import { get } from "@/lib/api";

export default function IntegrationsPage() {
  const { actor } = useApp();
  return <Page title="Интеграции" roles={["hr"]}>{actor.role === "hr" && <Integrations />}</Page>;
}

function Integrations() {
  const { data, error, reload } = useResource(() => get<{ tally: boolean; huntflow: boolean }>("/integrations/status"), []);
  if (error) return <ErrorState error={error} retry={reload} />;
  if (!data) return <LoadingState rows={2} />;
  return <div className="grid gap-4 md:grid-cols-2">
    <Panel title="Tally" action={<Badge tone={data.tally ? "success" : "neutral"}>{data.tally ? "Настроена" : "Не подключена"}</Badge>}>
      <p className="text-sm text-muted-foreground">Две внешние анкеты. Персональные ссылки доступны в карточке контрольной анкеты.</p>
    </Panel>
    <Panel title="Huntflow" action={<Badge tone={data.huntflow ? "success" : "neutral"}>{data.huntflow ? "Настроена" : "Не подключена"}</Badge>}>
      <p className="text-sm text-muted-foreground">Карточку кандидата можно привязать на странице стажёра. Резюме и комментарии открываются в Huntflow.</p>
    </Panel>
  </div>;
}
