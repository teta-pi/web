import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TETA+PI — Trust Infrastructure for Digital Entities",
  description:
    "Get verified on TETA+PI. Businesses, journalists, and artists verified via registry + C2PA + Bitcoin become discoverable by AI agents through the MCP protocol.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="tp-banner">
          🚧 Project under construction — we are building in public. Features ship daily.
        </div>
        {/* Offset for the fixed banner above so it never overlaps page content. */}
        <div className="tp-content-offset">{children}</div>
        <script
          data-goatcounter="https://stats.tetapi.dev/count"
          async
          src="https://stats.tetapi.dev/count.js"
        ></script>
      </body>
    </html>
  );
}
