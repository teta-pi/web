import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TETA+PI — Trust Infrastructure for the Agent Economy",
  description:
    "Verified businesses for the agent economy. Search businesses verified through official registries and C2PA-signed media.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
