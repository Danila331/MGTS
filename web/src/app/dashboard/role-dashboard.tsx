"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { LoadingState, Page } from "@/components/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardDataView, DashboardView } from "./dashboard-view";

const AnalyticsDashboard = dynamic(() => import("./analytics-dashboard"), {
  ssr: false,
  loading: () => <LoadingState rows={4} />,
});
const MentorAnalytics = dynamic(() => import("./mentor-analytics"), {
  ssr: false,
  loading: () => <LoadingState rows={4} />,
});

export function RoleDashboard() {
  const { actor, demo } = useApp();
  if (actor.role !== "hr") return <DashboardView />;
  return <HROverview key={actor.id} demo={demo} />;
}

function HROverview({ demo }: { demo: boolean }) {
  const [tab, setTab] = useState("interns");

  return (
    <Page title="Обзор" subtitle="Стажировка МГТС" roles={["hr"]} wide>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Разделы обзора" className="mb-3 min-h-9">
          <TabsTrigger value="interns" className="px-3">Стажёры</TabsTrigger>
          <TabsTrigger value="mentors" className="px-3">Наставники</TabsTrigger>
          {demo && <TabsTrigger value="demo" className="px-3">Демо-аналитика</TabsTrigger>}
        </TabsList>
        <TabsContent value="interns"><DashboardDataView embedded /></TabsContent>
        <TabsContent value="mentors"><MentorAnalytics /></TabsContent>
        {demo && <TabsContent value="demo"><AnalyticsDashboard /></TabsContent>}
      </Tabs>
    </Page>
  );
}
