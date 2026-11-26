"use client";

import { ArrowUpRight } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { LoadingState, Page } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardView } from "./dashboard-view";
import { FeedbackCoverage } from "./feedback-coverage";

const AnalyticsDashboard = dynamic(() => import("./analytics-dashboard"), {
  ssr: false,
  loading: () => <LoadingState rows={4} />,
});
const MentorAnalytics = dynamic(() => import("./mentor-analytics"), {
  ssr: false,
  loading: () => <LoadingState rows={4} />,
});

export function RoleDashboard() {
  const { actor } = useApp();
  if (actor.role !== "hr") return <DashboardView />;
  return <HROverview key={actor.id} actorID={actor.id} />;
}

function HROverview({ actorID }: { actorID: string }) {
  const [tab, setTab] = useState<"interns" | "mentors">("interns");
  const [openedMentors, setOpenedMentors] = useState(false);

  return (
    <Page
      title="Обзор"
      subtitle="Стажировка МГТС"
      roles={["hr"]}
      wide
      actions={tab === "interns" && (
        <Link href="/dashboard/live" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Текущий рейтинг
          <ArrowUpRight aria-hidden />
        </Link>
      )}
    >
      <Tabs value={tab} onValueChange={(value) => {
        if (value === "mentors") setOpenedMentors(true);
        if (value === "interns" || value === "mentors") setTab(value);
      }}>
        <TabsList aria-label="Направление обратной связи" className="mb-3 min-h-9">
          <TabsTrigger value="interns" className="px-3">Стажёры</TabsTrigger>
          <TabsTrigger value="mentors" className="px-3">Наставники</TabsTrigger>
        </TabsList>
        <TabsContent value="interns" keepMounted>
          <FeedbackCoverage key={`feedback:${actorID}`} />
          <AnalyticsDashboard key={actorID} />
        </TabsContent>
        <TabsContent value="mentors" keepMounted>
          {openedMentors && <MentorAnalytics />}
        </TabsContent>
      </Tabs>
    </Page>
  );
}
