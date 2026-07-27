"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { mediaUrl } from "@/lib/api";

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

interface PublicBlockMedia {
  id: string;
  type: string;
  storage_url: string;
  original_hash: string | null;
  c2pa_verified: boolean;
  c2pa_signer: string | null;
  bitcoin_confirmed: boolean;
  bitcoin_block: number | null;
  uploaded_at: string;
}

interface PublicBlock {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  order: number;
  is_public: boolean;
  verification_status: string;
  media: PublicBlockMedia[];
  created_at: string;
}

export default function PublicBlockPage() {
  const params = useParams<{ slug: string; blockId: string }>();
  const [block, setBlock] = useState<PublicBlock | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params?.blockId) return;
    fetch(`${API_BASE}/api/v1/blocks/${params.blockId}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setBlock)
      .catch(() => setNotFound(true));
  }, [params?.blockId]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 50%,#EDF1FB 100%)", color: TEXT, fontFamily: "'Manrope','Trebuchet MS','Segoe UI',sans-serif", position: "relative" }}>
      <AppHeader />

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "110px 24px 80px" }}>
        <Link href={`/e/${params?.slug}`} style={{ display: "inline-block", marginBottom: 16, fontSize: 13, fontWeight: 600, color: INDIGO, textDecoration: "none" }}>
          ← Back to profile
        </Link>

        {notFound && (
          <div style={{ ...glass, padding: "48px 40px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Block not found</div>
            <div style={{ fontSize: 14.5, color: TEXT_SEC }}>This block doesn&apos;t exist or isn&apos;t public.</div>
          </div>
        )}

        {!block && !notFound && (
          <div style={{ textAlign: "center", color: MUTED, fontSize: 14, paddingTop: 60 }}>Loading…</div>
        )}

        {block && (
          <div style={{ ...glass, padding: "34px 36px" }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", margin: 0 }}>{block.title}</h1>
            {block.description && (
              <p style={{ fontSize: 15, color: TEXT_SEC, lineHeight: 1.6, margin: "14px 0 0" }}>{block.description}</p>
            )}

            {block.media.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
                {block.media.map((m) => {
                  const url = mediaUrl(m.storage_url);
                  return (
                    <div key={m.id} style={{ border: "1px solid rgba(26,16,53,0.08)", borderRadius: 12, overflow: "hidden" }}>
                      {url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt=""
                          style={{ width: "100%", maxHeight: 420, objectFit: "contain", display: "block", background: "#F3F1FA" }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "10px 14px" }}>
                        {url && (
                          <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: INDIGO, textDecoration: "none" }}>
                            View original
                          </a>
                        )}
                        {m.original_hash && (
                          <span style={{ fontSize: 11.5, fontFamily: "ui-monospace,monospace", color: MUTED }}>
                            #sha256:{m.original_hash.slice(0, 16)}…
                          </span>
                        )}
                        {m.c2pa_verified && (
                          <span style={{ fontSize: 11.5, fontFamily: "ui-monospace,monospace", color: INDIGO }}>c2pa:verified</span>
                        )}
                        {m.bitcoin_confirmed ? (
                          <span style={{ fontSize: 11.5, fontFamily: "ui-monospace,monospace", color: SUN }}>btc:ts:confirmed{m.bitcoin_block ? ` #${m.bitcoin_block}` : ""}</span>
                        ) : (
                          <span style={{ fontSize: 11.5, fontFamily: "ui-monospace,monospace", color: MUTED }}>btc:ts:pending</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 13.5, color: MUTED, marginTop: 20 }}>No media attached to this block.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
