"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";

// ===== "Grid of Record" design tokens (3.16, docs/design/search-home-results) =====
// Same palette as the profile redesign (3.15) — kept as a local copy since
// this page and profile/page.tsx don't share a components module yet.
const GR_INK = "#1A1035";
const GR_MUTED = "#9088B0";
const GR_PRIMARY = "#6B3FA0";
const GR_PRIMARY_HOVER = "#5A3488";
const GR_ORANGE = "#E8640C";
const GR_BORDER = "#E2DCF0";
const GR_MONO_FONT = "ui-monospace,'SF Mono',Menlo,monospace";
const GR_UI_FONT = "'Trebuchet MS','Segoe UI','Helvetica Neue',sans-serif";

function useViewport() {
  const [vw, setVw] = useState(1280);
  useEffect(() => {
    const update = () => setVw(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return vw;
}

// No public "how many entities / blocks exist" endpoint exists yet (checked
// lib/api.ts and docs/api.md — only /claim/stats and require_admin-gated
// /admin/stats exist). Renders "—" rather than a fabricated number, same
// choice as the profile facts strip's "agent lookups / 30d" (3.15a) — see
// docs/known-issues.md.
function useEvidenceCounts() {
  return { entities: null as number | null, blocks: null as number | null };
}

export default function HomePage() {
  const router = useRouter();
  const vw = useViewport();
  const m = vw < 640;
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const counts = useEvidenceCounts();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runSearch = () => {
    const q = query.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F4F2F8", fontFamily: GR_UI_FONT, color: GR_INK }}>
      <AppHeader />
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: m ? "96px 16px 60px" : "104px 24px 80px" }}>
        <div style={{ background: "#fff", border: `1px solid ${GR_BORDER}` }}>
          {/* Region 1: wordmark strip — auth-aware nav lives in AppHeader above */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: m ? "12px 16px" : "12px 26px", borderBottom: `1px solid ${GR_BORDER}`,
            }}
          >
            <span style={{ fontSize: m ? 18 : 20, fontWeight: 600, color: GR_PRIMARY, lineHeight: 1, letterSpacing: "-0.5px" }}>Θ</span>
            <span style={{ fontSize: m ? 12 : 14, fontWeight: 300, lineHeight: 1 }}>+</span>
            <span style={{ fontSize: m ? 16 : 18, fontWeight: 600, color: GR_ORANGE, lineHeight: 1 }}>π</span>
          </div>

          {/* Region 2: query field — the query line is the page */}
          <div
            style={{
              height: m ? 420 : 520, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", padding: m ? "0 16px" : "0 34px",
            }}
          >
            <div style={{ width: "100%", maxWidth: 720 }}>
              <div style={{ display: "flex", borderBottom: "1.5px solid #1A1035" }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: m ? 10 : 14, padding: m ? "0 1px 11px" : "0 2px 14px", minWidth: 0 }}>
                  <span style={{ width: m ? 12 : 14, height: m ? 12 : 14, flexShrink: 0, border: `1.5px solid ${GR_MUTED}`, borderRadius: "50%" }} />
                  {/* Real <input> — native caret, no fake blinking element (the
                      design's animated caret is a prototype-only stand-in). */}
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
                    placeholder="Search verified entities…"
                    style={{
                      display: "block", flex: 1, minWidth: 0,
                      fontFamily: GR_MONO_FONT, fontSize: m ? 14 : 19, letterSpacing: "-0.3px",
                      color: GR_INK, border: "none", background: "transparent", outline: "none",
                      overflow: "hidden", textOverflow: "ellipsis",
                    }}
                  />
                </div>
                <span
                  onClick={runSearch}
                  style={{
                    fontFamily: GR_MONO_FONT, fontSize: m ? 10 : 11, letterSpacing: "1.4px", textTransform: "uppercase",
                    color: GR_PRIMARY, padding: m ? "0 1px 11px" : "0 2px 14px", cursor: "pointer",
                    flexShrink: 0, alignSelf: "flex-end", whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = GR_PRIMARY_HOVER; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = GR_PRIMARY; }}
                >
                  Search ↵
                </span>
              </div>

              {/* Region 3: under-rule line */}
              {m ? (
                <div style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: GR_MUTED, marginTop: 12, lineHeight: 1.6 }}>
                  signed evidence only
                  <br />
                  {counts.entities ?? "—"} entities · {counts.blocks ?? "—"} blocks
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, marginTop: 14 }}>
                  <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10.5, color: GR_MUTED, letterSpacing: "0.3px" }}>
                    signed evidence only · {counts.entities ?? "—"} entities · {counts.blocks ?? "—"} blocks
                  </span>
                  <Link href="/search" style={{ fontFamily: GR_MONO_FONT, fontSize: 10.5, letterSpacing: "0.3px" }}>
                    example result set →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
