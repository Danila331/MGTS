import { ClipboardCheck, LayoutDashboard, UserRound, UsersRound } from "lucide-react";
import type { Role } from "@/lib/types";

export interface NavItem { href: string; label: string; icon: typeof LayoutDashboard; roles: Role[]; group: string; }
const staff: Role[] = ["hr", "manager", "mentor"];
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Обзор", icon: LayoutDashboard, roles: staff, group: "Пульс" },
  { href: "/me", label: "Мой Пульс", icon: UserRound, roles: ["intern"], group: "Пульс" },
  { href: "/interns", label: "Стажёры", icon: UsersRound, roles: staff, group: "Пульс" },
  { href: "/surveys", label: "Анкеты", icon: ClipboardCheck, roles: ["hr", "manager", "mentor", "intern"], group: "Пульс" },
];
