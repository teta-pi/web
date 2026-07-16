"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  SpinnerIcon,
  CheckCircleIcon,
  PasskeyIcon,
} from "@/components/ui/VerificationIcon";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { type EntityKind, entityTypeForKind, isPersonKind } from "@/lib/types";
import { searchApi, authApi, businessApi, claimApi } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";

/* ── Design tokens ── */
const INDIGO = "#5B45C9";
const SUN = "#F59A2E";
const TEXT = "#1A1035";
const TEXT_SEC = "#5A4F78";
const TEXT_AUTH = "#3A2C5C";
const MUTED = "#9991AC";
const DOT = "#C9C2D8";

/* ── Wordmark ── */
function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 7, cursor: "pointer", userSelect: "none" }}>
      <span style={{ fontSize: 20, fontWeight: 700, color: INDIGO, lineHeight: 1, letterSpacing: -0.5 }}>Θ</span>
      <span style={{ fontSize: 15, fontWeight: 300, color: TEXT, lineHeight: 1 }}>+</span>
      <span style={{ fontSize: 18, fontWeight: 700, color: SUN, lineHeight: 1 }}>π</span>
    </div>
  );
}

function useViewport() {
  const [vw, setVw] = useState(1280);
  useEffect(() => {
    const u = () => setVw(window.innerWidth);
    u(); window.addEventListener("resize", u);
    return () => window.removeEventListener("resize", u);
  }, []);
  return vw;
}

const PAIRING_CODE = `PI-${Math.random().toString(36).slice(2, 6).toUpperCase()}-9QX1`;

/* ── Pseudo-QR ── */
function PseudoQR() {
  const size = 160, modules = 21, cell = size / modules;

  const finderPattern = (ox: number, oy: number) => {
    const cells = [];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const border = r === 0 || r === 6 || c === 0 || c === 6;
        const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (border || inner) cells.push(<rect key={`${ox}-${oy}-${r}-${c}`} x={(ox + c) * cell} y={(oy + r) * cell} width={cell} height={cell} fill={TEXT} />);
      }
    }
    return cells;
  };

  const dataModules = [];
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      const inFinder = (r < 9 && c < 9) || (r < 9 && c > modules - 9) || (r > modules - 9 && c < 9);
      if (!inFinder && Math.random() > 0.5) {
        dataModules.push(<rect key={`d-${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill={TEXT} />);
      }
    }
  }

  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <rect width={size} height={size} fill="white" />
      {dataModules}
      {finderPattern(0, 0)}
      {finderPattern(modules - 7, 0)}
      {finderPattern(0, modules - 7)}
    </svg>
  );
}

/* ── Glass container shared wrapper ── */
function PageShell({ children, m }: { children: React.ReactNode; m: boolean }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 50%,#EDF1FB 100%)",
      color: TEXT,
      position: "relative",
      overflow: "hidden",
      fontFamily: "'Manrope','Trebuchet MS','Segoe UI',sans-serif",
    }}>
      {/* Color washes */}
      <div style={{ position: "absolute", top: -160, left: -130, width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle,rgba(91,69,201,0.22),transparent 68%)", filter: "blur(34px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -180, right: -150, width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle,rgba(245,154,46,0.18),transparent 68%)", filter: "blur(38px)", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <Link href="/" style={{ position: "fixed", top: m ? 16 : 26, left: m ? 16 : 30, zIndex: 20, textDecoration: "none" }}>
          <Wordmark />
        </Link>
        {children}
      </div>
    </div>
  );
}

/* ── Primary button ── */
function BtnPrimary({ children, onClick, disabled, style }: {
  children: React.ReactNode; onClick?: () => void;
  disabled?: boolean; style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "13px 24px", borderRadius: 11,
        background: disabled ? "rgba(26,16,53,0.08)" : `linear-gradient(180deg,#6E58D6,${INDIGO})`,
        color: disabled ? MUTED : "#fff",
        fontSize: 15, fontWeight: 600, border: "none",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
        boxShadow: disabled ? "none" : "0 6px 18px rgba(91,69,201,0.30), inset 0 1px 0 rgba(255,255,255,0.3)",
        transition: "opacity 0.16s",
        ...style,
      }}
    >{children}</button>
  );
}

/* ── Icons ── */
function MailIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>;
}
function SearchIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={INDIGO} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.3-4.3"/></svg>;
}

/* ── Step 0 type picker ── */
type TopKind = "business" | "person";

const TOP_KINDS: Array<{ top: TopKind; label: string; sub: string; detail: string }> = [
  {
    top: "business",
    label: "Business / Organization",
    sub: "Company · startup · brand · NGO · institution",
    detail: "Be found by AI agents searching for verified suppliers, partners, and services.",
  },
  {
    top: "person",
    label: "Person",
    sub: "Journalist · actor · creator · other",
    detail: "Prove you're a real human — and that your work is yours, not AI-generated.",
  },
];

const SUB_KINDS: Record<TopKind, Array<{ kind: EntityKind; label: string; hint: string }>> = {
  business: [
    { kind: "business", label: "Business", hint: "Company · startup · brand" },
    { kind: "organization", label: "Organization", hint: "NGO · institution · public body" },
  ],
  person: [
    { kind: "journalist", label: "Journalist", hint: "Reporter · editor · publication" },
    { kind: "actor", label: "Actor", hint: "Film · stage · voice" },
    { kind: "creator", label: "Creator", hint: "Artist · photographer · musician" },
    { kind: "other", label: "Other", hint: "Anyone who needs a verified identity" },
  ],
};

/* ══════════════════════════════════════════════════════ */
export default function ClaimPage() {
  const vw = useViewport();
  const m = vw < 640;
  const store = useOnboardingStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [topKind, setTopKind] = useState<TopKind | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [nameCheck, setNameCheck] = useState<"idle" | "checking" | "taken" | "available">("idle");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [readyToPay, setReadyToPay] = useState(false);
  const claimSubmittedRef = useRef(false);

  const isPerson = isPersonKind(store.entityKind);

  useEffect(() => { if (store.step !== 1) setNameCheck("idle"); }, [store.step]);

  // Register the claim in the waitlist once the user is authed (idempotent on email)
  useEffect(() => {
    if (!store.authed || !store.accountEmail || claimSubmittedRef.current) return;
    claimSubmittedRef.current = true;
    const kindMap: Record<EntityKind, "business" | "journalist" | "creator" | "developer" | "other"> = {
      business: "business", organization: "other", journalist: "journalist",
      actor: "other", creator: "creator", other: "other",
    };
    claimApi
      .create(store.accountEmail, kindMap[store.entityKind ?? "business"] ?? "other", readyToPay, {
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
      })
      .catch(() => { claimSubmittedRef.current = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.authed, store.accountEmail]);

  // Create the entity as soon as the account exists. No registry lookup, no match
  // required — POST /businesses takes any name and returns registry_status=unverified
  // (docs/api.md, docs/verification-rework.md §1). Registry, business-email and
  // domain proofs are optional methods the owner picks later on /profile.
  useEffect(() => {
    if (!store.authed || !store.token || !store.entity || store.createdEntityId) return;
    const entityType = entityTypeForKind(store.entityKind);
    setCreating(true); setCreateError("");
    businessApi
      .create(store.entity.name, undefined, store.entity.iso || undefined, store.token, entityType)
      .then((biz) => store.setCreatedEntityId(String(biz.id)))
      .catch(() => setCreateError("Could not save your profile — you can retry from your dashboard."))
      .finally(() => setCreating(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.authed, store.token]);

  // Name availability is advisory. It never blocks a business: two entities can
  // legitimately share a brand name (Google the brand vs Alphabet Inc. the legal
  // entity) and trust comes from verification, not from claiming a name first.
  useEffect(() => {
    if (store.step !== 1) return;
    if (!store.query.trim()) { setNameCheck("idle"); return; }
    setNameCheck("checking");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchApi.search(store.query.trim(), "any");
        const exact = results.some((r) => r.name.toLowerCase() === store.query.trim().toLowerCase());
        setNameCheck(exact ? "taken" : "available");
      } catch { setNameCheck("available"); }
    }, 600);
    return () => clearTimeout(debounceRef.current);
  }, [store.query, store.step]);

  const STEP_LABELS = ["Identify", "Verify", "Camera", "Publish"];

  /* ── Step 0: Entry — pick a type ── */
  if (store.step === 0) {
    const subs = topKind ? SUB_KINDS[topKind] : [];

    return (
      <PageShell m={m}>
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: m ? "80px 24px 60px" : "60px 40px",
          textAlign: "center",
        }}>
          <div style={{
            fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
            fontSize: 11.5, letterSpacing: "1.4px", textTransform: "uppercase",
            color: MUTED, marginBottom: 26,
          }}>For businesses · journalists · actors · creators</div>

          <div style={{
            fontSize: m ? 38 : 52, fontWeight: 600,
            letterSpacing: "-1.4px", lineHeight: 1.04,
            maxWidth: 640, marginBottom: 20,
          }}>
            Claim your verified identity.
          </div>

          <div style={{
            fontSize: 17, fontWeight: 300, lineHeight: 1.6,
            color: TEXT_SEC, maxWidth: 480, marginBottom: 44,
          }}>
            Create your page in a minute — free, no registry needed. Add proof (registry,
            domain, business email, C2PA media) whenever you&apos;re ready.
          </div>

          {/* Top-level: business or person */}
          <div style={{
            display: "grid",
            gridTemplateColumns: m ? "1fr" : "1fr 1fr",
            gap: 14, width: "100%", maxWidth: 640, marginBottom: subs.length ? 20 : 36,
          }}>
            {TOP_KINDS.map(({ top, label, sub, detail }) => {
              const active = topKind === top;
              return (
                <button
                  key={top}
                  onClick={() => { setTopKind(top); store.setEntityKind(SUB_KINDS[top][0].kind); }}
                  style={{
                    textAlign: "left",
                    background: active ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.5)",
                    border: active ? `1px solid ${INDIGO}` : "1px solid rgba(255,255,255,0.7)",
                    borderRadius: 18,
                    padding: "22px 24px",
                    cursor: "pointer", fontFamily: "inherit",
                    boxShadow: active
                      ? "0 12px 34px rgba(91,69,201,0.18), inset 0 1px 0 rgba(255,255,255,0.9)"
                      : "0 8px 26px rgba(45,55,120,0.08), inset 0 1px 0 rgba(255,255,255,0.85)",
                    backdropFilter: "blur(14px) saturate(140%)",
                    WebkitBackdropFilter: "blur(14px) saturate(140%)",
                    transition: "box-shadow 0.15s, border 0.15s, background 0.15s",
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>{sub}</div>
                  <div style={{ fontSize: 13, color: TEXT_SEC, lineHeight: 1.5 }}>{detail}</div>
                </button>
              );
            })}
          </div>

          {/* Sub-kind picker — appears once a top-level card is chosen */}
          {topKind && (
            <div style={{ width: "100%", maxWidth: 640, marginBottom: 36 }}>
              <div style={{
                fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
                fontSize: 10.5, letterSpacing: "0.6px", textTransform: "uppercase",
                color: MUTED, marginBottom: 12, textAlign: "left",
              }}>
                {topKind === "person" ? "What kind of person?" : "What kind of entity?"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginBottom: 22 }}>
                {subs.map(({ kind, label, hint }) => {
                  const active = store.entityKind === kind;
                  return (
                    <button
                      key={kind}
                      onClick={() => store.setEntityKind(kind)}
                      title={hint}
                      style={{
                        textAlign: "left", padding: "10px 16px", borderRadius: 11,
                        border: active ? `1px solid ${INDIGO}` : "1px solid rgba(26,16,53,0.12)",
                        background: active ? "rgba(91,69,201,0.06)" : "rgba(255,255,255,0.45)",
                        color: active ? TEXT : TEXT_SEC,
                        cursor: "pointer", fontFamily: "inherit",
                        transition: "border 0.15s, background 0.15s",
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{hint}</div>
                    </button>
                  );
                })}
              </div>
              <BtnPrimary
                disabled={!store.entityKind}
                onClick={() => store.setStep(1)}
                style={{ width: m ? "100%" : "auto" }}
              >
                Continue →
              </BtnPrimary>
            </div>
          )}

          <Link href="/login" style={{ fontSize: 13.5, color: TEXT_SEC, textDecoration: "none" }}>
            Already verified? Sign in
          </Link>

          <div style={{
            marginTop: 52,
            fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
            fontSize: 11, color: MUTED, letterSpacing: "0.4px",
            display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center",
          }}>
            <span>registry:attested</span><span style={{ color: DOT }}>·</span>
            <span>c2pa:verified</span><span style={{ color: DOT }}>·</span>
            <span>btc:ts:confirmed</span>
          </div>
        </div>
      </PageShell>
    );
  }

  /* ── Steps 1–3 ── */
  if (store.step >= 1 && store.step <= 3) {
    const stepIndex = store.step - 1;
    const progressPct = `${store.step * 25}%`;
    const trustChipLabel = store.authed ? "Email verified" : "Unverified — free to create";
    const trustChipColor = store.authed ? INDIGO : MUTED;

    return (
      <PageShell m={m}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: m ? "80px 20px 60px" : "80px 40px 80px" }}>

          {/* Progress Rail */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: store.authed ? trustChipColor : "transparent", border: `1px solid ${trustChipColor}` }} />
                <span style={{ fontSize: 12.5, color: TEXT_AUTH, letterSpacing: "0.2px" }}>{trustChipLabel}</span>
              </span>
              <span style={{ fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", fontSize: 11, color: MUTED, letterSpacing: "0.6px" }}>
                STEP {store.step} / 4
              </span>
            </div>
            <div style={{ height: 2, background: "rgba(26,16,53,0.07)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: progressPct, background: INDIGO, borderRadius: 2, transition: "width 0.35s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 11 }}>
              {STEP_LABELS.map((label, i) => {
                const done = i < stepIndex, active = i === stepIndex;
                return (
                  <span key={label} style={{
                    fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
                    fontSize: m ? 9 : 10.5, letterSpacing: "0.3px",
                    color: active ? INDIGO : done ? TEXT_AUTH : MUTED,
                    fontWeight: active ? 700 : 400,
                  }}>{label}</span>
                );
              })}
            </div>
          </div>

          {/* Back — hidden once the account exists; there is nothing to go back to */}
          {!store.authed && (
            <div
              onClick={() => store.setStep((store.step - 1) as 0 | 1 | 2 | 3 | 4)}
              style={{ fontSize: 13, color: MUTED, cursor: "pointer", marginBottom: 32, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              ← Back
            </div>
          )}

          {/* ── Step 1: Identify ── */}
          {store.step === 1 && (
            <div>
              <div style={{ fontSize: m ? 26 : 32, fontWeight: 600, letterSpacing: "-0.7px", lineHeight: 1.12, marginBottom: 8 }}>
                {isPerson ? "What's your name?" : "What's it called?"}
              </div>
              <div style={{ fontSize: 16, fontWeight: 300, lineHeight: 1.55, color: TEXT_SEC, marginBottom: 28 }}>
                {store.entityKind === "business"
                  ? "The name people know you by — brand or legal name, either works. You can add an official registry match later."
                  : store.entityKind === "organization"
                  ? "Your organization's name — this becomes your verified identity on TETA+PI."
                  : store.entityKind === "journalist"
                  ? "Your name or handle as you publish — this becomes your verified identity on TETA+PI."
                  : store.entityKind === "creator"
                  ? "Your name or artist handle — we'll attach C2PA-signed proof of authorship to your work."
                  : "Your name or handle — this becomes your verified identity on TETA+PI."}
              </div>

              {/* Input */}
              <div style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "15px 18px",
                border: "1px solid rgba(26,16,53,0.12)", borderRadius: 13,
                background: "rgba(91,69,201,0.025)",
                backdropFilter: "blur(8px)",
                marginBottom: 20,
              }}>
                <SearchIcon size={20} />
                <input
                  value={store.query}
                  onChange={(e) => store.setQuery(e.target.value)}
                  placeholder={isPerson ? "Your name or username…" : "Name…"}
                  style={{ flex: 1, border: "none", background: "transparent", fontSize: 17, color: TEXT, fontFamily: "inherit" }}
                />
              </div>

              <div style={{ marginBottom: 20, minHeight: 20 }}>
                {nameCheck === "checking" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, color: MUTED, fontSize: 13 }}>
                    <SpinnerIcon size={14} /> Checking availability…
                  </div>
                )}
                {nameCheck === "available" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#22B07D", fontSize: 13 }}>
                    <CheckCircleIcon size={14} /> Name is available
                  </div>
                )}
                {nameCheck === "taken" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, color: SUN, fontSize: 13 }}>
                    {isPerson
                      ? "✗ This name is already taken — try a different one"
                      : "! Someone already uses this name — you can still continue, then prove control."}
                  </div>
                )}
                {nameCheck === "idle" && (
                  <div style={{ fontSize: 12, color: MUTED }}>
                    This name will appear on your verified profile.
                  </div>
                )}
              </div>

              <BtnPrimary
                disabled={!store.query.trim() || nameCheck === "checking" || (isPerson && nameCheck === "taken")}
                onClick={() => {
                  if (!store.query.trim()) return;
                  store.setEntity({ name: store.query.trim(), iso: "" });
                  store.setStep(2);
                }}
              >
                Continue →
              </BtnPrimary>
            </div>
          )}

          {/* ── Step 2: Verify email → account ── */}
          {store.step === 2 && store.entity && (
            <div style={{ maxWidth: 420 }}>
              <div style={{ fontSize: m ? 26 : 32, fontWeight: 600, letterSpacing: "-0.8px", marginBottom: 8 }}>Verify your email.</div>
              <div style={{ fontSize: 15, color: TEXT_SEC, marginBottom: 28, lineHeight: 1.5 }}>
                We&apos;ll send a code to confirm you&apos;re real. This is your account — and your
                page goes live as soon as it&apos;s confirmed.
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, background: `rgba(91,69,201,0.08)`, marginBottom: 28, fontSize: 14, fontWeight: 600, color: TEXT_AUTH }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: INDIGO }} />
                {store.entity.name}
              </div>

              {!emailCodeSent ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", border: "1px solid rgba(26,16,53,0.12)", borderRadius: 9, marginBottom: 14 }}>
                    <MailIcon size={18} />
                    <input
                      value={emailInput}
                      onChange={(e) => { setEmailInput(e.target.value); setEmailError(""); }}
                      placeholder="your@email.com"
                      type="email"
                      style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", fontSize: 15, color: TEXT, fontFamily: "inherit" }}
                    />
                  </div>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: TEXT_SEC, lineHeight: 1.5, cursor: "pointer", marginBottom: 14 }}>
                    <input
                      type="checkbox"
                      checked={readyToPay}
                      onChange={(e) => setReadyToPay(e.target.checked)}
                      style={{ marginTop: 2, width: 15, height: 15, accentColor: INDIGO }}
                    />
                    <span>I&apos;m ready to pay <strong>$25</strong> when billing launches — lock my founding price.</span>
                  </label>
                  {emailError && <div style={{ color: SUN, fontSize: 13, marginBottom: 10 }}>{emailError}</div>}
                  <BtnPrimary
                    disabled={!emailInput.includes("@") || emailLoading}
                    style={{ width: "100%" }}
                    onClick={async () => {
                      setEmailLoading(true); setEmailError("");
                      try {
                        await authApi.sendEmailCode(emailInput.trim());
                        store.setAccountEmail(emailInput.trim());
                        setEmailCodeSent(true);
                      } catch { setEmailError("Couldn't send code — check your email and try again."); }
                      finally { setEmailLoading(false); }
                    }}
                  >
                    {emailLoading ? <><SpinnerIcon size={16} /> Sending…</> : "Send verification code →"}
                  </BtnPrimary>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
                    <div style={{ flex: 1, height: 1, background: "rgba(26,16,53,0.08)" }} />
                    <span style={{ fontSize: 12, color: MUTED }}>or</span>
                    <div style={{ flex: 1, height: 1, background: "rgba(26,16,53,0.08)" }} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    {[
                      { label: "Continue with Google", icon: <span style={{ width: 20, height: 20, borderRadius: "50%", border: "1px solid rgba(26,16,53,0.25)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: TEXT_AUTH, flexShrink: 0 }}>G</span> },
                      { label: "Continue with a passkey", icon: <PasskeyIcon size={18} /> },
                    ].map(({ label, icon }) => (
                      <button
                        key={label}
                        title="OAuth coming soon — use email above"
                        onClick={() => setEmailError("OAuth coming soon. Use email above.")}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 12,
                          padding: "13px 18px",
                          border: "1px solid rgba(26,16,53,0.14)", borderRadius: 11,
                          background: "transparent", fontSize: 14.5, fontWeight: 600, color: TEXT_AUTH,
                          cursor: "not-allowed", fontFamily: "inherit", textAlign: "left", opacity: 0.6,
                        }}
                      >
                        {icon} {label}
                        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 400, color: "#B8B2C8" }}>soon</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13.5, color: TEXT_SEC, marginBottom: 14 }}>
                    Code sent to <strong>{emailInput}</strong>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                    <input
                      value={emailCode}
                      onChange={(e) => { setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setEmailError(""); }}
                      placeholder="· · · · · ·"
                      maxLength={6}
                      style={{
                        width: 160, fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
                        fontSize: 22, letterSpacing: "8px", padding: "10px 14px",
                        border: "1px solid rgba(26,16,53,0.12)", borderRadius: 9,
                        background: "transparent", color: TEXT,
                      }}
                    />
                    <BtnPrimary
                      disabled={emailCode.length < 6 || emailLoading}
                      onClick={async () => {
                        setEmailLoading(true); setEmailError("");
                        try {
                          const res = await authApi.verifyCode(emailInput.trim(), emailCode);
                          store.setToken(res.access_token);
                          useAuthStore.getState().setAuth(res.access_token, { email: emailInput.trim() } as never);
                          store.setAuthed(true); store.setStep(3);
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : "";
                          setEmailError(
                            msg.includes("Too many") ? "Too many attempts — request a new code." : "Wrong or expired code — try again."
                          );
                        } finally { setEmailLoading(false); }
                      }}
                      style={{ padding: "10px 20px" }}
                    >
                      {emailLoading ? <><SpinnerIcon size={14} /> Checking…</> : "Verify →"}
                    </BtnPrimary>
                  </div>
                  {emailError && <div style={{ color: SUN, fontSize: 13 }}>{emailError}</div>}
                  <span onClick={() => { setEmailCodeSent(false); setEmailCode(""); }} style={{ fontSize: 13, color: MUTED, cursor: "pointer" }}>
                    Resend or change email
                  </span>
                </>
              )}
              <div style={{ marginTop: 20 }}>
                <span onClick={() => store.setStep(1)} style={{ fontSize: 13, color: MUTED, cursor: "pointer" }}>← Change name</span>
              </div>
            </div>
          )}

          {/* ── Step 3: Camera pairing (the entity is being created in the background) ── */}
          {store.step === 3 && (
            <div>
              <div style={{ fontSize: m ? 26 : 32, fontWeight: 600, letterSpacing: "-0.7px", marginBottom: 10 }}>Link your PI Camera.</div>
              <div style={{ fontSize: 16, fontWeight: 300, lineHeight: 1.6, color: TEXT_SEC, marginBottom: creating ? 12 : 32, maxWidth: 500 }}>
                Pair once. Then any clip you shoot is C2PA-signed on the device and flows straight into your blocks.
              </div>
              {creating && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: 13, color: TEXT_SEC }}>
                  <SpinnerIcon size={14} /> Creating your profile…
                </div>
              )}
              {createError && <div style={{ marginBottom: 16, fontSize: 13, color: SUN }}>{createError}</div>}

              <div style={{ display: "flex", gap: 30, alignItems: "center", flexWrap: "wrap", marginBottom: 32 }}>
                <div style={{
                  flexShrink: 0, padding: 16,
                  border: "1px solid rgba(26,16,53,0.10)", borderRadius: 14,
                  background: "rgba(255,255,255,0.82)",
                  boxShadow: "0 8px 26px rgba(45,55,120,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
                }}>
                  <PseudoQR />
                </div>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", fontSize: 12, color: MUTED, letterSpacing: "0.4px", marginBottom: 6 }}>PAIRING CODE</div>
                  <div style={{ fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", fontSize: 22, color: TEXT_AUTH, letterSpacing: "2px", fontWeight: 600, marginBottom: 18 }}>{PAIRING_CODE}</div>
                  <div style={{ fontSize: 14, color: TEXT_SEC, lineHeight: 1.55, maxWidth: 280 }}>
                    Open PI Camera, go to <span style={{ color: TEXT_AUTH, fontWeight: 600 }}>Settings → Link account</span>, and scan this code or enter the pairing code above.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <BtnPrimary onClick={() => { store.setPaired(true); store.setStep(4); }}>I&apos;ve linked my camera →</BtnPrimary>
                <span onClick={() => store.setStep(4)} style={{ fontSize: 14, color: TEXT_SEC, cursor: "pointer", textAlign: "center" }}>
                  Skip for now — link later
                </span>
              </div>
            </div>
          )}
        </div>
      </PageShell>
    );
  }

  /* ── Step 4: Success ── */
  if (store.step === 4) {
    return (
      <PageShell m={m}>
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: m ? "80px 24px" : "80px 40px", textAlign: "center",
        }}>
          <CheckCircleIcon size={46} color={INDIGO} />

          <div style={{ fontSize: m ? 36 : 48, fontWeight: 600, letterSpacing: "-1px", lineHeight: 1.05, marginTop: 24, marginBottom: 10 }}>
            You&apos;re live.
          </div>
          <div style={{ fontSize: 16, fontWeight: 300, lineHeight: 1.6, color: TEXT_SEC, maxWidth: 440, marginBottom: 30 }}>
            {store.entity?.name ?? "Your identity"} is now on TETA+PI.
          </div>

          {/* Summary card */}
          <div style={{
            width: "100%", maxWidth: 440,
            border: "1px solid rgba(26,16,53,0.10)",
            borderLeft: "3px solid #B8B2C8",
            borderRadius: "0 13px 13px 0",
            padding: "18px 20px",
            background: "rgba(91,69,201,0.015)",
            textAlign: "left", marginBottom: 28,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: TEXT, letterSpacing: "-0.2px" }}>
                {store.entity?.name ?? "Your identity"}
              </span>
              <span style={{ fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", fontSize: 9.5, letterSpacing: "1.1px", textTransform: "uppercase", color: "#B8B2C8" }}>
                Email Verified
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10, fontSize: 12, color: MUTED }}>
              <span>{store.accountEmail || "—"}</span>
              {store.createdEntityId && <><span style={{ color: DOT }}>·</span><span style={{ color: "#22B07D" }}>✓ Profile saved</span></>}
              {store.paired && <><span style={{ color: DOT }}>·</span><span style={{ color: INDIGO }}>✓ PI Camera linked</span></>}
            </div>
          </div>

          {/* Maturity strip */}
          <div style={{
            fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
            fontSize: 11, display: "flex", gap: 10, alignItems: "center",
            marginBottom: 32, flexWrap: "wrap", justifyContent: "center",
          }}>
            <span style={{ color: "#B8B2C8" }}>● Email Verified</span>
            <span style={{ color: DOT }}>→</span>
            <span style={{ color: MUTED }}>○ {isPerson ? "C2PA Media" : "Registry / Domain"}</span>
            <span style={{ color: DOT }}>→</span>
            <span style={{ color: MUTED }}>○ Full</span>
          </div>

          <div style={{ fontSize: 14, color: TEXT_SEC, maxWidth: 380, lineHeight: 1.55, marginBottom: 28 }}>
            {isPerson
              ? "Add C2PA-signed media with PI Camera to reach Full verification — the highest trust level."
              : "Add proof from your profile — official registry match, domain ownership, or business email — to raise your trust level."}
          </div>

          <Link
            href="/profile"
            onClick={() => {
              if (store.token) localStorage.setItem("auth_token", store.token);
              if (store.createdEntityId) localStorage.setItem("entity_id", store.createdEntityId);
              if (store.entityKind) localStorage.setItem("entity_kind", store.entityKind);
            }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 9,
              padding: "14px 26px", borderRadius: 11,
              background: `linear-gradient(180deg,#6E58D6,${INDIGO})`,
              color: "#fff", fontSize: 15, fontWeight: 600, textDecoration: "none",
              boxShadow: "0 8px 24px rgba(91,69,201,0.34), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}
          >
            Build your profile →
          </Link>
        </div>
      </PageShell>
    );
  }

  return null;
}
