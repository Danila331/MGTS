import type { Metadata } from "next";
import { SurveyDetailView } from "./survey-detail-view";
export const metadata: Metadata = { title: "Структура и ответы анкеты" };
export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <SurveyDetailView id={id} />; }
