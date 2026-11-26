import { Suspense } from "react";
import type { Metadata } from "next";
import { InternsView } from "./interns-view";
import { LoadingState } from "@/components/page";
export const metadata: Metadata = { title: "Стажёры" };
export default function InternsPage() { return <Suspense fallback={<div className="p-6"><LoadingState /></div>}><InternsView /></Suspense>; }
