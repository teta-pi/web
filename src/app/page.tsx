"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";
import { BadgePill } from "@/components/ui/BadgePill";
import { IsoChip } from "@/components/ui/IsoChip";
import { VerificationIcon, SearchIcon } from "@/components/ui/VerificationIcon";
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

  // Live API search on submit
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
    if (q && !r.name.toLowerCase().includes(q) && !(r.description ?? "").toLowerCase().includes(q))
      return false;
    return true;
  });

  const filters: Array<{ key: Filter; label: string }> = [
    { key: "all", label: "All" },
    { key: "full", label: "Fully Verified" },
    { key: "registry", label: "Registry Only" },
    { key: "video", label: "With Video" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        color: "#1A1035",
        fontFamily: "'Trebuchet MS','Segoe UI','Helvetica Neue',sans-serif",
        position: "relative",
      }}
    >
      {/* Corner logo */}
      <div
        style={{
          position: "fixed",
          top: m ? 16 : 22,
          left: m ? 16 : 28,
          zIndex: 10,
        }}
      >
        <Wordmark size="sm" />
      </div>

      {/* Get verified pill */}
      <Link
        href="/claim"
        style={{
          position: "fixed",
          top: m ? 14 : 18,
          right: m ? 16 : 28,
          zIndex: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "8px 15px",
          border: "1px solid rgba(107,63,160,0.25)",
          borderRadius: 20,
          background: "rgba(107,63,160,0.06)",
          backdropFilter: "blur(8px)",
          fontSize: 13,
          fontWeight: 600,
          color: "#3A2C5C",
          textDecoration: "none",
          transition: "background 0.16s",
        }}
      >
        Get verified{" "}
        <span style={{ color: "#6B3FA0" }}>→</span>
      </Link>

      {/* ===== EMPTY STATE ===== */}
      {!submitted && (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: m ? "80px 24px 40px" : "100px 40px 60px",
            }}
          >
            <Wordmark size="lg" />

            <div
              style={{
                fontSize: 15,
                color: "#6B6080",
                letterSpacing: "0.2px",
                marginTop: 26,
                marginBottom: 42,
                textAlign: "center",
                maxWidth: 440,
                lineHeight: 1.55,
              }}
            >
              Search verified businesses, journalists, and artists — discoverable
              by AI agents through official registries and C2PA-signed media.
            </div>

            {/* Search bar */}
            <div
              style={{
                width: "100%",
                maxWidth: 560,
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "15px 20px",
                border: "1px solid rgba(26,16,53,0.12)",
                borderRadius: 13,
                background: "rgba(107,63,160,0.025)",
                backdropFilter: "blur(8px)",
              }}
            >
              <VerificationIcon size={20} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search verified entities…"
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  fontSize: 17,
                  color: "#1A1035",
                  fontFamily: "inherit",
                }}
              />
              <span
                onClick={handleSubmit}
                style={{
                  fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                  fontSize: 13,
                  color: "#9991AC",
                  cursor: "pointer",
                  padding: "3px 7px",
                  border: "1px solid rgba(26,16,53,0.10)",
                  borderRadius: 5,
                }}
              >
                ↵
              </span>
            </div>

            {/* Trust strip */}
            <div
              style={{
                marginTop: 24,
                fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                fontSize: 11.5,
                color: "#9991AC",
                letterSpacing: "0.4px",
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <span>registry:attested</span>
              <span style={{ color: "#D8D2E2" }}>·</span>
              <span>c2pa:verified</span>
              <span style={{ color: "#D8D2E2" }}>·</span>
              <span>btc:ts:confirmed</span>
            </div>
          </div>

          {/* Footer */}
          <footer
            style={{
              borderTop: "1px solid rgba(26,16,53,0.08)",
              background: "rgba(107,63,160,0.02)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              style={{
                padding: "13px 28px",
                borderBottom: "1px solid rgba(26,16,53,0.06)",
                fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                fontSize: 12,
                color: "#9991AC",
                letterSpacing: "0.3px",
              }}
            >
              Operating under EU · US · APAC registry standards
            </div>
            <div
              style={{
                padding: "15px 28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                fontSize: 13,
                color: "#6B6080",
              }}
            >
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <a
                  href={process.env.NEXT_PUBLIC_LANDING_URL ?? "http://localhost:3000"}
                  style={{ color: "#6B6080", textDecoration: "none" }}
                  onMouseEnter={(e) =>
                    ((e.target as HTMLElement).style.color = "#6B3FA0")
                  }
                  onMouseLeave={(e) =>
                    ((e.target as HTMLElement).style.color = "#6B6080")
                  }
                >
                  About
                </a>
                {["Registries", "For Agents"].map((l) => (
                  <span
                    key={l}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) =>
                      ((e.target as HTMLElement).style.color = "#6B3FA0")
                    }
                    onMouseLeave={(e) =>
                      ((e.target as HTMLElement).style.color = "#6B6080")
                    }
                  >
                    {l}
                  </span>
                ))}
                <Link
                  href="/claim"
                  style={{ color: "#6B6080", textDecoration: "none" }}
                  onMouseEnter={(e) =>
                    ((e.target as HTMLElement).style.color = "#6B3FA0")
                  }
                  onMouseLeave={(e) =>
                    ((e.target as HTMLElement).style.color = "#6B6080")
                  }
                >
                  For Businesses
                </Link>
                <span
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) =>
                    ((e.target as HTMLElement).style.color = "#6B3FA0")
                  }
                  onMouseLeave={(e) =>
                    ((e.target as HTMLElement).style.color = "#6B6080")
                  }
                >
                  How Verification Works
                </span>
              </div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {["Privacy", "Terms", "API", "Settings"].map((l) => (
                  <span
                    key={l}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) =>
                      ((e.target as HTMLElement).style.color = "#6B3FA0")
                    }
                    onMouseLeave={(e) =>
                      ((e.target as HTMLElement).style.color = "#6B6080")
                    }
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* ===== RESULTS STATE ===== */}
      {submitted && (
        <div
          style={{
            maxWidth: 880,
            margin: "0 auto",
            padding: m ? "72px 16px 60px" : "80px 24px 80px",
          }}
        >
          {/* Sticky search bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 18px",
              border: "1px solid rgba(26,16,53,0.12)",
              borderRadius: 13,
              background: "rgba(107,63,160,0.025)",
              backdropFilter: "blur(8px)",
              marginBottom: 22,
            }}
          >
            <VerificationIcon size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search verified entities…"
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                background: "transparent",
                fontSize: 16,
                color: "#1A1035",
                fontFamily: "inherit",
              }}
            />
            <span
              style={{
                fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                fontSize: 11,
                color: "#9991AC",
                letterSpacing: "0.3px",
                whiteSpace: "nowrap",
              }}
            >
              verified-only
            </span>
          </div>

          {/* Filter row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              padding: "0 4px 14px",
              borderBottom: "1px solid rgba(26,16,53,0.08)",
            }}
          >
            <div style={{ display: "flex", gap: m ? 16 : 24, flexWrap: "wrap" }}>
              {filters.map(({ key, label }) => {
                const active = filter === key;
                return (
                  <span
                    key={key}
                    onClick={() => setFilter(key)}
                    style={{
                      fontSize: 13.5,
                      letterSpacing: "0.2px",
                      cursor: "pointer",
                      color: active ? "#1A1035" : "#9991AC",
                      fontWeight: active ? 700 : 400,
                      paddingBottom: 2,
                      borderBottom: active ? "1px solid #6B3FA0" : "1px solid transparent",
                    }}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
            <span
              style={{
                fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                fontSize: 11.5,
                color: "#9991AC",
                letterSpacing: "0.3px",
              }}
            >
              {filteredResults.length} verified
            </span>
          </div>

          {/* Results */}
          {searching && (
            <div
              style={{
                padding: "60px 24px",
                textAlign: "center",
                color: "#9991AC",
                fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                fontSize: 13,
              }}
            >
              Searching registries…
            </div>
          )}

          {!searching && filteredResults.map((r) => (
            <ResultRow key={r.slug} result={r} mobile={m} />
          ))}

          {!searching && filteredResults.length === 0 && (
            <div
              style={{
                padding: "60px 24px",
                textAlign: "center",
                color: "#E8640C",
                fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                fontSize: 13,
              }}
            >
              ✗ No matches found for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({
  result: r,
  mobile: m,
}: {
  result: DisplaySearchResult;
  mobile: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "26px 18px 24px",
        borderBottom: "1px solid rgba(26,16,53,0.07)",
        borderLeft: `3px solid ${r.accentColor}`,
        background: hovered ? "rgba(107,63,160,0.035)" : "transparent",
        transition: "background 0.18s ease",
        cursor: "pointer",
      }}
    >
      {/* Name + level label */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: m ? "wrap" : "nowrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 11, minWidth: 0 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: r.accentColor,
              flexShrink: 0,
              transform: "translateY(-2px)",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: m ? 19 : 22,
              fontWeight: 600,
              letterSpacing: "-0.4px",
              color: "#1A1035",
              lineHeight: 1.15,
            }}
          >
            {r.name}
          </span>
        </div>
        <span
          style={{
            fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
            fontSize: 10,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: r.accentColor,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {r.levelLabel}
        </span>
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 15,
          color: "#6B6080",
          lineHeight: 1.5,
          margin: "9px 0 0 18px",
          maxWidth: 600,
        }}
      >
        {r.description}
      </div>

      {/* Badge pills */}
      <div
        style={{
          display: "flex",
          gap: 9,
          flexWrap: "wrap",
          margin: "15px 0 0 18px",
        }}
      >
        {r.badgePills.map((b) => (
          <BadgePill key={b.text} text={b.text} />
        ))}
      </div>

      {/* Registry line */}
      <div
        style={{
          margin: "14px 0 0 18px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          fontSize: 12,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 600,
            color: "#3A2C5C",
            letterSpacing: "0.2px",
          }}
        >
          <IsoChip code={r.iso} />
          {r.authority}
        </span>
        <span style={{ color: "#D8D2E2" }}>·</span>
        <span style={{ color: "#6B6080" }}>{r.requirement}</span>
      </div>

      {/* Mono meta */}
      <div
        style={{
          fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
          fontSize: 11,
          color: "#9991AC",
          letterSpacing: "0.3px",
          margin: "7px 0 0 18px",
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "#6B6080" }}>{r.registryId}</span>
        <span style={{ color: "#D8D2E2" }}>·</span>
        <span>{r.hash}</span>
      </div>
    </div>
  );
}
