"use client";

import { useState, type FormEvent } from "react";
import { Badge, InsufficientData, Panel } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Link as LinkIcon } from "lucide-react";
import { ApiError, get, post, put } from "@/lib/api";
import { roleLabels } from "@/lib/format";
import type { SurveyAnalysis as Analysis, SurveyEvidence, SurveyResponse } from "@/lib/types";
import { useResource } from "@/hooks/use-resource";
import { ResponseList } from "@/components/response-list";
import { toast } from "sonner";

const analysisStatus = {
  disabled: "ИИ-провайдер не подключён. Сигналы по правилам доступны.",
  no_data: "Разбор появится после первого ответа.",
  pending: "ИИ-разбор готовится.",
  retrying: "Провайдер временно недоступен. Анализ повторится автоматически.",
  ready: "",
  failed: "ИИ-разбор недоступен после нескольких попыток.",
};

function Evidence({ items, responses }: { items: SurveyEvidence[]; responses: SurveyResponse[] }) {
  return <ul className="space-y-2">
    {items.map((item) => {
      const response = responses.find(({ id }) => id === item.response_id);
      return <li key={`${item.response_id}:${item.text}`} className="rounded-md border-l-2 bg-surface px-3 py-2">
        <p className="text-xs text-muted-foreground">{roleLabels[item.role]} · месяц {item.wave}</p>
        <blockquote className="mt-1 whitespace-pre-wrap break-words text-sm">{item.text}</blockquote>
        {response && <details className="mt-1 text-sm">
          <summary className="w-fit cursor-pointer text-muted-foreground">Ответ целиком</summary>
          <ResponseList responses={[response]} />
        </details>}
      </li>;
    })}
  </ul>;
}

export function SurveyAnalysisPanel({ id, analysis, responses, reload }: { id: string; analysis: Analysis; responses: SurveyResponse[]; reload: () => void }) {
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");
  async function retry() {
    setRetrying(true);
    setRetryError("");
    try {
      await post(`/interns/${id}/analysis/retry`);
      reload();
    } catch (reason) {
      setRetryError(reason instanceof Error ? reason.message : "Не удалось поставить разбор в очередь.");
    } finally { setRetrying(false); }
  }
  return <Panel title="Разбор обратной связи">
    <div className="space-y-4">
      {analysis.ai ? <section className="space-y-2" aria-label="ИИ-сводка">
        <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">ИИ-сводка</h3>{analysis.model && <Badge>{analysis.model}</Badge>}</div>
        <p className="whitespace-pre-wrap break-words text-sm">{analysis.ai.summary}</p>
        <p className="text-sm"><strong>Предлагаемый шаг.</strong> {analysis.ai.next_step}</p>
        <Evidence items={analysis.ai.evidence} responses={responses} />
      </section> : <div className="space-y-2">
        <p role="status" className="text-sm text-muted-foreground">{analysisStatus[analysis.status]}</p>
        {analysis.status === "failed" && <Button variant="outline" size="sm" type="button" disabled={retrying} onClick={() => void retry()}>Повторить разбор</Button>}
        {retryError && <p role="alert" className="text-sm text-destructive">{retryError}</p>}
      </div>}
      <section className="space-y-2" aria-label="Сигналы по правилам">
        <h3 className="text-sm font-semibold">Сигналы по правилам</h3>
        {analysis.findings.length ? <div className="max-h-[28rem] space-y-2 overflow-y-auto">
          {analysis.findings.map((item) => <details key={`${item.kind}:${item.title}:${item.evidence[0]?.role}`} className="rounded-lg border bg-card px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">{item.title}{item.severity === "critical" && <span className="ml-2 text-destructive">Срочно</span>}</summary>
            <div className="mt-2"><Evidence items={item.evidence} responses={responses} /></div>
          </details>)}
        </div> : <InsufficientData text="В последнем контрольном периоде нет сигналов по правилам." />}
      </section>
      <FollowUp id={id} current={analysis.follow_up} reviewVersion={analysis.review_version} reload={reload} />
    </div>
  </Panel>;
}

type Draft = { note: string; status: "in_progress" | "done"; version?: string };

function FollowUp({ id, current, reviewVersion, reload }: { id: string; current?: Analysis["follow_up"]; reviewVersion?: string; reload: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const entry = draft ?? { note: current?.note ?? "", status: current?.status ?? "in_progress", version: reviewVersion };
  const stale = draft && draft.version !== reviewVersion;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || stale || !draft?.note.trim()) return;
    setBusy(true);
    setError("");
    try {
      await put(`/interns/${id}/follow-up`, { note: draft.note, status: draft.status, review_version: draft.version });
      setDraft(null);
      toast.success("Следующий шаг сохранён");
      reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить следующий шаг.");
      if (reason instanceof ApiError && reason.status === 409) reload();
    } finally { setBusy(false); }
  }
  return <form className="space-y-2 border-t pt-3" onSubmit={submit}>
    <label className="block text-sm font-medium">Следующий шаг HR
      <textarea className="mt-2 block min-h-20 w-full rounded-md border bg-background p-2 text-sm font-normal" value={entry.note} onChange={(e) => setDraft({ ...entry, note: e.target.value })} required maxLength={1500} disabled={busy} />
    </label>
    {stale && <div className="space-y-2 rounded-md bg-warning-soft p-3 text-sm" role="status">
      <p>Ответы или сохранённый шаг изменились. Сверьте актуальный разбор, затем подтвердите свой черновик.</p>
      {current?.note && <p className="break-words">Сохранённый шаг · {current.note}</p>}
      <Button type="button" variant="outline" size="sm" onClick={() => { setDraft({ ...entry, version: reviewVersion }); setError(""); }}>Оставить мой черновик</Button>
    </div>}
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Статус следующего шага" className="h-8 rounded-md border bg-background px-2 text-sm" value={entry.status} onChange={(e) => setDraft({ ...entry, status: e.target.value as Draft["status"] })} disabled={busy}>
        <option value="in_progress">В работе</option><option value="done">Выполнен</option>
      </select>
      <Button size="sm" type="submit" disabled={busy || !!stale || !draft?.note.trim()}>Сохранить шаг</Button>
      {error && <span role="alert" className="text-sm text-destructive">{error}</span>}
    </div>
  </form>;
}

interface Candidate { id: number; position: string; url?: string; recent_feedback: number }
interface CandidateResponse { enabled: boolean; profile: Candidate | null }

export function CandidatePanel({ id, candidateId }: { id: string; candidateId?: number }) {
  const path = `/interns/${id}/candidate`;
  const { data, error, setData, reload } = useResource(() => get<CandidateResponse>(path), [id]);
  const [candidate, setCandidate] = useState(candidateId ? String(candidateId) : "");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  async function save(value: number) {
    setBusy(true);
    setSaveError("");
    try {
      const result = await put<CandidateResponse>(path, { candidate_id: value });
      setData(result);
      setCandidate(result.profile ? String(result.profile.id) : "");
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Не удалось обновить связь.");
    } finally { setBusy(false); }
  }
  if (!data && !error) return null;
  const profile = data?.profile;
  return <Panel title="Huntflow" note="Резюме и история подбора">
    {data?.enabled === false ? <p className="text-sm text-muted-foreground">Интеграция не подключена.</p> : <div className="space-y-3">
      {error && <div className="flex items-center gap-2" role="status"><p className="text-sm text-destructive">{error.message}</p><Button variant="outline" size="sm" onClick={reload}>Повторить</Button></div>}
      {profile && <div className="text-sm">
        <p>{profile.position || `Кандидат №${profile.id}`}</p>
        <p className="mt-1 text-muted-foreground">Записей с комментариями среди последних 10 событий · {profile.recent_feedback}</p>
        {profile.url && <a className="mt-2 inline-flex items-center gap-1 underline" href={profile.url} target="_blank" rel="noreferrer"><LinkIcon className="size-4" />Открыть карточку и резюме</a>}
      </div>}
      <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); void save(Number(candidate)); }}>
        <label className="text-sm">ID кандидата
          <input className="mt-1 block h-8 w-32 rounded-md border bg-background px-2" type="number" min={1} step={1} required value={candidate} onChange={(event) => setCandidate(event.target.value)} />
        </label>
        <Button type="submit" size="sm" disabled={busy || !candidate || Number(candidate) === profile?.id}>Привязать</Button>
        {(profile || (candidateId && error)) && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void save(0)}>Отвязать</Button>}
      </form>
      {saveError && <p className="text-sm text-destructive" role="alert">{saveError}</p>}
    </div>}
  </Panel>;
}
