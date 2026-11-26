import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AppProvider } from "@/components/app-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const sans = Geist({ variable: "--font-geist", subsets: ["latin", "cyrillic"], display: "swap" });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "cyrillic"], display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: "Пульс · МГТС", template: "%s · Пульс" },
  description: "Пульс-опросы стажёров и наставников МГТС",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#151618" }],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" className={`${sans.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
    <body className="min-h-full">
      <ThemeProvider><TooltipProvider delay={300}><AppProvider>{children}</AppProvider></TooltipProvider><Toaster position="top-center" /></ThemeProvider>
    </body>
  </html>;
}
