import type { Metadata } from "next";
import { SurveyTakeView } from "./survey-take-view";
export const metadata: Metadata = { title: "Прохождение анкеты" };
export default async function TakePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <SurveyTakeView id={id} />; }
