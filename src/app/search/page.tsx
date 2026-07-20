"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { searchApi } from "@/lib/api";
import type { SearchResult } from "@/lib/types";
import { LEVEL_ACCENT, LEVEL_LABEL, ENTITY_TYPE_LABEL } from "@/lib/types";
import AppHeader from "@/components/AppHeader";

const INDIGO = "#5B45C9";
const TEXT = "#1A1035";
const TEXT_SEC = "#5A4F78";
const MUTED = "#9991AC";

const glass: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.7)",
  borderRadius: 20,
  background: "rgba(255,255,255,0.5)",
  boxShadow: "0 16px 50px rgba(45,55,120,0.10), inset 0 1px 0 rgba(255,255,255,0.85)",
  backdropFilter: "blur(20px) saturate(140%)",
  WebkitBackdropFilter: "blur(20px) saturate(140%)",
};

function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={INDIGO} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="7" /><path d="M20 20l-4.3-4.3" />
    </svg>
  );
}

function ResultRow({ result }: { result: SearchResult }) {
  const [hovered, setHovered] = useState(false);
  const accent = LEVEL_ACCENT[result.verification_level];

  return (
    <Link
      href={`/e/${result.slug}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        padding: "22px 22px 20px",
        borderLeft: `3px solid ${accent}`,
        background: hovered ? "rgba(91,69,201,0.045)" : "transparent",
        transition: "background 0.18s ease",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 11, minWidth: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent, flexShrink: 0, transform: "translateY(-2px)", display: "inline-block" }} />
          <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.3px", color: TEXT, lineHeight: 1.15 }}>
            {result.name}
          </span>
          <span style={{
            fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
            fontSize: 10.5, color: MUTED, letterSpacing: "0.3px",
          }}>
            {ENTITY_TYPE_LABEL[result.entity_type]}
          </span>
        </div>
        <span style={{
          fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
          fontSize: 10, letterSpacing: "1.2px", textTransform: "uppercase",
          color: accent, whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {LEVEL_LABEL[result.verification_level]}
        </span>
      </div>

      {result.description && (
        <div style={{ fontSize: 14.5, color: TEXT_SEC, lineHeight: 1.5, margin: "9px 0 0 18px", maxWidth: 600 }}>
          {result.description}
        </div>
      )}
    </Link>
  );
}

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const [input, setInput] = useState(q);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => setInput(q), [q]);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults(null);
      return;
    }
    setSearching(true);
    setError(false);
    searchApi
      .search(term, "any", undefined, 20)
      .then(setResults)
      .catch(() => setError(true))
      .finally(() => setSearching(false));
  }, [q]);

  const submit = () => {
    const term = input.trim();
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 50%,#EDF1FB 100%)",
      color: TEXT,
    }}>
      <AppHeader />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "96px 32px 80px" }}>
        {/* Search bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "15px 20px",
          marginBottom: 22,
          ...glass,
        }}>
          <SearchIcon />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Search verified entities…"
            style={{
              flex: 1, minWidth: 0, border: "none", background: "transparent",
              fontSize: 16, color: TEXT,
              fontFamily: "'Manrope','Trebuchet MS','Segoe UI',sans-serif",
            }}
          />
          <span
            onClick={submit}
            style={{
              fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
              fontSize: 13, color: INDIGO, cursor: "pointer",
              padding: "4px 9px",
              border: "1px solid rgba(91,69,201,0.25)",
              borderRadius: 8,
              background: "rgba(91,69,201,0.06)",
            }}
          >↵</span>
        </div>

        {/* Results panel */}
        <div style={{ ...glass, overflow: "hidden" }}>
          {!q.trim() && (
            <div style={{
              padding: "60px 24px", textAlign: "center",
              color: MUTED, fontSize: 14.5, lineHeight: 1.6,
            }}>
              Search verified businesses, journalists, and creators by name or description.
            </div>
          )}

          {q.trim() !== "" && searching && (
            <div style={{
              padding: "60px 24px", textAlign: "center",
              color: MUTED, fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", fontSize: 13,
            }}>
              Searching registries…
            </div>
          )}

          {q.trim() !== "" && !searching && error && (
            <div style={{
              padding: "60px 24px", textAlign: "center",
              color: "#F59A2E", fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", fontSize: 13,
            }}>
              ✗ Search is unavailable right now — try again shortly.
            </div>
          )}

          {q.trim() !== "" && !searching && !error && results && results.length === 0 && (
            <div style={{
              padding: "60px 24px", textAlign: "center",
              color: "#F59A2E", fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", fontSize: 13,
            }}>
              ✗ No matches found for &quot;{q}&quot;
            </div>
          )}

          {q.trim() !== "" && !searching && !error && results && results.map((r, i) => (
            <div key={r.id ?? `${r.slug}-${i}`} style={{ borderBottom: i === results.length - 1 ? "none" : "1px solid rgba(26,16,53,0.07)" }}>
              <ResultRow result={r} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  );
}
