import type { Metadata } from "next";
import { RoleDashboard } from "./role-dashboard";

export const metadata: Metadata = { title: "Обзор программы" };

export default function DashboardPage() {
  return <RoleDashboard />;
}
