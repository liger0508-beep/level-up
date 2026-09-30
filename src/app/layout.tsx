import type { Metadata } from "next";
import "./globals.css";
import { UserActivityTracker } from "@/components/layout/UserActivityTracker";

export const metadata: Metadata = {
  title: "GLA Level-Up",
  description: "GLA Level-Up Coach System",
  openGraph: {
    title: "GLA Level-Up",
    description: "GLA Level-Up Coach System",
    siteName: "GLA Level-Up",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
        suppressHydrationWarning={true}
      >
        {children}
        <UserActivityTracker />
      </body>
    </html>
  );
}