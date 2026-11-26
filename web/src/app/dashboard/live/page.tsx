import type { Metadata } from "next";
import { DashboardView } from "../dashboard-view";

export const metadata: Metadata = { title: "Текущий рейтинг стажёров" };

export default function LiveDashboardPage() {
  return <DashboardView />;
}
