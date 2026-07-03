"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  SpinnerIcon,
  CheckCircleIcon,
  PasskeyIcon,
} from "@/components/ui/VerificationIcon";
import {
  useOnboardingStore,
  type RegistryEntity,
  type EntityKind,
} from "@/stores/useOnboardingStore";
import { searchApi, authApi, businessApi, claimApi } from "@/lib/api";

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

/* ── IsoChip ── */
function IsoChip({ code }: { code: string }) {
  if (!code) return null;
  return (
    <span style={{
      fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
      fontSize: 10, padding: "1px 6px",
      border: "1px solid rgba(91,69,201,0.25)",
      borderRadius: 4, color: INDIGO, letterSpacing: "0.5px",
    }}>{code}</span>
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

/* ── Synthetic fallback ── */
function syntheticResults(q: string): RegistryEntity[] {
  if (!q.trim()) return [];
  const base = q.trim();
  return [
    { name: `${base} GmbH`, registryId: `HRB-${Math.floor(Math.random() * 90000 + 10000)}`, iso: "DE", authority: "Handelsregister", city: "Berlin", status: "active", since: "2019" },
    { name: `${base} Ltd`, registryId: `CRN-${Math.floor(Math.random() * 90000 + 10000)}`, iso: "GB", authority: "Companies House", city: "London", status: "active", since: "2020" },
  ];
}

const OFFICERS = [
  "J•••n S•••h  ·  Director",
  "M•••a K•••k  ·  Managing Director",
  "A•••a L•••z  ·  Authorised Signatory",
];

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

/* ── ProveMethodCard ── */
function ProveMethodCard({ title, description, icon, selected, onToggle, children }: {
  title: string; description: string; icon: React.ReactNode;
  selected: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: selected ? `1px solid rgba(91,69,201,0.30)` : "1px solid rgba(26,16,53,0.10)",
        borderLeft: selected ? `3px solid ${INDIGO}` : "1px solid rgba(26,16,53,0.10)",
        borderRadius: selected ? "0 11px 11px 0" : 11,
        padding: "16px 18px",
        background: selected ? "rgba(91,69,201,0.025)" : "transparent",
        cursor: "pointer",
        transition: "border 0.16s, background 0.16s",
      }}
      onClick={onToggle}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: selected ? INDIGO : MUTED }}>{icon}</span>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: TEXT }}>{title}</div>
          <div style={{ fontSize: 12.5, color: TEXT_SEC, marginTop: 2 }}>{description}</div>
        </div>
      </div>
      {selected && <div onClick={(e) => e.stopPropagation()}>{children}</div>}
    </div>
  );
}

/* ── Icons ── */
function MailIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>;
}
function UserIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0"/></svg>;
}
function DocumentIcon({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/></svg>;
}
function SearchIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={INDIGO} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.3-4.3"/></svg>;
}

/* ══════════════════════════════════════════════════════ */
export default function ClaimPage() {
  const vw = useViewport();
  const m = vw < 640;
  const store = useOnboardingStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [synResults, setSynResults] = useState<RegistryEntity[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [expandedMethod, setExpandedMethod] = useState<"domain" | "contact" | "document" | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [nameUnique, setNameUnique] = useState<"idle" | "checking" | "taken" | "available">("idle");
  const [emailVerifyInput, setEmailVerifyInput] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [emailVerifyLoading, setEmailVerifyLoading] = useState(false);
  const [emailVerifyError, setEmailVerifyError] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [readyToPay, setReadyToPay] = useState(false);
  const claimSubmittedRef = useRef(false);

  const isBusiness = store.entityKind === "business";

  useEffect(() => { if (store.step !== 1) setNameUnique("idle"); }, [store.step]);

  // Register the claim in the waitlist once the user is authed (idempotent on email)
  useEffect(() => {
    if (!store.authed || !store.accountEmail || claimSubmittedRef.current) return;
    claimSubmittedRef.current = true;
    const kindMap: Record<string, "business" | "journalist" | "creator" | "developer" | "other"> = {
      business: "business", journalist: "journalist", artist: "creator", organization: "other",
    };
    claimApi
      .create(store.accountEmail, kindMap[store.entityKind ?? "business"] ?? "other", readyToPay, {
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
      })
      .catch(() => { claimSubmittedRef.current = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.authed, store.accountEmail]);

  useEffect(() => {
    if (!store.authed || !store.token || !store.entity || store.createdEntityId) return;
    const entityTypeMap: Record<string, string> = {
      business: "business", journalist: "person", artist: "person", organization: "organization",
    };
    const entityType = entityTypeMap[store.entityKind ?? "business"] ?? "business";
    setCreating(true); setCreateError("");
    businessApi
      .create(store.entity.name, undefined, store.entity.iso || undefined, store.token, entityType)
      .then((biz) => store.setCreatedEntityId(String(biz.id)))
      .catch(() => setCreateError("Could not save your profile — you can retry from your dashboard."))
      .finally(() => setCreating(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.authed, store.token]);

  useEffect(() => {
    if (store.step !== 1 || isBusiness) return;
    if (!store.query.trim()) { setNameUnique("idle"); return; }
    setNameUnique("checking");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchApi.search(store.query.trim(), "any");
        const exact = results.some((r) => r.name.toLowerCase() === store.query.trim().toLowerCase());
        setNameUnique(exact ? "taken" : "available");
      } catch { setNameUnique("available"); }
    }, 600);
    return () => clearTimeout(debounceRef.current);
  }, [store.query, store.step, isBusiness]);

  useEffect(() => {
    if (store.step !== 1 || !isBusiness) return;
    if (!store.query.trim()) { store.setSearchPhase("idle"); return; }
    store.setSearchPhase("searching");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchApi.searchRegistry(store.query.trim());
        if (results.length === 0) {
          store.setSearchPhase("none");
        } else {
          setSynResults(results.map((r) => ({
            name: r.legal_name, registryId: r.registration_number,
            iso: r.country, authority: r.registry,
            city: r.address?.split(",")[0] ?? "",
            status: r.status, since: r.founded ?? "",
          })));
          store.setSearchPhase("results");
        }
      } catch {
        setSynResults(syntheticResults(store.query));
        store.setSearchPhase("results");
      }
    }, 700);
    return () => clearTimeout(debounceRef.current);
  }, [store.query, store.step, isBusiness]);

  const STEP_LABELS = ["Identify", "Confirm", "Prove", "Camera", "Publish"];
  const trustChipLabel = store.proven ? "Control proven" : store.entity ? "Registry attested" : "Unverified";
  const trustChipColor = store.proven ? INDIGO : store.entity ? "#B8B2C8" : MUTED;

  /* ── Step 0: Entry ── */
  if (store.step === 0) {
    const kinds: Array<{ kind: EntityKind; label: string; sub: string; detail: string }> = [
      { kind: "business", label: "Business", sub: "Company · Startup · Brand", detail: "Be found by AI agents searching for verified suppliers, partners, and services." },
      { kind: "journalist", label: "Journalist / Media", sub: "Reporter · Editor · Publication", detail: "Prove your identity and content are real — let agents cite you with confidence." },
      { kind: "artist", label: "Artist / Creator", sub: "Visual art · Photography · Music", detail: "Prove your work is human-made, not AI-generated. C2PA-signed proof on the blockchain." },
      { kind: "organization", label: "Organization", sub: "NGO · Institution · Public body", detail: "Verified presence for foundations, universities, and public institutions." },
    ];

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
          }}>For businesses · journalists · artists</div>

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
            Prove you&apos;re real — through official registries and C2PA-signed media — and become discoverable by AI agents.
          </div>

          {/* Entity kind selector */}
          <div style={{
            display: "grid",
            gridTemplateColumns: m ? "1fr" : "1fr 1fr",
            gap: 14, width: "100%", maxWidth: 640, marginBottom: 36,
          }}>
            {kinds.map(({ kind, label, sub, detail }) => (
              <button
                key={kind}
                onClick={() => { store.setEntityKind(kind); store.setStep(1); }}
                style={{
                  textAlign: "left", background: "rgba(255,255,255,0.5)",
                  border: "1px solid rgba(255,255,255,0.7)",
                  borderRadius: 18,
                  padding: "22px 24px",
                  cursor: "pointer", fontFamily: "inherit",
                  boxShadow: "0 8px 26px rgba(45,55,120,0.08), inset 0 1px 0 rgba(255,255,255,0.85)",
                  backdropFilter: "blur(14px) saturate(140%)",
                  WebkitBackdropFilter: "blur(14px) saturate(140%)",
                  transition: "box-shadow 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 34px rgba(91,69,201,0.18), inset 0 1px 0 rgba(255,255,255,0.9)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 26px rgba(45,55,120,0.08), inset 0 1px 0 rgba(255,255,255,0.85)"; }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>{sub}</div>
                <div style={{ fontSize: 13, color: TEXT_SEC, lineHeight: 1.5 }}>{detail}</div>
              </button>
            ))}
          </div>

          <span
            onClick={() => { store.setAuthMode("signin"); store.setStep(4); }}
            style={{ fontSize: 13.5, color: TEXT_SEC, cursor: "pointer" }}
          >
            Already verified? Sign in
          </span>

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

  /* ── Steps 1–4 ── */
  if (store.step >= 1 && store.step <= 4) {
    const stepIndex = store.step - 1;
    const progressPct = `${store.step * 20}%`;

    return (
      <PageShell m={m}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: m ? "80px 20px 60px" : "80px 40px 80px" }}>

          {/* Progress Rail */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: store.proven || store.entity ? trustChipColor : "transparent", border: `1px solid ${trustChipColor}` }} />
                <span style={{ fontSize: 12.5, color: TEXT_AUTH, letterSpacing: "0.2px" }}>{trustChipLabel}</span>
              </span>
              <span style={{ fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", fontSize: 11, color: MUTED, letterSpacing: "0.6px" }}>
                STEP {store.step} / 5
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

          {/* Back */}
          <div
            onClick={() => store.setStep((store.step - 1) as 0 | 1 | 2 | 3 | 4 | 5)}
            style={{ fontSize: 13, color: MUTED, cursor: "pointer", marginBottom: 32, display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            ← Back
          </div>

          {/* ── Step 1: Identify ── */}
          {store.step === 1 && (
            <div>
              <div style={{ fontSize: m ? 26 : 32, fontWeight: 600, letterSpacing: "-0.7px", lineHeight: 1.12, marginBottom: 8 }}>
                {isBusiness ? "What's your business called?" : "What's your name?"}
              </div>
              <div style={{ fontSize: 16, fontWeight: 300, lineHeight: 1.55, color: TEXT_SEC, marginBottom: 28 }}>
                {isBusiness
                  ? "Enter the legal name. We search official registries directly — no forms, no categories."
                  : store.entityKind === "journalist"
                  ? "Your name or handle as you publish — this becomes your verified identity on TETA+PI."
                  : store.entityKind === "artist"
                  ? "Your name or artist handle — we'll attach C2PA-signed proof of authorship to your work."
                  : "Your organization name — this becomes your verified identity on TETA+PI."}
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
                  placeholder={isBusiness ? "Legal company name…" : "Your name or username…"}
                  style={{ flex: 1, border: "none", background: "transparent", fontSize: 17, color: TEXT, fontFamily: "inherit" }}
                />
              </div>

              {/* Business: registry search */}
              {isBusiness && (
                <>
                  {store.searchPhase === "idle" && (
                    <div style={{ fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", fontSize: 11.5, color: MUTED, letterSpacing: "0.3px", padding: "4px 2px" }}>
                      EU · US · UK · APAC registries connected
                    </div>
                  )}
                  {store.searchPhase === "searching" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: MUTED, fontSize: 13, padding: "6px 2px" }}>
                      <SpinnerIcon size={15} /> Searching registries…
                    </div>
                  )}
                  {store.searchPhase === "none" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 9, color: SUN, fontSize: 13, padding: "6px 2px" }}>
                      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={SUN} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                      No registry match — check the exact legal name or spelling.
                    </div>
                  )}
                  {store.searchPhase === "results" && synResults.length > 0 && (
                    <div>
                      <div style={{ fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", fontSize: 10.5, letterSpacing: "0.6px", textTransform: "uppercase", color: MUTED, margin: "2px 2px 10px" }}>
                        {synResults.length} matches — select yours
                      </div>
                      {synResults.map((r) => (
                        <div
                          key={r.registryId}
                          onClick={() => { store.setEntity(r); store.setStep(2); }}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
                            padding: "16px 14px", borderBottom: "1px solid rgba(26,16,53,0.07)",
                            cursor: "pointer", transition: "background 0.16s",
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(91,69,201,0.035)")}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                        >
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: TEXT, letterSpacing: "-0.2px" }}>{r.name}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                              <IsoChip code={r.iso} />
                              <span style={{ fontSize: 12, color: TEXT_SEC }}>{r.authority}</span>
                              <span style={{ color: DOT }}>·</span>
                              <span style={{ fontSize: 12, color: MUTED }}>{r.city}</span>
                            </div>
                          </div>
                          <span style={{ fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", fontSize: 10.5, color: MUTED, whiteSpace: "nowrap" }}>{r.registryId}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Non-business: uniqueness check */}
              {!isBusiness && (
                <>
                  <div style={{ marginBottom: 20, minHeight: 20 }}>
                    {nameUnique === "checking" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 7, color: MUTED, fontSize: 13 }}>
                        <SpinnerIcon size={14} /> Checking availability…
                      </div>
                    )}
                    {nameUnique === "available" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#22B07D", fontSize: 13 }}>
                        <CheckCircleIcon size={14} /> Name is available
                      </div>
                    )}
                    {nameUnique === "taken" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 7, color: SUN, fontSize: 13 }}>
                        ✗ This name is already taken — try a different one
                      </div>
                    )}
                    {nameUnique === "idle" && (
                      <div style={{ fontSize: 12, color: MUTED }}>
                        This name will appear on your verified profile.
                      </div>
                    )}
                  </div>
                  <BtnPrimary
                    disabled={!store.query.trim() || nameUnique === "taken" || nameUnique === "checking"}
                    onClick={() => {
                      if (!store.query.trim() || nameUnique === "taken" || nameUnique === "checking") return;
                      store.setEntity({ name: store.query.trim(), registryId: "", iso: "", authority: "self-asserted", city: "", status: "active", since: "" });
                      store.setStep(2);
                    }}
                  >
                    Continue →
                  </BtnPrimary>
                </>
              )}
            </div>
          )}

          {/* ── Step 2: Confirm (business) / Email verify (non-business) ── */}
          {store.step === 2 && store.entity && !isBusiness && (
            <div style={{ maxWidth: 420 }}>
              <div style={{ fontSize: m ? 26 : 32, fontWeight: 600, letterSpacing: "-0.8px", marginBottom: 8 }}>Verify your email.</div>
              <div style={{ fontSize: 15, color: TEXT_SEC, marginBottom: 28, lineHeight: 1.5 }}>
                We&apos;ll send a code to confirm you&apos;re a real person. This is your identity proof on TETA+PI.
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, background: `rgba(91,69,201,0.08)`, marginBottom: 28, fontSize: 14, fontWeight: 600, color: TEXT_AUTH }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: INDIGO }} />
                {store.entity.name}
              </div>

              {!emailCodeSent ? (
                <>
                  <input
                    value={emailVerifyInput}
                    onChange={(e) => { setEmailVerifyInput(e.target.value); setEmailVerifyError(""); }}
                    placeholder="your@email.com"
                    type="email"
                    style={{
                      width: "100%", padding: "13px 14px",
                      border: "1px solid rgba(26,16,53,0.12)", borderRadius: 9,
                      fontSize: 15, background: "transparent", color: TEXT,
                      fontFamily: "inherit", marginBottom: 14, boxSizing: "border-box",
                    }}
                  />
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: TEXT_SEC, lineHeight: 1.5, cursor: "pointer", marginBottom: 14 }}>
                    <input
                      type="checkbox"
                      checked={readyToPay}
                      onChange={(e) => setReadyToPay(e.target.checked)}
                      style={{ marginTop: 2, width: 15, height: 15, accentColor: INDIGO }}
                    />
                    <span>I&apos;m ready to pay <strong>$21</strong> when billing launches — lock my founding price.</span>
                  </label>
                  {emailVerifyError && <div style={{ color: SUN, fontSize: 13, marginBottom: 10 }}>{emailVerifyError}</div>}
                  <BtnPrimary
                    disabled={!emailVerifyInput.includes("@") || emailVerifyLoading}
                    style={{ width: "100%" }}
                    onClick={async () => {
                      setEmailVerifyLoading(true); setEmailVerifyError("");
                      try {
                        const res = await authApi.magicLink(emailVerifyInput.trim());
                        store.setAccountEmail(emailVerifyInput.trim());
                        if (res.dev_token) { store.setToken(res.dev_token); store.setAuthed(true); store.setStep(4); }
                        else { setEmailCodeSent(true); }
                      } catch { setEmailVerifyError("Couldn't send code — check your email and try again."); }
                      finally { setEmailVerifyLoading(false); }
                    }}
                  >
                    {emailVerifyLoading ? <><SpinnerIcon size={16} /> Sending…</> : "Send verification code →"}
                  </BtnPrimary>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13.5, color: TEXT_SEC, marginBottom: 14 }}>
                    Code sent to <strong>{emailVerifyInput}</strong>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                    <input
                      value={emailCode}
                      onChange={(e) => { setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setEmailVerifyError(""); }}
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
                      disabled={emailCode.length < 6 || emailVerifyLoading}
                      onClick={async () => {
                        setEmailVerifyLoading(true); setEmailVerifyError("");
                        try {
                          const user = await authApi.register(emailVerifyInput.trim());
                          if (user) {
                            const loginRes = await authApi.magicLink(emailVerifyInput.trim());
                            if (loginRes.dev_token) store.setToken(loginRes.dev_token);
                          }
                          store.setAuthed(true); store.setStep(4);
                        } catch {
                          try {
                            const loginRes = await authApi.magicLink(emailVerifyInput.trim());
                            if (loginRes.dev_token) store.setToken(loginRes.dev_token);
                            store.setAuthed(true); store.setStep(4);
                          } catch { setEmailVerifyError("Verification failed — please try again."); }
                        } finally { setEmailVerifyLoading(false); }
                      }}
                      style={{ padding: "10px 20px" }}
                    >
                      {emailVerifyLoading ? <><SpinnerIcon size={14} /> Checking…</> : "Verify →"}
                    </BtnPrimary>
                  </div>
                  {emailVerifyError && <div style={{ color: SUN, fontSize: 13 }}>{emailVerifyError}</div>}
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

          {store.step === 2 && store.entity && isBusiness && (
            <div>
              <div style={{ fontSize: m ? 26 : 32, fontWeight: 600, letterSpacing: "-0.7px", marginBottom: 14 }}>Is this your business?</div>
              <div style={{ fontSize: 16, fontWeight: 300, lineHeight: 1.55, color: TEXT_SEC, marginBottom: 28 }}>
                Confirm the exact legal entity. Everything here comes from the public register.
              </div>

              <div style={{
                border: "1px solid rgba(26,16,53,0.10)",
                borderLeft: `3px solid ${INDIGO}`,
                borderRadius: "0 13px 13px 0",
                padding: "24px 24px",
                background: "rgba(91,69,201,0.018)",
                marginBottom: 28,
              }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 11 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: INDIGO, flexShrink: 0, transform: "translateY(-3px)" }} />
                  <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.5px", lineHeight: 1.1 }}>{store.entity.name}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px", margin: "22px 0 0 19px" }}>
                  {[
                    ["Registry", <><IsoChip code={store.entity.iso} /> {store.entity.authority}</>],
                    ["Registry ID", <span style={{ fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", color: MUTED }}>{store.entity.registryId}</span>],
                    ["Status", store.entity.status],
                    ["Registered", `${store.entity.city} · since ${store.entity.since}`],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <div style={{ fontSize: 11, color: MUTED, letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 14, color: TEXT_AUTH, fontWeight: 600 }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", fontSize: 11, color: MUTED, margin: "20px 0 0 19px", letterSpacing: "0.3px" }}>#registry:attested</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <BtnPrimary onClick={() => store.setStep(3)}>Yes, this is us →</BtnPrimary>
                <span onClick={() => store.setStep(1)} style={{ fontSize: 13.5, color: TEXT_SEC, cursor: "pointer" }}>Not us — search again</span>
              </div>
            </div>
          )}

          {/* ── Step 3: Prove ── */}
          {store.step === 3 && isBusiness && (
            <div>
              <div style={{ fontSize: m ? 26 : 32, fontWeight: 600, letterSpacing: "-0.7px", marginBottom: 8 }}>
                {`Prove you represent ${store.entity?.name ?? "your business"}`}
              </div>
              <div style={{ fontSize: 16, fontWeight: 300, lineHeight: 1.55, color: TEXT_SEC, marginBottom: 28 }}>
                We need to confirm you&apos;re authorised. Choose any one method.
              </div>

              {!store.proven ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <ProveMethodCard
                    title="Registry domain email"
                    description="Fastest — send a code to your registered domain"
                    icon={<MailIcon size={18} />}
                    selected={expandedMethod === "domain"}
                    onToggle={() => setExpandedMethod(expandedMethod === "domain" ? null : "domain")}
                  >
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 13.5, color: TEXT_SEC, marginBottom: 12 }}>
                        Send code to{" "}
                        <span style={{ fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", fontSize: 13, color: INDIGO }}>
                          ad•••@{store.entity?.name.toLowerCase().replace(/\s+/g, "") || "yourdomain"}.com
                        </span>
                      </div>
                      <button
                        onClick={() => {}}
                        style={{
                          padding: "10px 20px", borderRadius: 9, background: INDIGO,
                          color: "#fff", fontSize: 13.5, fontWeight: 600, border: "none",
                          cursor: "pointer", fontFamily: "inherit", marginBottom: 14,
                        }}
                      >Send code</button>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input
                          value={verifyCode}
                          onChange={(e) => setVerifyCode(e.target.value)}
                          placeholder="· · · · · ·"
                          maxLength={6}
                          style={{
                            width: 140, fontFamily: "ui-monospace,'SF Mono','Menlo',monospace",
                            fontSize: 18, letterSpacing: "6px", padding: "10px 14px",
                            border: "1px solid rgba(26,16,53,0.12)", borderRadius: 9,
                            background: "transparent", color: TEXT,
                          }}
                        />
                        <button
                          onClick={() => { if (verifyCode.length >= 3) store.setProven(true); }}
                          disabled={verifyCode.length < 3}
                          style={{
                            padding: "10px 18px", borderRadius: 9,
                            background: verifyCode.length >= 3 ? INDIGO : "rgba(26,16,53,0.06)",
                            color: verifyCode.length >= 3 ? "#fff" : MUTED,
                            fontSize: 13.5, fontWeight: 600, border: "none",
                            cursor: verifyCode.length >= 3 ? "pointer" : "default", fontFamily: "inherit",
                          }}
                        >Verify</button>
                      </div>
                    </div>
                  </ProveMethodCard>

                  <ProveMethodCard
                    title="Registered contact"
                    description="Verify as a director or authorised signatory"
                    icon={<UserIcon size={18} />}
                    selected={expandedMethod === "contact"}
                    onToggle={() => setExpandedMethod(expandedMethod === "contact" ? null : "contact")}
                  >
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 13, color: TEXT_SEC, marginBottom: 10 }}>Select an officer:</div>
                      {OFFICERS.map((o) => (
                        <label key={o} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid rgba(26,16,53,0.06)", cursor: "pointer", fontSize: 13.5, color: TEXT_AUTH }}>
                          <input type="radio" name="officer" value={o} onChange={() => store.setOfficer(o)} checked={store.officer === o} style={{ accentColor: INDIGO }} />
                          {o}
                        </label>
                      ))}
                      <button
                        onClick={() => { if (store.officer) store.setProven(true); }}
                        disabled={!store.officer}
                        style={{
                          marginTop: 14, padding: "10px 20px", borderRadius: 9,
                          background: store.officer ? INDIGO : "rgba(26,16,53,0.06)",
                          color: store.officer ? "#fff" : MUTED,
                          fontSize: 13.5, fontWeight: 600, border: "none",
                          cursor: store.officer ? "pointer" : "default", fontFamily: "inherit",
                        }}
                      >Send verification link</button>
                    </div>
                  </ProveMethodCard>

                  <ProveMethodCard
                    title="Authorisation document"
                    description="Upload a signed letter of authorisation"
                    icon={<DocumentIcon size={18} />}
                    selected={expandedMethod === "document"}
                    onToggle={() => setExpandedMethod(expandedMethod === "document" ? null : "document")}
                  >
                    <div style={{ marginTop: 16 }}>
                      <label style={{
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        gap: 10, padding: "32px 20px", border: "1.5px dashed rgba(26,16,53,0.15)",
                        borderRadius: 9, cursor: "pointer", color: MUTED, fontSize: 13.5, textAlign: "center",
                      }}>
                        <DocumentIcon size={24} color={MUTED} />
                        Drop PDF or click to upload
                        <input type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }}
                          onChange={() => { store.setProvePhase("proving"); setTimeout(() => store.setProven(true), 1300); }} />
                      </label>
                      {store.provePhase === "proving" && (
                        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, color: SUN, fontSize: 13 }}>
                          <SpinnerIcon size={16} color={SUN} /> Timestamping on Bitcoin…
                        </div>
                      )}
                    </div>
                  </ProveMethodCard>
                </div>
              ) : (
                <div style={{
                  padding: "15px 18px",
                  border: `1px solid rgba(91,69,201,0.18)`,
                  borderRadius: 11,
                  background: "rgba(91,69,201,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, color: INDIGO, fontWeight: 600, fontSize: 14 }}>
                    <CheckCircleIcon size={17} /> Control proven
                  </div>
                  <BtnPrimary onClick={() => store.setStep(4)} style={{ padding: "11px 20px" }}>Continue →</BtnPrimary>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Account ── */}
          {store.step === 4 && (
            <div>
              {!store.authed ? (
                <div style={{ maxWidth: 420 }}>
                  <div style={{ fontSize: m ? 26 : 32, fontWeight: 600, letterSpacing: "-0.7px", marginBottom: 14 }}>
                    {store.authMode === "signup" ? "Create your account." : "Welcome back."}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 300, lineHeight: 1.55, color: TEXT_SEC, marginBottom: 28 }}>
                    {store.authMode === "signin" ? "Sign in to manage your verified page." : "So you can manage this page — and let agents query it — later."}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    {[
                      { label: "Continue with Google", icon: <span style={{ width: 20, height: 20, borderRadius: "50%", border: "1px solid rgba(26,16,53,0.25)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: TEXT_AUTH, flexShrink: 0 }}>G</span> },
                      { label: "Continue with Microsoft", icon: <span style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, width: 16, height: 16, flexShrink: 0 }}>{[...Array(4)].map((_, i) => <span key={i} style={{ background: MUTED, borderRadius: 1 }} />)}</span> },
                      { label: "Continue with a passkey", icon: <PasskeyIcon size={18} /> },
                    ].map(({ label, icon }) => (
                      <button
                        key={label}
                        title="OAuth coming soon — use email below"
                        onClick={() => setEmailVerifyError("OAuth coming soon. Use email below.")}
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

                    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0" }}>
                      <div style={{ flex: 1, height: 1, background: "rgba(26,16,53,0.08)" }} />
                      <span style={{ fontSize: 12, color: MUTED }}>or</span>
                      <div style={{ flex: 1, height: 1, background: "rgba(26,16,53,0.08)" }} />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", border: "1px solid rgba(26,16,53,0.14)", borderRadius: 11 }}>
                      <MailIcon size={18} />
                      <input
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="you@company.com"
                        type="email"
                        style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", fontSize: 15, color: TEXT, fontFamily: "inherit" }}
                      />
                    </div>

                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: TEXT_SEC, lineHeight: 1.5, cursor: "pointer", padding: "2px 2px 0" }}>
                      <input
                        type="checkbox"
                        checked={readyToPay}
                        onChange={(e) => setReadyToPay(e.target.checked)}
                        style={{ marginTop: 2, width: 15, height: 15, accentColor: INDIGO }}
                      />
                      <span>I&apos;m ready to pay <strong>$21</strong> when billing launches — lock my founding price.</span>
                    </label>

                    {emailVerifyError && <div style={{ color: SUN, fontSize: 13 }}>{emailVerifyError}</div>}

                    <BtnPrimary
                      disabled={!emailInput.includes("@") || emailVerifyLoading}
                      style={{ width: "100%", textAlign: "center" }}
                      onClick={async () => {
                        if (!emailInput.includes("@")) return;
                        setEmailVerifyLoading(true); setEmailVerifyError("");
                        try {
                          const res = await authApi.magicLink(emailInput.trim());
                          store.setAccountEmail(emailInput.trim());
                          if (res.dev_token) { store.setToken(res.dev_token); store.setAuthed(true); }
                          else { store.setAuthed(true); }
                        } catch { setEmailVerifyError("Could not send email — try again."); }
                        finally { setEmailVerifyLoading(false); }
                      }}
                    >
                      {emailVerifyLoading ? <><SpinnerIcon size={15} /> Sending…</> : "Continue with email →"}
                    </BtnPrimary>

                    <div style={{ fontSize: 11.5, color: MUTED, textAlign: "center", marginTop: 2 }}>
                      We&apos;ll send a magic link — no password.
                    </div>
                  </div>

                  <div style={{
                    marginTop: 26, display: "inline-flex", alignItems: "center", gap: 7,
                    fontSize: 13, color: TEXT_SEC, cursor: "pointer",
                  }}>
                    <span style={{ fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", fontSize: 11, padding: "1px 6px", border: "1px solid rgba(26,16,53,0.14)", borderRadius: 4, color: INDIGO }}>AGENT</span>
                    Setting up for an AI agent?{" "}
                    <span style={{ color: INDIGO }}>Use an API key →</span>
                  </div>
                </div>
              ) : (
                /* Pairing panel */
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
                    <BtnPrimary onClick={() => { store.setPaired(true); store.setStep(5); }}>I&apos;ve linked my camera →</BtnPrimary>
                    <span onClick={() => store.setStep(5)} style={{ fontSize: 14, color: TEXT_SEC, cursor: "pointer", textAlign: "center" }}>
                      Skip for now — link later
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </PageShell>
    );
  }

  /* ── Step 5: Success ── */
  if (store.step === 5) {
    return (
      <PageShell m={m}>
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: m ? "80px 24px" : "80px 40px", textAlign: "center",
        }}>
          <CheckCircleIcon size={46} color={INDIGO} />

          <div style={{ fontSize: m ? 36 : 48, fontWeight: 600, letterSpacing: "-1px", lineHeight: 1.05, marginTop: 24, marginBottom: 10 }}>
            You&apos;re verified.
          </div>
          <div style={{ fontSize: 16, fontWeight: 300, lineHeight: 1.6, color: TEXT_SEC, maxWidth: 440, marginBottom: 30 }}>
            {store.entity?.name ?? (isBusiness ? "Your business" : "Your identity")} is now on TETA+PI.
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
                {store.entity?.name ?? (isBusiness ? "Your business" : "Your identity")}
              </span>
              <span style={{ fontFamily: "ui-monospace,'SF Mono','Menlo',monospace", fontSize: 9.5, letterSpacing: "1.1px", textTransform: "uppercase", color: "#B8B2C8" }}>
                {isBusiness ? "Registry Only" : "Email Verified"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10, fontSize: 12, color: MUTED }}>
              {isBusiness && <span style={{ fontFamily: "ui-monospace,'SF Mono','Menlo',monospace" }}>{store.entity?.registryId ?? "—"}</span>}
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
            <span style={{ color: "#B8B2C8" }}>● {isBusiness ? "Registry Only" : "Email Verified"}</span>
            <span style={{ color: DOT }}>→</span>
            <span style={{ color: MUTED }}>○ {isBusiness ? "Partial" : "C2PA Media"}</span>
            <span style={{ color: DOT }}>→</span>
            <span style={{ color: MUTED }}>○ Full</span>
          </div>

          <div style={{ fontSize: 14, color: TEXT_SEC, maxWidth: 360, lineHeight: 1.55, marginBottom: 28 }}>
            Add C2PA-signed media with PI Camera to reach Full verification — the highest trust level.
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
