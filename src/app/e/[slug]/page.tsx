"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AccountMenu from "@/components/AccountMenu";

const INDIGO = "#5B45C9";
const SUN = "#F59A2E";
const TEXT = "#1A1035";
const TEXT_SEC = "#5A4F78";
const MUTED = "#9088B0";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.55)",
  border: "1px solid rgba(255,255,255,0.7)",
  borderRadius: 18,
  boxShadow: "0 12px 40px rgba(45,55,120,0.10), inset 0 1px 0 rgba(255,255,255,0.85)",
  backdropFilter: "blur(20px) saturate(140%)",
  WebkitBackdropFilter: "blur(20px) saturate(140%)",
};

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

const LEVEL_COLORS: Record<string, string> = {
  full: INDIGO, live: INDIGO, partial: "#7A68D4", domain: "#3FA97C",
  email: "#3F7FA0", registry: "#9088B0", none: "#B8B2C8",
};

export default function PublicEntityPage() {
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
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 50%,#EDF1FB 100%)", color: TEXT, fontFamily: "'Manrope','Trebuchet MS','Segoe UI',sans-serif", position: "relative" }}>
      <Link href="/" style={{ position: "fixed", top: 26, left: 30, zIndex: 10, textDecoration: "none", display: "flex", alignItems: "baseline", gap: 7 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: INDIGO }}>Θ</span>
        <span style={{ fontSize: 15, fontWeight: 300, color: TEXT }}>+</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: SUN }}>π</span>
      </Link>
      <AccountMenu />

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "110px 24px 80px" }}>
        {notFound && (
          <div style={{ ...glass, padding: "48px 40px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Entity not found</div>
            <div style={{ fontSize: 14.5, color: TEXT_SEC }}>This page doesn&apos;t exist or isn&apos;t public.</div>
            <Link href="/" style={{ display: "inline-block", marginTop: 20, fontSize: 14, fontWeight: 600, color: INDIGO, textDecoration: "none" }}>← Search entities</Link>
          </div>
        )}

        {!profile && !notFound && (
          <div style={{ textAlign: "center", color: MUTED, fontSize: 14, paddingTop: 60 }}>Loading…</div>
        )}

        {profile && (
          <>
            {/* Header card */}
            <div style={{ ...glass, padding: "34px 36px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.7px", margin: 0 }}>{profile.name}</h1>
                    {profile.country && (
                      <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, padding: "2px 7px", border: `1px solid ${INDIGO}40`, borderRadius: 5, color: INDIGO }}>{profile.country}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13.5, color: MUTED, marginTop: 6, textTransform: "capitalize" }}>{profile.entity_type}</div>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
                  color: "#fff", background: LEVEL_COLORS[profile.trust_level] ?? MUTED,
                  padding: "6px 14px", borderRadius: 12,
                }}>
                  {profile.trust_level === "none" ? "Unverified" : `${profile.trust_level} · verified`}
                </span>
              </div>
              {profile.description && (
                <p style={{ fontSize: 15, color: TEXT_SEC, lineHeight: 1.6, margin: "18px 0 0" }}>{profile.description}</p>
              )}

              {/* Trust chips */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 20 }}>
                {profile.registry.status === "verified" && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: INDIGO, background: "rgba(91,69,201,0.08)", padding: "5px 12px", borderRadius: 10, fontFamily: "ui-monospace,monospace" }}>
                    registry:attested{profile.registry.registry_id ? ` · ${profile.registry.registry_id}` : ""}
                  </span>
                )}
                {profile.trust_level === "email" && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#3F7FA0", background: "rgba(63,127,160,0.10)", padding: "5px 12px", borderRadius: 10, fontFamily: "ui-monospace,monospace" }}>
                    email:control · verified
                  </span>
                )}
                {profile.trust_level === "domain" && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#3FA97C", background: "rgba(63,169,124,0.10)", padding: "5px 12px", borderRadius: 10, fontFamily: "ui-monospace,monospace" }}>
                    dns:txt · verified
                  </span>
                )}
                {profile.agent_endpoint && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: profile.agent_endpoint_verified ? "#3FA97C" : MUTED, background: profile.agent_endpoint_verified ? "rgba(63,169,124,0.10)" : "rgba(26,16,53,0.05)", padding: "5px 12px", borderRadius: 10, fontFamily: "ui-monospace,monospace" }}>
                    mcp:{profile.agent_endpoint_verified ? "reachable" : "declared"}
                  </span>
                )}
              </div>

              {/* Brand → verified legal entity, publicly disclosed (not hidden) */}
              {profile.legal_entity && (
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(26,16,53,0.07)", fontSize: 13.5, color: TEXT_SEC }}>
                  Legal entity:{" "}
                  <Link href={`/e/${profile.legal_entity.slug}`} style={{ color: INDIGO, fontWeight: 600, textDecoration: "none" }}>
                    {profile.legal_entity.name}
                  </Link>
                  {profile.legal_entity.registry_status === "verified" && (
                    <span style={{ fontSize: 12, color: MUTED, marginLeft: 8, fontFamily: "ui-monospace,monospace" }}>registry-verified</span>
                  )}
                </div>
              )}
            </div>

            {/* Blocks */}
            {profile.blocks.length > 0 ? (
              profile.blocks.map((b, i) => (
                <div key={i} style={{ ...glass, padding: "24px 28px", marginBottom: 12 }}>
                  <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.3px" }}>{b.title}</div>
                  {b.description && <p style={{ fontSize: 14, color: TEXT_SEC, lineHeight: 1.6, margin: "8px 0 0" }}>{b.description}</p>}
                  {b.media.length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      {b.media.map((m, j) => (
                        <span key={j} style={{ fontSize: 11.5, fontFamily: "ui-monospace,monospace", color: TEXT_SEC, background: "rgba(26,16,53,0.05)", padding: "4px 10px", borderRadius: 8 }}>
                          {m.type}
                          {m.c2pa_verified && <span style={{ color: INDIGO }}> · C2PA ✓</span>}
                          {m.bitcoin_confirmed && <span style={{ color: SUN }}> · BTC #{m.bitcoin_block}</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ ...glass, padding: "24px 28px", textAlign: "center", color: MUTED, fontSize: 14 }}>
                No public blocks yet.
              </div>
            )}

            {/* Agent footer */}
            <div style={{ textAlign: "center", marginTop: 28, fontSize: 12, color: MUTED, fontFamily: "ui-monospace,monospace" }}>
              Verifiable by AI agents via MCP · mcp.tetapi.dev · teta_verify_entity
            </div>
          </>
        )}
      </div>
    </div>
  );
}
