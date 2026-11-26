import type { Metadata } from "next";
import { MeView } from "./me-view";
export const metadata: Metadata = { title: "Моя стажировка" };
export default function MePage() { return <MeView />; }
