import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SurveyFormView } from "./survey-form-view";

export const metadata: Metadata = { title: "Форма обратной связи" };

export default async function FormPage({ params }: { params: Promise<{ audience: string }> }) {
  const { audience } = await params;
  if (audience !== "intern" && audience !== "mentor") notFound();
  return <SurveyFormView key={audience} audience={audience} />;
}
