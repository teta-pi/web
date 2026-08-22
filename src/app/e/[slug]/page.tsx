"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppHeader, { APP_HEADER_H } from "@/components/AppHeader";
import {
  GR_INK, GR_BODY, GR_MUTED, GR_PRIMARY, GR_LILAC, GR_ORANGE,
  GR_BORDER, GR_RAISED, GR_MONO_FONT, GR_STRIPE, GR_INKSTRIPE,
  blockMediaLabel, formatTileDate, SealGlyph, type LedgerKind, type SealKind,
} from "@/components/GridOfRecord";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Two accent colors used across the app for these exact trust signals
// (domain/email verification) — same hex values profile.tsx's own method
// cards use, just not part of the shared registry/c2pa/btc GridOfRecord set.
const GR_DOMAIN = "#3FA97C";
const GR_EMAIL = "#3F7FA0";

// Same local pattern as page.tsx / profile/page.tsx / search/page.tsx /
// claim/page.tsx (3.15f, 3.16a) — no shared hook module yet.
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

interface PublicProfile {
  name: string;
  slug: string;
  entity_type: string;
  description: string | null;
  country: string | null;
  trust_level: string;
  registry: { registry: string | null; status: string; registry_id: string | null };
  // Brand → verified legal entity link, publicly disclosed (not hidden) per
  // docs/verification-rework.md §3.
  legal_entity: { id: string; name: string; slug: string; registry_status: string } | null;
  agent_endpoint: string | null;
  agent_endpoint_verified: boolean;
  blocks: {
    title: string;
    description: string | null;
    media: { type: string; c2pa_verified: boolean; captured_at: string | null; bitcoin_confirmed: boolean; bitcoin_block: number | null }[];
  }[];
  created_at: string;
}

type PublicBlock = PublicProfile["blocks"][number];

const LEVEL_COLORS: Record<string, string> = {
  full: GR_PRIMARY, live: GR_PRIMARY, partial: "#7A68D4", domain: GR_DOMAIN,
  email: GR_EMAIL, registry: GR_MUTED, none: GR_MUTED,
};

const TRUST_ORDER = ["none", "registry", "email", "domain", "partial", "full", "live"];
function trustOrdinal(level: string): number {
  const i = TRUST_ORDER.indexOf(level);
  return i < 0 ? 0 : i;
}

function yearOf(dateLike: string | null | undefined): string {
  if (!dateLike) return "—";
  const m = dateLike.match(/\d{4}/);
  return m ? m[0] : "—";
}

function blockKindOf(block: PublicBlock): LedgerKind {
  const media = block.media[0];
  if (!media) return "TEXT";
  if (media.type === "video") return "VIDEO";
  if (media.type === "photo") return "PHOTO";
  return "FILE";
}

function blockMarksOf(block: PublicBlock): Array<"c2pa" | "btc"> {
  const marks: Array<"c2pa" | "btc"> = [];
  if (block.media.some((mm) => mm.c2pa_verified)) marks.push("c2pa");
  if (block.media.some((mm) => mm.bitcoin_confirmed)) marks.push("btc");
  return marks;
}

// ===== Attestation bar — same three seals (registry/c2pa/btc) as /profile's
// Visitor mode, derived from this same public payload. No re-check-timestamp
// cell here: the public endpoint returns no updated_at (see docs/known-issues.md). =====
interface AttestationCellData { kind: SealKind; token: string; detail: string; state: string; verified: boolean }

function AttestationCellView({ cell, mobile: m }: { cell: AttestationCellData; mobile: boolean }) {
  const lineColor = cell.verified ? (cell.kind === "btc" ? GR_ORANGE : GR_PRIMARY) : GR_MUTED;
  if (m) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: "1px solid #F1EDF9" }}>
        <SealGlyph kind={cell.kind} verified={cell.verified} size={11} />
        <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: GR_INK, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {cell.token}
        </span>
        <span style={{ fontFamily: GR_MONO_FONT, fontSize: 9.5, color: lineColor, flexShrink: 0, paddingLeft: 8 }}>
          {cell.verified ? "✓ " : ""}{cell.state}
        </span>
      </div>
    );
  }
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, padding: "15px 20px", borderRight: `1px solid ${GR_BORDER}` }}>
      <SealGlyph kind={cell.kind} verified={cell.verified} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: GR_MONO_FONT, fontSize: 11.5, color: GR_INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {cell.token}
        </div>
        <div style={{ fontFamily: GR_MONO_FONT, fontSize: 9.5, color: GR_MUTED, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {cell.detail}
        </div>
      </div>
      <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: lineColor, marginLeft: "auto", flexShrink: 0, paddingLeft: 8 }}>
        {cell.verified ? "✓ " : ""}{cell.state}
      </span>
    </div>
  );
}

function AttestationBar({ profile, mobile: m }: { profile: PublicProfile; mobile: boolean }) {
  // No person/business distinction here (unlike /profile's owner-only
  // AttestationBar) — this public payload's `registry` field is whatever the
  // backend actually found for this entity, business or person alike (e.g. a
  // person-kind entity can carry real registry_data), so it's shown exactly
  // as returned, same as the original page did.
  const registryCell: AttestationCellData = profile.registry.status === "verified"
    ? { kind: "registry", token: "registry:attested", detail: `${profile.registry.registry ?? ""} ${profile.registry.registry_id ?? ""}`.trim() || "verified", state: "attested", verified: true }
    : profile.registry.status === "not_found"
    ? { kind: "registry", token: "registry:not_found", detail: "no match in connected registries", state: "not found", verified: false }
    : profile.registry.status === "pending"
    ? { kind: "registry", token: "registry:pending", detail: "check in progress", state: "pending", verified: false }
    : { kind: "registry", token: "registry:unverified", detail: "not yet checked", state: "unverified", verified: false };

  const total = profile.blocks.length;
  const signed = profile.blocks.filter((b) => b.media.some((mm) => mm.c2pa_verified)).length;
  const c2paCell: AttestationCellData = {
    kind: "c2pa", token: signed > 0 ? "c2pa:verified" : "c2pa:unverified",
    detail: total > 0 ? `${signed} of ${total} blocks signed` : "no blocks yet",
    state: signed > 0 ? "verified" : "unverified", verified: signed > 0,
  };

  const btcBlocks = profile.blocks.filter((b) => b.media.some((mm) => mm.bitcoin_confirmed));
  const latestBtc = btcBlocks.flatMap((b) => b.media).find((mm) => mm.bitcoin_block)?.bitcoin_block ?? null;
  const btcCell: AttestationCellData = {
    kind: "btc", token: btcBlocks.length > 0 ? "btc:ts:confirmed" : "btc:ts:unconfirmed",
    detail: btcBlocks.length > 0
      ? (latestBtc ? `block ${latestBtc.toLocaleString()}` : `${btcBlocks.length} block${btcBlocks.length > 1 ? "s" : ""} confirmed`)
      : total > 0 ? "awaiting confirmation" : "no blocks yet",
    state: btcBlocks.length > 0 ? "confirmed" : "unconfirmed", verified: btcBlocks.length > 0,
  };

  return (
    <div style={{ display: "flex", flexDirection: m ? "column" : "row", borderBottom: `1px solid ${GR_BORDER}`, background: GR_RAISED }}>
      {[registryCell, c2paCell, btcCell].map((c) => (
        <AttestationCellView key={c.kind} cell={c} mobile={m} />
      ))}
    </div>
  );
}

// ===== Identity — avatar tile + name/slug/country + description, same
// layout as /profile's Visitor mode, minus the Edit/Agent mode switch and
// save controls (there's no editing surface on a public page). =====
function EntityIdentity({ profile, mobile: m }: { profile: PublicProfile; mobile: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: m ? "column" : "row", alignItems: m ? "stretch" : "flex-start", gap: m ? 14 : 28, padding: m ? "18px 16px 14px" : "32px 34px 24px" }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div
          style={{
            width: m ? 60 : 104, height: m ? 60 : 104, flexShrink: 0,
            border: `1px solid ${GR_BORDER}`, background: GR_STRIPE,
            display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: m ? 6 : 9,
          }}
        >
          <span style={{ fontFamily: GR_MONO_FONT, fontSize: m ? 8 : 9.5, color: GR_MUTED, letterSpacing: "0.4px" }}>avatar</span>
        </div>
        {m && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px", margin: 0, lineHeight: 1.1, color: GR_INK }}>{profile.name}</h1>
            <div style={{ fontFamily: GR_MONO_FONT, fontSize: 10.5, color: GR_PRIMARY, marginTop: 7 }}>
              tetapi.dev/{profile.slug} · trust {trustOrdinal(profile.trust_level)}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: m ? undefined : "1 1 260px", minWidth: 0 }}>
        {!m && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-1.1px", margin: 0, lineHeight: 1.1, color: GR_INK }}>{profile.name}</h1>
            <span style={{ fontFamily: GR_MONO_FONT, fontSize: 11.5, color: GR_PRIMARY, border: `1px solid ${GR_LILAC}`, padding: "3px 8px" }}>
              tetapi.dev/{profile.slug}
            </span>
            {profile.country && (
              <span style={{ fontFamily: GR_MONO_FONT, fontSize: 11, color: GR_BODY, border: `1px solid ${GR_BORDER}`, padding: "3px 8px" }}>
                {profile.country}
              </span>
            )}
          </div>
        )}
        <div style={{ fontFamily: GR_MONO_FONT, fontSize: 10.5, letterSpacing: "0.6px", textTransform: "uppercase", color: GR_MUTED, marginTop: m ? 0 : 8 }}>
          {profile.entity_type}{m && profile.country ? ` · ${profile.country}` : ""}
        </div>
        <p style={{ fontSize: 15.5, color: profile.description ? GR_BODY : GR_MUTED, lineHeight: 1.55, margin: "13px 0 0", maxWidth: 640 }}>
          {profile.description || "No description yet."}
        </p>
      </div>

      <span
        style={{
          fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
          color: "#fff", background: LEVEL_COLORS[profile.trust_level] ?? GR_MUTED,
          padding: "6px 14px", flexShrink: 0, alignSelf: m ? "flex-start" : undefined,
        }}
      >
        {profile.trust_level === "none" ? "Unverified" : `${profile.trust_level} · verified`}
      </span>
    </div>
  );
}

// ===== Trust chips — email/domain/mcp signals that don't have their own
// attestation-bar cell (registry/c2pa/btc do). =====
function TrustChips({ profile, mobile: m }: { profile: PublicProfile; mobile: boolean }) {
  const chips: { key: string; label: string; color: string }[] = [];
  if (profile.trust_level === "email") chips.push({ key: "email", label: "email:control · verified", color: GR_EMAIL });
  if (profile.trust_level === "domain") chips.push({ key: "domain", label: "dns:txt · verified", color: GR_DOMAIN });
  if (profile.agent_endpoint) {
    chips.push({
      key: "mcp",
      label: `mcp:${profile.agent_endpoint_verified ? "reachable" : "declared"}`,
      color: profile.agent_endpoint_verified ? GR_DOMAIN : GR_MUTED,
    });
  }
  if (chips.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: m ? "0 16px 16px" : "0 34px 20px" }}>
      {chips.map((c) => (
        <span key={c.key} style={{ fontFamily: GR_MONO_FONT, fontSize: 11, color: c.color, border: `1px solid ${GR_BORDER}`, padding: "5px 11px" }}>
          {c.label}
        </span>
      ))}
    </div>
  );
}

// ===== Facts strip — same shape as /profile's Visitor mode, sourced entirely
// from this payload; "agent lookups / 30d" has no backend source on the
// public endpoint either (see docs/known-issues.md), so "blocks on record"
// (real data) fills that slot instead of a fabricated stat. =====
function FactsStrip({ profile, mobile: m }: { profile: PublicProfile; mobile: boolean }) {
  const signedBlocks = profile.blocks.filter((b) => b.media.some((mm) => mm.c2pa_verified || mm.bitcoin_confirmed)).length;
  const stats = [
    { k: "signed blocks", v: String(signedBlocks) },
    { k: "trust level", v: `L${trustOrdinal(profile.trust_level)}` },
    { k: "registered", v: yearOf(profile.created_at) },
    { k: "blocks on record", v: String(profile.blocks.length) },
  ];
  return (
    <div style={{ display: "flex", flexWrap: m ? "wrap" : "nowrap", borderTop: `1px solid ${GR_BORDER}`, borderBottom: `1px solid ${GR_BORDER}` }}>
      {stats.map((s, i) => (
        <div
          key={s.k}
          style={{ flex: m ? "1 1 50%" : 1, minWidth: 0, padding: "16px 34px 17px", borderRight: i < stats.length - 1 ? `1px solid ${GR_BORDER}` : "none" }}
        >
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.6px", lineHeight: 1, color: GR_INK }}>{s.v}</div>
          <div style={{ fontFamily: GR_MONO_FONT, fontSize: 10, letterSpacing: "1.2px", textTransform: "uppercase", color: GR_MUTED, marginTop: 7 }}>{s.k}</div>
        </div>
      ))}
    </div>
  );
}

// ===== Square ledger — same visual language as /profile's StatementTile
// (square borders, mono labels, stripe media placeholder), simplified to what
// the public payload actually carries: no per-block id/hash/storage_url, so
// tiles aren't clickable (nothing was clickable here before either) and
// there's no detail modal to open. Not forced to aspect-ratio 1 like the
// owner's ledger — descriptions here have no hover/modal to expand into, so
// tile height flexes to fit the real text instead of clipping it. =====
function StatementTilePublic({ block, index, mobile: m }: { block: PublicBlock; index: number; mobile: boolean }) {
  const kind = blockKindOf(block);
  const marks = blockMarksOf(block);
  const dark = kind === "VIDEO";
  const dateLabel = formatTileDate(block.media[0]?.captured_at ?? null);
  const btcBlock = block.media.find((mm) => mm.bitcoin_block)?.bitcoin_block ?? null;

  return (
    <div style={{ border: `1px solid ${GR_BORDER}`, background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 13px", borderBottom: "1px solid #F1EDF9" }}>
        <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10.5, color: GR_MUTED, letterSpacing: "0.6px" }}>
          {String(index + 1).padStart(2, "0")} · {kind}
        </span>
        <span style={{ display: "flex", gap: 4 }}>
          {marks.map((mk) => <SealGlyph key={mk} kind={mk} verified size={8} />)}
        </span>
      </div>
      <div style={{ padding: "16px 13px", minHeight: m ? 56 : 72, background: dark ? GR_INKSTRIPE : GR_STRIPE, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: dark ? GR_LILAC : GR_MUTED, letterSpacing: "0.6px" }}>
          {blockMediaLabel(kind)}
        </span>
      </div>
      <div style={{ padding: "12px 13px 13px", borderTop: "1px solid #F1EDF9" }}>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.2px", color: GR_INK }}>
          {block.title || "Untitled block"}
        </div>
        {block.description && (
          <div style={{ fontSize: 12.5, color: GR_BODY, lineHeight: 1.5, marginTop: 6 }}>{block.description}</div>
        )}
        <div style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: GR_MUTED, marginTop: 8 }}>
          {dateLabel}{btcBlock ? ` · BTC #${btcBlock.toLocaleString()}` : ""}
        </div>
      </div>
    </div>
  );
}

function StatementLedgerPublic({ profile, mobile: m }: { profile: PublicProfile; mobile: boolean }) {
  if (profile.blocks.length === 0) {
    return (
      <div style={{ padding: "40px 34px", textAlign: "center", color: GR_MUTED, fontSize: 13.5 }}>
        No public blocks yet.
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "repeat(2,1fr)", gap: 10, padding: m ? "0 16px 18px" : "0 34px 34px" }}>
      {profile.blocks.map((b, i) => (
        <StatementTilePublic key={i} block={b} index={i} mobile={m} />
      ))}
    </div>
  );
}

// ===== Trust footer — the informational half of /profile Visitor mode's
// region 7 (the trust sentence), plus the original page's agent footer note.
// No CTA buttons here: Visitor mode's "Contact"/"Verify all blocks" buttons
// either open the block detail modal (doesn't exist on this payload) or are
// already-documented stubs with no real channel — neither belongs on a
// public page real visitors and agents rely on. =====
function TrustFooter({ profile, mobile: m }: { profile: PublicProfile; mobile: boolean }) {
  return (
    <div style={{ borderTop: `1px solid ${GR_BORDER}`, background: GR_RAISED, padding: m ? "20px 16px 22px" : "22px 34px 24px" }}>
      <div style={{ fontSize: 14.5, color: GR_BODY, lineHeight: 1.55, maxWidth: 620 }}>
        Nothing on {profile.name}&rsquo;s page is self-reported. Each block on record carries its own attestation chain.
      </div>
      <div style={{ fontFamily: GR_MONO_FONT, fontSize: 11, color: GR_MUTED, marginTop: 14, letterSpacing: "0.3px" }}>
        Verifiable by AI agents via MCP · mcp.tetapi.dev · teta_verify_entity
      </div>
    </div>
  );
}

export default function PublicEntityPage() {
  const vw = useViewport();
  const m = vw < 640;
  const params = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params?.slug) return;
    fetch(`${API_BASE}/api/v1/businesses/by-slug/${params.slug}/public`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setProfile)
      .catch(() => setNotFound(true));
  }, [params?.slug]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 50%,#EDF1FB 100%)", color: GR_INK, fontFamily: "'Manrope','Trebuchet MS','Segoe UI',sans-serif", position: "relative" }}>
      <AppHeader />

      <div style={{ maxWidth: 880, margin: "0 auto", padding: m ? `${APP_HEADER_H + 24}px 16px 80px` : `${APP_HEADER_H + 32}px 24px 80px` }}>
        {notFound && (
          <div style={{ background: "#fff", border: `1px solid ${GR_BORDER}`, padding: "48px 40px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: GR_INK, marginBottom: 8 }}>Entity not found</div>
            <div style={{ fontSize: 14.5, color: GR_MUTED }}>This page doesn&apos;t exist or isn&apos;t public.</div>
            <Link href="/" style={{ display: "inline-block", marginTop: 20, fontSize: 14, fontWeight: 600, color: GR_PRIMARY, textDecoration: "none" }}>← Search entities</Link>
          </div>
        )}

        {!profile && !notFound && (
          <div style={{ textAlign: "center", color: GR_MUTED, fontSize: 14, paddingTop: 60 }}>Loading…</div>
        )}

        {profile && (
          <div style={{ background: "#fff", border: `1px solid ${GR_BORDER}` }}>
            <AttestationBar profile={profile} mobile={m} />
            <EntityIdentity profile={profile} mobile={m} />
            <TrustChips profile={profile} mobile={m} />

            {profile.legal_entity && (
              <div style={{ padding: m ? "14px 16px" : "16px 34px", borderTop: `1px solid ${GR_BORDER}`, fontSize: 13.5, color: GR_BODY }}>
                Legal entity:{" "}
                <Link href={`/e/${profile.legal_entity.slug}`} style={{ color: GR_PRIMARY, fontWeight: 600, textDecoration: "none" }}>
                  {profile.legal_entity.name}
                </Link>
                {profile.legal_entity.registry_status === "verified" && (
                  <span style={{ fontFamily: GR_MONO_FONT, fontSize: 11, color: GR_MUTED, marginLeft: 8 }}>registry-verified</span>
                )}
              </div>
            )}

            <FactsStrip profile={profile} mobile={m} />

            <div style={{ padding: m ? "18px 16px 12px" : "22px 34px 15px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <span style={{ fontFamily: GR_MONO_FONT, fontSize: 11, letterSpacing: "1.6px", textTransform: "uppercase", color: GR_PRIMARY }}>
                Statements
              </span>
              <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10.5, color: GR_MUTED }}>{profile.blocks.length} on record</span>
            </div>
            <StatementLedgerPublic profile={profile} mobile={m} />

            <TrustFooter profile={profile} mobile={m} />
          </div>
        )}
      </div>
    </div>
  );
}
