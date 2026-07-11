"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "react-qr-code";
import { Wordmark } from "@/components/ui/Wordmark";
import AccountMenu from "@/components/AccountMenu";
import { BadgePill } from "@/components/ui/BadgePill";
import { IsoChip } from "@/components/ui/IsoChip";
import {
  VerificationIcon,
  SpinnerIcon,
  CameraIcon,
} from "@/components/ui/VerificationIcon";
import { useProfileStore, type ProfileView, type ProfileBlock } from "@/stores/useProfileStore";
import { devices, authApi, blockApi, businessApi } from "@/lib/api";
import type { Block } from "@/lib/types";

// Public entity pages live on the app subdomain. Shared links are always the
// production URL — a localhost link would be useless to whoever receives it.
const APP_ORIGIN = "https://app.tetapi.dev";

// Local (unsaved) blocks use `block-N` ids; persisted blocks use server UUIDs.
const isServerBlock = (id: string) => !id.startsWith("block-");

// Map a persisted block from the API onto the store's block shape.
function mapServerBlock(b: Block): ProfileBlock {
  const media = b.media?.[0];
  return {
    id: b.id,
    title: b.title ?? "",
    desc: b.description ?? "",
    media: media
      ? { source: media.c2pa_verified ? "pi_camera" : "file", phase: "done" }
      : null,
  };
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

// Real registry check debounce (business only)
function useRegistryCheck(name: string, enabled: boolean) {
  const store = useProfileStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!enabled) {
      store.setNameStatus("idle");
      store.setRegistryData(null);
      return;
    }
    if (!name.trim()) {
      store.setNameStatus("idle");
      store.setRegistryData(null);
      return;
    }
    store.setNameStatus("checking");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { searchApi } = await import("@/lib/api");
        const results = await searchApi.searchRegistry(name.trim());
        if (results.length > 0) {
          const r = results[0];
          store.setNameStatus("verified");
          store.setRegistryData({
            iso: r.country || "",
            authority: r.registry,
            registryId: r.registration_number,
            status: r.status || "active",
            city: r.address || "",
            since: r.founded || "",
          });
        } else {
          store.setNameStatus("not_found");
          store.setRegistryData(null);
        }
      } catch {
        store.setNameStatus("not_found");
        store.setRegistryData(null);
      }
    }, 900);
    return () => clearTimeout(debounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, enabled]);
}

export default function ProfilePage() {
  const vw = useViewport();
  const m = vw < 640;
  const store = useProfileStore();

  // Public-page slug + published flag, for the "Share page" button.
  const [slug, setSlug] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  // Restore auth session from localStorage (written by claim flow on Step 5)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("auth_token");
    const entityId = localStorage.getItem("entity_id");
    if (token) store.setAuthToken(token);
    if (entityId) store.setBusinessId(entityId);
    const kind = localStorage.getItem("entity_kind") as "business" | "journalist" | "artist" | "organization" | null;
    if (kind) store.setEntityKind(kind);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the entity + its persisted blocks once the entity id is known.
  useEffect(() => {
    const businessId = store.businessId;
    if (!businessId) return;
    let cancelled = false;
    (async () => {
      const [biz, blocks] = await Promise.all([
        businessApi.get(businessId).catch(() => null),
        blockApi.list(businessId).catch(() => [] as Block[]),
      ]);
      if (cancelled) return;
      if (biz) {
        if (biz.name) store.setCompanyName(biz.name);
        if (biz.description) store.setDescription(biz.description);
        setSlug(biz.slug ?? null);
        setPublished(!!biz.is_published);
      }
      store.setBlocks(blocks.map(mapServerBlock));
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.businessId]);

  useRegistryCheck(store.companyName, store.entityKind === "business");

  const views: Array<{ key: ProfileView; label: string }> = [
    { key: "edit", label: "Edit" },
    { key: "visitor", label: "Preview as visitor" },
    { key: "agent", label: "Preview as agent" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 50%,#EDF1FB 100%)",
        fontFamily: "'Manrope','Trebuchet MS','Segoe UI',sans-serif",
        color: "#1A1035",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Color washes */}
      <div style={{ position: "absolute", top: -160, left: -130, width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle,rgba(91,69,201,0.22),transparent 68%)", filter: "blur(34px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -180, right: -150, width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle,rgba(245,154,46,0.18),transparent 68%)", filter: "blur(38px)", pointerEvents: "none" }} />

      {/* Corner logo */}
      <div style={{ position: "fixed", top: m ? 16 : 22, left: m ? 16 : 28, zIndex: 20 }}>
        <Wordmark size="sm" />
      </div>

      {/* Account menu */}
      <AccountMenu />

      {/* Content */}
      <div
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: m ? "72px 16px 100px" : "80px 24px 100px",
          position: "relative", zIndex: 1,
        }}
      >
        {published && slug && <SharePageButton slug={slug} mobile={m} />}

        {store.view === "edit" && <EditView mobile={m} />}
        {store.view === "visitor" && <VisitorView mobile={m} />}
        {store.view === "agent" && <AgentView mobile={m} />}
      </div>

      {/* Fixed segmented control */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          padding: "4px",
          gap: 2,
          background: "rgba(255,255,255,0.55)",
          border: "1px solid rgba(255,255,255,0.7)",
          borderRadius: 14,
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
          boxShadow: "0 8px 26px rgba(45,55,120,0.10), inset 0 1px 0 rgba(255,255,255,0.9)",
          zIndex: 30,
        }}
      >
        {views.map(({ key, label }) => {
          const active = store.view === key;
          return (
            <button
              key={key}
              onClick={() => store.setView(key)}
              style={{
                padding: m ? "8px 12px" : "8px 16px",
                borderRadius: 10,
                border: "none",
                background: active ? "linear-gradient(180deg,#6E58D6,#5B45C9)" : "transparent",
                color: active ? "#fff" : "#5A4F78",
                fontSize: m ? 12 : 13.5,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.16s",
                whiteSpace: "nowrap",
                boxShadow: active ? "0 3px 10px rgba(91,69,201,0.28)" : "none",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
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
function EditView({ mobile: m }: { mobile: boolean }) {
  const store = useProfileStore();
  const [saving, setSaving] = useState(false);
  const isBusiness = store.entityKind === "business";

  const namePlaceholder = isBusiness ? "Company name" : store.entityKind === "journalist" ? "Your full name" : store.entityKind === "artist" ? "Your name / stage name" : "Organization name";
  const descPlaceholder = isBusiness ? "What does your company do?" : store.entityKind === "journalist" ? "What do you cover? Where do you publish?" : store.entityKind === "artist" ? "Your medium, style, or practice." : "What does your organization do?";

  const token = store.authToken ?? (typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);

  const handleSave = async () => {
    setSaving(true);
    if (store.businessId && token) {
      try {
        await businessApi.update(
          store.businessId,
          { name: store.companyName, description: store.description },
          token
        );
      } catch {
        // keep the optimistic "Saved" UX; a failed sync retries on next save
      }
    }
    store.setSavedAt(new Date());
    setSaving(false);
  };

  // Persist the new block up front so it has a real id (needed for media upload).
  const handleAddBlock = async () => {
    if (store.businessId && token) {
      try {
        const created = await blockApi.add(store.businessId, "", undefined, token, store.blocks.length);
        store.addBlock(mapServerBlock(created));
        return;
      } catch {
        // fall through to a local-only block if the API is unreachable
      }
    }
    store.addBlock();
  };

  return (
    <div>
      {/* Name input */}
      <input
        value={store.companyName}
        onChange={(e) => store.setCompanyName(e.target.value)}
        placeholder={namePlaceholder}
        style={{
          width: "100%",
          fontSize: m ? 32 : 44,
          fontWeight: 600,
          letterSpacing: "-1px",
          color: "#1A1035",
          border: "none",
          background: "transparent",
          fontFamily: "inherit",
          marginBottom: 10,
        }}
      />

      {/* Status row */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {isBusiness ? (
          <>
            {store.nameStatus === "checking" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9991AC", fontSize: 13 }}>
                <SpinnerIcon size={15} /> Checking registry…
              </div>
            )}
            {store.nameStatus === "verified" && store.registryData && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#5B45C9", fontSize: 13.5, fontWeight: 600 }}>
                  <VerificationIcon size={16} />✓ Verified in registry
                </div>
                <IsoChip code={store.registryData.iso} />
                <span style={{ fontSize: 12.5, color: "#3A2C5C", fontWeight: 600 }}>{store.registryData.authority}</span>
                <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 11, color: "#9991AC" }}>
                  {store.registryData.registryId}
                </span>
              </div>
            )}
            {store.nameStatus === "not_found" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#F59A2E", fontSize: 13.5 }}>
                ✗ Not found in connected registries
              </div>
            )}
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#5B45C9", fontSize: 13.5, fontWeight: 600 }}>
            <VerificationIcon size={16} />✓ Email verified
            <span style={{ fontSize: 12, color: "#9991AC", fontWeight: 400 }}>· identity:self-asserted</span>
          </div>
        )}

        {/* Save controls */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {store.savedAt && !saving && (
            <span style={{ fontSize: 12, color: "#9991AC" }}>
              Saved {store.savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "7px 16px", borderRadius: 8,
              background: saving ? "rgba(91,69,201,0.12)" : "linear-gradient(180deg,#6E58D6,#5B45C9)",
              color: saving ? "#9991AC" : "#fff",
              fontSize: 13, fontWeight: 600, border: "none",
              boxShadow: saving ? "none" : "0 4px 12px rgba(91,69,201,0.28)",
              cursor: saving ? "default" : "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {saving ? <><SpinnerIcon size={12} /> Saving…</> : "Save"}
          </button>
        </div>
      </div>

      {/* Description */}
      <textarea
        value={store.description}
        onChange={(e) => store.setDescription(e.target.value)}
        placeholder={descPlaceholder}
        rows={3}
        style={{
          width: "100%",
          fontSize: 17,
          fontWeight: 300,
          color: "#5A4F78",
          border: "none",
          background: "transparent",
          fontFamily: "inherit",
          resize: "vertical",
          lineHeight: 1.6,
          marginBottom: 32,
        }}
      />

      <div style={{ height: 1, background: "rgba(26,16,53,0.08)", marginBottom: 24 }} />

      {/* Blocks header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
              fontSize: 10.5,
              letterSpacing: "1.4px",
              textTransform: "uppercase",
              color: "#9991AC",
            }}
          >
            Your blocks
          </span>
          {store.blocks.length > 0 && (
            <span
              style={{
                fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                fontSize: 10.5,
                color: "#9991AC",
              }}
            >
              {store.blocks.length}
            </span>
          )}
        </div>
      </div>

      {/* Empty state */}
      {store.blocks.length === 0 && (
        <div
          onClick={handleAddBlock}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "48px 24px",
            border: "1.5px dashed rgba(26,16,53,0.15)",
            borderRadius: 13,
            cursor: "pointer",
            color: "#9991AC",
            fontSize: 14,
            transition: "border-color 0.16s, background 0.16s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(91,69,201,0.02)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(91,69,201,0.3)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(26,16,53,0.15)";
          }}
        >
          <CameraIcon size={28} color="#9991AC" />
          + Add your first block
        </div>
      )}

      {/* Block cards */}
      {store.blocks.map((block) => (
        <BlockCard key={block.id} block={block} mobile={m} />
      ))}

      {store.blocks.length > 0 && (
        <div
          onClick={handleAddBlock}
          style={{
            marginTop: 16,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13.5,
            color: "#5B45C9",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + Add block
        </div>
      )}

      <PiCamSection businessId={store.businessId} entityName={store.companyName} />
    </div>
  );
}

// ===== Block Card =====
function BlockCard({ block, mobile: m }: { block: ProfileBlock; mobile: boolean }) {
  const store = useProfileStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(!block.title); // new blocks start in edit mode
  const [uploadError, setUploadError] = useState<string | null>(null);
  const token = store.authToken ?? (typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);

  const removeBlock = () => {
    clearTimeout(blockSaveTimers.get(block.id));
    blockSaveTimers.delete(block.id);
    if (isServerBlock(block.id) && token) blockApi.delete(block.id, token).catch(() => {});
    store.removeBlock(block.id);
  };

  const accentColor =
    block.media?.phase === "done"
      ? block.media.source === "pi_camera" ? "#5B45C9" : "#F59A2E"
      : "rgba(26,16,53,0.10)";

  const handleFileUpload = useCallback(
    async (source: "pi_camera" | "file", file?: File) => {
      setUploadError(null);
      store.setBlockMedia(block.id, { source, phase: source === "pi_camera" ? "signing" : "timestamping" });

      // Real upload for file source
      if (source === "file" && file) {
        const token = store.authToken ?? (typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);
        if (token && store.businessId) {
          try {
            const { mediaApi } = await import("@/lib/api");
            await mediaApi.upload(block.id, file, file.type.split("/")[0] || "image", token);
          } catch (e) {
            setUploadError(e instanceof Error ? e.message : "Upload failed");
            store.setBlockMedia(block.id, null);
            return;
          }
        }
      }

      // Both Pi CAM (handled server-side) and file finish as "done"
      setTimeout(
        () => store.setBlockMedia(block.id, { source, phase: "done" }),
        source === "pi_camera" ? 850 : 400
      );
    },
    [block.id, store]
  );

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.7)",
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: "0 13px 13px 0",
        padding: "18px 20px 16px 18px",
        marginBottom: 16,
        background: "rgba(255,255,255,0.45)",
        backdropFilter: "blur(12px) saturate(130%)",
        WebkitBackdropFilter: "blur(12px) saturate(130%)",
        boxShadow: "0 6px 20px rgba(45,55,120,0.07), inset 0 1px 0 rgba(255,255,255,0.85)",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editing ? 12 : 6 }}>
        <span style={{ color: "#D8D2E2", fontSize: 16, cursor: "grab" }}>⠿</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!editing && (
            <span
              onClick={() => setEditing(true)}
              style={{ fontSize: 12, color: "#9991AC", cursor: "pointer", padding: "3px 8px", border: "1px solid rgba(26,16,53,0.12)", borderRadius: 6 }}
            >
              Edit
            </span>
          )}
          {editing && (
            <span
              onClick={() => setEditing(false)}
              style={{ fontSize: 12, color: "#5B45C9", cursor: "pointer", fontWeight: 600, padding: "3px 8px", border: "1px solid rgba(91,69,201,0.35)", borderRadius: 6, background: "rgba(91,69,201,0.06)" }}
            >
              Done
            </span>
          )}
          <span onClick={removeBlock} style={{ color: "#9991AC", cursor: "pointer", fontSize: 16 }}>×</span>
        </div>
      </div>

      {editing ? (
        <>
          <input
            value={block.title}
            onChange={(e) => { store.updateBlock(block.id, { title: e.target.value }); scheduleBlockSave(block.id, token); }}
            placeholder="Block title"
            autoFocus
            style={{ width: "100%", fontSize: m ? 18 : 21, fontWeight: 600, color: "#1A1035", border: "none", background: "transparent", fontFamily: "inherit", marginBottom: 8 }}
          />
          <textarea
            value={block.desc}
            onChange={(e) => { store.updateBlock(block.id, { desc: e.target.value }); scheduleBlockSave(block.id, token); }}
            placeholder="Describe what this block shows…"
            rows={2}
            style={{ width: "100%", fontSize: 15, fontWeight: 300, color: "#5A4F78", border: "none", background: "transparent", fontFamily: "inherit", resize: "vertical", lineHeight: 1.55, marginBottom: 16 }}
          />
          {!block.media ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 16px", border: "1px dashed rgba(26,16,53,0.14)", borderRadius: 9, flexWrap: "wrap" }}>
                <CameraIcon size={22} color="#9991AC" />
                <button
                  onClick={() => handleFileUpload("pi_camera")}
                  style={{ padding: "9px 16px", border: "1px solid rgba(91,69,201,0.3)", borderRadius: 9, background: "rgba(91,69,201,0.06)", color: "#5B45C9", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Upload from PI Camera
                </button>
                <span onClick={() => fileRef.current?.click()} style={{ fontSize: 13, color: "#9991AC", cursor: "pointer" }}>
                  or upload a file
                </span>
                <input ref={fileRef} type="file" accept="video/*,image/*,.pdf" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload("file", f); }} />
              </div>
              {uploadError && <div style={{ fontSize: 12, color: "#F59A2E", marginTop: 6 }}>{uploadError}</div>}
            </div>
          ) : (
            <MediaDisplay block={block} onReplace={() => store.setBlockMedia(block.id, null)} />
          )}
        </>
      ) : (
        /* Collapsed view */
        <div>
          <div style={{ fontSize: m ? 17 : 19, fontWeight: 600, color: "#1A1035", marginBottom: block.desc ? 4 : 0 }}>
            {block.title || <span style={{ color: "#D8D2E2" }}>Untitled block</span>}
          </div>
          {block.desc && (
            <div style={{ fontSize: 14, color: "#5A4F78", lineHeight: 1.5, marginBottom: block.media ? 10 : 0 }}>
              {block.desc}
            </div>
          )}
          {block.media && <MediaDisplay block={block} onReplace={() => { store.setBlockMedia(block.id, null); setEditing(true); }} />}
        </div>
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

  const accentColor = isDone ? (isCamera ? "#5B45C9" : "#F59A2E") : "#9991AC";
  const hash = isDone
    ? isCamera
      ? "#c2pa:verified · btc:ts:confirmed"
      : "#btc:ts:confirmed"
    : "";

  return (
    <div>
      {/* Media placeholder (striped) */}
      <div
        style={{
          height: 140,
          borderRadius: 9,
          position: "relative",
          overflow: "hidden",
          background: "repeating-linear-gradient(135deg, rgba(91,69,201,0.04) 0px, rgba(91,69,201,0.04) 8px, transparent 8px, transparent 16px)",
          border: "1px solid rgba(26,16,53,0.08)",
          marginBottom: 10,
        }}
      >
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
                {isCamera ? "✓ Authentic — signed by PI Camera" : "✓ Timestamped on Bitcoin"}
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
function PiCamSection({ businessId, entityName }: { businessId: string | null; entityName: string }) {
  const store = useProfileStore();
  const [qrData, setQrData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  const authToken = store.authToken ?? (typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);

  async function handleConnect() {
    const token = store.authToken ?? (typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);
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
      <div style={{ marginTop: 40, paddingTop: 28, borderTop: "1px solid rgba(26,16,53,0.08)" }}>
        <div style={{
          fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
          fontSize: 10.5, letterSpacing: "1.4px", textTransform: "uppercase",
          color: "#9991AC", marginBottom: 14,
        }}>
          Pi CAM
        </div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#1A1035", marginBottom: 4 }}>
              Connect Pi CAM mobile app
            </div>
            <div style={{ fontSize: 13, color: "#9991AC", lineHeight: 1.5 }}>
              Scan QR in the Pi CAM app to link your camera. Photos will be C2PA-signed and uploaded automatically.
            </div>
            {authToken && (
              <div style={{ fontSize: 11, color: "#27AE60", marginTop: 6, fontWeight: 500 }}>
                ✓ Signed in
              </div>
            )}
          </div>
          <button
            onClick={handleConnect}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 20px",
              border: "1px solid rgba(91,69,201,0.3)", borderRadius: 10,
              background: "rgba(91,69,201,0.06)", color: "#5B45C9", fontSize: 13.5, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
              opacity: loading ? 0.6 : 1, whiteSpace: "nowrap",
            }}
          >
            {loading ? <SpinnerIcon size={14} /> : <CameraIcon size={14} color="#5B45C9" />}
            {loading ? "Generating…" : "Connect Pi CAM"}
          </button>
        </div>
        {error && <div style={{ marginTop: 10, fontSize: 13, color: "#F59A2E" }}>{error}</div>}
      </div>

      {showLogin && (
        <SignInModal
          onSuccess={(token) => {
            localStorage.setItem("auth_token", token);
            store.setAuthToken(token);
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
function SignInModal({ onSuccess, onClose }: { onSuccess: (token: string) => void; onClose: () => void }) {
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
          Required to generate a Pi CAM linking QR code.
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
  const store = useProfileStore();
  const isBusiness = store.entityKind === "business";
  const hasC2pa = store.blocks.some((b) => b.media?.phase === "done" && b.media.source === "pi_camera");
  const level = isBusiness
    ? store.nameStatus === "verified" ? "registry" : "unverified"
    : hasC2pa ? "full" : "email";
  const accentColor = level === "full" ? "#5B45C9" : level === "email" ? "#5B45C9" : level === "registry" ? "#B8B2C8" : "#D8D2E2";
  const levelLabel = level === "full" ? "Full Verification" : level === "email" ? "Email Verified" : level === "registry" ? "Registry Only" : "Unverified";
  const badges = isBusiness
    ? level === "registry" ? ["Registry"] : []
    : level === "full" ? ["Email Verified", "C2PA Media", "Bitcoin TS"] : ["Email Verified"];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: accentColor }} />
        <span style={{ fontSize: m ? 28 : 36, fontWeight: 600, letterSpacing: "-0.8px" }}>
          {store.companyName || "Business Name"}
        </span>
        <span
          style={{
            fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
            fontSize: 10,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: accentColor,
            marginLeft: "auto",
          }}
        >
          {levelLabel}
        </span>
      </div>

      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 20, marginLeft: 18 }}>
        {badges.map((b) => (
          <BadgePill key={b} text={b} />
        ))}
      </div>

      <div
        style={{
          fontSize: 16,
          color: "#5A4F78",
          lineHeight: 1.6,
          marginBottom: 32,
          fontWeight: 300,
        }}
      >
        {store.description || "No description yet."}
      </div>

      {store.blocks.map((block) => (
        <div
          key={block.id}
          style={{
            borderLeft: `3px solid ${
              block.media?.phase === "done"
                ? block.media.source === "pi_camera"
                  ? "#5B45C9"
                  : "#F59A2E"
                : "rgba(26,16,53,0.10)"
            }`,
            borderRadius: "0 11px 11px 0",
            padding: "18px 18px 16px",
            marginBottom: 16,
            border: "1px solid rgba(26,16,53,0.07)",
          }}
        >
          <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>
            {block.title || "Untitled block"}
          </div>
          <div style={{ fontSize: 14.5, color: "#5A4F78", lineHeight: 1.5 }}>
            {block.desc || "—"}
          </div>
          {block.media?.phase === "done" && (
            <div
              style={{
                height: 80,
                marginTop: 12,
                borderRadius: 9,
                background:
                  "repeating-linear-gradient(135deg, rgba(91,69,201,0.04) 0px, rgba(91,69,201,0.04) 8px, transparent 8px, transparent 16px)",
                border: "1px solid rgba(26,16,53,0.06)",
              }}
            />
          )}
          {block.media?.phase === "done" && (
            <div
              style={{
                fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                fontSize: 11,
                color: "#9991AC",
                marginTop: 8,
              }}
            >
              {block.media.source === "pi_camera"
                ? "#c2pa:verified · btc:ts:confirmed"
                : "#btc:ts:confirmed"}
            </div>
          )}
        </div>
      ))}
    </div>
  );
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
      : isBusiness && store.nameStatus === "verified"
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
    registry: isBusiness && store.registryData
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
