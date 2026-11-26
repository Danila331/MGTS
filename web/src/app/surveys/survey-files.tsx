"use client";

import { Download, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Panel } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { surveyFileRequest } from "@/lib/api";

const fileTypes = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};

const downloads = [
  { label: "Excel", query: "format=xlsx", filename: "pulse-responses.xlsx" },
  { label: "CSV стажёров", query: "format=csv&audience=intern", filename: "pulse-intern-responses.csv" },
  { label: "CSV наставников", query: "format=csv&audience=mentor", filename: "pulse-mentor-responses.csv" },
];

interface ImportResult { imported: number; skipped: number; }

export function SurveyFiles({ onImport }: { onImport: () => void }) {
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("file");

    setError("");
    setResult(null);
    if (!(file instanceof File) || !file.size) {
      setError("Файл пустой.");
      return;
    }
    const format = file.name.split(".").at(-1)?.toLowerCase();
    if (format !== "xlsx" && format !== "csv") {
      setError("Выберите файл XLSX или CSV.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Размер файла должен быть не больше 2 МБ.");
      return;
    }

    setWorking("upload");
    try {
      const response = await surveyFileRequest(`/surveys/responses/import?format=${format}`, {
        method: "POST",
        body: file,
        headers: { "Content-Type": fileTypes[format] },
      });
      const report: ImportResult = await response.json();
      setResult(report);
      form.reset();
      if (report.imported > 0) onImport();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось импортировать ответы.");
    } finally {
      setWorking(null);
    }
  }

  async function download(query: string, filename: string) {
    setError("");
    setWorking(filename);
    try {
      const response = await surveyFileRequest(`/surveys/responses/export?${query}`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось скачать ответы.");
    } finally {
      setWorking(null);
    }
  }

  return (
    <Panel title="Импорт и выгрузка ответов">
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={upload} className="flex flex-wrap items-end gap-2.5">
          <label className="min-w-0 flex-1 basis-52 text-[12px] font-medium">
            Файл с ответами
            <Input className="mt-1.5 min-h-9 w-full max-sm:min-h-11" type="file" name="file" accept=".xlsx,.csv" required disabled={working !== null} />
          </label>
          <Button type="submit" disabled={working !== null} className="max-sm:min-h-11">
            <Upload aria-hidden />{working === "upload" ? "Импортирую…" : "Импортировать"}
          </Button>
        </form>
        <div>
          <p className="mb-1.5 text-[12px] font-medium">Скачать ответы</p>
          <div className="flex flex-wrap gap-2">
            {downloads.map(({ label, query, filename }) => (
              <Button key={filename} type="button" variant="outline" disabled={working !== null} onClick={() => download(query, filename)} className="max-sm:min-h-11">
                <Download aria-hidden />{working === filename ? "Готовлю файл…" : label}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground">XLSX или CSV до 2 МБ. Импорт добавляет новые ответы к существующим стажировкам.</p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-destructive-soft px-3 py-2 text-[13px] text-destructive">{error}</p>}
      {result && <p role="status" className="mt-3 rounded-lg bg-success-soft px-3 py-2 text-[13px] text-success">Импортировано {result.imported} · Уже в Пульсе {result.skipped}</p>}
    </Panel>
  );
}
