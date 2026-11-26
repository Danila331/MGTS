"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/components/app-provider";

export function RoleRedirect() {
  const { actor } = useApp();
  const router = useRouter();
  useEffect(() => { router.replace(actor.role === "intern" ? "/me" : "/dashboard"); }, [actor.role, router]);
  return <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground" role="status">Открываю Пульс…</div>;
}
