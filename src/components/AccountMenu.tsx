"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";

const INDIGO = "#5B45C9";

/** Avatar button + dropdown (My Page / Settings / Log out).
 *  Renders a "Create account →" pill when logged out. */
export default function AccountMenu({ fixed = true }: { fixed?: boolean }) {
  const { token, user, clearAuth } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const wrapStyle: React.CSSProperties = fixed
    ? { position: "fixed", top: 20, right: 24, zIndex: 40 }
    : { position: "relative" };

  if (!mounted) return null;

  if (!token) {
    return (
      <Link
        href="/claim"
        style={{
          ...wrapStyle,
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "9px 16px",
          border: "1px solid rgba(255,255,255,0.7)",
          borderRadius: 18,
          background: "rgba(255,255,255,0.55)",
          boxShadow: "0 6px 20px rgba(45,55,120,0.10), inset 0 1px 0 rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px) saturate(140%)",
          WebkitBackdropFilter: "blur(12px) saturate(140%)",
          fontSize: 13, fontWeight: 600, color: "#3A2C5C", textDecoration: "none",
        }}
      >
        Create account <span style={{ color: INDIGO }}>→</span>
      </Link>
    );
  }

  const letter = (user?.email ?? "?")[0].toUpperCase();

  return (
    <div ref={ref} style={wrapStyle}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.7)",
          background: `linear-gradient(180deg,#6E58D6,${INDIGO})`,
          color: "#fff", fontSize: 16, fontWeight: 700,
          boxShadow: "0 6px 20px rgba(91,69,201,0.30), inset 0 1px 0 rgba(255,255,255,0.3)",
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {letter}
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: 48, right: 0, width: 220,
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(255,255,255,0.8)",
            borderRadius: 16,
            boxShadow: "0 18px 50px rgba(45,55,120,0.22), inset 0 1px 0 rgba(255,255,255,0.9)",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            overflow: "hidden",
            padding: "6px 0",
          }}
        >
          <div style={{ padding: "10px 16px 8px", fontSize: 12, color: "#9088B0", borderBottom: "1px solid rgba(26,16,53,0.06)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.email ?? "Signed in"}
          </div>
          {[
            { label: "My Page", href: "/profile", icon: "▣" },
            { label: "Settings", href: "/settings", icon: "⚙" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "11px 16px", fontSize: 14, fontWeight: 500,
                color: "#1A1035", textDecoration: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(91,69,201,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ color: INDIGO, width: 18, textAlign: "center" }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
          <div
            onClick={() => {
              clearAuth();
              setOpen(false);
              router.push("/");
            }}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "11px 16px", fontSize: 14, fontWeight: 500,
              color: "#B04545", cursor: "pointer",
              borderTop: "1px solid rgba(26,16,53,0.06)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(176,69,69,0.06)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ width: 18, textAlign: "center" }}>↩</span>
            Log out
          </div>
        </div>
      )}
    </div>
  );
}
