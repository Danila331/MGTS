"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/page";
import { Button } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import { get, getApiMode, put } from "@/lib/api";
import { formatDate } from "@/lib/format";

type Recap = { progress: string; open_questions: string; next_steps: string; version: number; saved_at?: string };
type RecapResponse = { available: boolean; recap?: Recap };
const fields = [
  { key: "progress", label: "Прогресс" },
  { key: "open_questions", label: "Открытые вопросы" },
  { key: "next_steps", label: "Следующие шаги" },
] as const;

export function FinalRecap({ internshipID }: { internshipID: string }) {
  if (getApiMode() === "mock") return null;
  return <FinalRecapLoader internshipID={internshipID} />;
}

function FinalRecapLoader({ internshipID }: { internshipID: string }) {
  const path = `/interns/${encodeURIComponent(internshipID)}/final-recap`;
  const { data, error, reload } = useResource(() => get<RecapResponse>(path), [path]);
  if (error) return <Panel title="Итог стажировки">
    <p role="alert" className="text-sm text-destructive">{error.message}</p>
    <Button className="mt-2" variant="outline" size="sm" onClick={reload}>Повторить</Button>
  </Panel>;
  if (!data?.available || !data.recap) return null;
  return <FinalRecapEditor key={`${path}:${data.recap.version}`} initial={data.recap} onReload={reload} path={path} />;
}

function FinalRecapEditor({ initial, path, onReload }: { initial: Recap; path: string; onReload: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = await put<RecapResponse>(path, draft);
      if (saved.recap) setDraft(saved.recap);
      toast.success("Итог стажировки сохранён");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить итог.");
    } finally {
      setBusy(false);
    }
  }
  return <Panel title="Итог стажировки" note={draft.saved_at ? `Сохранён · ${formatDate(draft.saved_at, true)}` : "Черновик для финальной встречи · доступен HR"}>
    <form onSubmit={submit} className="space-y-3">
      {fields.map(({ key, label }) => <label key={key} className="block text-sm font-medium">{label}
        <textarea className="mt-1 block min-h-24 w-full rounded-lg border bg-field p-3 font-normal" required maxLength={2000} value={draft[key]} onChange={(event) => setDraft((value) => ({ ...value, [key]: event.target.value }))} disabled={busy} />
      </label>)}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={busy || fields.some(({ key }) => !draft[key].trim())}>{busy ? "Сохраняю…" : "Сохранить итог"}</Button>
        {error && <><p role="alert" className="text-sm text-destructive">{error}</p><Button type="button" variant="outline" size="sm" onClick={onReload}>Проверить сохранённый итог</Button></>}
      </div>
    </form>
  </Panel>;
}
