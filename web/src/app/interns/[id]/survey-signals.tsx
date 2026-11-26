import { RefreshCw } from "lucide-react";
import { Badge, InsufficientData, Panel } from "@/components/page";
import { ResponseList } from "@/components/response-list";
import { Button } from "@/components/ui/button";
import { roleLabels, statusLabels, urgencyLabels } from "@/lib/format";
import type { SurveyResponse, SurveySignal } from "@/lib/types";

interface Props {
  signals: SurveySignal[];
  responses: SurveyResponse[];
  refreshing: boolean;
  refreshFailed: boolean;
  onRefresh: () => void;
}

export function SurveySignals({ signals, responses, refreshing, refreshFailed, onRefresh }: Props) {
  const responsesByID = new Map(responses.map((item) => [item.id, item]));

  return (
    <Panel
      title="Сигналы из анкет"
      action={<Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={refreshing} aria-label="Обновить сигналы"><RefreshCw aria-hidden />Обновить</Button>}
    >
      {refreshFailed && <p className="mb-3 text-[12px] text-destructive" role="status">Обновление не удалось. Показаны предыдущие данные.</p>}
      {signals.length === 0 ? <InsufficientData text="По полученным анкетам пока нет активных сигналов." /> : (
        <div className="max-h-96 space-y-3 overflow-y-auto" role="region" tabIndex={0} aria-label="Активные сигналы из анкет" aria-busy={refreshing}>
          {signals.map((signal) => {
            const urgency = urgencyLabels[signal.urgency as keyof typeof urgencyLabels];
            const tone = signal.urgency === "critical" ? "danger" : signal.urgency === "high" ? "warning" : "neutral";
            return (
              <article key={signal.id} className="space-y-2.5 rounded-lg border bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[13px] font-semibold">{signal.title}</h3>
                  {urgency && <Badge tone={tone}>{urgency}</Badge>}
                  {statusLabels[signal.status] && <Badge>{statusLabels[signal.status]}</Badge>}
                </div>
                {signal.summary && <p className="text-[12px] text-muted-foreground">{signal.summary}</p>}
                {signal.evidence.map((source) => {
                  const response = responsesByID.get(source.source_id);
                  if (!response) return null;
                  const origin = [roleLabels[response.role], response.respondent, response.period].filter(Boolean).join(" · ");
                  return (
                    <div key={`${source.source_id}:${source.type}:${source.quote}`} className="rounded-lg bg-card px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">{origin}</p>
                      {source.type === "quote" ? (
                        <blockquote className="mt-1 border-s-2 ps-2 text-[13px] leading-5 wrap-anywhere whitespace-pre-wrap">{source.quote}</blockquote>
                      ) : <p className="mt-1 text-[13px] wrap-anywhere">{source.quote}</p>}
                      <details className="mt-1.5">
                        <summary className="w-fit cursor-pointer rounded text-[12px] font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring">Ответ целиком</summary>
                        <div className="mt-2"><ResponseList responses={[response]} /></div>
                      </details>
                    </div>
                  );
                })}
              </article>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
