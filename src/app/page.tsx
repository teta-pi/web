"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { getDisplayResults } from "@/lib/seedData";
import type { DisplaySearchResult, SearchResult } from "@/lib/types";
import { LEVEL_ACCENT, LEVEL_LABEL, LEVEL_HASH } from "@/lib/types";
import { searchApi } from "@/lib/api";

type Filter = "all" | "full" | "registry" | "video";

const SEED_RESULTS = getDisplayResults();

function toDisplay(r: SearchResult, idx: number): DisplaySearchResult {
  const rd = r.registry_data;
  return {
    ...r,
    accentColor: LEVEL_ACCENT[r.verification_level],
    levelLabel: LEVEL_LABEL[r.verification_level],
    hash: LEVEL_HASH[r.verification_level],
    iso: r.country ?? "",
    authority: rd?.registry ?? "",
    requirement: "",
    registryId: r.registry_id ? `REG·${r.country}·${r.registry_id}` : "",
    badgePills: (r.badges ?? []).map((t) => ({ text: t })),
    hasVideo: r.block_count > 0,
    id: r.id ?? `api-${idx}`,
  };
}

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

/* ── Wordmark ── */
function Wordmark({ size = "sm" }: { size?: "sm" | "lg" }) {
  const lg = size === "lg";
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: lg ? 12 : 7 }}>
      <span style={{ fontSize: lg ? 64 : 20, fontWeight: 700, color: "#5B45C9", lineHeight: 1, letterSpacing: lg ? -2 : -0.5 }}>Θ</span>
      <span style={{ fontSize: lg ? 40 : 15, fontWeight: 300, color: "#1A1035", lineHeight: 1 }}>+</span>
      <span style={{ fontSize: lg ? 58 : 18, fontWeight: 700, color: "#F59A2E", lineHeight: 1 }}>π</span>
    </div>
  );
}

/* ── Search icon ── */
function SearchIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#5B45C9" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="7" /><path d="M20 20l-4.3-4.3" />
    </svg>
  );
}

/* ── Badge pill ── */
function BadgePill({ text }: { text: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 12px",
      border: "1px solid rgba(255,255,255,0.8)",
      borderRadius: 20,
      background: "rgba(255,255,255,0.62)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
      fontSize: 12.5, color: "#3A2C5C",
    }}>
      <span style={{ color: "#5B45C9", fontSize: 11 }}>✓</span>{text}
    </span>
  );
}

/* ── ISO chip ── */
function IsoChip({ code }: { code: string }) {
  if (!code) return null;
  return (
    <span style={{
      fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
      fontSize: 10.5, padding: "1px 6px",
      border: "1px solid rgba(91,69,201,0.25)",
      borderRadius: 4, color: "#5B45C9", letterSpacing: "0.5px",
    }}>{code}</span>
  );
}

/* ── Filter pill ── */
function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <span
      onClick={onClick}
      style={{
        fontSize: 13.5, letterSpacing: "0.1px", cursor: "pointer",
        color: active ? "#fff" : "#5A4F78",
        fontWeight: active ? 700 : 500,
        padding: "6px 14px", borderRadius: 14,
        background: active ? "linear-gradient(180deg,#6E58D6,#5B45C9)" : "rgba(255,255,255,0.55)",
        border: `1px solid ${active ? "transparent" : "rgba(255,255,255,0.7)"}`,
        boxShadow: active ? "0 4px 14px rgba(91,69,201,0.30)" : undefined,
        transition: "all 0.15s",
      }}
    >{label}</span>
  );
}

export default function SearchPage() {
  const vw = useViewport();
  const m = vw < 640;

  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [apiResults, setApiResults] = useState<DisplaySearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    if (query.trim()) setSubmitted(true);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  useEffect(() => {
    if (!submitted || !query.trim()) return;
    setSearching(true);
    searchApi
      .search(query.trim(), "any", undefined, 20)
      .then((results) => {
        setApiResults(results.length > 0 ? results.map(toDisplay) : null);
      })
      .catch(() => setApiResults(null))
      .finally(() => setSearching(false));
  }, [submitted, query]);

  const pool = apiResults ?? SEED_RESULTS;

  const filteredResults: DisplaySearchResult[] = pool.filter((r) => {
    if (filter === "full" && r.verification_level !== "full") return false;
    if (filter === "registry" && r.verification_level !== "registry") return false;
    if (filter === "video" && !r.hasVideo) return false;
    const q = query.trim().toLowerCase();
    if (q && !r.name.toLowerCase().includes(q) && !(r.description ?? "").toLowerCase().includes(q)) return false;
    return true;
  });

  const filters: Array<{ key: Filter; label: string }> = [
    { key: "all", label: "All" },
    { key: "full", label: "Fully Verified" },
    { key: "registry", label: "Registry Only" },
    { key: "video", label: "With Video" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 50%,#EDF1FB 100%)",
      color: "#1A1035",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Color washes */}
      <div style={{ position: "absolute", top: -160, left: -130, width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle,rgba(91,69,201,0.26),transparent 68%)", filter: "blur(34px)", animation: "floatA 28s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -180, right: -150, width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle,rgba(245,154,46,0.22),transparent 68%)", filter: "blur(38px)", animation: "floatB 32s ease-in-out infinite", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Corner logo */}
        <div style={{ position: "fixed", top: m ? 16 : 26, left: m ? 16 : 30, zIndex: 10, cursor: "pointer", userSelect: "none" }}
          onClick={() => { setSubmitted(false); setQuery(""); }}>
          <Wordmark size="sm" />
        </div>

        {/* Get verified pill */}
        <Link
          href="/claim"
          style={{
            position: "fixed", top: m ? 16 : 26, right: m ? 16 : 30, zIndex: 10,
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
          Create account <span style={{ color: "#5B45C9" }}>→</span>
        </Link>

        {/* ===== EMPTY STATE ===== */}
        {!submitted && (
          <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: m ? "28px 18px" : "32px",
            }}>
              <Wordmark size="lg" />

              <div style={{
                fontSize: 16, color: "#5A4F78", letterSpacing: "0.1px",
                marginTop: 26, marginBottom: 42,
                textAlign: "center", maxWidth: 460, lineHeight: 1.55,
              }}>
                Trust infrastructure for the agent economy. Search businesses, journalists, and artists verified through official registries and C2PA-signed media.
              </div>

              {/* Search bar */}
              <div style={{
                width: "100%", maxWidth: 580,
                display: "flex", alignItems: "center", gap: 14,
                padding: "16px 22px",
                border: "1px solid rgba(255,255,255,0.7)",
                borderRadius: 18,
                background: "rgba(255,255,255,0.55)",
                boxShadow: "0 14px 44px rgba(45,55,120,0.12), inset 0 1px 0 rgba(255,255,255,0.85)",
                backdropFilter: "blur(20px) saturate(140%)",
                WebkitBackdropFilter: "blur(20px) saturate(140%)",
              }}>
                <SearchIcon size={20} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search verified entities…"
                  style={{
                    flex: 1, border: "none", background: "transparent",
                    fontSize: 17, color: "#1A1035",
                    fontFamily: "'Manrope','Trebuchet MS','Segoe UI',sans-serif",
                  }}
                />
                <span
                  onClick={handleSubmit}
                  style={{
                    fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
                    fontSize: 13, color: "#5B45C9", cursor: "pointer",
                    padding: "4px 9px",
                    border: "1px solid rgba(91,69,201,0.25)",
                    borderRadius: 8,
                    background: "rgba(91,69,201,0.06)",
                  }}
                >↵</span>
              </div>

              {/* Trust strip */}
              <div style={{
                marginTop: 24,
                fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
                fontSize: 11.5, color: "#9991AC", letterSpacing: "0.4px",
                display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center",
              }}>
                <span>registry:attested</span>
                <span style={{ color: "#C9C2D8" }}>·</span>
                <span>c2pa:verified</span>
                <span style={{ color: "#C9C2D8" }}>·</span>
                <span>btc:ts:confirmed</span>
              </div>
            </div>

            {/* Footer */}
            <footer style={{
              borderTop: "1px solid rgba(26,16,53,0.08)",
              background: "rgba(255,255,255,0.4)",
              backdropFilter: "blur(10px)",
            }}>
              <div style={{
                padding: "13px 28px",
                borderBottom: "1px solid rgba(26,16,53,0.06)",
                fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
                fontSize: 12, color: "#9991AC", letterSpacing: "0.3px",
              }}>
                Operating under EU · US · APAC registry standards
              </div>
              <div style={{
                padding: "15px 28px",
                display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: 16,
                flexWrap: "wrap", fontSize: 13, color: "#5A4F78",
              }}>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <a href={process.env.NEXT_PUBLIC_LANDING_URL ?? "/"} style={{ color: "#5A4F78", textDecoration: "none" }}>About</a>
                  {["Registries", "For Agents"].map((l) => (
                    <span key={l} style={{ cursor: "pointer" }}>{l}</span>
                  ))}
                  <Link href="/claim" style={{ color: "#5A4F78", textDecoration: "none" }}>For Businesses</Link>
                  <span style={{ cursor: "pointer" }}>How Verification Works</span>
                </div>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  {["Privacy", "Terms", "API", "Settings"].map((l) => (
                    <span key={l} style={{ cursor: "pointer" }}>{l}</span>
                  ))}
                </div>
              </div>
            </footer>
          </div>
        )}

        {/* ===== RESULTS STATE ===== */}
        {submitted && (
          <div style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: m ? "74px 16px 60px" : "96px 32px 80px",
          }}>
            {/* Search bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "15px 20px",
              border: "1px solid rgba(255,255,255,0.7)",
              borderRadius: 18,
              background: "rgba(255,255,255,0.55)",
              boxShadow: "0 12px 40px rgba(45,55,120,0.10), inset 0 1px 0 rgba(255,255,255,0.85)",
              backdropFilter: "blur(20px) saturate(140%)",
              WebkitBackdropFilter: "blur(20px) saturate(140%)",
              marginBottom: 22,
            }}>
              <SearchIcon size={18} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search verified entities…"
                style={{
                  flex: 1, minWidth: 0, border: "none", background: "transparent",
                  fontSize: 16, color: "#1A1035",
                  fontFamily: "'Manrope','Trebuchet MS','Segoe UI',sans-serif",
                }}
              />
              <span style={{
                fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
                fontSize: 11, color: "#9991AC", letterSpacing: "0.3px", whiteSpace: "nowrap",
              }}>verified-only</span>
            </div>

            {/* Filter row */}
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between", gap: 12,
              flexWrap: "wrap", padding: "0 6px 16px",
            }}>
              <div style={{ display: "flex", gap: m ? 10 : 12, flexWrap: "wrap" }}>
                {filters.map(({ key, label }) => (
                  <FilterPill key={key} label={label} active={filter === key} onClick={() => setFilter(key)} />
                ))}
              </div>
              <span style={{
                fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
                fontSize: 11.5, color: "#9991AC", letterSpacing: "0.3px",
              }}>
                {filteredResults.length} verified
              </span>
            </div>

            {/* Results panel */}
            <div style={{
              border: "1px solid rgba(255,255,255,0.7)",
              borderRadius: 20,
              background: "rgba(255,255,255,0.5)",
              boxShadow: "0 16px 50px rgba(45,55,120,0.10), inset 0 1px 0 rgba(255,255,255,0.85)",
              backdropFilter: "blur(20px) saturate(140%)",
              WebkitBackdropFilter: "blur(20px) saturate(140%)",
              overflow: "hidden",
            }}>
              {searching && (
                <div style={{
                  padding: "60px 24px", textAlign: "center",
                  color: "#9991AC", fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", fontSize: 13,
                }}>
                  Searching registries…
                </div>
              )}

              {!searching && filteredResults.length === 0 && (
                <div style={{
                  padding: "60px 24px", textAlign: "center",
                  color: "#F59A2E", fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", fontSize: 13,
                }}>
                  ✗ No matches found for "{query}"
                </div>
              )}

              {!searching && filteredResults.map((r, i) => (
                <ResultRow key={r.slug ?? i} result={r} mobile={m} last={i === filteredResults.length - 1} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({ result: r, mobile: m, last }: { result: DisplaySearchResult; mobile: boolean; last: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "26px 22px 24px",
        borderBottom: last ? "none" : "1px solid rgba(26,16,53,0.07)",
        borderLeft: `3px solid ${r.accentColor}`,
        background: hovered ? "rgba(91,69,201,0.045)" : "transparent",
        transition: "background 0.18s ease",
        cursor: "pointer",
      }}
    >
      {/* Name + level label */}
      <div style={{
        display: "flex", alignItems: "baseline",
        justifyContent: "space-between", gap: 14,
        flexWrap: m ? "wrap" : "nowrap",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 11, minWidth: 0 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: r.accentColor, flexShrink: 0,
            transform: "translateY(-2px)", display: "inline-block",
          }} />
          <span style={{ fontSize: m ? 19 : 22, fontWeight: 600, letterSpacing: "-0.3px", color: "#1A1035", lineHeight: 1.15 }}>
            {r.name}
          </span>
        </div>
        <span style={{
          fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
          fontSize: 10, letterSpacing: "1.2px", textTransform: "uppercase",
          color: r.accentColor, whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {r.levelLabel}
        </span>
      </div>

      {/* Description */}
      <div style={{ fontSize: 15, color: "#5A4F78", lineHeight: 1.5, margin: "9px 0 0 18px", maxWidth: 600 }}>
        {r.description}
      </div>

      {/* Badge pills */}
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", margin: "15px 0 0 18px" }}>
        {r.badgePills.map((b) => <BadgePill key={b.text} text={b.text} />)}
      </div>

      {/* Registry line */}
      <div style={{ margin: "14px 0 0 18px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, color: "#3A2C5C", letterSpacing: "0.1px" }}>
          <IsoChip code={r.iso} />
          {r.authority}
        </span>
        <span style={{ color: "#C9C2D8" }}>·</span>
        <span style={{ color: "#5A4F78" }}>{r.requirement}</span>
      </div>

      {/* Mono meta */}
      <div style={{
        fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
        fontSize: 11, color: "#9991AC", letterSpacing: "0.3px",
        margin: "7px 0 0 18px", display: "flex", gap: 10, flexWrap: "wrap",
      }}>
        <span style={{ color: "#5A4F78" }}>{r.registryId}</span>
        <span style={{ color: "#C9C2D8" }}>·</span>
        <span>{r.hash}</span>
      </div>
    </div>
  );
}
