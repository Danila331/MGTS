import type { Metadata } from "next";
import { SurveyTakeView } from "./survey-take-view";
export const metadata: Metadata = { title: "Прохождение анкеты" };
export default async function TakePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ internship_id?: string | string[] }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <SurveyTakeView id={id} internshipId={typeof query.internship_id === "string" ? query.internship_id : undefined} />;
}
