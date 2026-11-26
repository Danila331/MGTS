import type { Metadata } from "next";
import { InternshipView } from "./internship-view";
export const metadata: Metadata = { title: "Карточка стажировки" };
export default async function InternshipPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <InternshipView id={id} />; }
