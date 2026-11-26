import type { Metadata } from "next";
import { DashboardView } from "./dashboard-view";
export const metadata: Metadata = { title: "Обзор программы" };
export default function DashboardPage() { return <DashboardView />; }
