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
import {
  GR_INK, GR_BODY, GR_MUTED, GR_PRIMARY, GR_PRIMARY_HOVER,
  GR_TINT, GR_LILAC, GR_ORANGE, GR_BORDER, GR_RAISED, GR_MONO_FONT,
} from "@/components/GridOfRecord";

/* ── Wordmark — same local pattern as page.tsx / profile / search / e/[slug]
   (3.15f, 3.16a), colors match the shared ui/Wordmark.tsx exactly ── */
function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 7, cursor: "pointer", userSelect: "none" }}>
      <span style={{ fontSize: 20, fontWeight: 700, color: GR_PRIMARY, lineHeight: 1, letterSpacing: -0.5 }}>Θ</span>
      <span style={{ fontSize: 15, fontWeight: 300, color: GR_INK, lineHeight: 1 }}>+</span>
      <span style={{ fontSize: 18, fontWeight: 700, color: GR_ORANGE, lineHeight: 1 }}>π</span>
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

/* ── Shared page wrapper — same flat background as /profile, /search,
   /e/[slug] (no glass blur washes) ── */
function PageShell({ children, m }: { children: React.ReactNode; m: boolean }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 50%,#EDF1FB 100%)",
      color: GR_INK,
      position: "relative",
      // "clip", not "hidden" — see page.tsx (home) for why: this wizard's own
      // step transitions change content height enough to trigger it (phantom
      // scroll container hiding the progress rail after a step change).
      overflow: "clip",
      fontFamily: "'Manrope','Trebuchet MS','Segoe UI',sans-serif",
    }}>
      <div style={{ position: "relative", zIndex: 1 }}>
        <Link href="/" style={{ position: "fixed", top: `calc(var(--banner-h) + ${m ? 16 : 26}px)`, left: m ? 16 : 30, zIndex: 20, textDecoration: "none" }}>
          <Wordmark />
        </Link>
        {children}
      </div>
    </div>
  );
}

/* ── Primary button — flat GR_PRIMARY, square corners (matches the
   BlockDetailModal / search-page CTA pattern), no gradient or shadow ── */
function BtnPrimary({ children, onClick, disabled, style }: {
  children: React.ReactNode; onClick?: () => void;
  disabled?: boolean; style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY_HOVER; }}
      onMouseLeave={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY; }}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "13px 24px", borderRadius: 4,
        background: disabled ? GR_TINT : GR_PRIMARY,
        color: disabled ? GR_MUTED : "#fff",
        fontSize: 15, fontWeight: 600, border: "none",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
        transition: "background 0.16s",
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
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={GR_PRIMARY} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.3-4.3"/></svg>;
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
  const claimSubmittedRef = useRef(false);

  const isPerson = isPersonKind(store.entityKind);

  useEffect(() => { if (store.step !== 1) setNameCheck("idle"); }, [store.step]);

  // Each step is a fresh screen — start it scrolled to the top instead of
  // wherever the previous step left off (otherwise the progress rail can
  // render above the fold, e.g. when clicking through on a short viewport).
  useEffect(() => { window.scrollTo(0, 0); }, [store.step]);

  // Register the claim in the waitlist once the user is authed (idempotent on email)
  useEffect(() => {
    if (!store.authed || !store.accountEmail || claimSubmittedRef.current) return;
    claimSubmittedRef.current = true;
    const kindMap: Record<EntityKind, "business" | "journalist" | "creator" | "developer" | "other"> = {
      business: "business", organization: "other", journalist: "journalist",
      actor: "other", creator: "creator", other: "other",
    };
    claimApi
      .create(store.accountEmail, kindMap[store.entityKind ?? "business"] ?? "other", {
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

  // Camera step is hidden until 14.x's device-link flow is confirmed working
  // on a real device (docs/known-issues.md QA #11/#33) — the rail only ever
  // shows Identify/Verify here; Publish is the Step 4 success screen below.
  const STEP_LABELS = ["Identify", "Verify", "Publish"];

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
            fontFamily: GR_MONO_FONT,
            fontSize: 11.5, letterSpacing: "1.4px", textTransform: "uppercase",
            color: GR_MUTED, marginBottom: 26,
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
            color: GR_BODY, maxWidth: 480, marginBottom: 44,
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
                    background: active ? GR_TINT : "#fff",
                    border: active ? `1px solid ${GR_PRIMARY}` : `1px solid ${GR_BORDER}`,
                    borderRadius: 0,
                    padding: "22px 24px",
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "border 0.15s, background 0.15s",
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 600, color: GR_INK, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 12, color: GR_MUTED, marginBottom: 10 }}>{sub}</div>
                  <div style={{ fontSize: 13, color: GR_BODY, lineHeight: 1.5 }}>{detail}</div>
                </button>
              );
            })}
          </div>

          {/* Sub-kind picker — appears once a top-level card is chosen */}
          {topKind && (
            <div style={{ width: "100%", maxWidth: 640, marginBottom: 36 }}>
              <div style={{
                fontFamily: GR_MONO_FONT,
                fontSize: 10.5, letterSpacing: "0.6px", textTransform: "uppercase",
                color: GR_MUTED, marginBottom: 12, textAlign: "left",
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
                        textAlign: "left", padding: "10px 16px", borderRadius: 0,
                        border: active ? `1px solid ${GR_PRIMARY}` : `1px solid ${GR_BORDER}`,
                        background: active ? GR_TINT : "#fff",
                        color: active ? GR_INK : GR_BODY,
                        cursor: "pointer", fontFamily: "inherit",
                        transition: "border 0.15s, background 0.15s",
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 11.5, color: GR_MUTED, marginTop: 2 }}>{hint}</div>
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

          <Link href="/login" style={{ fontSize: 13.5, color: GR_BODY, textDecoration: "none" }}>
            Already verified? Sign in
          </Link>

          <div style={{
            marginTop: 52,
            fontFamily: GR_MONO_FONT,
            fontSize: 11, color: GR_MUTED, letterSpacing: "0.4px",
            display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center",
          }}>
            <span>registry:attested</span><span style={{ color: GR_LILAC }}>·</span>
            <span>c2pa:verified</span><span style={{ color: GR_LILAC }}>·</span>
            <span>btc:ts:confirmed</span>
          </div>
        </div>
      </PageShell>
    );
  }

  /* ── Steps 1–2 (Camera step hidden — see STEP_LABELS note above) ── */
  if (store.step === 1 || store.step === 2) {
    const stepIndex = store.step - 1;
    const progressPct = `${(store.step / STEP_LABELS.length) * 100}%`;
    const trustChipLabel = store.authed ? "Email verified" : "Unverified — free to create";
    const trustChipColor = store.authed ? GR_PRIMARY : GR_MUTED;

    return (
      <PageShell m={m}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: m ? "80px 20px 60px" : "80px 40px 80px" }}>

          {/* Progress Rail */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: store.authed ? trustChipColor : "transparent", border: `1px solid ${trustChipColor}` }} />
                <span style={{ fontSize: 12.5, color: GR_BODY, letterSpacing: "0.2px" }}>{trustChipLabel}</span>
              </span>
              <span style={{ fontFamily: GR_MONO_FONT, fontSize: 11, color: GR_MUTED, letterSpacing: "0.6px" }}>
                STEP {store.step} / {STEP_LABELS.length}
              </span>
            </div>
            <div style={{ height: 2, background: GR_BORDER, overflow: "hidden" }}>
              <div style={{ height: "100%", width: progressPct, background: GR_PRIMARY, transition: "width 0.35s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 11 }}>
              {STEP_LABELS.map((label, i) => {
                const done = i < stepIndex, active = i === stepIndex;
                return (
                  <span key={label} style={{
                    fontFamily: GR_MONO_FONT,
                    fontSize: m ? 9 : 10.5, letterSpacing: "0.3px",
                    color: active ? GR_PRIMARY : done ? GR_BODY : GR_MUTED,
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
              style={{ fontSize: 13, color: GR_MUTED, cursor: "pointer", marginBottom: 32, display: "inline-flex", alignItems: "center", gap: 6 }}
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
              <div style={{ fontSize: 16, fontWeight: 300, lineHeight: 1.55, color: GR_BODY, marginBottom: 28 }}>
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
                border: `1px solid ${GR_BORDER}`, borderRadius: 0,
                background: "#fff",
                marginBottom: 20,
              }}>
                <SearchIcon size={20} />
                <input
                  value={store.query}
                  onChange={(e) => store.setQuery(e.target.value)}
                  placeholder={isPerson ? "Your name or username…" : "Name…"}
                  style={{ flex: 1, border: "none", background: "transparent", fontSize: 17, color: GR_INK, fontFamily: "inherit" }}
                />
              </div>

              <div style={{ marginBottom: 20, minHeight: 20 }}>
                {nameCheck === "checking" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, color: GR_MUTED, fontSize: 13 }}>
                    <SpinnerIcon size={14} /> Checking availability…
                  </div>
                )}
                {nameCheck === "available" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#22B07D", fontSize: 13 }}>
                    <CheckCircleIcon size={14} /> Name is available
                  </div>
                )}
                {nameCheck === "taken" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, color: GR_ORANGE, fontSize: 13 }}>
                    {isPerson
                      ? "✗ This name is already taken — try a different one"
                      : "! Someone already uses this name — you can still continue, then prove control."}
                  </div>
                )}
                {nameCheck === "idle" && (
                  <div style={{ fontSize: 12, color: GR_MUTED }}>
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
              <div style={{ fontSize: 15, color: GR_BODY, marginBottom: 28, lineHeight: 1.5 }}>
                We&apos;ll send a code to confirm you&apos;re real. This is your account — and your
                page goes live as soon as it&apos;s confirmed.
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 0, border: `1px solid ${GR_BORDER}`, background: GR_TINT, marginBottom: 28, fontSize: 14, fontWeight: 600, color: GR_INK }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: GR_PRIMARY }} />
                {store.entity.name}
              </div>

              {!emailCodeSent ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", border: `1px solid ${GR_BORDER}`, borderRadius: 0, marginBottom: 14 }}>
                    <MailIcon size={18} />
                    <input
                      value={emailInput}
                      onChange={(e) => { setEmailInput(e.target.value); setEmailError(""); }}
                      placeholder="your@email.com"
                      type="email"
                      style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", fontSize: 15, color: GR_INK, fontFamily: "inherit" }}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: GR_BODY, lineHeight: 1.5, marginBottom: 14 }}>
                    <CheckCircleIcon size={14} />
                    <span>Join early access — be first on the registry.</span>
                  </div>
                  {emailError && <div style={{ color: GR_ORANGE, fontSize: 13, marginBottom: 10 }}>{emailError}</div>}
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
                    <div style={{ flex: 1, height: 1, background: GR_BORDER }} />
                    <span style={{ fontSize: 12, color: GR_MUTED }}>or</span>
                    <div style={{ flex: 1, height: 1, background: GR_BORDER }} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    {[
                      { label: "Continue with Google", icon: <span style={{ width: 20, height: 20, borderRadius: "50%", border: `1px solid ${GR_BORDER}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: GR_BODY, flexShrink: 0 }}>G</span> },
                      { label: "Continue with a passkey", icon: <PasskeyIcon size={18} /> },
                    ].map(({ label, icon }) => (
                      <button
                        key={label}
                        title="OAuth coming soon — use email above"
                        onClick={() => setEmailError("OAuth coming soon. Use email above.")}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 12,
                          padding: "13px 18px",
                          border: `1px solid ${GR_BORDER}`, borderRadius: 0,
                          background: "transparent", fontSize: 14.5, fontWeight: 600, color: GR_BODY,
                          cursor: "not-allowed", fontFamily: "inherit", textAlign: "left", opacity: 0.6,
                        }}
                      >
                        {icon} {label}
                        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 400, color: GR_MUTED }}>soon</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13.5, color: GR_BODY, marginBottom: 14 }}>
                    Code sent to <strong>{emailInput}</strong>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                    <input
                      value={emailCode}
                      onChange={(e) => { setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setEmailError(""); }}
                      placeholder="· · · · · ·"
                      maxLength={6}
                      style={{
                        width: 160, fontFamily: GR_MONO_FONT,
                        fontSize: 22, letterSpacing: "8px", padding: "10px 14px",
                        border: `1px solid ${GR_BORDER}`, borderRadius: 0,
                        background: "transparent", color: GR_INK,
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
                          store.setAuthed(true); store.setStep(4);
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
                  {emailError && <div style={{ color: GR_ORANGE, fontSize: 13 }}>{emailError}</div>}
                  <span onClick={() => { setEmailCodeSent(false); setEmailCode(""); }} style={{ fontSize: 13, color: GR_MUTED, cursor: "pointer" }}>
                    Resend or change email
                  </span>
                </>
              )}
              <div style={{ marginTop: 20 }}>
                <span onClick={() => store.setStep(1)} style={{ fontSize: 13, color: GR_MUTED, cursor: "pointer" }}>← Change name</span>
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
          <CheckCircleIcon size={46} color={GR_PRIMARY} />

          <div style={{ fontSize: m ? 36 : 48, fontWeight: 600, letterSpacing: "-1px", lineHeight: 1.05, marginTop: 24, marginBottom: 10 }}>
            You&apos;re live.
          </div>
          <div style={{ fontSize: 16, fontWeight: 300, lineHeight: 1.6, color: GR_BODY, maxWidth: 440, marginBottom: 30 }}>
            {store.entity?.name ?? "Your identity"} is now on TETA+PI.
          </div>

          {/* Summary card */}
          <div style={{
            width: "100%", maxWidth: 440,
            border: `1px solid ${GR_BORDER}`,
            borderLeft: `3px solid ${GR_LILAC}`,
            borderRadius: 0,
            padding: "18px 20px",
            background: GR_RAISED,
            textAlign: "left", marginBottom: 28,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: GR_INK, letterSpacing: "-0.2px" }}>
                {store.entity?.name ?? "Your identity"}
              </span>
              <span style={{ fontFamily: GR_MONO_FONT, fontSize: 9.5, letterSpacing: "1.1px", textTransform: "uppercase", color: GR_MUTED }}>
                Email Verified
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10, fontSize: 12, color: GR_MUTED }}>
              <span>{store.accountEmail || "—"}</span>
              {creating && <><span style={{ color: GR_LILAC }}>·</span><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><SpinnerIcon size={11} /> Saving profile…</span></>}
              {store.createdEntityId && <><span style={{ color: GR_LILAC }}>·</span><span style={{ color: "#22B07D" }}>✓ Profile saved</span></>}
              {store.paired && <><span style={{ color: GR_LILAC }}>·</span><span style={{ color: GR_PRIMARY }}>✓ PI Camera linked</span></>}
            </div>
            {createError && <div style={{ marginTop: 10, fontSize: 12.5, color: GR_ORANGE }}>{createError}</div>}
          </div>

          {/* Maturity strip — registry match isn't business-only (3.23: a
              person-kind entity can carry a real verified registry_status
              too, e.g. a sole proprietor's name found in Handelsregister),
              so the person path names it alongside C2PA instead of implying
              it isn't available. */}
          <div style={{
            fontFamily: GR_MONO_FONT,
            fontSize: 11, display: "flex", gap: 10, alignItems: "center",
            marginBottom: 32, flexWrap: "wrap", justifyContent: "center",
          }}>
            <span style={{ color: GR_MUTED }}>● Email Verified</span>
            <span style={{ color: GR_LILAC }}>→</span>
            <span style={{ color: GR_MUTED }}>○ {isPerson ? "Registry / C2PA Media" : "Registry / Domain"}</span>
            <span style={{ color: GR_LILAC }}>→</span>
            <span style={{ color: GR_MUTED }}>○ Full</span>
          </div>

          <div style={{ fontSize: 14, color: GR_BODY, maxWidth: 380, lineHeight: 1.55, marginBottom: 28 }}>
            {isPerson
              ? "Add proof from your profile — official registry match, domain ownership, or C2PA-signed media via PI Camera — to raise your trust level."
              : "Add proof from your profile — official registry match, domain ownership, or business email — to raise your trust level."}
          </div>

          <Link
            href="/profile"
            onClick={() => {
              if (store.token) localStorage.setItem("auth_token", store.token);
              if (store.createdEntityId) localStorage.setItem("entity_id", store.createdEntityId);
              if (store.entityKind) localStorage.setItem("entity_kind", store.entityKind);
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = GR_PRIMARY_HOVER; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = GR_PRIMARY; }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 9,
              padding: "14px 26px", borderRadius: 4,
              background: GR_PRIMARY,
              color: "#fff", fontSize: 15, fontWeight: 600, textDecoration: "none",
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
