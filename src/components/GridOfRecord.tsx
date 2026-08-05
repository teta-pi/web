"use client";

import { useState } from "react";
import { mediaUrl } from "@/lib/api";
import type { Block } from "@/lib/types";
import type { ProfileBlock } from "@/stores/useProfileStore";

// Shared "Grid of Record" design tokens + pieces used by both the profile
// page (3.15) and the search results page (3.16b) — extracted here rather
// than duplicated so a design-token change or a fix to the block-detail
// modal only has to happen once. See docs/design/profile-grid-of-record/ and
// docs/design/search-home-results/ (teta-pi/infra) for the source specs.
export const GR_INK = "#1A1035";
export const GR_BODY = "#4A3F6B";
export const GR_MUTED = "#9088B0";
export const GR_PRIMARY = "#6B3FA0";
export const GR_PRIMARY_HOVER = "#5A3488";
export const GR_TINT = "#F4F0FB";
export const GR_LILAC = "#C9B8E8";
export const GR_ORANGE = "#E8640C";
export const GR_BORDER = "#E2DCF0";
export const GR_RAISED = "#FBFAFD";
export const GR_MONO_FONT = "ui-monospace,'SF Mono',Menlo,monospace";
export const GR_STRIPE = "repeating-linear-gradient(45deg,#F1EDF9 0 6px,#FBFAFD 6px 12px)";
export const GR_INKSTRIPE = "repeating-linear-gradient(45deg,#241847 0 6px,#1A1035 6px 12px)";

// Map a persisted block from the API onto the shared block shape both pages
// render (profile's own ledger, and now search's per-entity evidence grid).
export function mapServerBlock(b: Block): ProfileBlock {
  const media = b.media?.[0];
  return {
    id: b.id,
    title: b.title ?? "",
    desc: b.description ?? "",
    createdAt: b.created_at,
    media: media
      ? {
          source: media.c2pa_verified ? "pi_camera" : "file",
          phase: "done",
          id: media.id,
          storage_url: media.storage_url,
          original_hash: media.original_hash,
          c2pa_verified: media.c2pa_verified,
          bitcoin_confirmed: media.bitcoin_confirmed,
          bitcoin_block: media.bitcoin_block,
          type: media.type,
          uploaded_at: media.uploaded_at,
        }
      : null,
  };
}

// The real data model has no "audio" media type (MediaItem.type is video|
// photo|file only) and no per-block registry association — both spec
// concepts don't map onto real data (documented in 3.15b, see
// docs/known-issues.md), so KIND drops audio and a tile's seal maxes out at
// c2pa+btc, never registry.
export type LedgerKind = "VIDEO" | "PHOTO" | "TEXT" | "FILE";

export function blockKind(block: ProfileBlock): LedgerKind {
  if (!block.media) return "TEXT";
  if (block.media.type === "video") return "VIDEO";
  if (block.media.type === "photo") return "PHOTO";
  return "FILE";
}

export function blockMarks(block: ProfileBlock): Array<"c2pa" | "btc"> {
  const marks: Array<"c2pa" | "btc"> = [];
  if (block.media?.c2pa_verified) marks.push("c2pa");
  if (block.media?.bitcoin_confirmed) marks.push("btc");
  return marks;
}

export function blockHashLabel(block: ProfileBlock): string {
  return block.media?.original_hash
    ? `sha256:${block.media.original_hash.slice(0, 10)}…${block.media.original_hash.slice(-6)}`
    : "no signature yet";
}

export function blockMediaLabel(kind: LedgerKind): string {
  return kind === "VIDEO" ? "video source" : kind === "PHOTO" ? "photo source" : kind === "FILE" ? "file source" : "plain text · no media";
}

// Matches the spec's "12 JUN 2026" tile-meta format (no time component).
export function formatTileDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${String(d.getUTCDate()).padStart(2, "0")} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export type SealKind = "registry" | "c2pa" | "btc";

export function SealGlyph({ kind, verified, size = 14 }: { kind: SealKind; verified: boolean; size?: number }) {
  const line = verified ? (kind === "btc" ? GR_ORANGE : GR_PRIMARY) : GR_MUTED;
  const fill = kind === "c2pa" ? "transparent" : verified ? line : "transparent";
  const radius = kind === "c2pa" ? "50%" : "1px";
  const rot = kind === "btc" ? "45deg" : "0deg";
  return (
    <span
      style={{
        width: size, height: size, flexShrink: 0, display: "inline-block",
        border: `1.5px solid ${line}`, background: fill, borderRadius: radius, transform: `rotate(${rot})`,
      }}
    />
  );
}

// Block detail modal (3.15d) — literal read-only inspector, identical on
// both pages per the search spec ("Block modal — Identical to the
// profile's"). `headerPrefix` lets each caller supply its own left half of
// the header (`Block 01` on the profile ledger, the owning entity's name on
// search's evidence grid) while the modal still appends `· KIND` itself, and
// `secondaryAction` replaces the profile-only "Replace media" escape hatch
// with whatever the caller's second button should do (or omits it).
export function BlockDetailModal({
  block, headerPrefix, onClose, secondaryAction,
}: {
  block: ProfileBlock; headerPrefix: string; onClose: () => void;
  secondaryAction: { label: string; onClick: () => void } | null;
}) {
  const [imgError, setImgError] = useState(false);
  const kind = blockKind(block);
  const marks = blockMarks(block);
  const dark = kind === "VIDEO";
  const resolvedUrl = block.media?.storage_url ? mediaUrl(block.media.storage_url) : null;
  const showRealImage = kind === "PHOTO" && !!resolvedUrl && !imgError;
  const dateLabel = formatTileDate(block.media?.uploaded_at ?? block.createdAt);

  const rows: Array<{ k: string; v: string }> = [
    { k: "type", v: kind.toLowerCase() },
    { k: "signature", v: blockHashLabel(block) },
    { k: "captured", v: dateLabel },
    { k: "attestations", v: marks.length ? marks.join(" · ") : "none yet" },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 90, background: "rgba(26,16,53,0.55)",
        backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 40,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 600, maxWidth: "100%", background: "#fff", border: `1px solid ${GR_LILAC}` }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 22px", borderBottom: `1px solid ${GR_BORDER}`, background: GR_RAISED }}>
          <span style={{ fontFamily: GR_MONO_FONT, fontSize: 11, letterSpacing: "1.4px", textTransform: "uppercase", color: GR_PRIMARY }}>
            {headerPrefix} · {kind}
          </span>
          <span onClick={onClose} style={{ fontSize: 18, color: GR_MUTED, cursor: "pointer", lineHeight: 1 }}>×</span>
        </div>

        <div style={{ padding: "24px 22px 26px" }}>
          <div
            style={{
              height: 190, border: `1px solid ${GR_BORDER}`, background: dark ? GR_INKSTRIPE : GR_STRIPE,
              display: "flex", alignItems: "flex-end", justifyContent: showRealImage ? undefined : "flex-start",
              padding: 12, overflow: "hidden", position: "relative",
            }}
          >
            {showRealImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedUrl!}
                alt=""
                onError={() => setImgError(true)}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10.5, color: dark ? GR_LILAC : GR_MUTED }}>
                {blockMediaLabel(kind)}
              </span>
            )}
          </div>

          <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.6px", margin: "20px 0 0", lineHeight: 1.25, color: GR_INK }}>
            {block.title || "Untitled block"}
          </h2>
          <div style={{ fontSize: 14.5, color: GR_BODY, lineHeight: 1.6, marginTop: 10 }}>
            {block.desc || "No description yet."}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 1, background: GR_BORDER, border: `1px solid ${GR_BORDER}`, marginTop: 22 }}>
            {rows.map((r) => (
              <div key={r.k} style={{ background: "#fff", padding: "13px 15px" }}>
                <div style={{ fontFamily: GR_MONO_FONT, fontSize: 9.5, letterSpacing: "1.2px", textTransform: "uppercase", color: GR_MUTED }}>
                  {r.k}
                </div>
                <div style={{ fontFamily: GR_MONO_FONT, fontSize: 12, color: GR_INK, marginTop: 6, wordBreak: "break-all" }}>
                  {r.v}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 22, flexWrap: "wrap" }}>
            <span
              onClick={onClose}
              style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: GR_PRIMARY, padding: "11px 20px", borderRadius: 4, cursor: "pointer" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = GR_PRIMARY_HOVER; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = GR_PRIMARY; }}
            >
              Verify chain
            </span>
            {secondaryAction && (
              <span
                onClick={secondaryAction.onClick}
                style={{ fontSize: 14, fontWeight: 600, color: GR_PRIMARY, border: `1px solid ${GR_LILAC}`, padding: "11px 20px", borderRadius: 4, cursor: "pointer" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = GR_PRIMARY; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = GR_LILAC; }}
              >
                {secondaryAction.label}
              </span>
            )}
          </div>
          <div style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: GR_MUTED, marginTop: 12, lineHeight: 1.5 }}>
            Verify chain re-runs the same hourly automatic check — a manual trigger isn&apos;t wired to a backend endpoint yet.
          </div>
        </div>
      </div>
    </div>
  );
}
