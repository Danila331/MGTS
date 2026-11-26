"use client";

import { useEffect, useRef } from "react";
import { analyticsMarkup } from "./analytics-markup";
import { mountAnalytics } from "./mount-analytics";

export default function AnalyticsDashboard() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    root.innerHTML = analyticsMarkup;
    mountAnalytics(root);
    return () => root.replaceChildren();
  }, []);

  return <div ref={ref} />;
}
