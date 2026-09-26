"use client";

import { useState } from "react";
import { SpinnerIcon } from "@/components/ui/VerificationIcon";
import type { DomainVerifyInstructions } from "@/lib/api";
import {
  GR_INK, GR_BODY, GR_MUTED, GR_PRIMARY, GR_PRIMARY_HOVER,
  GR_TINT, GR_ORANGE, GR_BORDER, GR_RAISED, GR_MONO_FONT,
} from "@/components/GridOfRecord";

// Domain-ownership proof, "Grid of Record" flavour: type a domain → get the
// DNS TXT / well-known instructions → "Check now". The same three-beat UX
// /profile's Domain MethodCard has had since 3.13, lifted out so the claim
// flow (3.24: /claim's 409 branch, reached from /e/[slug]'s "Is this you?")
// runs the identical pattern against /claim/domain/* instead of
// /verify/domain/*. The two calls are injected so the panel doesn't know
// which backend route it's driving. /profile's card still has its own copy
// in the pre-3.22 glass style — switching it to this component is a
// /profile restyle, tracked separately.

export type DomainCheckResult = { verified: boolean } & Record<string, unknown>;

export function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginBottom: 8 }}>
      {/* no uppercase: the label is a URL for the well-known row */}
      <div style={{ fontFamily: GR_MONO_FONT, fontSize: 10.5, letterSpacing: "0.3px", color: GR_MUTED, marginBottom: 4, wordBreak: "break-all" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
        <code style={{
          flex: 1, minWidth: 0, fontFamily: GR_MONO_FONT, fontSize: 12, lineHeight: 1.5,
          color: GR_INK, background: GR_RAISED, border: `1px solid ${GR_BORDER}`, borderRight: "none",
          padding: "8px 10px", wordBreak: "break-all",
        }}>{value}</code>
        <button
          onClick={() => { navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}
          style={{
            fontFamily: GR_MONO_FONT, fontSize: 11, fontWeight: 600, color: GR_PRIMARY,
            background: "#fff", border: `1px solid ${GR_BORDER}`, padding: "0 12px", cursor: "pointer", flexShrink: 0,
          }}
        >
          {copied ? "✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

export default function DomainProofPanel({
  start, check, onVerified, mobile: m, initialDomain = "",
}: {
  start: (domain: string) => Promise<DomainVerifyInstructions>;
  check: (domain: string) => Promise<DomainCheckResult>;
  onVerified: (result: DomainCheckResult) => void;
  mobile: boolean;
  initialDomain?: string;
}) {
  const [domain, setDomain] = useState(initialDomain);
  const [instr, setInstr] = useState<DomainVerifyInstructions | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const getInstructions = async () => {
    const d = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!d) return;
    setBusy(true); setErr(null);
    try { setInstr(await start(d)); setDomain(d); }
    catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };

  const runCheck = async () => {
    if (!instr) return;
    setBusy(true); setErr(null);
    try {
      const r = await check(instr.domain);
      if (r.verified) onVerified(r);
      else setErr("Not found yet — a DNS TXT record or the well-known file can take a few minutes to propagate. Try again shortly.");
    } catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };

  const btn = (disabled: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "12px 20px", borderRadius: 4, border: "none",
    background: disabled ? GR_TINT : GR_PRIMARY, color: disabled ? GR_MUTED : "#fff",
    fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: disabled ? "default" : "pointer",
    whiteSpace: "nowrap", transition: "background 0.16s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {!instr ? (
        <div style={{ display: "flex", gap: 10, flexWrap: m ? "wrap" : "nowrap" }}>
          <input
            value={domain}
            onChange={(e) => { setDomain(e.target.value); setErr(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") getInstructions(); }}
            placeholder="yourdomain.com"
            autoCapitalize="none" autoCorrect="off" spellCheck={false}
            style={{
              flex: "1 1 220px", minWidth: 0, padding: "12px 14px", fontSize: 15, fontFamily: "inherit",
              color: GR_INK, background: "#fff", border: `1px solid ${GR_BORDER}`, borderRadius: 0, outline: "none",
            }}
          />
          <button
            onClick={getInstructions}
            disabled={busy || !domain.trim()}
            onMouseEnter={(e) => { if (!busy && domain.trim()) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY_HOVER; }}
            onMouseLeave={(e) => { if (!busy && domain.trim()) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY; }}
            style={{ ...btn(busy || !domain.trim()), width: m ? "100%" : "auto" }}
          >
            {busy ? <><SpinnerIcon size={14} color="#fff" /> Preparing…</> : "Get instructions →"}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 14, color: GR_BODY, lineHeight: 1.55, marginBottom: 14 }}>
            Add <strong style={{ color: GR_INK }}>either</strong> proof for <strong style={{ color: GR_INK }}>{instr.domain}</strong>, then check.
            {" "}Expires in {Math.max(1, Math.round(instr.expires_in / 3600))}h.
          </div>
          <div style={{ fontFamily: GR_MONO_FONT, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: GR_PRIMARY, marginBottom: 8 }}>
            DNS TXT record
          </div>
          <CopyRow label="Host" value={instr.dns_txt.host} />
          <CopyRow label="Value" value={instr.dns_txt.value} />
          <div style={{ fontFamily: GR_MONO_FONT, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: GR_PRIMARY, margin: "14px 0 8px" }}>
            …or a well-known file
          </div>
          <CopyRow label={instr.file.url} value={instr.file.content} />
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
            <button
              onClick={runCheck}
              disabled={busy}
              onMouseEnter={(e) => { if (!busy) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY_HOVER; }}
              onMouseLeave={(e) => { if (!busy) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY; }}
              style={btn(busy)}
            >
              {busy ? <><SpinnerIcon size={14} color="#fff" /> Checking…</> : "Check now →"}
            </button>
            <span onClick={() => { if (!busy) { setInstr(null); setErr(null); } }} style={{ fontSize: 13, color: GR_MUTED, cursor: "pointer" }}>
              Use a different domain
            </span>
          </div>
        </div>
      )}
      {err && <div style={{ fontSize: 13, color: GR_ORANGE, lineHeight: 1.5 }}>{err}</div>}
    </div>
  );
}
