import type { Metadata } from "next";
import { SurveysView } from "./surveys-view";
export const metadata: Metadata = { title: "Анкеты" };
export default function SurveysPage() { return <SurveysView />; }
