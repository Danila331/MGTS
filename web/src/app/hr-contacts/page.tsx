"use client";

import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { EmptyState, ErrorState, LoadingState, Page, Panel } from "@/components/page";
import { useResource } from "@/hooks/use-resource";
import { get, getApiMode } from "@/lib/api";
import { formatDate, roleLabels } from "@/lib/format";
import type { Role } from "@/lib/types";

type Contact = { id: string; internship_id: string; sender_name: string; sender_role: Role; message: string; created_at: string };

export default function HRContactsPage() {
  const { actor } = useApp();
  return <Page title="Обращения к HR" roles={["hr"]}>
    {actor.role === "hr" && (getApiMode() === "mock"
      ? <EmptyState title="Нет подключения к Пульсу" text="Для просмотра обращений нужен сервер Пульса." />
      : <Inbox key={actor.id} />)}
  </Page>;
}

function Inbox() {
  const { data, error, reload } = useResource(() => get<{ items: Contact[] }>("/hr-contacts"), [], 12000);
  if (error) return <ErrorState error={error} retry={reload} />;
  if (!data) return <LoadingState rows={3} />;
  if (!data.items.length) return <EmptyState title="Обращений пока нет" text="Сообщения стажёров и наставников появятся здесь." />;
  return <div className="space-y-3">
    {data.items.map((item) => <Panel key={item.id} title={item.sender_name} note={`${roleLabels[item.sender_role]} · ${formatDate(item.created_at, true)}`}>
      <p className="whitespace-pre-wrap break-words text-sm">{item.message}</p>
      <Link href={`/interns/${encodeURIComponent(item.internship_id)}`} className="mt-3 inline-block text-sm underline">Открыть карточку стажировки</Link>
    </Panel>)}
  </div>;
}
