"use client";

import { ArrowUpRight } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { LoadingState, Page } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { DashboardView } from "./dashboard-view";
import { FeedbackCoverage } from "./feedback-coverage";

const AnalyticsDashboard = dynamic(() => import("./analytics-dashboard"), {
  ssr: false,
  loading: () => <LoadingState rows={4} />,
});

export function RoleDashboard() {
  const { actor } = useApp();
  if (actor.role !== "hr") return <DashboardView />;

  return (
    <Page
      title="Обзор"
      subtitle="Стажировка МГТС"
      roles={["hr"]}
      wide
      actions={
        <Link href="/dashboard/live" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Текущий рейтинг
          <ArrowUpRight aria-hidden />
        </Link>
      }
    >
      <FeedbackCoverage key={`feedback:${actor.id}`} />
      <AnalyticsDashboard key={actor.id} />
    </Page>
  );
}
