"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "react-qr-code";
import AppHeader, { APP_HEADER_H } from "@/components/AppHeader";
import {
  VerificationIcon,
  SpinnerIcon,
  CameraIcon,
  BuildingIcon,
  MailIcon,
  GlobeIcon,
  DocumentIcon,
  LinkIcon,
  ShieldIcon,
} from "@/components/ui/VerificationIcon";
import { useProfileStore, type ProfileView, type ProfileBlock } from "@/stores/useProfileStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { devices, authApi, blockApi, businessApi, verifyApi, publicProfileApi, mediaUrl } from "@/lib/api";
import type { DomainVerifyInstructions, PublicLegalEntity } from "@/lib/api";
import type { Block, Business, EntityKind, VerificationLevel } from "@/lib/types";
import { isPersonKind, normalizeEntityKind } from "@/lib/types";

// Public entity pages live on the app subdomain. Shared links are always the
// production URL — a localhost link would be useless to whoever receives it.
const APP_ORIGIN = "https://app.tetapi.dev";

// Local (unsaved) blocks use `block-N` ids; persisted blocks use server UUIDs.
const isServerBlock = (id: string) => !id.startsWith("block-");

// Effective session token everywhere on this page: /login and /settings
// authenticate through useAuthStore ("tetapi-auth" in localStorage), while
// /claim writes directly to useProfileStore + a bare "auth_token" localStorage
// key. Each component reads `useAuthStore((s) => s.token)` first (reactive, so
// it updates the moment a user signs in) and falls back to the claim flow's
// token for users who arrived that way instead — see ProfilePage, StatementTile,
// BlockEditPanel, VerifyMenu and PiCamButton below.

// Map a persisted block from the API onto the store's block shape.
function mapServerBlock(b: Block): ProfileBlock {
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

// Drag-to-reorder: snapshot the order captured at drag start so a failed save
// can roll back. Only server-side blocks (real UUIDs) get persisted — unsaved
// `block-N` blocks have no row to reorder yet.
let dragSnapshot: ProfileBlock[] | null = null;

// Persist the current block order to the backend. Sends only server-side block
// ids (the endpoint assigns each its array index as `order`); on failure the
// pre-drag order is restored so the UI never lies about what was saved.
function persistBlockOrder(token: string | null) {
  const snapshot = dragSnapshot;
  dragSnapshot = null;
  if (!snapshot) return;
  const after = useProfileStore.getState().blocks;
  const changed = after.some((b, i) => b.id !== snapshot[i]?.id);
  if (!changed) return;
  const ids = after.map((b) => b.id).filter(isServerBlock);
  if (!token || ids.length < 2) return;
  blockApi.reorder(ids, token).catch(() => useProfileStore.getState().setBlocks(snapshot));
}

// Debounced per-block PATCH. Flushes the latest title/desc from the store so
// rapid edits across both fields never clobber each other.
const blockSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
function scheduleBlockSave(blockId: string, token: string | null) {
  if (!token || !isServerBlock(blockId)) return;
  clearTimeout(blockSaveTimers.get(blockId));
  blockSaveTimers.set(
    blockId,
    setTimeout(() => {
      blockSaveTimers.delete(blockId);
      const b = useProfileStore.getState().blocks.find((x) => x.id === blockId);
      if (!b) return;
      blockApi.update(blockId, { title: b.title, description: b.desc }, token).catch(() => {});
    }, 600)
  );
}

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

// ===== "Grid of Record" design tokens (3.15, docs/design/profile-grid-of-record) =====
// Exact hex values from the owner's high-fidelity handoff — kept distinct from
// the V_* constants below (VerifyMenu's older glass palette) since the two
// visual languages coexist on this page until the redesign finishes (3.15b-f).
const GR_INK = "#1A1035";
const GR_BODY = "#4A3F6B";
const GR_MUTED = "#9088B0";
const GR_PRIMARY = "#6B3FA0";
const GR_PRIMARY_HOVER = "#5A3488";
const GR_TINT = "#F4F0FB";
const GR_LILAC = "#C9B8E8";
const GR_ORANGE = "#E8640C";
const GR_BORDER = "#E2DCF0";
const GR_RAISED = "#FBFAFD";
const GR_MONO_FONT = "ui-monospace,'SF Mono',Menlo,monospace";
const GR_STRIPE = "repeating-linear-gradient(45deg,#F1EDF9 0 6px,#FBFAFD 6px 12px)";
const GR_INKSTRIPE = "repeating-linear-gradient(45deg,#241847 0 6px,#1A1035 6px 12px)";

// none < registry/email/domain < partial < full < live — used only to derive
// the facts strip's compact "L{n}" trust stat from the real backend enum.
const TRUST_ORDER: VerificationLevel[] = ["none", "registry", "email", "domain", "partial", "full", "live"];
function trustOrdinal(level: VerificationLevel | null): number {
  if (!level) return 0;
  const i = TRUST_ORDER.indexOf(level);
  return i < 0 ? 0 : i;
}

function yearOf(dateLike: string | null | undefined): string {
  if (!dateLike) return "—";
  const m = dateLike.match(/\d{4}/);
  return m ? m[0] : "—";
}

// Matches the spec's "12 JUN 2026 · 09:41Z" format exactly.
function formatRecheckTs(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${hh}:${mm}Z`;
}

// Matches the spec's "12 JUN 2026" tile-meta format (no time component).
function formatTileDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${String(d.getUTCDate()).padStart(2, "0")} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ===== Regions 5-6: Ledger controls + square ledger =====
// The real data model has no "audio" media type (MediaItem.type is only
// video|photo|file) and no per-block registry association — both spec
// concepts (filter chips include "audio"; a seal can include "registry")
// don't map onto real data, so KIND drops audio in favor of the real "file"
// bucket, and per-block marks are c2pa/btc only (see docs/changelog.md).
type LedgerKind = "VIDEO" | "PHOTO" | "TEXT" | "FILE";
type LedgerFilter = "ALL" | LedgerKind;

function blockKind(block: ProfileBlock): LedgerKind {
  if (!block.media) return "TEXT";
  if (block.media.type === "video") return "VIDEO";
  if (block.media.type === "photo") return "PHOTO";
  return "FILE";
}

function blockMarks(block: ProfileBlock): Array<"c2pa" | "btc"> {
  const marks: Array<"c2pa" | "btc"> = [];
  if (block.media?.c2pa_verified) marks.push("c2pa");
  if (block.media?.bitcoin_confirmed) marks.push("btc");
  return marks;
}

// Shared between the tile's hover overlay and the block detail modal (3.15d)
// — one source of truth for the signature/media-label strings both render.
function blockHashLabel(block: ProfileBlock): string {
  return block.media?.original_hash
    ? `sha256:${block.media.original_hash.slice(0, 10)}…${block.media.original_hash.slice(-6)}`
    : "no signature yet";
}

function blockMediaLabel(kind: LedgerKind): string {
  return kind === "VIDEO" ? "video source" : kind === "PHOTO" ? "photo source" : kind === "FILE" ? "file source" : "plain text · no media";
}

// ===== Region 2: Attestation bar =====
// Full-width bar above identity — three seals (registry/c2pa/btc) derived
// from the entity's real registry/block data, never hardcoded, plus a status
// cell with the pulsing re-check dot. Region 2 is entirely new (no 3.13
// equivalent); it supersedes the inline "✓ Verified in registry" status row
// the old EditView used to render next to the name.
type SealKind = "registry" | "c2pa" | "btc";

function SealGlyph({ kind, verified, size = 14 }: { kind: SealKind; verified: boolean; size?: number }) {
  const line = verified ? (kind === "btc" ? GR_ORANGE : GR_PRIMARY) : GR_MUTED;
  const fill = kind === "c2pa" ? "transparent" : verified ? line : "transparent";
  const radius = kind === "c2pa" ? "50%" : "1px";
  const rot = kind === "btc" ? "45deg" : "0deg";
  return (
    <span
      style={{
        width: size, height: size, flexShrink: 0,
        border: `1.5px solid ${line}`, background: fill,
        borderRadius: radius, transform: `rotate(${rot})`,
      }}
    />
  );
}

interface AttestationCell {
  key: string;
  kind: SealKind;
  token: string;
  detail: string;
  state: string;
  verified: boolean;
}

function AttestationCellView({ cell, mobile: m }: { cell: AttestationCell; mobile: boolean }) {
  const [hover, setHover] = useState(false);
  const lineColor = cell.verified ? (cell.kind === "btc" ? GR_ORANGE : GR_PRIMARY) : GR_MUTED;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        // Full mobile layout (seals stacked as full-width rows) is 3.15f's job —
        // this basis just keeps cells from clipping on narrow viewports meanwhile.
        flex: m ? "1 1 50%" : 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12,
        padding: "15px 20px", borderRight: `1px solid ${GR_BORDER}`,
        background: hover ? GR_TINT : "transparent",
      }}
    >
      <SealGlyph kind={cell.kind} verified={cell.verified} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: GR_MONO_FONT, fontSize: 11.5, letterSpacing: "0.4px", color: GR_INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {cell.token}
        </div>
        <div style={{ fontFamily: GR_MONO_FONT, fontSize: 9.5, color: GR_MUTED, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {cell.detail}
        </div>
      </div>
      <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: lineColor, marginLeft: "auto", letterSpacing: "0.6px", flexShrink: 0, paddingLeft: 8 }}>
        {cell.verified ? "✓ " : ""}{cell.state}
      </span>
    </div>
  );
}

function AttestationBar({ mobile: m, updatedAt }: { mobile: boolean; updatedAt: string | null }) {
  const store = useProfileStore();
  const isPerson = isPersonKind(store.entityKind);
  const total = store.blocks.length;

  // "registry" doesn't apply to person-kind entities (journalist/actor/creator/
  // other never run a registry check) — shown as an explicit n/a cell rather
  // than silently reusing another attestation's slot.
  const registryCell: AttestationCell = isPerson
    ? { key: "registry", kind: "registry", token: "registry:n/a", detail: "not applicable — individual", state: "n/a", verified: false }
    : store.registryStatus === "verified" && store.registryData
    ? {
        key: "registry", kind: "registry", token: "registry:attested",
        detail: `${store.registryData.iso} · ${store.registryData.authority} ${store.registryData.registryId}`.trim(),
        state: "attested", verified: true,
      }
    : store.registryStatus === "not_found"
    ? { key: "registry", kind: "registry", token: "registry:not_found", detail: "no match in connected registries", state: "not found", verified: false }
    : store.registryStatus === "pending"
    ? { key: "registry", kind: "registry", token: "registry:pending", detail: "check in progress", state: "pending", verified: false }
    : { key: "registry", kind: "registry", token: "registry:unverified", detail: "not yet checked", state: "unverified", verified: false };

  const signed = store.blocks.filter((b) => b.media?.c2pa_verified).length;
  const c2paCell: AttestationCell = {
    key: "c2pa", kind: "c2pa",
    token: signed > 0 ? "c2pa:verified" : "c2pa:unverified",
    detail: total > 0 ? `${signed} of ${total} blocks signed` : "no blocks yet",
    state: signed > 0 ? "verified" : "unverified",
    verified: signed > 0,
  };

  const btcBlocks = store.blocks.filter((b) => b.media?.bitcoin_confirmed);
  const latestBtc = btcBlocks.find((b) => b.media?.bitcoin_block)?.media?.bitcoin_block ?? null;
  const btcCell: AttestationCell = {
    key: "btc", kind: "btc",
    token: btcBlocks.length > 0 ? "btc:ts:confirmed" : "btc:ts:unconfirmed",
    detail: btcBlocks.length > 0
      ? (latestBtc ? `block ${latestBtc.toLocaleString()}` : `${btcBlocks.length} block${btcBlocks.length > 1 ? "s" : ""} confirmed`)
      : total > 0 ? "awaiting confirmation" : "no blocks yet",
    state: btcBlocks.length > 0 ? "confirmed" : "unconfirmed",
    verified: btcBlocks.length > 0,
  };

  const cells = [registryCell, c2paCell, btcCell];

  return (
    <div style={{ display: "flex", alignItems: "stretch", flexWrap: m ? "wrap" : "nowrap", borderBottom: `1px solid ${GR_BORDER}`, background: GR_RAISED }}>
      {cells.map((c) => (
        <AttestationCellView key={c.key} cell={c} mobile={m} />
      ))}
      <div style={{ width: m ? undefined : 210, flex: m ? "1 1 100%" : "none", display: "flex", alignItems: "center", gap: 9, padding: "15px 20px" }}>
        <span className="tp-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: GR_ORANGE, flexShrink: 0 }} />
        <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: GR_MUTED, lineHeight: 1.5 }}>
          re-checked hourly<br />{formatRecheckTs(updatedAt)}
        </span>
      </div>
    </div>
  );
}

// ===== Region 3: Identity =====
// Avatar tile + name/handle/description + the new 3-way mode switch. Name and
// description keep EditView's old inline-edit behaviour (Edit → Save toggle),
// just relocated here since identity is now shared chrome across all three
// modes instead of something EditView alone rendered.
function ProfileIdentity({ mobile: m, slug }: { mobile: boolean; slug: string | null }) {
  const store = useProfileStore();
  const sharedToken = useAuthStore((s) => s.token);
  const [fieldsEditing, setFieldsEditing] = useState(!store.companyName);
  const [saving, setSaving] = useState(false);
  const isBusiness = store.entityKind === "business";
  const isPerson = isPersonKind(store.entityKind);
  const isEdit = store.view === "edit";

  const namePlaceholder = isBusiness ? "Company name" : store.entityKind === "journalist" ? "Your full name" : store.entityKind === "creator" ? "Your name / stage name" : isPerson ? "Your name" : "Organization name";
  const descPlaceholder = isBusiness ? "What does your company do?" : store.entityKind === "journalist" ? "What do you cover? Where do you publish?" : store.entityKind === "creator" ? "Your medium, style, or practice." : isPerson ? "What do you do?" : "What does your organization do?";

  const token = sharedToken ?? store.authToken ?? (typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);

  const handleSave = async () => {
    setSaving(true);
    if (store.businessId && token) {
      try {
        await businessApi.update(store.businessId, { name: store.companyName, description: store.description }, token);
      } catch {
        // keep the optimistic "Saved" UX; a failed sync retries on next save
      }
    }
    store.setSavedAt(new Date());
    setSaving(false);
    setFieldsEditing(false);
  };

  const modes: Array<{ key: ProfileView; label: string }> = [
    { key: "edit", label: "Edit" },
    { key: "visitor", label: "Visitor" },
    { key: "agent", label: "Agent" },
  ];

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 28, padding: m ? "24px 20px 20px" : "32px 34px 24px", flexWrap: m ? "wrap" : "nowrap" }}>
      <div
        style={{
          width: m ? 72 : 104, height: m ? 72 : 104, flexShrink: 0,
          border: `1px solid ${GR_BORDER}`, background: GR_STRIPE,
          display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 9,
        }}
      >
        <span style={{ fontFamily: GR_MONO_FONT, fontSize: 9.5, color: GR_MUTED, letterSpacing: "0.4px" }}>avatar 1:1</span>
      </div>

      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          {isEdit && fieldsEditing ? (
            <input
              value={store.companyName}
              onChange={(e) => store.setCompanyName(e.target.value)}
              placeholder={namePlaceholder}
              autoFocus
              style={{ fontSize: m ? 24 : 34, fontWeight: 700, letterSpacing: "-1.1px", color: GR_INK, border: "none", background: "transparent", fontFamily: "inherit", margin: 0, flex: "1 1 260px", minWidth: 0 }}
            />
          ) : (
            <h1 style={{ fontSize: m ? 24 : 34, fontWeight: 700, letterSpacing: "-1.1px", margin: 0, lineHeight: 1.02, color: GR_INK }}>
              {store.companyName || namePlaceholder}
            </h1>
          )}
          {slug && (
            <span style={{ fontFamily: GR_MONO_FONT, fontSize: 11.5, color: GR_PRIMARY, border: `1px solid ${GR_LILAC}`, padding: "3px 8px" }}>
              tetapi.dev/{slug}
            </span>
          )}
        </div>

        {isEdit && fieldsEditing ? (
          <textarea
            value={store.description}
            onChange={(e) => store.setDescription(e.target.value)}
            placeholder={descPlaceholder}
            rows={3}
            style={{ width: "100%", maxWidth: 640, fontSize: 15.5, color: GR_BODY, lineHeight: 1.55, border: "none", background: "transparent", fontFamily: "inherit", resize: "vertical", margin: "13px 0 0" }}
          />
        ) : (
          <p style={{ fontSize: 15.5, color: store.description ? GR_BODY : GR_MUTED, lineHeight: 1.55, margin: "13px 0 0", maxWidth: 640 }}>
            {store.description || descPlaceholder}
          </p>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 14, flexShrink: 0 }}>
        <div style={{ display: "flex", border: `1px solid ${GR_BORDER}` }}>
          {modes.map((md) => {
            const active = store.view === md.key;
            return (
              <div
                key={md.key}
                onClick={() => store.setView(md.key)}
                style={{ fontSize: 13, fontWeight: 600, padding: "9px 16px", cursor: "pointer", color: active ? "#fff" : GR_BODY, background: active ? GR_PRIMARY : "transparent", borderRight: `1px solid ${GR_BORDER}` }}
              >
                {md.label}
              </div>
            );
          })}
        </div>

        {isEdit && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {store.savedAt && !fieldsEditing && !saving && (
              <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: GR_MUTED }}>
                saved {store.savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={fieldsEditing ? handleSave : () => setFieldsEditing(true)}
              disabled={saving}
              style={{
                padding: "8px 15px", borderRadius: 4, border: "none",
                background: saving ? "rgba(107,63,160,0.35)" : GR_PRIMARY,
                color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                cursor: saving ? "default" : "pointer", display: "flex", alignItems: "center", gap: 6,
              }}
              onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY_HOVER; }}
              onMouseLeave={(e) => { if (!saving) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY; }}
            >
              {saving ? <><SpinnerIcon size={12} /> Saving…</> : fieldsEditing ? "Save" : "Edit"}
            </button>
          </div>
        )}

        <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: GR_MUTED, letterSpacing: "0.6px" }}>
          shareable · agent-readable
        </span>
      </div>
    </div>
  );
}

// ===== Region 4: Facts strip =====
// Four stats, all derived from real entity/block data — no stubs. "agent
// lookups / 30d" has no backend source yet (no per-entity analytics endpoint
// exists — see docs/known-issues.md), so it renders "—" rather than a
// fabricated number until that lands.
function FactsStrip({
  mobile: m, verificationLevel, createdAt,
}: {
  mobile: boolean; verificationLevel: VerificationLevel | null; createdAt: string | null;
}) {
  const store = useProfileStore();
  const signedBlocks = store.blocks.filter((b) => b.media?.c2pa_verified || b.media?.bitcoin_confirmed).length;
  const registeredYear = store.registryData?.since ? yearOf(store.registryData.since) : yearOf(createdAt);
  const stats = [
    { k: "signed blocks", v: String(signedBlocks) },
    { k: "trust level", v: `L${trustOrdinal(verificationLevel)}` },
    { k: "registered", v: registeredYear },
    { k: "agent lookups / 30d", v: "—" },
  ];
  return (
    <div style={{ display: "flex", flexWrap: m ? "wrap" : "nowrap", borderTop: `1px solid ${GR_BORDER}`, borderBottom: `1px solid ${GR_BORDER}` }}>
      {stats.map((s, i) => (
        <div
          key={s.k}
          style={{
            flex: m ? "1 1 50%" : 1, minWidth: 0, padding: "16px 34px 17px",
            borderRight: i < stats.length - 1 ? `1px solid ${GR_BORDER}` : "none",
          }}
        >
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.6px", lineHeight: 1, color: GR_INK }}>{s.v}</div>
          <div style={{ fontFamily: GR_MONO_FONT, fontSize: 10, letterSpacing: "1.2px", textTransform: "uppercase", color: GR_MUTED, marginTop: 7 }}>{s.k}</div>
        </div>
      ))}
    </div>
  );
}

// ===== Region 6: Statement tile =====
// The core ledger component. Square, three stacked rows (head/media/foot) +
// a hover provenance overlay, matching the spec exactly. Draggable only in
// Edit mode (persists via the same blockApi.reorder/persistBlockOrder the old
// 3.13 BlockCard already used — that endpoint already exists, see changelog).
// Clicking a tile opens the block detail modal (3.15d) in every mode — Edit's
// old direct-to-BlockEditPanel bridge is gone; the panel is now reached one
// click deeper, via the modal's "Replace media" action (see BlockDetailModal).
function StatementTile({
  block, index, isEdit, onOpen,
}: {
  block: ProfileBlock; index: number; isEdit: boolean; onOpen: () => void;
}) {
  const store = useProfileStore();
  const sharedToken = useAuthStore((s) => s.token);
  const token = sharedToken ?? store.authToken ?? (typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);
  const [hover, setHover] = useState(false);
  const [imgError, setImgError] = useState(false);

  const kind = blockKind(block);
  const marks = blockMarks(block);
  const dark = kind === "VIDEO";
  const isDragging = store.dragId === block.id;
  const resolvedUrl = block.media?.storage_url ? mediaUrl(block.media.storage_url) : null;
  // Real signed media is worth showing, unlike the spec's decorative-only
  // placeholders (this app has actual evidence, not just a mock) — video
  // keeps the spec's literal ink-stripe treatment (no inline video embeds in
  // a dense grid), photo shows the real upload when it resolves.
  const showRealImage = kind === "PHOTO" && !!resolvedUrl && !imgError;

  const mediaLabel = blockMediaLabel(kind);
  const mediaLabelColor = dark ? GR_LILAC : GR_MUTED;

  // Real per-block marks max out at 2 (c2pa + btc — no per-block registry
  // association exists), so "full chain" here means both, not three.
  const sealState = marks.length === 2 ? "full chain" : marks.length === 1 ? "partial" : "unsigned";
  const sealColor = marks.length === 2 ? GR_PRIMARY : marks.length === 1 ? GR_ORANGE : GR_MUTED;

  const hashLabel = blockHashLabel(block);
  const dateLabel = formatTileDate(block.media?.uploaded_at ?? block.createdAt);

  return (
    <div
      draggable={isEdit}
      onDragStart={() => {
        if (!isEdit) return;
        dragSnapshot = useProfileStore.getState().blocks;
        store.setDragId(block.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!isEdit) return;
        const { dragId, blocks } = useProfileStore.getState();
        if (!dragId || dragId === block.id) return;
        const from = blocks.findIndex((b) => b.id === dragId);
        const to = blocks.findIndex((b) => b.id === block.id);
        if (from === -1 || to === -1 || from === to) return;
        store.reorderBlocks(from, to);
      }}
      onDrop={(e) => e.preventDefault()}
      onDragEnd={() => {
        store.setDragId(null);
        persistBlockOrder(token);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onOpen}
      style={{
        position: "relative", aspectRatio: "1", border: `1px solid ${hover ? GR_PRIMARY : GR_BORDER}`,
        background: "#fff", cursor: isEdit ? "grab" : "pointer",
        opacity: isDragging ? 0.3 : 1, display: "flex", flexDirection: "column", overflow: "hidden",
      }}
    >
      {/* Head */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 13px", borderBottom: "1px solid #F1EDF9", flexShrink: 0 }}>
        <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10.5, color: GR_MUTED, letterSpacing: "0.6px" }}>
          {String(index + 1).padStart(2, "0")} · {kind}
        </span>
        <span style={{ display: "flex", gap: 4 }}>
          {marks.map((mk) => <SealGlyph key={mk} kind={mk} verified size={8} />)}
        </span>
      </div>

      {/* Media */}
      <div style={{ flex: 1, minHeight: 0, position: "relative", background: dark ? GR_INKSTRIPE : GR_STRIPE, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {showRealImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedUrl!}
            alt=""
            onError={() => setImgError(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: mediaLabelColor, letterSpacing: "0.6px" }}>{mediaLabel}</span>
        )}
      </div>

      {/* Foot */}
      <div style={{ padding: "12px 13px 13px", borderTop: "1px solid #F1EDF9", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.2px", color: GR_INK }}>
          {block.title || "Untitled block"}
        </div>
        <div style={{ fontFamily: GR_MONO_FONT, fontSize: 10, color: GR_MUTED, marginTop: 7 }}>{dateLabel}</div>
      </div>

      {/* Hover overlay */}
      <div
        style={{
          position: "absolute", inset: 0, background: "rgba(26,16,53,0.93)",
          opacity: hover ? 1 : 0, transition: "opacity .16s ease", pointerEvents: "none",
          padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontFamily: GR_MONO_FONT, fontSize: 9.5, letterSpacing: "1.4px", textTransform: "uppercase", color: sealColor }}>
            {sealState}
          </div>
          <div style={{ fontFamily: GR_MONO_FONT, fontSize: 11, color: GR_LILAC, lineHeight: 1.7, marginTop: 12, wordBreak: "break-all" }}>
            {hashLabel}<br />{dateLabel}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: "#fff", lineHeight: 1.45 }}>{block.desc || "No description yet."}</div>
      </div>
    </div>
  );
}

function AddBlockTile({ onAdd }: { onAdd: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onAdd}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        aspectRatio: "1", border: `1px dashed ${hover ? GR_PRIMARY : GR_LILAC}`, background: hover ? GR_TINT : GR_RAISED,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9, cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 28, fontWeight: 300, color: GR_PRIMARY, lineHeight: 1 }}>+</span>
      <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10.5, color: GR_PRIMARY, letterSpacing: "0.8px" }}>ADD BLOCK</span>
      {/* "audio" dropped — no backing media type today, see blockKind() above */}
      <span style={{ fontFamily: GR_MONO_FONT, fontSize: 9.5, color: GR_MUTED }}>video · photo · text · file</span>
    </div>
  );
}

// ===== Region 5: Ledger controls =====
function LedgerControls({
  mobile: m, filter, setFilter, isEdit, businessId, entityName, total,
}: {
  mobile: boolean; filter: LedgerFilter; setFilter: (f: LedgerFilter) => void; isEdit: boolean;
  businessId: string | null; entityName: string; total: number;
}) {
  const filters: LedgerFilter[] = ["ALL", "VIDEO", "PHOTO", "TEXT", "FILE"];
  const hint = isEdit ? "drag a square to reorder · click to inspect" : "click a square to inspect";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "22px 34px 15px", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontFamily: GR_MONO_FONT, fontSize: 11, letterSpacing: "1.6px", textTransform: "uppercase", color: GR_PRIMARY }}>
          Statements
        </span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {filters.map((f) => {
            const active = filter === f;
            return (
              <span
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontFamily: GR_MONO_FONT, fontSize: 10.5, letterSpacing: "0.6px", padding: "6px 11px", cursor: "pointer",
                  color: active ? GR_INK : GR_MUTED, border: `1px solid ${active ? GR_PRIMARY : GR_BORDER}`,
                  background: active ? GR_TINT : "#fff",
                }}
              >
                {f === "ALL" ? `all ${total}` : f.toLowerCase()}
              </span>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {hint && <span style={{ fontFamily: GR_MONO_FONT, fontSize: 10.5, color: GR_MUTED }}>{hint}</span>}
        {/* Connect Camera lives next to the blocks it feeds (QA #30) — moved
            here from the old EditView now that blocks are a shared region. */}
        {isEdit && <PiCamButton businessId={businessId} entityName={entityName} />}
      </div>
    </div>
  );
}

// ===== Region 6: Square ledger grid =====
function StatementLedger({
  mobile: m, filter, isEdit, setEditingBlockId, onOpenBlock,
}: {
  mobile: boolean; filter: LedgerFilter; isEdit: boolean;
  setEditingBlockId: (id: string | null) => void; onOpenBlock: (id: string) => void;
}) {
  const store = useProfileStore();
  const sharedToken = useAuthStore((s) => s.token);
  const token = sharedToken ?? store.authToken ?? (typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);

  // Index reflects each block's real position in store.blocks, not its
  // position in the filtered/visible list — filtering must not renumber or
  // break reorder's from/to lookups.
  const indexed = store.blocks.map((b, i) => ({ block: b, index: i }));
  const visible = filter === "ALL" ? indexed : indexed.filter(({ block }) => blockKind(block) === filter);

  // Persist the new block up front so it has a real id (needed for media upload).
  const handleAddBlock = async () => {
    if (store.businessId && token) {
      try {
        const created = await blockApi.add(store.businessId, "", undefined, token, store.blocks.length);
        const mapped = mapServerBlock(created);
        store.addBlock(mapped);
        setEditingBlockId(mapped.id);
        return;
      } catch {
        // fall through to a local-only block if the API is unreachable
      }
    }
    store.addBlock();
    const blocks = useProfileStore.getState().blocks;
    const last = blocks[blocks.length - 1];
    if (last) setEditingBlockId(last.id);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: m ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 10, padding: "0 34px 34px" }}>
      {visible.map(({ block, index }) => (
        <StatementTile
          key={block.id}
          block={block}
          index={index}
          isEdit={isEdit}
          onOpen={() => onOpenBlock(block.id)}
        />
      ))}
      {isEdit && <AddBlockTile onAdd={handleAddBlock} />}
      {!isEdit && visible.length === 0 && (
        <div style={{ gridColumn: "1 / -1", padding: "40px 0", textAlign: "center", color: GR_MUTED, fontSize: 13.5 }}>
          No statements yet.
        </div>
      )}
    </div>
  );
}

// ===== Block detail modal (3.15d) =====
// Opens on tile click in every mode (Edit/Visitor/Agent) — same data, same
// component, no per-mode variant. Read-only fact grid over the real
// media_url/content_hash/c2pa_verified/bitcoin_confirmed fields 1.20-web
// already wired; this is new UI over existing data, not a new data source.
// "Replace media" (Edit only) hands off to BlockEditPanel — the upload flow
// that already exists there (3.15b) — rather than re-implementing upload
// inside the modal. "Verify chain" has no backend endpoint for a manual
// re-check yet (see docs/known-issues.md), so it mirrors the design
// prototype's own stub behavior (closes the modal) and says so beneath the
// buttons instead of pretending to call something real.
function BlockDetailModal({
  block, index, isEdit, onClose, onReplaceMedia,
}: {
  block: ProfileBlock; index: number; isEdit: boolean; onClose: () => void; onReplaceMedia: () => void;
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
            Block {String(index + 1).padStart(2, "0")} · {kind}
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
            {isEdit && (
              <span
                onClick={onReplaceMedia}
                style={{ fontSize: 14, fontWeight: 600, color: GR_PRIMARY, border: `1px solid ${GR_LILAC}`, padding: "11px 20px", borderRadius: 4, cursor: "pointer" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = GR_PRIMARY; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = GR_LILAC; }}
              >
                Replace media
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

export default function ProfilePage() {
  const vw = useViewport();
  const m = vw < 640;
  const store = useProfileStore();
  const sharedToken = useAuthStore((s) => s.token);
  const token = sharedToken ?? store.authToken ?? (typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);

  // Public-page slug + published flag, for the "Share page" button.
  const [slug, setSlug] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  // Square ledger state (3.15b) — filter chips + which block (if any) has its
  // edit panel open below the grid. Both are page-level since LedgerControls
  // and StatementLedger are siblings that need to share them.
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("ALL");
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  // Which block (if any) has its detail modal open (3.15d) — page-level since
  // the modal itself renders outside the ledger, at the top of this component.
  const [openBlockId, setOpenBlockId] = useState<string | null>(null);

  // Entity fields the new "Grid of Record" regions need (facts strip, attestation
  // bar) that useProfileStore doesn't carry — kept local to this page rather than
  // added to the shared store since nothing else reads them yet.
  const [entityMeta, setEntityMeta] = useState<{
    verificationLevel: VerificationLevel | null;
    createdAt: string | null;
    updatedAt: string | null;
  }>({ verificationLevel: null, createdAt: null, updatedAt: null });

  // Set by lib/api.ts's centralized 401 handler (any request, anywhere on this
  // page) — a dead token must never leave the page silently rendering as if
  // the session were still good (QA #1). Once true, the tabs/edit surface are
  // replaced with a sign-in gate until the user re-authenticates.
  const [sessionInvalid, setSessionInvalid] = useState(false);
  useEffect(() => {
    const onUnauthorized = () => setSessionInvalid(true);
    window.addEventListener("teta:unauthorized", onUnauthorized);
    return () => window.removeEventListener("teta:unauthorized", onUnauthorized);
  }, []);

  // Restore auth session from localStorage (written by claim flow on Step 5)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("auth_token");
    const entityId = localStorage.getItem("entity_id");
    if (token) store.setAuthToken(token);
    if (entityId) store.setBusinessId(entityId);
    const kind = normalizeEntityKind(localStorage.getItem("entity_kind"));
    if (kind) store.setEntityKind(kind);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Validate whatever token we have on mount with an authenticated call —
  // covers both /login sessions (useAuthStore) and /claim sessions (store's
  // own authToken, restored above). Runs even when businessId is already
  // known (claim-flow users have it from localStorage) so a stale token from
  // yesterday gets caught immediately instead of only surfacing as "invalid
  // token" the next time the user clicks something (QA #1/#2). A 401 here is
  // handled centrally by lib/api.ts (clears both stores + localStorage, fires
  // "teta:unauthorized"); we just use success to adopt an entity if needed.
  useEffect(() => {
    const token = sharedToken ?? store.authToken;
    if (!token) return;
    let cancelled = false;
    businessApi.list(token).then((list) => {
      if (cancelled) return;
      setSessionInvalid(false);
      if (useProfileStore.getState().businessId) return;
      const own = list[0];
      if (!own) return;
      store.setBusinessId(own.id);
      store.setEntityKind(own.entity_type === "organization" ? "organization" : own.entity_type === "person" ? "other" : "business");
    }).catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedToken, store.authToken]);

  // Load the entity + its persisted blocks once the entity id is known.
  useEffect(() => {
    const businessId = store.businessId;
    if (!businessId) return;
    // The store is a module-level singleton, not scoped to an entity — switching
    // to a different one (e.g. creating a second page under the same account)
    // must not leave the previous entity's name/description/blocks/registry
    // badge on screen while this fetch is in flight (QA #18). Reset up front,
    // and assign the fetched values unconditionally below so a genuinely empty
    // field on the new entity clears the old one too, instead of only doing so
    // when the new value happens to be truthy.
    store.setCompanyName("");
    store.setDescription("");
    store.setBlocks([]);
    store.setNameStatus("idle");
    store.setRegistryStatus(null);
    store.setRegistryData(null);
    setEntityMeta({ verificationLevel: null, createdAt: null, updatedAt: null });
    let cancelled = false;
    (async () => {
      const [biz, blocks] = await Promise.all([
        businessApi.get(businessId).catch(() => null),
        blockApi.list(businessId).catch(() => [] as Block[]),
      ]);
      if (cancelled) return;
      if (biz) {
        store.setCompanyName(biz.name ?? "");
        store.setDescription(biz.description ?? "");
        store.setRegistryStatus(biz.registry_status ?? null);
        if (biz.registry_status === "verified" && biz.registry_data) {
          store.setRegistryData({
            iso: biz.country || "",
            authority: biz.registry_data.registry,
            registryId: biz.registry_data.registration_number,
            status: biz.registry_data.status,
            city: biz.registry_data.address || "",
            since: biz.registry_data.founded || "",
          });
        } else {
          store.setRegistryData(null);
        }
        setSlug(biz.slug ?? null);
        setPublished(!!biz.is_published);
        setEntityMeta({
          verificationLevel: biz.verification_level ?? null,
          createdAt: biz.created_at ?? null,
          updatedAt: biz.updated_at ?? null,
        });
      }
      store.setBlocks(blocks.map(mapServerBlock));
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.businessId]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 50%,#EDF1FB 100%)",
        fontFamily: "'Manrope','Trebuchet MS','Segoe UI',sans-serif",
        color: "#1A1035",
        position: "relative",
        // "clip", not "hidden" — see page.tsx for why (phantom scroll container).
        overflow: "clip",
      }}
    >
      {/* Color washes */}
      <div style={{ position: "absolute", top: -160, left: -130, width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle,rgba(91,69,201,0.22),transparent 68%)", filter: "blur(34px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -180, right: -150, width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle,rgba(245,154,46,0.18),transparent 68%)", filter: "blur(38px)", pointerEvents: "none" }} />

      {/* Fixed translucent app header — logo + avatar, offset below the
          under-construction banner (QA #10/#24). */}
      <AppHeader />

      {/* Content */}
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: m ? `${APP_HEADER_H + 24}px 16px 100px` : `${APP_HEADER_H + 32}px 24px 100px`,
          position: "relative", zIndex: 1,
        }}
      >
        {sessionInvalid ? (
          <div style={{ maxWidth: 880, margin: "0 auto" }}>
            <SignedOutPanel
              onSignIn={(token) => {
                localStorage.setItem("auth_token", token);
                store.setAuthToken(token);
                useAuthStore.getState().setAuth(token);
                setSessionInvalid(false);
              }}
            />
          </div>
        ) : (
          <>
            {/* Regions 1-6 ("Grid of Record") — nav (AppHeader above),
                attestation bar, identity + mode switch, facts strip (3.15a),
                verification & publishing tiles (3.15c, Edit mode only, region
                5a — sits between facts strip and ledger controls per spec
                order), ledger controls + square ledger (3.15b) + the block
                detail modal (3.15d). Regions 1-4/6 shared across all three
                modes; 5a is Edit-only. What's left below (visitor
                footer/agent panel, mobile) is 3.15e-f. */}
            <div style={{ background: "#fff", border: `1px solid ${GR_BORDER}`, marginBottom: 26 }}>
              <AttestationBar mobile={m} updatedAt={entityMeta.updatedAt} />
              <ProfileIdentity mobile={m} slug={slug} />
              <FactsStrip mobile={m} verificationLevel={entityMeta.verificationLevel} createdAt={entityMeta.createdAt} />
              {/* Remount on entity switch: VerifyMenu keeps its own useState
                  (registryStatus, emailDone, linked, isPublished…) that has
                  no other trigger to clear when businessId changes (QA #18). */}
              {store.view === "edit" && (
                <VerifyMenu
                  key={store.businessId ?? "new"}
                  businessId={store.businessId}
                  token={token}
                  mobile={m}
                  entityKind={store.entityKind}
                />
              )}
              <LedgerControls
                mobile={m}
                filter={ledgerFilter}
                setFilter={setLedgerFilter}
                isEdit={store.view === "edit"}
                businessId={store.businessId}
                entityName={store.companyName}
                total={store.blocks.length}
              />
              <StatementLedger
                mobile={m}
                filter={ledgerFilter}
                isEdit={store.view === "edit"}
                setEditingBlockId={setEditingBlockId}
                onOpenBlock={setOpenBlockId}
              />
              {/* Title/description editing + media upload for one block, opened
                  either from ADD BLOCK or from the detail modal's "Replace
                  media" action (never directly from a tile click anymore —
                  that opens the read-only modal in every mode, see below). */}
              {store.view === "edit" && editingBlockId && (
                <div style={{ borderTop: `1px solid ${GR_BORDER}`, padding: "22px 34px 26px" }}>
                  <BlockEditPanel
                    key={editingBlockId}
                    block={store.blocks.find((b) => b.id === editingBlockId) ?? null}
                    mobile={m}
                    onClose={() => setEditingBlockId(null)}
                  />
                </div>
              )}
            </div>

            {/* Block detail modal (3.15d) — opens on tile click in every
                mode; "Replace media" hands off to BlockEditPanel above via
                the same editingBlockId state ADD BLOCK already uses. */}
            {openBlockId && (() => {
              const openIndex = store.blocks.findIndex((b) => b.id === openBlockId);
              const openBlock = openIndex >= 0 ? store.blocks[openIndex] : null;
              if (!openBlock) return null;
              return (
                <BlockDetailModal
                  block={openBlock}
                  index={openIndex}
                  isEdit={store.view === "edit"}
                  onClose={() => setOpenBlockId(null)}
                  onReplaceMedia={() => {
                    setOpenBlockId(null);
                    setEditingBlockId(openBlock.id);
                  }}
                />
              );
            })()}

            {/* Regions 7/8 — still 3.13's shipped UI until 3.15e lands. */}
            <div style={{ maxWidth: 880, margin: "0 auto" }}>
              {published && slug && <SharePageButton slug={slug} mobile={m} />}

              {store.view === "visitor" && <VisitorView mobile={m} />}
              {store.view === "agent" && <AgentView mobile={m} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===== Signed-out gate =====
// Replaces the whole edit/preview surface once a 401 clears the session
// (QA #1) — never leave the page looking editable with a dead token.
function SignedOutPanel({ onSignIn }: { onSignIn: (token: string) => void }) {
  const [showModal, setShowModal] = useState(true);
  return (
    <>
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.7)",
          borderRadius: 20,
          background: "rgba(255,255,255,0.5)",
          boxShadow: "0 16px 50px rgba(45,55,120,0.10), inset 0 1px 0 rgba(255,255,255,0.85)",
          backdropFilter: "blur(20px) saturate(140%)",
          WebkitBackdropFilter: "blur(20px) saturate(140%)",
          padding: "56px 32px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1A1035", marginBottom: 10 }}>
          Your session expired
        </div>
        <div style={{ fontSize: 14.5, color: "#5A4F78", lineHeight: 1.6, marginBottom: 22, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
          Sign in again to keep editing your profile.
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: "10px 22px",
            border: "1px solid rgba(91,69,201,0.3)", borderRadius: 10,
            background: "rgba(91,69,201,0.06)", color: "#5B45C9", fontSize: 13.5, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Sign in
        </button>
      </div>
      {showModal && (
        <SignInModal
          onSuccess={(token) => { onSignIn(token); setShowModal(false); }}
          onClose={() => setShowModal(false)}
          subtitle="Your session expired — sign in again to keep editing."
        />
      )}
    </>
  );
}

// ===== Share Page button =====
// Only rendered once the entity is published — links to / copies the public page.
function SharePageButton({ slug, mobile: m }: { slug: string; mobile: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = `${APP_ORIGIN}/e/${slug}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. insecure context) — the link is still openable.
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
          fontSize: m ? 11 : 12,
          color: "#9991AC",
          textDecoration: "none",
          wordBreak: "break-all",
        }}
      >
        {url.replace(/^https?:\/\//, "")}
      </a>
      <button
        onClick={copy}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "8px 16px",
          border: "1px solid rgba(91,69,201,0.3)", borderRadius: 10,
          background: "rgba(91,69,201,0.06)", color: "#5B45C9",
          fontSize: 13.5, fontWeight: 600, cursor: "pointer",
          fontFamily: "inherit", whiteSpace: "nowrap",
        }}
      >
        {copied ? "✓ Link copied" : "Share page"}
      </button>
    </div>
  );
}

// ===== Edit View =====
// Blocks-first layout (QA #29): content blocks are the primary object on the
// page, rendered immediately after name/description. Verifiers + Registry
// Match + Document Upload + Legal Entity + Publish&Privacy collapse into one
// compact icon menu (QA #28/#31) below the blocks, not full-width strips.
// Name/description default to read-only with an explicit Edit→Save toggle
// (QA #26/#27) instead of always-editable fields.
// ===== Verification methods chooser =====
// Registry / Email / Domain are ACTIVE (each wires to its /verify/* endpoint and
// writes an append-only verification_events row on success). Document Upload is
// visible but DISABLED ("Coming soon") — it makes zero network calls until the
// backend upload/review flow ships (docs/verification-rework.md §2). Below the
// methods, the brand→verified-legal-entity link (the Google/Alphabet case, §3).

const V_INDIGO = "#5B45C9";
const V_SUN = "#F59A2E";
const V_GREEN = "#3FA97C";
const V_MUTED = "#9991AC";
const V_TEXT = "#1A1035";
const V_SEC = "#5A4F78";

const vInput: React.CSSProperties = {
  padding: "10px 13px", borderRadius: 9, border: "1.5px solid rgba(26,16,53,0.15)",
  fontSize: 14, fontFamily: "inherit", color: V_TEXT, outline: "none", width: "100%",
};
function vBtn(kind: "primary" | "ghost", disabled?: boolean): React.CSSProperties {
  if (kind === "primary")
    return {
      padding: "9px 16px", borderRadius: 9, border: "none",
      background: disabled ? "rgba(91,69,201,0.35)" : "linear-gradient(180deg,#6E58D6,#5B45C9)",
      color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
      cursor: disabled ? "default" : "pointer", whiteSpace: "nowrap",
      display: "inline-flex", alignItems: "center", gap: 7,
    };
  return {
    padding: "9px 16px", borderRadius: 9, border: "1px solid rgba(91,69,201,0.3)",
    background: "rgba(91,69,201,0.06)", color: V_INDIGO, fontSize: 13, fontWeight: 600,
    fontFamily: "inherit", cursor: disabled ? "default" : "pointer", whiteSpace: "nowrap",
    display: "inline-flex", alignItems: "center", gap: 7, opacity: disabled ? 0.5 : 1,
  };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

// A copyable monospace value (DNS host/value, well-known content).
function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: V_MUTED, marginBottom: 3 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <code style={{
          flex: 1, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12,
          color: "#3A2C5C", background: "rgba(26,16,53,0.04)", border: "1px solid rgba(26,16,53,0.08)",
          borderRadius: 7, padding: "7px 10px", wordBreak: "break-all",
        }}>{value}</code>
        <button
          onClick={() => { navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}
          style={{ ...vBtn("ghost"), padding: "7px 12px" }}
        >
          {copied ? "✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function MethodCard({
  title, desc, accent, right, children, disabled,
}: {
  title: string; desc: string; accent: string;
  right?: React.ReactNode; children?: React.ReactNode; disabled?: boolean;
}) {
  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.7)",
      borderLeft: `3px solid ${accent}`,
      borderRadius: "0 13px 13px 0",
      padding: "16px 18px",
      marginBottom: 12,
      background: disabled ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.45)",
      backdropFilter: "blur(12px) saturate(130%)",
      WebkitBackdropFilter: "blur(12px) saturate(130%)",
      boxShadow: "0 6px 20px rgba(45,55,120,0.07), inset 0 1px 0 rgba(255,255,255,0.85)",
      opacity: disabled ? 0.72 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: V_TEXT }}>{title}</div>
          <div style={{ fontSize: 12.5, color: V_MUTED, lineHeight: 1.5, marginTop: 3 }}>{desc}</div>
        </div>
        {right && <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{right}</div>}
      </div>
      {children && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  );
}

function StatusPill({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 600, color, background: `${color}18`,
      padding: "5px 11px", borderRadius: 10, whiteSpace: "nowrap",
      fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
    }}>{text}</span>
  );
}

type VerifyMenuKey = "registry" | "email" | "domain" | "document" | "legal" | "publish";

// ===== Region 5a: Verification & publishing action tiles =====
// Replaces the old MenuIconButton (round icon + tiny label, glass style)
// with the spec's 56px-tall horizontal bars. State machine matches
// verifySteps() in the design's HTML source exactly (not approximated):
// verified always shows purple status text even for Publish (whose OWN
// accent — border/glyph/dot when selected-or-done — is orange); "in
// progress" status text is always orange regardless of item; label stays
// ink-colored in every state. Domain's old distinct green accent is retired
// — the new design only differentiates Publish (orange), everything else
// purple, matching AttestationBar/StatementTile's reduced palette.
function VerifyActionTile({
  label, icon, done, selected, accent, onClick,
}: {
  label: string; icon: React.ReactNode; done: boolean; selected: boolean;
  accent: string; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const border = hover ? GR_PRIMARY : selected ? accent : GR_BORDER;
  const status = done ? "verified" : selected ? "in progress" : "pending";
  const statusColor = done ? GR_PRIMARY : selected ? GR_ORANGE : GR_MUTED;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", height: 56, border: `1px solid ${border}`,
        background: selected ? GR_TINT : "#fff", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 11, padding: "0 12px",
      }}
    >
      {icon}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: GR_INK, letterSpacing: "-0.1px" }}>{label}</div>
        <div style={{ fontFamily: GR_MONO_FONT, fontSize: 9.5, letterSpacing: "0.6px", color: statusColor, marginTop: 3 }}>{status}</div>
      </div>
      {done && (
        <span style={{ position: "absolute", top: 9, right: 9, width: 6, height: 6, borderRadius: "50%", background: GR_PRIMARY }} />
      )}
    </div>
  );
}

// Verifiers + Registry Match + Document Upload + Legal Entity + Publish &
// Privacy, as the spec's 6-up row of low action tiles (3.15c) — was a round
// icon-button row (QA #28/#31) before that. One item's panel (MethodCard,
// unchanged from 3.13) is open at a time, directly beneath the tile row —
// only the tile row's chrome changed this session, not the verification
// flows or panels themselves.
function VerifyMenu({
  businessId, token, mobile: m, entityKind,
}: { businessId: string | null; token: string | null; mobile: boolean; entityKind: EntityKind }) {
  // Registry / Document Upload / Legal-entity link are business concepts — a
  // persona account (journalist/actor/creator/other) only gets Email + Domain.
  const isBusinessKind = !isPersonKind(entityKind);
  const [activeKey, setActiveKey] = useState<VerifyMenuKey | null>(null);
  const toggle = (k: VerifyMenuKey) => setActiveKey((cur) => (cur === k ? null : k));

  // Registry
  const [registryStatus, setRegistryStatus] = useState<string | null>(null);
  const [registryBusy, setRegistryBusy] = useState(false);
  const [registryTimedOut, setRegistryTimedOut] = useState(false);

  // Business Email Control — panel visibility now driven by activeKey, not
  // its own toggle.
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [emailDone, setEmailDone] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  // Domain Ownership
  const [domain, setDomain] = useState("");
  const [domainInstr, setDomainInstr] = useState<DomainVerifyInstructions | null>(null);
  const [domainDone, setDomainDone] = useState(false);
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainErr, setDomainErr] = useState<string | null>(null);

  // Brand → legal entity link
  const [linked, setLinked] = useState<PublicLegalEntity | null>(null);
  const [candidates, setCandidates] = useState<Business[]>([]);
  const [selectedLegal, setSelectedLegal] = useState("");
  const [legalBusy, setLegalBusy] = useState(false);
  const [legalErr, setLegalErr] = useState<string | null>(null);

  // Publish & Privacy (merged from the former PublishSection)
  const [isPublished, setIsPublished] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [publishBusy, setPublishBusy] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [publishErr, setPublishErr] = useState<string | null>(null);

  // Continues polling a check already in flight (started before this mount,
  // or left running past the previous poll's attempt cap) as well as one just
  // started by runRegistry. Reaching the cap while still "pending" means the
  // backend job is real but slow — that's surfaced as "still processing",
  // not silently dropped back to a plain "Verify now" button (QA #13).
  const pollRegistry = async (attempt: number) => {
    if (!businessId) return;
    const b = await businessApi.get(businessId).catch(() => null);
    if (b) setRegistryStatus(b.registry_status);
    const settled = b && (b.registry_status === "verified" || b.registry_status === "not_found");
    if (settled) { setRegistryBusy(false); return; }
    if (attempt >= 5) { setRegistryBusy(false); setRegistryTimedOut(true); return; }
    setTimeout(() => pollRegistry(attempt + 1), 2500);
  };

  // Load current registry status, existing link (via the public payload, which
  // BusinessOut omits), and candidate legal entities (own registry-verified ones).
  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    (async () => {
      const biz = await businessApi.get(businessId).catch(() => null);
      if (cancelled) return;
      if (biz) {
        setRegistryStatus(biz.registry_status);
        if (biz.registry_status === "pending") { setRegistryBusy(true); pollRegistry(0); }
        if (isBusinessKind && biz.slug) {
          const pub = await publicProfileApi.bySlug(biz.slug).catch(() => null);
          if (!cancelled && pub) setLinked(pub.legal_entity ?? null);
        }
      }
      if (isBusinessKind && token) {
        const list = await businessApi.list(token).catch(() => [] as Business[]);
        if (!cancelled) {
          setCandidates(list.filter((b) => b.registry_status === "verified" && b.id !== businessId));
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, token, isBusinessKind]);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    businessApi.get(businessId).then((biz) => {
      if (cancelled) return;
      setIsPublished(!!biz.is_published);
      setIsPublic(biz.is_public !== false);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [businessId]);

  if (!businessId) return null;

  const runRegistry = async () => {
    if (!token) return;
    setRegistryBusy(true);
    setRegistryTimedOut(false);
    try {
      await verifyApi.registry(businessId, token);
    } catch { setRegistryBusy(false); return; }
    pollRegistry(0);
  };

  const sendEmailCode = async () => {
    if (!token || !email.trim()) return;
    setEmailBusy(true); setEmailErr(null);
    try { await verifyApi.emailStart(businessId, email.trim(), token); setEmailSent(true); }
    catch (e) { setEmailErr(errMsg(e)); }
    finally { setEmailBusy(false); }
  };
  const confirmEmailCode = async () => {
    if (!token || !emailCode.trim()) return;
    setEmailBusy(true); setEmailErr(null);
    try { await verifyApi.emailConfirm(businessId, email.trim(), emailCode.trim(), token); setEmailDone(true); }
    catch (e) { setEmailErr(errMsg(e)); }
    finally { setEmailBusy(false); }
  };

  const getDomainInstr = async () => {
    if (!token || !domain.trim()) return;
    setDomainBusy(true); setDomainErr(null);
    try { const r = await verifyApi.domainStart(businessId, domain.trim(), token); setDomainInstr(r); }
    catch (e) { setDomainErr(errMsg(e)); }
    finally { setDomainBusy(false); }
  };
  const checkDomain = async () => {
    if (!token || !domainInstr) return;
    setDomainBusy(true); setDomainErr(null);
    try {
      const r = await verifyApi.domainCheck(businessId, domainInstr.domain, token);
      if (r.verified) setDomainDone(true);
      else setDomainErr("Not found yet — DNS TXT / the well-known file can take a few minutes to propagate. Try again shortly.");
    } catch (e) { setDomainErr(errMsg(e)); }
    finally { setDomainBusy(false); }
  };

  const linkLegal = async () => {
    if (!token || !selectedLegal) return;
    setLegalBusy(true); setLegalErr(null);
    try {
      const r = await verifyApi.linkLegalEntity(businessId, selectedLegal, token);
      const c = candidates.find((x) => x.id === selectedLegal);
      setLinked({ id: r.legal_entity_id, name: r.legal_entity_name, slug: c?.slug ?? "", registry_status: "verified" });
      setSelectedLegal("");
    } catch (e) { setLegalErr(errMsg(e)); }
    finally { setLegalBusy(false); }
  };
  const unlinkLegal = async () => {
    if (!token) return;
    setLegalBusy(true); setLegalErr(null);
    try { await verifyApi.unlinkLegalEntity(businessId, token); setLinked(null); }
    catch (e) { setLegalErr(errMsg(e)); }
    finally { setLegalBusy(false); }
  };

  const doPublish = async () => {
    if (!token) return;
    setPublishBusy(true); setPublishErr(null);
    try { await businessApi.publish(businessId, token); setIsPublished(true); }
    catch (e) { setPublishErr(errMsg(e)); }
    finally { setPublishBusy(false); }
  };
  const togglePrivacy = async () => {
    if (!token) return;
    const next = !isPublic;
    setPrivacyBusy(true); setPublishErr(null);
    try { await businessApi.setPrivacy(businessId, next, token); setIsPublic(next); }
    catch (e) { setPublishErr(errMsg(e)); }
    finally { setPrivacyBusy(false); }
  };

  const registryVerified = registryStatus === "verified";

  // Real per-step done/selected state feeds VerifyActionTile's glyph/border/
  // status coloring — see the state-machine note above the component. Icon
  // colors are resolved here (not inside the tile) since they depend on the
  // same done/selected/accent inputs the tile itself only has as props.
  const verifyItems: Array<{
    key: VerifyMenuKey; label: string; done: boolean; accent: string; icon: React.ReactNode;
  } | false> = [
    isBusinessKind && {
      key: "registry", label: "Registry", done: registryVerified, accent: GR_PRIMARY,
      icon: <BuildingIcon size={18} color={registryVerified || activeKey === "registry" ? GR_PRIMARY : GR_MUTED} />,
    },
    {
      key: "email", label: "Email", done: emailDone, accent: GR_PRIMARY,
      icon: <MailIcon size={18} color={emailDone || activeKey === "email" ? GR_PRIMARY : GR_MUTED} />,
    },
    {
      key: "domain", label: "Domain", done: domainDone, accent: GR_PRIMARY,
      icon: <GlobeIcon size={18} color={domainDone || activeKey === "domain" ? GR_PRIMARY : GR_MUTED} />,
    },
    // Document upload has no working backend flow yet (Coming soon, see the
    // panel below) — never "done"; still selectable, panel shows the disabled
    // state.
    isBusinessKind && {
      key: "document", label: "Document", done: false, accent: GR_PRIMARY,
      icon: <DocumentIcon size={18} color={activeKey === "document" ? GR_PRIMARY : GR_MUTED} />,
    },
    isBusinessKind && {
      key: "legal", label: "Legal", done: !!linked, accent: GR_PRIMARY,
      icon: <LinkIcon size={18} color={!!linked || activeKey === "legal" ? GR_PRIMARY : GR_MUTED} />,
    },
    {
      key: "publish", label: "Publish", done: isPublished, accent: GR_ORANGE,
      icon: <ShieldIcon size={18} color={isPublished || activeKey === "publish" ? GR_ORANGE : GR_MUTED} />,
    },
  ];
  const visibleVerifyItems = verifyItems.filter(Boolean) as Exclude<typeof verifyItems[number], false>[];

  return (
    <div style={{ padding: m ? "22px 16px 0" : "22px 34px 0" }}>
      <div style={{ fontFamily: GR_MONO_FONT, fontSize: 11, letterSpacing: "1.6px", textTransform: "uppercase", color: GR_PRIMARY, marginBottom: 12 }}>
        Verification &amp; publishing
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${m ? Math.min(3, visibleVerifyItems.length) : visibleVerifyItems.length}, 1fr)`,
          gap: 10,
          marginBottom: activeKey ? 14 : 0,
        }}
      >
        {visibleVerifyItems.map((it) => (
          <VerifyActionTile
            key={it.key}
            label={it.label}
            icon={it.icon}
            done={it.done}
            selected={activeKey === it.key}
            accent={it.accent}
            onClick={() => toggle(it.key)}
          />
        ))}
      </div>

      {/* Official Registry Match — business/organization only */}
      {activeKey === "registry" && isBusinessKind && (
        <MethodCard
          title="Official Registry Match"
          desc="Match your legal name against Handelsregister, GLEIF or EU VAT."
          accent={registryVerified ? V_INDIGO : "#B8B2C8"}
          right={
            registryVerified ? (
              <StatusPill text="verified" color={V_INDIGO} />
            ) : registryBusy ? (
              <span style={{ display: "flex", alignItems: "center", gap: 7, color: V_MUTED, fontSize: 13 }}>
                <SpinnerIcon size={14} /> Checking…
              </span>
            ) : registryTimedOut ? (
              <span style={{ display: "flex", alignItems: "center", gap: 7, color: V_MUTED, fontSize: 13 }}>
                Still processing — check back shortly
              </span>
            ) : (
              <>
                {registryStatus === "not_found" && <StatusPill text="not found" color={V_SUN} />}
                <button onClick={runRegistry} style={vBtn("primary")}>
                  {registryStatus === "not_found" ? "Re-check" : "Verify now"}
                </button>
              </>
            )
          }
        />
      )}

      {/* Email Control */}
      {activeKey === "email" && (
        <MethodCard
          title={isBusinessKind ? "Business Email Control" : "Email Control"}
          desc={isBusinessKind ? "Confirm a magic code sent to an address on your own domain." : "Confirm a magic code sent to an email address you control."}
          accent={emailDone ? V_INDIGO : "#B8B2C8"}
          right={emailDone ? <StatusPill text="verified" color={V_INDIGO} /> : undefined}
        >
          {!emailDone && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: m ? "wrap" : "nowrap" }}>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourbrand.com" disabled={emailSent} style={vInput}
                />
                {!emailSent && (
                  <button onClick={sendEmailCode} disabled={emailBusy || !email.trim()} style={vBtn("primary", emailBusy || !email.trim())}>
                    {emailBusy ? <SpinnerIcon size={12} /> : null} Send code
                  </button>
                )}
              </div>
              {emailSent && (
                <div style={{ display: "flex", gap: 8, flexWrap: m ? "wrap" : "nowrap" }}>
                  <input
                    value={emailCode} onChange={(e) => setEmailCode(e.target.value)}
                    placeholder="6-digit code" inputMode="numeric" style={vInput}
                  />
                  <button onClick={confirmEmailCode} disabled={emailBusy || !emailCode.trim()} style={vBtn("primary", emailBusy || !emailCode.trim())}>
                    {emailBusy ? <SpinnerIcon size={12} /> : null} Confirm
                  </button>
                </div>
              )}
              {emailSent && !emailErr && (
                <div style={{ fontSize: 12, color: V_MUTED }}>Code sent to {email}. Free-mailbox domains (gmail, etc.) are rejected.</div>
              )}
              {emailErr && <div style={{ fontSize: 12.5, color: V_SUN }}>{emailErr}</div>}
            </div>
          )}
        </MethodCard>
      )}

      {/* Domain Ownership */}
      {activeKey === "domain" && (
        <MethodCard
          title="Domain Ownership"
          desc="Prove control of your domain via a DNS TXT record or a well-known file."
          accent={domainDone ? V_GREEN : "#B8B2C8"}
          right={domainDone ? <StatusPill text="verified" color={V_GREEN} /> : undefined}
        >
          {!domainDone && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
              {!domainInstr ? (
                <div style={{ display: "flex", gap: 8, flexWrap: m ? "wrap" : "nowrap" }}>
                  <input
                    value={domain} onChange={(e) => setDomain(e.target.value)}
                    placeholder="yourbrand.com" style={vInput}
                  />
                  <button onClick={getDomainInstr} disabled={domainBusy || !domain.trim()} style={vBtn("primary", domainBusy || !domain.trim())}>
                    {domainBusy ? <SpinnerIcon size={12} /> : null} Get instructions
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 12.5, color: V_SEC, lineHeight: 1.55, marginBottom: 10 }}>
                    Add <strong>either</strong> proof for <strong>{domainInstr.domain}</strong>, then check:
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: V_SEC, margin: "0 0 6px", letterSpacing: "0.4px" }}>DNS TXT record</div>
                  <CopyRow label="Host" value={domainInstr.dns_txt.host} />
                  <CopyRow label="Value" value={domainInstr.dns_txt.value} />
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: V_SEC, margin: "10px 0 6px", letterSpacing: "0.4px" }}>…or well-known file</div>
                  <CopyRow label={domainInstr.file.url} value={domainInstr.file.content} />
                  <button onClick={checkDomain} disabled={domainBusy} style={{ ...vBtn("primary", domainBusy), marginTop: 4 }}>
                    {domainBusy ? <SpinnerIcon size={12} /> : null} Check now
                  </button>
                </div>
              )}
              {domainErr && <div style={{ fontSize: 12.5, color: V_SUN, lineHeight: 1.5 }}>{domainErr}</div>}
            </div>
          )}
        </MethodCard>
      )}

      {/* Document Upload — visible but DISABLED, no network calls (Coming soon).
          Business/organization only (registration certificate, licence, tax ID). */}
      {activeKey === "document" && isBusinessKind && (
        <MethodCard
          title="Document Upload"
          desc="Registration certificate, licence or tax ID — reviewed by our team."
          accent="#D8D2E2"
          disabled
          right={<StatusPill text="Coming soon" color={V_MUTED} />}
        />
      )}

      {/* Brand → verified legal entity link — business/organization only; the
          brand→parent-company concept doesn't apply to a person account. */}
      {activeKey === "legal" && isBusinessKind && (
        <MethodCard
          title="Link to a verified legal entity"
          desc="Inherit trust from a registry-verified entity you own (e.g. a brand → its parent company). Publicly disclosed on your page."
          accent={linked ? V_INDIGO : "#B8B2C8"}
          right={linked ? <StatusPill text="linked" color={V_INDIGO} /> : undefined}
        >
          {linked ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13.5, color: V_TEXT }}>
                Linked to <strong>{linked.name}</strong>{" "}
                <span style={{ fontSize: 12, color: V_MUTED }}>· registry-verified legal entity</span>
              </div>
              <button onClick={unlinkLegal} disabled={legalBusy} style={{ ...vBtn("ghost", legalBusy), marginLeft: "auto" }}>
                {legalBusy ? <SpinnerIcon size={12} /> : null} Unlink
              </button>
            </div>
          ) : candidates.length > 0 ? (
            <div style={{ display: "flex", gap: 8, flexWrap: m ? "wrap" : "nowrap", alignItems: "center" }}>
              <select
                value={selectedLegal} onChange={(e) => setSelectedLegal(e.target.value)}
                style={{ ...vInput, cursor: "pointer" }}
              >
                <option value="">Choose a verified entity you own…</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button onClick={linkLegal} disabled={legalBusy || !selectedLegal} style={vBtn("primary", legalBusy || !selectedLegal)}>
                {legalBusy ? <SpinnerIcon size={12} /> : null} Link
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: V_MUTED, lineHeight: 1.5 }}>
              No registry-verified entities to link yet. Registry-verify another entity you own first, then link it here.
            </div>
          )}
          {legalErr && <div style={{ fontSize: 12.5, color: V_SUN, marginTop: 8 }}>{legalErr}</div>}
        </MethodCard>
      )}

      {/* Publish & Privacy */}
      {activeKey === "publish" && (
        <MethodCard
          title={isPublished ? "Your page is live" : "Publish your page"}
          desc={
            isPublished
              ? isPublic
                ? "Visible to visitors and discoverable by agents."
                : "Live, but hidden — only reachable via direct link."
              : "Make your page reachable at its public URL. You can unpublish or change visibility any time."
          }
          accent={isPublished ? (isPublic ? V_GREEN : V_MUTED) : "#B8B2C8"}
          right={
            isPublished ? (
              <>
                <StatusPill text={isPublic ? "public" : "private"} color={isPublic ? V_GREEN : V_MUTED} />
                <button onClick={togglePrivacy} disabled={privacyBusy || !token} style={vBtn("ghost", privacyBusy || !token)}>
                  {privacyBusy ? <SpinnerIcon size={12} /> : null} {isPublic ? "Make private" : "Make public"}
                </button>
              </>
            ) : (
              <button onClick={doPublish} disabled={publishBusy || !token} style={vBtn("primary", publishBusy || !token)}>
                {publishBusy ? <SpinnerIcon size={12} /> : null} Publish
              </button>
            )
          }
        >
          {publishErr && <div style={{ fontSize: 12.5, color: V_SUN }}>{publishErr}</div>}
        </MethodCard>
      )}
    </div>
  );
}

// ===== Block Card =====
// Content editor for one statement block — title/description/media upload.
// Used to be BlockCard, always visible inline per-block in the old 3.13
// free-form list; now it opens below the square ledger (StatementLedger)
// when a tile is clicked in Edit mode, or after ADD BLOCK. The real
// click-to-open detail modal (with fact grid, Verify chain action, etc.) is
// 3.15d — this is the functional bridge until then, so title/description
// editing and media upload don't regress while the ledger's visuals change.
function BlockEditPanel({
  block, mobile: m, onClose,
}: {
  block: ProfileBlock | null; mobile: boolean; onClose: () => void;
}) {
  const store = useProfileStore();
  const sharedToken = useAuthStore((s) => s.token);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const token = sharedToken ?? store.authToken ?? (typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);

  const handleFileUpload = useCallback(
    async (source: "pi_camera" | "file", file?: File) => {
      if (!block) return;
      setUploadError(null);
      store.setBlockMedia(block.id, { source, phase: source === "pi_camera" ? "signing" : "timestamping" });

      // Real upload for file source
      if (source === "file" && file) {
        if (token && store.businessId) {
          try {
            const { mediaApi } = await import("@/lib/api");
            const result = await mediaApi.upload(block.id, file, file.type.split("/")[0] || "image", token);
            // mediaApi.upload's own response doesn't carry storage_url/original_hash
            // (dropped by the API's response_model) — re-fetch the block via the
            // permalink endpoint to read back the real MediaOut the server wrote.
            const updatedBlock = await blockApi.get(block.id, token);
            const uploaded =
              updatedBlock.media.find((m) => m.id === result.media_id) ??
              updatedBlock.media[updatedBlock.media.length - 1];
            store.setBlockMedia(block.id, {
              source,
              phase: "done",
              id: uploaded?.id,
              storage_url: uploaded?.storage_url,
              original_hash: uploaded?.original_hash,
              c2pa_verified: uploaded?.c2pa_verified,
              bitcoin_confirmed: uploaded?.bitcoin_confirmed,
              bitcoin_block: uploaded?.bitcoin_block,
              type: uploaded?.type,
              uploaded_at: uploaded?.uploaded_at,
            });
          } catch (e) {
            setUploadError(e instanceof Error ? e.message : "Upload failed");
            store.setBlockMedia(block.id, null);
          }
          return;
        }
      }

      // Pi CAM pairing isn't wired yet (tracked separately, 14.x) — UI-only
      // simulation, no real fields to attach.
      setTimeout(
        () => store.setBlockMedia(block.id, { source, phase: "done" }),
        source === "pi_camera" ? 850 : 400
      );
    },
    [block, store, token]
  );

  if (!block) return null;

  const removeBlock = () => {
    clearTimeout(blockSaveTimers.get(block.id));
    blockSaveTimers.delete(block.id);
    if (isServerBlock(block.id) && token) blockApi.delete(block.id, token).catch(() => {});
    store.removeBlock(block.id);
    onClose();
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontFamily: GR_MONO_FONT, fontSize: 11, letterSpacing: "1.4px", textTransform: "uppercase", color: GR_PRIMARY }}>
          Editing block
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span onClick={removeBlock} style={{ fontSize: 12.5, color: GR_MUTED, cursor: "pointer" }}>
            Remove
          </span>
          <span onClick={onClose} style={{ fontSize: 12.5, color: GR_PRIMARY, fontWeight: 600, cursor: "pointer" }}>
            Done
          </span>
        </div>
      </div>

      <input
        value={block.title}
        onChange={(e) => { store.updateBlock(block.id, { title: e.target.value }); scheduleBlockSave(block.id, token); }}
        placeholder="Block title"
        autoFocus
        style={{ width: "100%", fontSize: m ? 18 : 21, fontWeight: 600, color: GR_INK, border: "none", background: "transparent", fontFamily: "inherit", marginBottom: 8 }}
      />
      <textarea
        value={block.desc}
        onChange={(e) => { store.updateBlock(block.id, { desc: e.target.value }); scheduleBlockSave(block.id, token); }}
        placeholder="Describe what this block shows…"
        rows={2}
        style={{ width: "100%", fontSize: 15, fontWeight: 300, color: GR_BODY, border: "none", background: "transparent", fontFamily: "inherit", resize: "vertical", lineHeight: 1.55, marginBottom: 16 }}
      />
      {!block.media ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 16px", border: `1px dashed ${GR_LILAC}`, flexWrap: "wrap" }}>
            <CameraIcon size={22} color={GR_MUTED} />
            <button
              onClick={() => handleFileUpload("pi_camera")}
              style={{ padding: "9px 16px", border: `1px solid ${GR_PRIMARY}`, background: GR_TINT, color: GR_PRIMARY, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Upload from PI Camera
            </button>
            <span onClick={() => fileRef.current?.click()} style={{ fontSize: 13, color: GR_MUTED, cursor: "pointer" }}>
              or upload a file
            </span>
            <input ref={fileRef} type="file" accept="video/*,image/*,.pdf" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload("file", f); }} />
          </div>
          {uploadError && <div style={{ fontSize: 12, color: GR_ORANGE, marginTop: 6 }}>{uploadError}</div>}
        </div>
      ) : (
        <MediaDisplay block={block} onReplace={() => store.setBlockMedia(block.id, null)} />
      )}
    </div>
  );
}

function MediaDisplay({
  block,
  onReplace,
}: {
  block: ProfileBlock;
  onReplace: () => void;
}) {
  const media = block.media!;
  const isCamera = media.source === "pi_camera";
  const isDone = media.phase === "done";
  const [imgError, setImgError] = useState(false);

  const accentColor = isDone ? (isCamera ? "#5B45C9" : "#F59A2E") : "#9991AC";
  const resolvedUrl = media.storage_url ? mediaUrl(media.storage_url) : null;
  const statusLabel = media.bitcoin_confirmed
    ? "✓ Timestamped on Bitcoin"
    : media.c2pa_verified
    ? "✓ Authentic — C2PA signed"
    : resolvedUrl
    ? "Uploaded — pending Bitcoin timestamp"
    : "Uploaded";
  const hash = isDone
    ? [
        media.original_hash ? `#sha256:${media.original_hash.slice(0, 16)}…` : null,
        media.c2pa_verified ? "c2pa:verified" : null,
        media.bitcoin_confirmed ? "btc:ts:confirmed" : resolvedUrl ? "btc:ts:pending" : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div>
      {/* Real media preview, falling back to a striped placeholder */}
      <div
        style={{
          height: 140,
          borderRadius: 9,
          position: "relative",
          overflow: "hidden",
          background: resolvedUrl && !imgError
            ? "#F3F1FA"
            : "repeating-linear-gradient(135deg, rgba(91,69,201,0.04) 0px, rgba(91,69,201,0.04) 8px, transparent 8px, transparent 16px)",
          border: "1px solid rgba(26,16,53,0.08)",
          marginBottom: 10,
        }}
      >
        {resolvedUrl && !imgError && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedUrl}
            alt=""
            onError={() => setImgError(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}
        {resolvedUrl && imgError && (
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "#5B45C9",
              textDecoration: "none",
            }}
          >
            <DocumentIcon size={18} /> View file
          </a>
        )}
        {isCamera && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              background: "rgba(255,255,255,0.85)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(26,16,53,0.10)",
              borderRadius: 20,
              fontSize: 11,
              fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
              color: "#5B45C9",
              letterSpacing: "0.3px",
            }}
          >
            <CameraIcon size={12} />
            PI Camera · C2PA
          </div>
        )}
      </div>

      {/* Status row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          {media.phase === "signing" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9991AC", fontSize: 13 }}>
              <SpinnerIcon size={14} />
              Signing with PI Camera…
            </div>
          )}
          {media.phase === "timestamping" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#F59A2E", fontSize: 13 }}>
              <SpinnerIcon size={14} color="#F59A2E" />
              Timestamping on Bitcoin…
            </div>
          )}
          {isDone && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  color: accentColor,
                  fontSize: 13.5,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                <VerificationIcon size={15} color={accentColor} />
                {statusLabel}
              </div>
              <div
                style={{
                  fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                  fontSize: 11,
                  color: "#9991AC",
                }}
              >
                {hash}
              </div>
            </div>
          )}
        </div>
        <span
          onClick={onReplace}
          style={{ fontSize: 12.5, color: "#9991AC", cursor: "pointer" }}
        >
          Replace
        </span>
      </div>
    </div>
  );
}

// ===== Pi CAM Connect =====
// Deliberately a small button next to the blocks header, not a section
// inside the general verification menu (QA #30) — the capture→block
// relationship should read at a glance. 14.5 will add the same QR/Pairing-Code
// sync as a reachable entry point from here for users who skipped it at
// onboarding; this button is that entry point, wired to the existing flow.
function PiCamButton({ businessId, entityName }: { businessId: string | null; entityName: string }) {
  const store = useProfileStore();
  const sharedToken = useAuthStore((s) => s.token);
  const [qrData, setQrData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  // Check the shared auth store (populated by /login and /settings) first, so
  // users who already have a session there aren't asked to sign in again —
  // falling back to the claim flow's token/localStorage for /claim users.
  const authToken = sharedToken ?? store.authToken ?? (typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);

  async function handleConnect() {
    const token = authToken;
    if (!token) { setShowLogin(true); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await devices.generateToken(token);
      setQrData(JSON.stringify({ token: data.token, entity_id: data.entity_id, entity_name: data.entity_name }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not generate QR. Try again.";
      if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("Not authenticated")) {
        setShowLogin(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <button
          onClick={handleConnect}
          disabled={loading}
          title="Scan a QR in the Pi CAM app to link your camera — captures are C2PA-signed and uploaded straight into a block."
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "7px 14px",
            border: "1px solid rgba(91,69,201,0.3)", borderRadius: 9,
            background: "rgba(91,69,201,0.06)", color: "#5B45C9", fontSize: 12.5, fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
            opacity: loading ? 0.6 : 1, whiteSpace: "nowrap",
          }}
        >
          {loading ? <SpinnerIcon size={13} /> : <CameraIcon size={13} color="#5B45C9" />}
          {loading ? "Generating…" : "Connect Camera"}
        </button>
        {error && <div style={{ fontSize: 11.5, color: "#F59A2E", maxWidth: 220, textAlign: "right" }}>{error}</div>}
      </div>

      {showLogin && (
        <SignInModal
          onSuccess={(token) => {
            localStorage.setItem("auth_token", token);
            store.setAuthToken(token);
            useAuthStore.getState().setAuth(token);
            setShowLogin(false);
            setError(null);
          }}
          onClose={() => setShowLogin(false)}
        />
      )}

      {qrData && (
        <PiCamModal
          qrData={qrData}
          entityName={entityName || "Pi CAM Test"}
          onClose={() => setQrData(null)}
        />
      )}
    </>
  );
}

// ===== Sign-in modal =====
function SignInModal({ onSuccess, onClose, subtitle }: { onSuccess: (token: string) => void; onClose: () => void; subtitle?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.login(email.trim(), password);
      onSuccess(data.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(26,16,53,0.55)",
        backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 100, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(255,255,255,0.85)", borderRadius: 18, padding: "32px 28px 28px",
          maxWidth: 360, width: "100%",
          boxShadow: "0 24px 64px rgba(45,55,120,0.20), inset 0 1px 0 rgba(255,255,255,0.9)",
          backdropFilter: "blur(20px) saturate(140%)",
          WebkitBackdropFilter: "blur(20px) saturate(140%)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1035", marginBottom: 6 }}>
          Sign in to TETA+PI
        </div>
        <div style={{ fontSize: 13, color: "#9991AC", marginBottom: 24 }}>
          {subtitle ?? "Required to generate a Pi CAM linking QR code."}
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email" required
            style={{
              padding: "11px 14px", borderRadius: 10, border: "1.5px solid rgba(26,16,53,0.15)",
              fontSize: 14, fontFamily: "inherit", color: "#1A1035", outline: "none",
            }}
          />
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password" required
            style={{
              padding: "11px 14px", borderRadius: 10, border: "1.5px solid rgba(26,16,53,0.15)",
              fontSize: 14, fontFamily: "inherit", color: "#1A1035", outline: "none",
            }}
          />
          {error && <div style={{ fontSize: 13, color: "#F59A2E" }}>{error}</div>}
          <button
            type="submit" disabled={loading}
            style={{
              marginTop: 4, padding: "12px", borderRadius: 10, border: "none",
              background: loading ? "rgba(91,69,201,0.4)" : "linear-gradient(180deg,#6E58D6,#5B45C9)",
              color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {loading ? <SpinnerIcon size={14} /> : null}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

function PiCamModal({
  qrData,
  entityName,
  onClose,
}: {
  qrData: string;
  entityName: string;
  onClose: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(900); // 15 min

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(t); onClose(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [onClose]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,16,53,0.55)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(255,255,255,0.85)",
          borderRadius: 18,
          padding: "32px 28px 28px",
          maxWidth: 340,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(45,55,120,0.20), inset 0 1px 0 rgba(255,255,255,0.9)",
          backdropFilter: "blur(20px) saturate(140%)",
          WebkitBackdropFilter: "blur(20px) saturate(140%)",
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 600, color: "#1A1035", marginBottom: 4 }}>
          Scan with Pi CAM
        </div>
        <div style={{ fontSize: 13, color: "#9991AC", marginBottom: 24 }}>
          {entityName || "your entity"} · expires in{" "}
          <span
            style={{
              fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
              color: secondsLeft < 60 ? "#F59A2E" : "#5B45C9",
            }}
          >
            {mm}:{ss}
          </span>
        </div>

        <div
          style={{
            display: "inline-block",
            padding: 16,
            background: "#fff",
            border: "1.5px solid rgba(26,16,53,0.10)",
            borderRadius: 14,
            marginBottom: 20,
          }}
        >
          <QRCode
            value={qrData}
            size={200}
            fgColor="#1A1035"
            bgColor="#ffffff"
            level="M"
          />
        </div>

        <div
          style={{
            fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
            fontSize: 10.5,
            color: "#9991AC",
            letterSpacing: "0.3px",
            marginBottom: 20,
            wordBreak: "break-all",
          }}
        >
          {JSON.parse(qrData).token?.slice(0, 24)}…
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "10px",
            border: "1px solid rgba(26,16,53,0.12)",
            borderRadius: 10,
            background: "transparent",
            color: "#9991AC",
            fontSize: 13.5,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ===== Visitor View =====
function VisitorView({ mobile: m }: { mobile: boolean }) {
  // Name/description/badges (3.15a) and the block list itself (3.15b, shown
  // in every mode now, not duplicated per-view) both live in the shared
  // regions above. The trust-sentence footer + CTAs (region 7) are 3.15e —
  // this view is an intentional no-op stub until then.
  return null;
}

// ===== Agent View =====
function AgentView({ mobile: m }: { mobile: boolean }) {
  const store = useProfileStore();
  const isBusiness = store.entityKind === "business";

  const trustLevel =
    store.blocks.some((b) => b.media?.phase === "done" && b.media.source === "pi_camera")
      ? "full"
      : store.blocks.some((b) => b.media?.phase === "done")
      ? "partial"
      : isBusiness && store.registryStatus === "verified"
      ? "registry"
      : !isBusiness
      ? "email_verified"
      : "unverified";

  const json = {
    entity: {
      id: store.businessId || "00000000-0000-0000-0000-000000000001",
      type: store.entityKind || "business",
      name: store.companyName || "Name",
      description: store.description || null,
    },
    registry: isBusiness && store.registryStatus === "verified" && store.registryData
      ? {
          status: "verified",
          registry: store.registryData.authority,
          number: store.registryData.registryId,
        }
      : isBusiness ? null : { status: "self_asserted", method: "email" },
    trust_level: trustLevel,
    blocks: store.blocks.map((b) => ({
      title: b.title || "Untitled",
      description: b.desc || null,
      media: b.media
        ? [
            {
              type: "video",
              c2pa_verified: b.media.source === "pi_camera" && b.media.phase === "done",
              captured_at: new Date().toISOString(),
              bitcoin_confirmed: b.media.phase === "done",
            },
          ]
        : [],
    })),
  };

  return (
    <div>
      <div
        style={{
          padding: "20px 22px",
          border: "1px solid rgba(255,255,255,0.7)",
          borderRadius: 13,
          background: "rgba(255,255,255,0.45)",
          backdropFilter: "blur(12px) saturate(130%)",
          WebkitBackdropFilter: "blur(12px) saturate(130%)",
          boxShadow: "0 6px 20px rgba(45,55,120,0.07), inset 0 1px 0 rgba(255,255,255,0.85)",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <span
            style={{
              fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
              fontSize: 12.5,
              color: "#5B45C9",
              fontWeight: 600,
            }}
          >
            GET /v1/entity/{store.businessId || "{slug}"}
          </span>
          <span
            style={{
              fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
              fontSize: 11.5,
              color: "#9991AC",
            }}
          >
            200 · application/json
          </span>
        </div>
        <pre
          style={{
            fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
            fontSize: m ? 11 : 12.5,
            color: "#3A2C5C",
            lineHeight: 1.6,
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {JSON.stringify(json, null, 2)}
        </pre>
      </div>
      <div
        style={{
          fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
          fontSize: 11,
          color: "#9991AC",
          letterSpacing: "0.3px",
        }}
      >
        Agents read this structured, signed record — never the layout.
      </div>
    </div>
  );
}
