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
        <div
          style={{
            position: "relative",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "8px 16px",
            background: "#FFD60A",
            color: "#1A1035",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.02em",
            textAlign: "center",
          }}
        >
          🚧 Project under construction — we are building in public. Features ship daily.
        </div>
        {children}
        <script
          data-goatcounter="https://stats.tetapi.dev/count"
          async
          src="https://stats.tetapi.dev/count.js"
        ></script>
      </body>
    </html>
  );
}
