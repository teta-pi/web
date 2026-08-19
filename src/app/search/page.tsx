"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
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
// registry verification is entity-level, so it's real here. 0 marks is a
// state the design mock never shows (its example entities all have ≥1) but
// real claimed-and-unattested entities exist in prod today — they're kept
// out of the ranked list and the trust filters entirely, surfaced only in
// the withheld tail (see buildRow's caller and the withheld-tail known-issue
// this session logs).
function trustBadge(marks: EntityMark[]): { label: string; color: string } {
  if (marks.length === 3) return { label: "L3 media-backed", color: GR_PRIMARY };
  if (marks.length === 2) return { label: "L2 partial chain", color: GR_ORANGE };
  if (marks.length === 1) return { label: "L1 declared only", color: GR_MUTED };
  return { label: "unattested", color: GR_MUTED };
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
    trustLabel: badge.label, trustColor: badge.color,
    answer: buildAnswer(hasRegistry, rawBlocks),
  };
}

// ===== Evidence tile — StatementTile (3.15b), one size down, per spec =====
function EvidenceTile({ block, onOpen }: { block: ProfileBlock; onOpen: () => void }) {
  const [hover, setHover] = useState(false);
  const kind = blockKind(block);
  const marks = blockMarks(block);
  const dark = kind === "VIDEO";
  const mediaLabel = blockMediaLabel(kind);

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
  trust, setTrust, counts, entityCount, blockCount,
}: {
  trust: TrustFilter; setTrust: (t: TrustFilter) => void;
  counts: Record<TrustFilter, number>; entityCount: number; blockCount: number;
}) {
  const tabs: Array<{ id: TrustFilter; label: string; kind: "registry" | "c2pa" | "btc" }> = [
    { id: "ALL", label: "all results", kind: "registry" },
    { id: "FULL", label: "full chain", kind: "registry" },
    { id: "PARTIAL", label: "partial chain", kind: "btc" },
    { id: "DECLARED", label: "declared only", kind: "c2pa" },
  ];
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

// ===== Result row (region 3) =====
function ResultRowView({
  row, expanded, onToggle, onOpenBlock,
}: {
  row: ResultRowData; expanded: boolean; onToggle: () => void; onOpenBlock: (block: ProfileBlock) => void;
}) {
  const [hover, setHover] = useState(false);
  const { result, blocks, marks, trustLabel, trustColor } = row;
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
            <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: trustColor, border: `1px solid ${trustColor}`, padding: "2px 7px", letterSpacing: "0.6px" }}>
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

// ===== Withheld tail (region 4) =====
// The design spec's "unverified open-source mentions" (names scraped from
// outside the platform with no signed block) has no backend behind it —
// there's no mention-harvesting feature anywhere in this codebase. What
// prod *does* have today is claimed entities with zero attestations (no
// registry, no signed block) — the real, honest analogue: kept out of the
// ranked list and every trust filter, surfaced only here, revealed with a
// real (not fabricated) count from the same fetched result set. Logged in
// docs/known-issues.md.
function WithheldTail({ withheld }: { withheld: ResultRowData[] }) {
  const [show, setShow] = useState(false);
  if (withheld.length === 0) return null;

  return (
    <div style={{ padding: "22px 34px 24px", background: GR_RAISED }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span style={{ width: 11, height: 11, border: `1.5px dashed ${GR_MUTED}`, borderRadius: "50%", flexShrink: 0 }} />
        <span style={{ fontFamily: GR_MONO_FONT, fontSize: 11, letterSpacing: "1.2px", textTransform: "uppercase", color: GR_MUTED }}>
          {withheld.length} unverified mention{withheld.length === 1 ? "" : "s"} withheld
        </span>
      </div>
      <div style={{ fontSize: 13.5, color: GR_BODY, lineHeight: 1.55, marginTop: 9, maxWidth: 620 }}>
        Claimed pages with no registry check and no signed block behind them yet. Shown only if you ask for them explicitly.
      </div>
      <span
        onClick={() => setShow((s) => !s)}
        style={{ display: "inline-block", fontSize: 13, fontWeight: 600, color: GR_PRIMARY, border: `1px solid ${GR_LILAC}`, padding: "9px 16px", borderRadius: 4, cursor: "pointer", marginTop: 14 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = GR_PRIMARY; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = GR_LILAC; }}
      >
        {show ? "Hide unverified" : "Show unverified"}
      </span>

      {show && (
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 1, background: GR_BORDER, border: `1px solid ${GR_BORDER}` }}>
          {withheld.map((w) => (
            <Link
              key={w.result.id}
              href={`/e/${w.result.slug}`}
              style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "11px 15px", background: "#fff", textDecoration: "none" }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: GR_INK }}>{w.result.name}</span>
              <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: GR_MUTED }}>
                {ENTITY_TYPE_LABEL[w.result.entity_type].toLowerCase()} · no attestation on record
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

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
function BoardSearchNav({ input, setInput, onSubmit }: { input: string; setInput: (v: string) => void; onSubmit: () => void }) {
  const { token } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
        setRows(built);
        // First *ranked* (≥1 mark) result expanded by default, matching the
        // design spec — seeded once per query, same as the prototype (it
        // doesn't re-seed when the trust filter changes afterward).
        const firstRanked = built.find((row) => row.marks.length > 0);
        setExpanded(firstRanked ? { [firstRanked.result.id]: true } : {});
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

  // Claimed-but-unattested entities (0 marks) never enter the ranked list or
  // the trust filters — only the withheld tail. See WithheldTail's comment.
  const ranked = rows?.filter((r) => r.marks.length > 0)
    .sort((a, b) => b.marks.length - a.marks.length || b.result.relevance_score - a.result.relevance_score) ?? [];
  const withheld = rows?.filter((r) => r.marks.length === 0) ?? [];

  const visible = ranked.filter((r) =>
    trust === "ALL" ? true :
    trust === "FULL" ? r.marks.length === 3 :
    trust === "PARTIAL" ? r.marks.length === 2 :
    r.marks.length === 1
  );
  const counts: Record<TrustFilter, number> = {
    ALL: ranked.length,
    FULL: ranked.filter((r) => r.marks.length === 3).length,
    PARTIAL: ranked.filter((r) => r.marks.length === 2).length,
    DECLARED: ranked.filter((r) => r.marks.length === 1).length,
  };
  const blockCount = visible.reduce((n, r) => n + r.blocks.length, 0);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 50%,#EDF1FB 100%)", color: GR_INK }}>
      <AppHeader />
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: `${APP_HEADER_H + 32}px 24px 100px` }}>
        <div style={{ background: "#fff", border: `1px solid ${GR_BORDER}` }}>
          <BoardSearchNav input={input} setInput={setInput} onSubmit={submit} />

          {!q.trim() && <StatusMessage>Search verified businesses, journalists, and creators by name or description.</StatusMessage>}
          {q.trim() !== "" && loading && <StatusMessage>Searching registries…</StatusMessage>}
          {q.trim() !== "" && !loading && error && <StatusMessage>✗ Search is unavailable right now — try again shortly.</StatusMessage>}
          {q.trim() !== "" && !loading && !error && rows && rows.length === 0 && (
            <StatusMessage>✗ No matches found for &quot;{q}&quot;</StatusMessage>
          )}

          {q.trim() !== "" && !loading && !error && rows && rows.length > 0 && (
            <>
              <EvidenceFilterBar trust={trust} setTrust={setTrust} counts={counts} entityCount={visible.length} blockCount={blockCount} />
              {visible.length === 0 && <StatusMessage>No entities at this trust level yet.</StatusMessage>}
              {visible.map((row) => (
                <ResultRowView
                  key={row.result.id}
                  row={row}
                  expanded={!!expanded[row.result.id]}
                  onToggle={() => setExpanded((s) => ({ ...s, [row.result.id]: !s[row.result.id] }))}
                  onOpenBlock={(block) => setOpenBlock({ block, ownerName: row.result.name, ownerSlug: row.result.slug })}
                />
              ))}
              <WithheldTail withheld={withheld} />
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
