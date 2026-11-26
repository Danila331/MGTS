"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Field, fieldClass, FormDialog } from "@/components/forms";
import { LoadingState } from "@/components/page";
import { Button } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import { getAs, postAs } from "@/lib/api";

interface InternOptions {
  teams: { id: string; name: string }[];
  mentors: { id: string; name: string }[];
}

export function AddIntern({ actorID, onAdded }: { actorID: string; onAdded: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button size="sm" onClick={() => setOpen(true)}><Plus aria-hidden />Добавить стажёра</Button>
    {open && <AddInternDialog actorID={actorID} onClose={() => setOpen(false)} onAdded={onAdded} />}
  </>;
}

function AddInternDialog({ actorID, onClose, onAdded }: { actorID: string; onClose: () => void; onAdded: (id: string) => void }) {
  const { data, error, reload } = useResource(() => getAs<InternOptions>(actorID, "/interns/options"), []);
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [mentor, setMentor] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function submit() {
    if (!data || busy) return;
    if (!name.trim() || !team || !mentor) {
      setSaveError("Укажите имя, блок и наставника.");
      return;
    }
    setBusy(true);
    setSaveError("");
    try {
      const result = await postAs<{ id: string }>(actorID, "/interns", { name, team_id: team, mentor_id: mentor });
      toast.success("Стажёр добавлен");
      onClose();
      onAdded(result.id);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Не удалось добавить стажёра.");
    } finally {
      setBusy(false);
    }
  }

  return <FormDialog open onOpenChange={(opened) => { if (!opened && !busy) onClose(); }} title="Добавить стажёра" description="Укажите данные участника и назначьте наставника." onSubmit={submit} submitLabel="Добавить" busy={busy}>
    {!data ? error ? <div className="space-y-2" role="alert"><p className="text-sm text-destructive">Не удалось загрузить список блоков и наставников.</p><Button type="button" variant="outline" size="sm" onClick={reload}>Повторить</Button></div> : <LoadingState rows={2} /> : <>
      <Field label="Имя и фамилия"><input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} disabled={busy} /></Field>
      <Field label="Блок"><select className={fieldClass} value={team} onChange={(event) => setTeam(event.target.value)} required disabled={busy}>
        <option value="">Выберите блок</option>{data.teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></Field>
      <Field label="Наставник"><select className={fieldClass} value={mentor} onChange={(event) => setMentor(event.target.value)} required disabled={busy}>
        <option value="">Выберите наставника</option>{data.mentors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></Field>
      {saveError && <p className="text-[13px] text-destructive" role="alert">{saveError}</p>}
    </>}
  </FormDialog>;
}
