import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AssistantDrawer } from "@/components/Assistant";
import { CommandPalette } from "@/components/CommandPalette";
import { Shell } from "@/components/Shell";
import { AppProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "PeCal Kompass · Perschmann Calibration",
  description:
    "Welche Kunden sollten wir heute kontaktieren – und warum? Der KI-Vertriebsassistent für den Vertriebsinnendienst.",
};

export const viewport: Viewport = { themeColor: "#0b1e2c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Roboto+Flex:opsz,wght@8..144,100..1000&family=Roboto+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppProvider>
          <Shell>{children}</Shell>
          <CommandPalette />
          <AssistantDrawer />
        </AppProvider>
      </body>
    </html>
  );
}
