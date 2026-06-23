"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Wordmark } from "@/components/ui/Wordmark";
import { BadgePill } from "@/components/ui/BadgePill";
import { IsoChip } from "@/components/ui/IsoChip";
import {
  VerificationIcon,
  SpinnerIcon,
  CameraIcon,
} from "@/components/ui/VerificationIcon";
import { useProfileStore, type ProfileView, type ProfileBlock } from "@/stores/useProfileStore";

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

// Simulate registry check debounce
function useRegistryCheck(name: string) {
  const store = useProfileStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!name.trim()) {
      store.setNameStatus("idle");
      store.setRegistryData(null);
      return;
    }
    store.setNameStatus("checking");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = name.trim().toLowerCase();
      if (
        q.includes("test") ||
        q.includes("xxx") ||
        q.includes("unknown")
      ) {
        store.setNameStatus("not_found");
        store.setRegistryData(null);
      } else {
        store.setNameStatus("verified");
        store.setRegistryData({
          iso: "DE",
          authority: "Handelsregister",
          registryId: `REG·DE·HRB-${Math.floor(Math.random() * 90000 + 10000)}`,
          status: "active",
          city: "Berlin",
          since: "2019",
        });
      }
    }, 850);
    return () => clearTimeout(debounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
}

export default function ProfilePage() {
  const vw = useViewport();
  const m = vw < 640;
  const store = useProfileStore();

  useRegistryCheck(store.companyName);

  const views: Array<{ key: ProfileView; label: string }> = [
    { key: "edit", label: "Edit" },
    { key: "visitor", label: "Preview as visitor" },
    { key: "agent", label: "Preview as agent" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fff",
        fontFamily: "'Trebuchet MS','Segoe UI','Helvetica Neue',sans-serif",
        color: "#1A1035",
      }}
    >
      {/* Corner logo */}
      <div style={{ position: "fixed", top: m ? 16 : 22, left: m ? 16 : 28, zIndex: 20 }}>
        <Wordmark size="sm" />
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: m ? "72px 16px 100px" : "80px 24px 100px",
        }}
      >
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
          background: "rgba(107,63,160,0.04)",
          border: "1px solid rgba(26,16,53,0.10)",
          borderRadius: 12,
          backdropFilter: "blur(8px)",
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
                borderRadius: 9,
                border: "none",
                background: active ? "#6B3FA0" : "transparent",
                color: active ? "#fff" : "#6B6080",
                fontSize: m ? 12 : 13.5,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.16s",
                whiteSpace: "nowrap",
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

// ===== Edit View =====
function EditView({ mobile: m }: { mobile: boolean }) {
  const store = useProfileStore();

  return (
    <div>
      {/* Company name */}
      <input
        value={store.companyName}
        onChange={(e) => store.setCompanyName(e.target.value)}
        placeholder="Company name"
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

      {/* Registry status */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
        {store.nameStatus === "checking" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9991AC", fontSize: 13 }}>
            <SpinnerIcon size={15} />
            Checking registry…
          </div>
        )}
        {store.nameStatus === "verified" && store.registryData && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#6B3FA0", fontSize: 13.5, fontWeight: 600 }}>
              <VerificationIcon size={16} />✓ Verified in registry
            </div>
            <IsoChip code={store.registryData.iso} />
            <span style={{ fontSize: 12.5, color: "#3A2C5C", fontWeight: 600 }}>
              {store.registryData.authority}
            </span>
            <span
              style={{
                fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                fontSize: 11,
                color: "#9991AC",
              }}
            >
              {store.registryData.registryId}
            </span>
          </div>
        )}
        {store.nameStatus === "not_found" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#E8640C", fontSize: 13.5 }}>
            ✗ Not found in connected registries
          </div>
        )}
      </div>

      {/* Description */}
      <textarea
        value={store.description}
        onChange={(e) => store.setDescription(e.target.value)}
        placeholder="What does your company do?"
        rows={3}
        style={{
          width: "100%",
          fontSize: 17,
          fontWeight: 300,
          color: "#6B6080",
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
          onClick={() => store.addBlock()}
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
            (e.currentTarget as HTMLElement).style.background = "rgba(107,63,160,0.02)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(107,63,160,0.3)";
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
          onClick={() => store.addBlock()}
          style={{
            marginTop: 16,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13.5,
            color: "#6B3FA0",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + Add block
        </div>
      )}
    </div>
  );
}

// ===== Block Card =====
function BlockCard({ block, mobile: m }: { block: ProfileBlock; mobile: boolean }) {
  const store = useProfileStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const accentColor =
    block.media?.phase === "done"
      ? block.media.source === "pi_camera"
        ? "#6B3FA0"
        : "#E8640C"
      : "rgba(26,16,53,0.10)";

  const handleFileUpload = useCallback(
    (source: "pi_camera" | "file") => {
      store.setBlockMedia(block.id, { source, phase: source === "pi_camera" ? "signing" : "timestamping" });
      setTimeout(
        () => {
          store.setBlockMedia(block.id, { source, phase: "done" });
        },
        source === "pi_camera" ? 850 : 1300
      );
    },
    [block.id, store]
  );

  return (
    <div
      style={{
        border: "1px solid rgba(26,16,53,0.08)",
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: "0 13px 13px 0",
        padding: "20px 20px 20px 18px",
        marginBottom: 16,
        background: "rgba(107,63,160,0.008)",
      }}
    >
      {/* Card header: drag + remove */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <span style={{ color: "#D8D2E2", fontSize: 16, cursor: "grab" }}>⠿</span>
        <span
          onClick={() => store.removeBlock(block.id)}
          style={{ color: "#9991AC", cursor: "pointer", fontSize: 16 }}
        >
          ×
        </span>
      </div>

      {/* Title */}
      <input
        value={block.title}
        onChange={(e) => store.updateBlock(block.id, { title: e.target.value })}
        placeholder="Block title"
        style={{
          width: "100%",
          fontSize: m ? 18 : 21,
          fontWeight: 600,
          color: "#1A1035",
          border: "none",
          background: "transparent",
          fontFamily: "inherit",
          marginBottom: 8,
        }}
      />

      {/* Description */}
      <textarea
        value={block.desc}
        onChange={(e) => store.updateBlock(block.id, { desc: e.target.value })}
        placeholder="Describe what this block shows…"
        rows={2}
        style={{
          width: "100%",
          fontSize: 15,
          fontWeight: 300,
          color: "#6B6080",
          border: "none",
          background: "transparent",
          fontFamily: "inherit",
          resize: "vertical",
          lineHeight: 1.55,
          marginBottom: 16,
        }}
      />

      {/* Media area */}
      {!block.media ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "20px 16px",
            border: "1px dashed rgba(26,16,53,0.14)",
            borderRadius: 9,
            flexWrap: "wrap",
          }}
        >
          <CameraIcon size={22} color="#9991AC" />
          <button
            onClick={() => handleFileUpload("pi_camera")}
            style={{
              padding: "9px 16px",
              border: "1.5px solid #6B3FA0",
              borderRadius: 9,
              background: "transparent",
              color: "#6B3FA0",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Upload from PI Camera
          </button>
          <span
            onClick={() => fileRef.current?.click()}
            style={{ fontSize: 13, color: "#9991AC", cursor: "pointer" }}
          >
            or upload a file
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="video/*,image/*,.pdf"
            style={{ display: "none" }}
            onChange={() => handleFileUpload("file")}
          />
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

  const accentColor = isDone ? (isCamera ? "#6B3FA0" : "#E8640C") : "#9991AC";
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
          background: "repeating-linear-gradient(135deg, rgba(107,63,160,0.04) 0px, rgba(107,63,160,0.04) 8px, transparent 8px, transparent 16px)",
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
              color: "#6B3FA0",
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#E8640C", fontSize: 13 }}>
              <SpinnerIcon size={14} color="#E8640C" />
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

// ===== Visitor View =====
function VisitorView({ mobile: m }: { mobile: boolean }) {
  const store = useProfileStore();
  const level = store.nameStatus === "verified" ? "full" : "registry";
  const accentColor = level === "full" ? "#6B3FA0" : "#B8B2C8";
  const levelLabel = level === "full" ? "Full Verification" : "Registry Only";
  const hash = level === "full" ? "#c2pa:verified · btc:ts:confirmed" : "#registry:attested";
  const badges = level === "full" ? ["Registry", "C2PA Media", "Bitcoin TS"] : ["Registry"];

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
          color: "#6B6080",
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
                  ? "#6B3FA0"
                  : "#E8640C"
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
          <div style={{ fontSize: 14.5, color: "#6B6080", lineHeight: 1.5 }}>
            {block.desc || "—"}
          </div>
          {block.media?.phase === "done" && (
            <div
              style={{
                height: 80,
                marginTop: 12,
                borderRadius: 9,
                background:
                  "repeating-linear-gradient(135deg, rgba(107,63,160,0.04) 0px, rgba(107,63,160,0.04) 8px, transparent 8px, transparent 16px)",
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

  const trustLevel =
    store.blocks.some((b) => b.media?.phase === "done" && b.media.source === "pi_camera")
      ? "full"
      : store.blocks.some((b) => b.media?.phase === "done")
      ? "partial"
      : store.nameStatus === "verified"
      ? "registry"
      : "unverified";

  const json = {
    business: {
      id: store.businessId || "00000000-0000-0000-0000-000000000001",
      name: store.companyName || "Business Name",
      description: store.description || null,
    },
    registry: store.registryData
      ? {
          status: "verified",
          registry: store.registryData.authority,
          number: store.registryData.registryId,
        }
      : null,
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
          border: "1px solid rgba(26,16,53,0.10)",
          borderRadius: 13,
          background: "rgba(107,63,160,0.015)",
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
              color: "#6B3FA0",
              fontWeight: 600,
            }}
          >
            GET /v1/business/{store.businessId || "{slug}"}
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
