"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
// Same local pattern as page.tsx / profile/page.tsx (3.15f, 3.16a) — kept as
// a local copy since these pages don't share a components module yet.
function useViewport() {
  const [vw, setVw] = useState(1280);
  useEffect(() => {
    const u = () => setVw(window.innerWidth);
    u();
    window.addEventListener("resize", u);
    return () => window.removeEventListener("resize", u);
  }, []);
  return vw;
}
import { useRouter, useSearchParams } from "next/navigation";
import { searchApi, blockApi } from "@/lib/api";
import type { SearchResult } from "@/lib/types";
import { ENTITY_TYPE_LABEL } from "@/lib/types";
import AppHeader, { APP_HEADER_H } from "@/components/AppHeader";
import { useAuthStore } from "@/stores/useAuthStore";
import type { ProfileBlock } from "@/stores/useProfileStore";
import {
  GR_INK, GR_BODY, GR_MUTED, GR_PRIMARY, GR_PRIMARY_HOVER, GR_LILAC, GR_ORANGE,
  GR_BORDER, GR_RAISED, GR_MONO_FONT, GR_STRIPE, GR_INKSTRIPE,
  mapServerBlock, blockKind, blockMarks, blockMediaLabel,
  SealGlyph, BlockDetailModal, type LedgerKind,
} from "@/components/GridOfRecord";

// Search results fetch one blockApi.list() per row to derive real c2pa/btc
// marks and build the evidence grid — /search itself only returns
// block_count, not per-block signing state (see docs/known-issues.md). Kept
// modest since every extra row is an extra parallel request.
const RESULT_LIMIT = 12;

type EntityMark = "registry" | "c2pa" | "btc";
type TrustFilter = "ALL" | "FULL" | "PARTIAL" | "DECLARED";

interface ResultRowData {
  result: SearchResult;
  blocks: ProfileBlock[];
  marks: EntityMark[];
  trustLabel: string;
  trustColor: string;
  trustDashed: boolean;
  answer: string;
}

// Deterministic, template-based summary of an entity's real evidence — never
// a model-generated claim (the design spec's own open question: "does the
// answer come from a template or a model? if a model, it needs its own
// provenance marker" — this is the template branch). /search's relevance is
// entity-level (keyword or TWIRA score), not attributed to specific blocks,
// so this describes what's really on record rather than claiming a
// block-level query match the backend can't back up.
function buildAnswer(hasRegistry: boolean, blocks: ProfileBlock[]): string {
  if (blocks.length === 0) {
    return hasRegistry ? "Registry-attested. No blocks published yet." : "No blocks published yet.";
  }
  const titles = blocks.slice(0, 3).map((b) => b.title || "untitled block");
  const more = blocks.length > 3 ? `, and ${blocks.length - 3} more` : "";
  const signed = blocks.filter((b) => b.media?.c2pa_verified || b.media?.bitcoin_confirmed).length;
  const signedPart = signed > 0 ? ` ${signed} signed with C2PA or bitcoin timestamping.` : " None signed yet.";
  const regPart = hasRegistry ? "Registry-attested. " : "";
  return `${regPart}${blocks.length} block${blocks.length === 1 ? "" : "s"} on record: ${titles.join(", ")}${more}.${signedPart}`;
}

// Entity-level marks (unlike a block tile's marks, capped at c2pa+btc since
// there's no per-block registry association — 3.15b) can include all three:
// registry verification is entity-level, so it's real here. 0 marks (L0,
// `verification_level: "none"`) is a normal, documented registry state
// (whitepaper §3.4 — any name can be claimed instantly, free, with no
// registration check) — it ranks last, it is not hidden (3.21 fix; see
// roadmap.md 3.16/3.21 for why 3.16b's "withheld tail" reinterpretation was
// wrong: the design's withheld tail was for unsigned *open-source mentions*,
// a feature that doesn't exist in this codebase — L0 claimed entities are
// not that, they're the spec's own "declaration-only records" which the
// ranking rule says outrank nothing but must still render).
function trustBadge(marks: EntityMark[]): { label: string; color: string; dashed: boolean } {
  if (marks.length === 3) return { label: "L3 media-backed", color: GR_PRIMARY, dashed: false };
  if (marks.length === 2) return { label: "L2 partial chain", color: GR_ORANGE, dashed: false };
  if (marks.length === 1) return { label: "L1 declared only", color: GR_MUTED, dashed: false };
  return { label: "L0 no attestation on record", color: GR_MUTED, dashed: true };
}

function buildRow(result: SearchResult, rawBlocks: ProfileBlock[]): ResultRowData {
  const hasRegistry = !!result.registry_data;
  const hasC2pa = rawBlocks.some((b) => b.media?.c2pa_verified);
  const hasBtc = rawBlocks.some((b) => b.media?.bitcoin_confirmed);
  const marks: EntityMark[] = [
    ...(hasRegistry ? (["registry"] as const) : []),
    ...(hasC2pa ? (["c2pa"] as const) : []),
    ...(hasBtc ? (["btc"] as const) : []),
  ];
  const badge = trustBadge(marks);
  return {
    result, blocks: rawBlocks, marks,
    trustLabel: badge.label, trustColor: badge.color, trustDashed: badge.dashed,
    answer: buildAnswer(hasRegistry, rawBlocks),
  };
}

// ===== Evidence tile — StatementTile (3.15b), one size down, per spec =====
function EvidenceTile({ block, onOpen, mobile = false }: { block: ProfileBlock; onOpen: () => void; mobile?: boolean }) {
  const [hover, setHover] = useState(false);
  const kind = blockKind(block);
  const marks = blockMarks(block);
  const dark = kind === "VIDEO";
  const mediaLabel = blockMediaLabel(kind);

  // Mobile variant collapses the header row into the media area (kind +
  // marks pinned top, no separate meta-bearing header bar) per the design's
  // 2-up mobile evidence grid — the desktop three-row tile doesn't fit at
  // 390px with only two columns of breathing room.
  if (mobile) {
    return (
      <div
        onClick={onOpen}
        style={{ aspectRatio: "1", border: `1px solid ${GR_BORDER}`, background: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <div style={{ flex: 1, minHeight: 0, background: dark ? GR_INKSTRIPE : GR_STRIPE, display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: 8 }}>
          <span style={{ fontFamily: GR_MONO_FONT, fontSize: 9, color: dark ? GR_LILAC : GR_MUTED }}>{kind}</span>
          <span style={{ display: "flex", gap: 3 }}>
            {marks.map((mk) => <SealGlyph key={mk} kind={mk} verified size={6} />)}
          </span>
        </div>
        <div style={{ padding: 8, borderTop: "1px solid #F1EDF9", flexShrink: 0, fontSize: 11, fontWeight: 600, lineHeight: 1.25, color: GR_INK }}>
          {block.title || "Untitled block"}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        aspectRatio: "1", border: `1px solid ${hover ? GR_PRIMARY : GR_BORDER}`, background: "#fff",
        cursor: "pointer", display: "flex", flexDirection: "column", overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 11px", borderBottom: "1px solid #F1EDF9", flexShrink: 0 }}>
        <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: GR_MUTED, letterSpacing: "0.5px" }}>{kind}</span>
        <span style={{ display: "flex", gap: 3 }}>
          {marks.map((mk) => <SealGlyph key={mk} kind={mk} verified size={7} />)}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, background: dark ? GR_INKSTRIPE : GR_STRIPE, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: GR_MONO_FONT, fontSize: 9.5, color: dark ? GR_LILAC : GR_MUTED }}>{mediaLabel}</span>
      </div>
      <div style={{ padding: "10px 11px 11px", borderTop: "1px solid #F1EDF9", flexShrink: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, color: GR_INK }}>{block.title || "Untitled block"}</div>
      </div>
    </div>
  );
}

// ===== Evidence filter bar (region 2) =====
function EvidenceFilterBar({
  trust, setTrust, counts, entityCount, blockCount, mobile = false,
}: {
  trust: TrustFilter; setTrust: (t: TrustFilter) => void;
  counts: Record<TrustFilter, number>; entityCount: number; blockCount: number; mobile?: boolean;
}) {
  const tabs: Array<{ id: TrustFilter; label: string; kind: "registry" | "c2pa" | "btc" }> = [
    { id: "ALL", label: "all results", kind: "registry" },
    { id: "FULL", label: "full chain", kind: "registry" },
    { id: "PARTIAL", label: "partial chain", kind: "btc" },
    { id: "DECLARED", label: "declared only", kind: "c2pa" },
  ];

  // Mobile: the count cell drops (no room at 390px) and the bar scrolls
  // horizontally instead of each tab compressing to fit — per spec, tabs
  // must not wrap to multiple lines.
  if (mobile) {
    return (
      <div style={{ display: "flex", overflowX: "auto", borderBottom: `1px solid ${GR_BORDER}`, background: GR_RAISED }}>
        {tabs.map((t) => {
          const selected = trust === t.id;
          return (
            <div
              key={t.id}
              onClick={() => setTrust(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "11px 14px",
                borderRight: `1px solid ${GR_BORDER}`, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                background: selected ? "#F4F0FB" : "transparent",
                boxShadow: selected ? `inset 0 -2px 0 0 ${GR_PRIMARY}` : "none",
              }}
            >
              <SealGlyph kind={t.kind} verified={t.id !== "ALL"} size={9} />
              <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: selected ? GR_INK : GR_BODY }}>
                {t.label} {counts[t.id]}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "stretch", borderBottom: `1px solid ${GR_BORDER}`, background: GR_RAISED }}>
      {tabs.map((t) => {
        const selected = trust === t.id;
        return (
          <div
            key={t.id}
            onClick={() => setTrust(t.id)}
            style={{
              flex: 1, display: "flex", alignItems: "center", gap: 11, padding: "14px 20px",
              borderRight: `1px solid ${GR_BORDER}`, cursor: "pointer",
              background: selected ? "#F4F0FB" : "transparent",
              boxShadow: selected ? `inset 0 -2px 0 0 ${GR_PRIMARY}` : "none",
            }}
          >
            <SealGlyph kind={t.kind} verified={t.id !== "ALL"} size={12} />
            <span style={{ fontFamily: GR_MONO_FONT, fontSize: 11.5, color: selected ? GR_INK : GR_BODY, letterSpacing: "0.3px" }}>
              {t.label}
            </span>
            <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10.5, color: GR_MUTED, marginLeft: "auto" }}>{counts[t.id]}</span>
          </div>
        );
      })}
      <div style={{ width: 200, flexShrink: 0, display: "flex", alignItems: "center", padding: "14px 20px" }}>
        <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: GR_MUTED, lineHeight: 1.5 }}>
          {entityCount} entities<br />{blockCount} matched blocks
        </span>
      </div>
    </div>
  );
}

// Mobile result row: avatar + name + seal glyphs + trust label, a short
// answer, and a 2-up evidence grid (first two blocks) — per spec. Evidence
// is always shown (no collapse toggle) since the row is compact enough at
// two blocks that hiding it adds a tap for no space saved.
function MobileResultRowView({
  row, onOpenBlock,
}: {
  row: ResultRowData; onOpenBlock: (block: ProfileBlock) => void;
}) {
  const { result, blocks, marks, trustLabel, trustColor, trustDashed } = row;
  const mobileBlocks = blocks.slice(0, 2);

  return (
    <div style={{ borderBottom: `1px solid ${GR_BORDER}`, padding: 16 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ width: 48, height: 48, flexShrink: 0, border: `1px solid ${GR_BORDER}`, background: GR_STRIPE }} />
        <div style={{ minWidth: 0 }}>
          <Link
            href={`/e/${result.slug}`}
            style={{ display: "block", fontSize: 16, fontWeight: 700, letterSpacing: "-0.4px", lineHeight: 1.15, color: GR_INK, textDecoration: "none" }}
          >
            {result.name}
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, flexWrap: "wrap" }}>
            {marks.map((mk) => <SealGlyph key={mk} kind={mk} verified size={9} />)}
            <span style={{ fontFamily: GR_MONO_FONT, fontSize: 9.5, color: trustColor, border: `1px ${trustDashed ? "dashed" : "solid"} ${trustColor}`, padding: "1px 5px" }}>
              {trustLabel}
            </span>
          </div>
        </div>
      </div>
      <p style={{ fontSize: 13.5, color: GR_BODY, lineHeight: 1.5, margin: "11px 0 0" }}>{row.answer}</p>
      {mobileBlocks.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginTop: 12 }}>
          {mobileBlocks.map((b) => (
            <EvidenceTile key={b.id} block={b} onOpen={() => onOpenBlock(b)} mobile />
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Result row (region 3) =====
function ResultRowView({
  row, expanded, onToggle, onOpenBlock,
}: {
  row: ResultRowData; expanded: boolean; onToggle: () => void; onOpenBlock: (block: ProfileBlock) => void;
}) {
  const [hover, setHover] = useState(false);
  const { result, blocks, marks, trustLabel, trustColor, trustDashed } = row;
  const showBg = hover || expanded;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ borderBottom: `1px solid ${GR_BORDER}`, padding: "24px 34px 26px", background: showBg ? GR_RAISED : "#fff" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div style={{ width: 72, height: 72, flexShrink: 0, border: `1px solid ${GR_BORDER}`, background: GR_STRIPE }} />
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 11, flexWrap: "wrap" }}>
            <Link
              href={`/e/${result.slug}`}
              style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.7px", color: GR_INK, lineHeight: 1.1, textDecoration: "none" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = GR_PRIMARY; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = GR_INK; }}
            >
              {result.name}
            </Link>
            <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10.5, color: GR_PRIMARY, border: `1px solid ${GR_LILAC}`, padding: "2px 7px" }}>
              tetapi.dev/{result.slug}
            </span>
            <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10, letterSpacing: "1px", textTransform: "uppercase", color: GR_MUTED }}>
              {ENTITY_TYPE_LABEL[result.entity_type].toLowerCase()}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 11, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              {marks.map((mk) => (
                <span key={mk} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <SealGlyph kind={mk} verified size={10} />
                  <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: GR_BODY }}>{mk}</span>
                </span>
              ))}
            </span>
            <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: trustColor, border: `1px ${trustDashed ? "dashed" : "solid"} ${trustColor}`, padding: "2px 7px", letterSpacing: "0.6px" }}>
              {trustLabel}
            </span>
            <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: GR_MUTED }}>
              {result.block_count} block{result.block_count === 1 ? "" : "s"} · — agent lookups / 30d
            </span>
          </div>

          <p style={{ fontSize: 14.5, color: GR_BODY, lineHeight: 1.55, margin: "12px 0 0", maxWidth: 660 }}>{row.answer}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
          <Link
            href={`/e/${result.slug}`}
            style={{ fontSize: 13.5, fontWeight: 600, color: "#fff", background: GR_PRIMARY, padding: "10px 18px", borderRadius: 4, cursor: "pointer", textAlign: "center", textDecoration: "none" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = GR_PRIMARY_HOVER; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = GR_PRIMARY; }}
          >
            Open page
          </Link>
          <span
            onClick={onToggle}
            style={{ fontSize: 13, fontWeight: 600, color: GR_PRIMARY, border: `1px solid ${GR_LILAC}`, padding: "10px 18px", borderRadius: 4, cursor: "pointer", textAlign: "center" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = GR_PRIMARY; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = GR_LILAC; }}
          >
            {expanded ? "Hide evidence" : `Show ${blocks.length} block${blocks.length === 1 ? "" : "s"}`}
          </span>
        </div>
      </div>

      {expanded && blocks.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 18, paddingLeft: 92 }}>
          {blocks.map((b) => (
            <EvidenceTile key={b.id} block={b} onOpen={() => onOpenBlock(b)} />
          ))}
        </div>
      )}
    </div>
  );
}

// 3.21: the design spec's "withheld tail" was for unsigned open-source
// *mentions* — names scraped from outside the platform, with no entity
// record in this database at all. That feature (mention-harvesting) has
// never existed here. 3.16b conflated it with claimed-but-unattested
// entities (L0, marks.length === 0) and hid those behind a "Show
// unverified" button instead — but L0 is a normal, documented registry
// state (whitepaper §3.4), not an unverified external mention, and the
// spec's own ranking rule says weaker evidence ranks last, never hidden.
// Fixed: L0 rows render in the ranked list below (badged "L0 no attestation
// on record", dashed border) instead of a separate withheld tail. There is
// still no real content for a "show unverified mentions" action, so the
// button was removed rather than left dead — see docs/known-issues.md.

// ===== Nav with inline search (region 1 addition — AppHeader stays as the
// app-wide fixed chrome per 3.15a's precedent; this is just the board's own
// search box + My page link, the part of region 1 that's genuinely new).
// "My page" is a logged-in-only quick link (same rule AccountMenu already
// enforces in AppHeader above) — this second nav bar had its own separate
// Link with no auth check at all, which is the actual leak: AppHeader's own
// auth-aware AccountMenu was rendering correctly the whole time, but this
// duplicate link below it wasn't gated on anything. `mounted` mirrors
// AccountMenu's own guard so this doesn't flash "My page" during the first
// paint before the persisted auth store hydrates. =====
function BoardSearchNav({ input, setInput, onSubmit, mobile = false }: { input: string; setInput: (v: string) => void; onSubmit: () => void; mobile?: boolean }) {
  const { token } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (mobile) {
    return (
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${GR_BORDER}` }}>
        <div style={{ display: "flex", border: `1px solid ${GR_BORDER}`, minWidth: 0 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "0 11px", minWidth: 0 }}>
            <span style={{ width: 10, height: 10, flexShrink: 0, border: `1.5px solid ${GR_MUTED}`, borderRadius: "50%" }} />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
              placeholder="Search verified entities…"
              style={{
                display: "block", flex: 1, minWidth: 0, border: "none", background: "transparent",
                fontFamily: GR_MONO_FONT, fontSize: 11.5, color: GR_INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                padding: "10px 0",
              }}
            />
          </div>
          <span
            onClick={onSubmit}
            style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: GR_PRIMARY, padding: "10px 13px", cursor: "pointer", flexShrink: 0 }}
          >
            Go
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "12px 26px", borderBottom: `1px solid ${GR_BORDER}` }}>
      <div style={{ flex: 1, display: "flex", border: `1px solid ${GR_BORDER}`, minWidth: 0 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", minWidth: 0 }}>
          <span style={{ width: 11, height: 11, flexShrink: 0, border: `1.5px solid ${GR_MUTED}`, borderRadius: "50%" }} />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            placeholder="Search verified entities…"
            style={{
              display: "block", flex: 1, minWidth: 0, border: "none", background: "transparent",
              fontFamily: GR_MONO_FONT, fontSize: 13, color: GR_INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              padding: "11px 0",
            }}
          />
        </div>
        <span
          onClick={onSubmit}
          style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: GR_PRIMARY, padding: "11px 18px", cursor: "pointer", flexShrink: 0 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = GR_PRIMARY_HOVER; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = GR_PRIMARY; }}
        >
          Search
        </span>
      </div>
      {mounted && token && (
        <Link href="/profile" style={{ fontSize: 13.5, color: GR_BODY, flexShrink: 0, textDecoration: "none" }}>My page</Link>
      )}
    </div>
  );
}

function StatusMessage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "60px 24px", textAlign: "center", color: GR_MUTED, fontFamily: GR_MONO_FONT, fontSize: 13 }}>
      {children}
    </div>
  );
}

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const vw = useViewport();
  const m = vw < 640;

  const [input, setInput] = useState(q);
  const [rows, setRows] = useState<ResultRowData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [trust, setTrust] = useState<TrustFilter>("ALL");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openBlock, setOpenBlock] = useState<{ block: ProfileBlock; ownerName: string; ownerSlug: string } | null>(null);

  useEffect(() => setInput(q), [q]);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setRows(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    setTrust("ALL");
    (async () => {
      try {
        const results = await searchApi.search(term, "any", undefined, RESULT_LIMIT);
        const blockLists = await Promise.all(
          results.map((r) => blockApi.list(r.id).then((blocks) => blocks.map(mapServerBlock)).catch(() => []))
        );
        if (cancelled) return;
        const built = results.map((r, i) => buildRow(r, blockLists[i]));
        // Full chain > partial chain > declared-only > L0, never by
        // engagement/payment (design spec's ranking rule) — sorted once here
        // so both rendering and the default-expand pick below agree on order.
        const sorted = [...built].sort(
          (a, b) => b.marks.length - a.marks.length || b.result.relevance_score - a.result.relevance_score
        );
        setRows(sorted);
        // First result expanded by default, matching the design spec —
        // seeded once per query, same as the prototype (it doesn't re-seed
        // when the trust filter changes afterward).
        setExpanded(sorted.length > 0 ? { [sorted[0].result.id]: true } : {});
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [q]);

  const submit = () => {
    const term = input.trim();
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  };

  // All rows render in the ranked list, already sorted (see the fetch
  // effect above) — L0 (0 marks) sorts last but is never hidden (3.21 fix).
  // The FULL/PARTIAL/DECLARED filter tabs still only match ≥1 mark, so L0
  // rows only ever show under "all results" — they don't get their own tab
  // (there's nothing weaker than "declared only" worth a dedicated filter).
  const all = rows ?? [];

  const visible = all.filter((r) =>
    trust === "ALL" ? true :
    trust === "FULL" ? r.marks.length === 3 :
    trust === "PARTIAL" ? r.marks.length === 2 :
    r.marks.length === 1
  );
  const counts: Record<TrustFilter, number> = {
    ALL: all.length,
    FULL: all.filter((r) => r.marks.length === 3).length,
    PARTIAL: all.filter((r) => r.marks.length === 2).length,
    DECLARED: all.filter((r) => r.marks.length === 1).length,
  };
  const blockCount = visible.reduce((n, r) => n + r.blocks.length, 0);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 50%,#EDF1FB 100%)", color: GR_INK }}>
      <AppHeader />
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: m ? `${APP_HEADER_H + 20}px 16px 60px` : `${APP_HEADER_H + 32}px 24px 100px` }}>
        <div style={{ background: "#fff", border: `1px solid ${GR_BORDER}` }}>
          <BoardSearchNav input={input} setInput={setInput} onSubmit={submit} mobile={m} />

          {!q.trim() && <StatusMessage>Search verified businesses, journalists, and creators by name or description.</StatusMessage>}
          {q.trim() !== "" && loading && <StatusMessage>Searching registries…</StatusMessage>}
          {q.trim() !== "" && !loading && error && <StatusMessage>✗ Search is unavailable right now — try again shortly.</StatusMessage>}
          {q.trim() !== "" && !loading && !error && rows && rows.length === 0 && (
            <StatusMessage>✗ No matches found for &quot;{q}&quot;</StatusMessage>
          )}

          {q.trim() !== "" && !loading && !error && rows && rows.length > 0 && (
            <>
              <EvidenceFilterBar trust={trust} setTrust={setTrust} counts={counts} entityCount={visible.length} blockCount={blockCount} mobile={m} />
              {visible.length === 0 && <StatusMessage>No entities at this trust level yet.</StatusMessage>}
              {visible.map((row) =>
                m ? (
                  <MobileResultRowView
                    key={row.result.id}
                    row={row}
                    onOpenBlock={(block) => setOpenBlock({ block, ownerName: row.result.name, ownerSlug: row.result.slug })}
                  />
                ) : (
                  <ResultRowView
                    key={row.result.id}
                    row={row}
                    expanded={!!expanded[row.result.id]}
                    onToggle={() => setExpanded((s) => ({ ...s, [row.result.id]: !s[row.result.id] }))}
                    onOpenBlock={(block) => setOpenBlock({ block, ownerName: row.result.name, ownerSlug: row.result.slug })}
                  />
                )
              )}
            </>
          )}
        </div>
      </div>

      {openBlock && (
        <BlockDetailModal
          block={openBlock.block}
          headerPrefix={openBlock.ownerName}
          onClose={() => setOpenBlock(null)}
          secondaryAction={{ label: "Open entity page", onClick: () => router.push(`/e/${openBlock.ownerSlug}`) }}
        />
      )}
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
