"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";
import {
  VerificationIcon,
  SearchIcon,
  SpinnerIcon,
  MailIcon,
  UserIcon,
  DocumentIcon,
  PasskeyIcon,
  CheckCircleIcon,
} from "@/components/ui/VerificationIcon";
import { IsoChip } from "@/components/ui/IsoChip";
import {
  useOnboardingStore,
  type RegistryEntity,
  type EntityKind,
} from "@/stores/useOnboardingStore";
import { searchApi } from "@/lib/api";

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

// Synthetic fallback when API is unreachable (dev without Docker)
function syntheticResults(q: string): RegistryEntity[] {
  if (!q.trim()) return [];
  const base = q.trim();
  return [
    {
      name: `${base} GmbH`,
      registryId: `HRB-${Math.floor(Math.random() * 90000 + 10000)}`,
      iso: "DE",
      authority: "Handelsregister",
      city: "Berlin",
      status: "active",
      since: "2019",
    },
    {
      name: `${base} Ltd`,
      registryId: `CRN-${Math.floor(Math.random() * 90000 + 10000)}`,
      iso: "GB",
      authority: "Companies House",
      city: "London",
      status: "active",
      since: "2020",
    },
  ];
}

const OFFICERS = [
  "J•••n S•••h  ·  Director",
  "M•••a K•••k  ·  Managing Director",
  "A•••a L•••z  ·  Authorised Signatory",
];

const PAIRING_CODE = `PI-${Math.random().toString(36).slice(2, 6).toUpperCase()}-9QX1`;

// Pseudo-QR (21×21 finder-pattern only, mirroring prototype)
function PseudoQR() {
  const size = 160;
  const modules = 21;
  const cell = size / modules;

  const finderPattern = (ox: number, oy: number) => {
    const cells = [];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const border = r === 0 || r === 6 || c === 0 || c === 6;
        const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (border || inner) {
          cells.push(
            <rect
              key={`${ox}-${oy}-${r}-${c}`}
              x={(ox + c) * cell}
              y={(oy + r) * cell}
              width={cell}
              height={cell}
              fill="#1A1035"
            />
          );
        }
      }
    }
    return cells;
  };

  // Random data modules
  const dataModules = [];
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      const inFinder =
        (r < 9 && c < 9) ||
        (r < 9 && c > modules - 9) ||
        (r > modules - 9 && c < 9);
      if (!inFinder && Math.random() > 0.5) {
        dataModules.push(
          <rect
            key={`d-${r}-${c}`}
            x={c * cell}
            y={r * cell}
            width={cell}
            height={cell}
            fill="#1A1035"
          />
        );
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

export default function ClaimPage() {
  const vw = useViewport();
  const m = vw < 640;
  const store = useOnboardingStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [synResults, setSynResults] = useState<RegistryEntity[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [expandedMethod, setExpandedMethod] = useState<
    "domain" | "contact" | "document" | null
  >(null);
  const [emailInput, setEmailInput] = useState("");

  const isBusiness = store.entityKind === "business";

  // Live registry search debounce (Step 1 — business only)
  useEffect(() => {
    if (store.step !== 1 || !isBusiness) return;
    if (!store.query.trim()) {
      store.setSearchPhase("idle");
      return;
    }
    store.setSearchPhase("searching");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchApi.searchRegistry(store.query.trim());
        if (results.length === 0) {
          store.setSearchPhase("none");
        } else {
          setSynResults(
            results.map((r) => ({
              name: r.legal_name,
              registryId: r.registration_number,
              iso: r.country,
              authority: r.registry,
              city: r.address?.split(",")[0] ?? "",
              status: r.status,
              since: r.founded ?? "",
            }))
          );
          store.setSearchPhase("results");
        }
      } catch {
        // API unavailable — fall back to synthetic
        setSynResults(syntheticResults(store.query));
        store.setSearchPhase("results");
      }
    }, 700);
    return () => clearTimeout(debounceRef.current);
  }, [store.query, store.step, isBusiness]);

  const heroPad = m ? "80px 24px 60px" : "0";
  const flowPad = m ? "80px 20px 60px" : "80px 40px 80px";

  const STEP_LABELS = ["Identify", "Confirm", "Prove", "Account", "Publish"];

  const trustChipLabel = store.proven
    ? "Control proven"
    : store.entity
    ? "Registry attested"
    : "Unverified";
  const trustChipColor = store.proven
    ? "#6B3FA0"
    : store.entity
    ? "#B8B2C8"
    : "#9991AC";

  // ===== Step 0: Entry Hero =====
  if (store.step === 0) {
    const kinds: Array<{
      kind: EntityKind;
      label: string;
      sub: string;
      detail: string;
    }> = [
      {
        kind: "business",
        label: "Business",
        sub: "Company · Startup · Brand",
        detail: "Be found by AI agents searching for verified suppliers, partners, and services.",
      },
      {
        kind: "journalist",
        label: "Journalist / Media",
        sub: "Reporter · Editor · Publication",
        detail: "Prove your identity and content are real — let agents cite you with confidence.",
      },
      {
        kind: "artist",
        label: "Artist / Creator",
        sub: "Visual art · Photography · Music",
        detail: "Prove your work is human-made, not AI-generated. C2PA-signed proof on the blockchain.",
      },
      {
        kind: "organization",
        label: "Organization",
        sub: "NGO · Institution · Public body",
        detail: "Verified presence for foundations, universities, and public institutions.",
      },
    ];

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#fff",
          fontFamily: "'Trebuchet MS','Segoe UI','Helvetica Neue',sans-serif",
          position: "relative",
        }}
      >
        <div style={{ position: "fixed", top: m ? 16 : 22, left: m ? 16 : 28, zIndex: 20 }}>
          <Wordmark size="sm" />
        </div>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: m ? "80px 24px 60px" : "60px 40px",
          }}
        >
          <div
            style={{
              fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
              fontSize: 11,
              letterSpacing: "1.6px",
              textTransform: "uppercase",
              color: "#9991AC",
              marginBottom: 20,
              textAlign: "center",
            }}
          >
            verification · discoverability · trust
          </div>
          <div
            style={{
              fontSize: m ? 32 : 44,
              fontWeight: 600,
              letterSpacing: "-1.2px",
              lineHeight: 1.06,
              maxWidth: 580,
              color: "#1A1035",
              textAlign: "center",
              marginBottom: 14,
            }}
          >
            Get verified.<br />Get found by AI agents.
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 300,
              lineHeight: 1.6,
              color: "#6B6080",
              maxWidth: 440,
              marginBottom: 44,
              textAlign: "center",
            }}
          >
            Choose what you are — we&apos;ll show you exactly how verification
            makes you discoverable.
          </div>

          {/* Entity kind selector */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: m ? "1fr" : "1fr 1fr",
              gap: 14,
              width: "100%",
              maxWidth: 640,
              marginBottom: 36,
            }}
          >
            {kinds.map(({ kind, label, sub, detail }) => (
              <button
                key={kind}
                onClick={() => {
                  store.setEntityKind(kind);
                  store.setStep(1);
                }}
                style={{
                  textAlign: "left",
                  background: "none",
                  border: "1px solid rgba(26,16,53,0.1)",
                  borderRadius: 12,
                  padding: "20px 22px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#6B3FA0";
                  (e.currentTarget as HTMLElement).style.background = "rgba(107,63,160,0.03)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(26,16,53,0.1)";
                  (e.currentTarget as HTMLElement).style.background = "none";
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1035", marginBottom: 3 }}>
                  {label}
                </div>
                <div style={{ fontSize: 12, color: "#9991AC", marginBottom: 10 }}>{sub}</div>
                <div style={{ fontSize: 13, color: "#6B6080", lineHeight: 1.5 }}>{detail}</div>
              </button>
            ))}
          </div>

          <span
            onClick={() => {
              store.setAuthMode("signin");
              store.setStep(4);
            }}
            style={{ fontSize: 13.5, color: "#9991AC", cursor: "pointer" }}
          >
            Already verified? Sign in
          </span>

          <div
            style={{
              marginTop: 48,
              fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
              fontSize: 11,
              color: "#C8C2D8",
              letterSpacing: "0.4px",
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <span>registry:attested</span>
            <span>·</span>
            <span>c2pa:verified</span>
            <span>·</span>
            <span>btc:ts:confirmed</span>
          </div>
        </div>
      </div>
    );
  }

  // ===== Steps 1–4 wrapper with progress rail =====
  if (store.step >= 1 && store.step <= 4) {
    const stepIndex = store.step - 1; // 0-based for current
    const progressPct = `${store.step * 20}%`;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#fff",
          fontFamily: "'Trebuchet MS','Segoe UI','Helvetica Neue',sans-serif",
          position: "relative",
        }}
      >
        <div style={{ position: "fixed", top: m ? 16 : 22, left: m ? 16 : 28, zIndex: 20 }}>
          <Wordmark size="sm" />
        </div>
        <div
          style={{
            maxWidth: 600,
            margin: "0 auto",
            padding: flowPad,
          }}
        >
          {/* ── Progress Rail ── */}
          <div style={{ marginBottom: 40 }}>
            {/* Trust chip + step label */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12,
                  fontWeight: 600,
                  color: trustChipColor,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: trustChipColor,
                  }}
                />
                {trustChipLabel}
              </span>
              <span
                style={{
                  fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                  fontSize: 11,
                  color: "#9991AC",
                  letterSpacing: "1px",
                }}
              >
                STEP {store.step} / 5
              </span>
            </div>

            {/* Track */}
            <div
              style={{
                height: 2,
                background: "rgba(26,16,53,0.08)",
                borderRadius: 2,
                marginBottom: 10,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "100%",
                  width: progressPct,
                  background: "#6B3FA0",
                  borderRadius: 2,
                  transition: "width 0.35s ease",
                }}
              />
            </div>

            {/* Node labels */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              {STEP_LABELS.map((label, i) => {
                const done = i < stepIndex;
                const active = i === stepIndex;
                return (
                  <span
                    key={label}
                    style={{
                      fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                      fontSize: m ? 9 : 10.5,
                      letterSpacing: "0.5px",
                      color: active ? "#6B3FA0" : done ? "#3A2C5C" : "#9991AC",
                      fontWeight: active ? 700 : 400,
                    }}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Back */}
          <div
            onClick={() =>
              store.setStep((store.step - 1) as 0 | 1 | 2 | 3 | 4 | 5)
            }
            style={{
              fontSize: 13,
              color: "#9991AC",
              cursor: "pointer",
              marginBottom: 32,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ← Back
          </div>

          {/* ── Step 1: Identify ── */}
          {store.step === 1 && (
            <div>
              <div
                style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.8px", marginBottom: 8 }}
              >
                {isBusiness ? "What's your company called?" : "What's your name?"}
              </div>
              <div style={{ fontSize: 14, color: "#9091AC", marginBottom: 24 }}>
                {isBusiness
                  ? "We'll search official government registries to verify your entity."
                  : store.entityKind === "journalist"
                  ? "Your name or handle as you publish — this becomes your verified identity on TETA+PI."
                  : store.entityKind === "artist"
                  ? "Your name or artist handle — we'll attach C2PA-signed proof of authorship to your work."
                  : "Your organization name — this becomes your verified identity on TETA+PI."}
              </div>

              {/* Input */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 18px",
                  border: "1px solid rgba(26,16,53,0.12)",
                  borderRadius: 11,
                  background: "rgba(107,63,160,0.02)",
                  marginBottom: 20,
                }}
              >
                <SearchIcon size={18} color="#9991AC" />
                <input
                  value={store.query}
                  onChange={(e) => store.setQuery(e.target.value)}
                  placeholder={isBusiness ? "Legal company name…" : "Your name or username…"}
                  style={{
                    flex: 1,
                    border: "none",
                    background: "transparent",
                    fontSize: 16,
                    color: "#1A1035",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Business: registry search feedback */}
              {isBusiness && (
                <>
                  {store.searchPhase === "idle" && (
                    <div
                      style={{
                        fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                        fontSize: 11.5,
                        color: "#9991AC",
                        letterSpacing: "0.4px",
                      }}
                    >
                      EU · US · UK · APAC registries connected
                    </div>
                  )}
                  {store.searchPhase === "searching" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9991AC", fontSize: 13 }}>
                      <SpinnerIcon size={16} />
                      Searching registries…
                    </div>
                  )}
                  {store.searchPhase === "none" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#E8640C", fontSize: 13 }}>
                      ✗ No registry match — try the full legal name
                    </div>
                  )}
                  {store.searchPhase === "results" && synResults.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                          fontSize: 11,
                          color: "#9991AC",
                          marginBottom: 12,
                          letterSpacing: "0.3px",
                        }}
                      >
                        {synResults.length} matches — select yours
                      </div>
                      {synResults.map((r) => (
                        <div
                          key={r.registryId}
                          onClick={() => {
                            store.setEntity(r);
                            store.setStep(2);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            padding: "13px 16px",
                            border: "1px solid rgba(26,16,53,0.08)",
                            borderRadius: 9,
                            marginBottom: 8,
                            cursor: "pointer",
                            transition: "background 0.16s",
                          }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLElement).style.background = "rgba(107,63,160,0.035)")
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLElement).style.background = "transparent")
                          }
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 16, fontWeight: 600 }}>{r.name}</span>
                            <IsoChip code={r.iso} />
                            <span style={{ fontSize: 12, color: "#6B6080" }}>
                              {r.authority} · {r.city}
                            </span>
                          </div>
                          <span
                            style={{
                              fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                              fontSize: 11,
                              color: "#9991AC",
                            }}
                          >
                            {r.registryId}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Non-business: simple continue */}
              {!isBusiness && (
                <>
                  <div style={{ fontSize: 12, color: "#9991AC", marginBottom: 20 }}>
                    This name will appear on your verified profile. You can add links and media in the next steps.
                  </div>
                  <button
                    onClick={() => {
                      if (!store.query.trim()) return;
                      store.setEntity({
                        name: store.query.trim(),
                        registryId: "",
                        iso: "",
                        authority: "self-asserted",
                        city: "",
                        status: "active",
                        since: "",
                      });
                      store.setStep(2);
                    }}
                    disabled={!store.query.trim()}
                    style={{
                      padding: "13px 28px",
                      borderRadius: 11,
                      background: store.query.trim() ? "#6B3FA0" : "rgba(26,16,53,0.08)",
                      color: store.query.trim() ? "#fff" : "#9991AC",
                      fontSize: 15,
                      fontWeight: 600,
                      border: "none",
                      cursor: store.query.trim() ? "pointer" : "default",
                      fontFamily: "inherit",
                    }}
                  >
                    Continue →
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Step 2: Confirm ── */}
          {store.step === 2 && store.entity && (
            <div>
              <div
                style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.8px", marginBottom: 28 }}
              >
                {isBusiness ? "Is this your business?" : "Confirm your identity"}
              </div>
              <div
                style={{
                  padding: "20px 22px",
                  border: "1px solid rgba(26,16,53,0.08)",
                  borderLeft: "3px solid #6B3FA0",
                  borderRadius: "0 13px 13px 0",
                  background: "rgba(107,63,160,0.012)",
                  marginBottom: 28,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6B3FA0" }} />
                  <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.4px" }}>
                    {store.entity.name}
                  </span>
                </div>

                {isBusiness ? (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "10px 20px",
                        fontSize: 13,
                        marginLeft: 18,
                      }}
                    >
                      {[
                        ["Registry", <><IsoChip code={store.entity.iso} /> {store.entity.authority}</>],
                        ["Registry ID", <span style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", color: "#9991AC" }}>{store.entity.registryId}</span>],
                        ["Status", store.entity.status],
                        ["Registered", `${store.entity.city} · since ${store.entity.since}`],
                      ].map(([label, value]) => (
                        <div key={String(label)}>
                          <div style={{ color: "#9991AC", fontSize: 11, marginBottom: 3 }}>{label}</div>
                          <div style={{ color: "#3A2C5C", fontWeight: 600 }}>{value}</div>
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                        fontSize: 11,
                        color: "#9991AC",
                        marginTop: 16,
                        marginLeft: 18,
                      }}
                    >
                      #registry:attested
                    </div>
                  </>
                ) : (
                  <div style={{ marginLeft: 18 }}>
                    <div style={{ fontSize: 13, color: "#6B6080", marginBottom: 12, lineHeight: 1.5 }}>
                      {store.entityKind === "journalist"
                        ? "This name will be your verified journalist identity on TETA+PI. AI agents will be able to find and cite your work."
                        : store.entityKind === "artist"
                        ? "This name will be your verified artist identity. Your media will carry C2PA-signed proof of human authorship."
                        : "This name will be your verified organization identity on TETA+PI."}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {["c2pa:verified", "btc:ts:confirmed", "identity:self-asserted"].map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                            fontSize: 11,
                            color: "#9991AC",
                            background: "rgba(107,63,160,0.06)",
                            padding: "3px 8px",
                            borderRadius: 4,
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button
                  onClick={() => store.setStep(3)}
                  style={{
                    padding: "13px 24px",
                    borderRadius: 11,
                    background: "#6B3FA0",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  {isBusiness ? "Yes, this is us →" : "Yes, that's me →"}
                </button>
                <span
                  onClick={() => store.setStep(1)}
                  style={{ fontSize: 13.5, color: "#6B6080", cursor: "pointer" }}
                >
                  {isBusiness ? "Not us — search again" : "Change name"}
                </span>
              </div>
            </div>
          )}

          {/* ── Step 3: Prove ── */}
          {store.step === 3 && (
            <div>
              <div
                style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.8px", marginBottom: 8 }}
              >
                {isBusiness
                  ? `Prove you represent ${store.entity?.name ?? "your business"}`
                  : `Prove you are ${store.entity?.name ?? "yourself"}`}
              </div>
              <div style={{ fontSize: 15, color: "#6B6080", marginBottom: 28, lineHeight: 1.5 }}>
                {isBusiness
                  ? "We need to confirm you're authorised. Choose any one method."
                  : "Verify ownership of your identity — email, social link, or a signed document."}
              </div>

              {!store.proven ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Method 1: Domain email */}
                  <ProveMethodCard
                    title="Registry domain email"
                    description="Fastest — send a code to your registered domain"
                    icon={<MailIcon size={18} />}
                    selected={expandedMethod === "domain"}
                    onToggle={() =>
                      setExpandedMethod(expandedMethod === "domain" ? null : "domain")
                    }
                  >
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 13.5, color: "#6B6080", marginBottom: 12 }}>
                        Send code to{" "}
                        <span style={{ color: "#3A2C5C", fontWeight: 600 }}>
                          ad•••@{store.entity?.name.toLowerCase().replace(/\s+/g, "") || "yourdomain"}.com
                        </span>
                      </div>
                      <button
                        onClick={() => {}}
                        style={{
                          padding: "10px 20px",
                          borderRadius: 9,
                          background: "#6B3FA0",
                          color: "#fff",
                          fontSize: 13.5,
                          fontWeight: 600,
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          marginBottom: 14,
                        }}
                      >
                        Send code
                      </button>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input
                          value={verifyCode}
                          onChange={(e) => setVerifyCode(e.target.value)}
                          placeholder="· · · · · ·"
                          maxLength={6}
                          style={{
                            width: 140,
                            fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                            fontSize: 18,
                            letterSpacing: "6px",
                            padding: "10px 14px",
                            border: "1px solid rgba(26,16,53,0.12)",
                            borderRadius: 9,
                            background: "transparent",
                            color: "#1A1035",
                          }}
                        />
                        <button
                          onClick={() => {
                            if (verifyCode.length >= 3) {
                              store.setProven(true);
                            }
                          }}
                          disabled={verifyCode.length < 3}
                          style={{
                            padding: "10px 18px",
                            borderRadius: 9,
                            background: verifyCode.length >= 3 ? "#6B3FA0" : "rgba(26,16,53,0.06)",
                            color: verifyCode.length >= 3 ? "#fff" : "#9991AC",
                            fontSize: 13.5,
                            fontWeight: 600,
                            border: "none",
                            cursor: verifyCode.length >= 3 ? "pointer" : "default",
                            fontFamily: "inherit",
                          }}
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                  </ProveMethodCard>

                  {/* Method 2: Registered contact */}
                  <ProveMethodCard
                    title="Registered contact"
                    description="Verify as a director or authorised signatory"
                    icon={<UserIcon size={18} />}
                    selected={expandedMethod === "contact"}
                    onToggle={() =>
                      setExpandedMethod(expandedMethod === "contact" ? null : "contact")
                    }
                  >
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 13, color: "#6B6080", marginBottom: 10 }}>
                        Select an officer:
                      </div>
                      {OFFICERS.map((o) => (
                        <label
                          key={o}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 0",
                            borderBottom: "1px solid rgba(26,16,53,0.06)",
                            cursor: "pointer",
                            fontSize: 13.5,
                            color: "#3A2C5C",
                          }}
                        >
                          <input
                            type="radio"
                            name="officer"
                            value={o}
                            onChange={() => store.setOfficer(o)}
                            checked={store.officer === o}
                            style={{ accentColor: "#6B3FA0" }}
                          />
                          {o}
                        </label>
                      ))}
                      <button
                        onClick={() => {
                          if (store.officer) store.setProven(true);
                        }}
                        disabled={!store.officer}
                        style={{
                          marginTop: 14,
                          padding: "10px 20px",
                          borderRadius: 9,
                          background: store.officer ? "#6B3FA0" : "rgba(26,16,53,0.06)",
                          color: store.officer ? "#fff" : "#9991AC",
                          fontSize: 13.5,
                          fontWeight: 600,
                          border: "none",
                          cursor: store.officer ? "pointer" : "default",
                          fontFamily: "inherit",
                        }}
                      >
                        Send verification link
                      </button>
                    </div>
                  </ProveMethodCard>

                  {/* Method 3: Document upload */}
                  <ProveMethodCard
                    title="Authorisation document"
                    description="Upload a signed letter of authorisation"
                    icon={<DocumentIcon size={18} />}
                    selected={expandedMethod === "document"}
                    onToggle={() =>
                      setExpandedMethod(expandedMethod === "document" ? null : "document")
                    }
                  >
                    <div style={{ marginTop: 16 }}>
                      <label
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          padding: "32px 20px",
                          border: "1.5px dashed rgba(26,16,53,0.15)",
                          borderRadius: 9,
                          cursor: "pointer",
                          color: "#9991AC",
                          fontSize: 13.5,
                          textAlign: "center",
                        }}
                      >
                        <DocumentIcon size={24} color="#9991AC" />
                        Drop PDF or click to upload
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          style={{ display: "none" }}
                          onChange={() => {
                            store.setProvePhase("proving");
                            setTimeout(() => {
                              store.setProven(true);
                            }, 1300);
                          }}
                        />
                      </label>
                      {store.provePhase === "proving" && (
                        <div
                          style={{
                            marginTop: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            color: "#E8640C",
                            fontSize: 13,
                          }}
                        >
                          <SpinnerIcon size={16} color="#E8640C" />
                          Timestamping on Bitcoin…
                        </div>
                      )}
                    </div>
                  </ProveMethodCard>
                </div>
              ) : (
                <div
                  style={{
                    padding: "18px 20px",
                    border: "1px solid rgba(107,63,160,0.2)",
                    borderRadius: 11,
                    background: "rgba(107,63,160,0.04)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      color: "#6B3FA0",
                      fontWeight: 600,
                      fontSize: 15,
                    }}
                  >
                    <CheckCircleIcon size={20} />✓ Control proven
                  </div>
                  <button
                    onClick={() => store.setStep(4)}
                    style={{
                      padding: "11px 22px",
                      borderRadius: 9,
                      background: "#6B3FA0",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Continue →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Account ── */}
          {store.step === 4 && (
            <div>
              {!store.authed ? (
                <div style={{ maxWidth: 420 }}>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 600,
                      letterSpacing: "-0.8px",
                      marginBottom: 28,
                    }}
                  >
                    {store.authMode === "signup"
                      ? "Create your account."
                      : "Welcome back."}
                  </div>

                  {/* Provider buttons */}
                  {[
                    {
                      label: "Continue with Google",
                      glyph: (
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            border: "1.5px solid currentColor",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          G
                        </span>
                      ),
                    },
                    {
                      label: "Continue with Microsoft",
                      glyph: (
                        <span
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 2,
                            width: 16,
                            height: 16,
                          }}
                        >
                          {[...Array(4)].map((_, i) => (
                            <span
                              key={i}
                              style={{
                                background: "currentColor",
                                borderRadius: 1,
                                opacity: 0.8,
                              }}
                            />
                          ))}
                        </span>
                      ),
                    },
                    {
                      label: "Continue with a passkey",
                      glyph: <PasskeyIcon size={18} />,
                    },
                  ].map(({ label, glyph }) => (
                    <button
                      key={label}
                      onClick={() => store.setAuthed(true)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "13px 16px",
                        border: "1px solid rgba(26,16,53,0.12)",
                        borderRadius: 9,
                        background: "transparent",
                        fontSize: 14.5,
                        fontWeight: 600,
                        color: "#1A1035",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        marginBottom: 10,
                        textAlign: "left",
                      }}
                    >
                      {glyph}
                      {label}
                    </button>
                  ))}

                  {/* Divider */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      margin: "18px 0",
                      color: "#9991AC",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ flex: 1, height: 1, background: "rgba(26,16,53,0.08)" }} />
                    or
                    <div style={{ flex: 1, height: 1, background: "rgba(26,16,53,0.08)" }} />
                  </div>

                  {/* Email */}
                  <input
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Email address"
                    type="email"
                    style={{
                      width: "100%",
                      padding: "13px 16px",
                      border: "1px solid rgba(26,16,53,0.12)",
                      borderRadius: 9,
                      fontSize: 15,
                      color: "#1A1035",
                      fontFamily: "inherit",
                      background: "transparent",
                      marginBottom: 10,
                    }}
                  />
                  <button
                    onClick={() => {
                      if (emailInput.includes("@")) {
                        store.setAccountEmail(emailInput);
                        store.setAuthed(true);
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "13px 16px",
                      borderRadius: 9,
                      background: emailInput.includes("@")
                        ? "#6B3FA0"
                        : "rgba(26,16,53,0.06)",
                      color: emailInput.includes("@") ? "#fff" : "#9991AC",
                      fontSize: 15,
                      fontWeight: 600,
                      border: "none",
                      cursor: emailInput.includes("@") ? "pointer" : "default",
                      fontFamily: "inherit",
                      marginBottom: 16,
                    }}
                  >
                    Continue with email
                  </button>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#9991AC",
                      textAlign: "center",
                    }}
                  >
                    We&apos;ll send a magic link — no password.
                  </div>

                  {/* Agent note */}
                  <div
                    style={{
                      marginTop: 28,
                      padding: "11px 14px",
                      border: "1px solid rgba(26,16,53,0.07)",
                      borderRadius: 9,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 12,
                      color: "#9991AC",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                        fontSize: 10,
                        letterSpacing: "0.8px",
                        fontWeight: 700,
                        color: "#6B3FA0",
                      }}
                    >
                      AGENT
                    </span>
                    Setting up for an AI agent?{" "}
                    <span style={{ color: "#6B3FA0", cursor: "pointer" }}>
                      Use an API key →
                    </span>
                  </div>
                </div>
              ) : (
                // Pairing panel
                <div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 600,
                      letterSpacing: "-0.8px",
                      marginBottom: 10,
                    }}
                  >
                    Link your PI Camera.
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      color: "#6B6080",
                      lineHeight: 1.6,
                      marginBottom: 32,
                      maxWidth: 440,
                    }}
                  >
                    Pair once, then any clip shot on the device is C2PA-signed on
                    the device and flows straight into your profile blocks.
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 16,
                      marginBottom: 32,
                    }}
                  >
                    <div
                      style={{
                        padding: 16,
                        border: "1px solid rgba(26,16,53,0.10)",
                        borderRadius: 13,
                        background: "#fff",
                      }}
                    >
                      <PseudoQR />
                    </div>
                    <div
                      style={{
                        fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                        fontSize: 15,
                        color: "#3A2C5C",
                        letterSpacing: "2px",
                        fontWeight: 600,
                      }}
                    >
                      {PAIRING_CODE}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#6B6080",
                        textAlign: "center",
                        maxWidth: 340,
                        lineHeight: 1.5,
                      }}
                    >
                      Open PI Camera, go to Settings → Link to TETA+PI, and scan
                      this code or enter the pairing code above.
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <button
                      onClick={() => {
                        store.setPaired(true);
                        store.setStep(5);
                      }}
                      style={{
                        padding: "13px 24px",
                        borderRadius: 11,
                        background: "#6B3FA0",
                        color: "#fff",
                        fontSize: 15,
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      I&apos;ve linked my camera →
                    </button>
                    <span
                      onClick={() => store.setStep(5)}
                      style={{
                        fontSize: 13.5,
                        color: "#6B6080",
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      Skip for now — link later
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== Step 5: Success =====
  if (store.step === 5) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#fff",
          fontFamily: "'Trebuchet MS','Segoe UI','Helvetica Neue',sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: m ? "80px 24px" : "80px 40px",
          textAlign: "center",
        }}
      >
        <div style={{ position: "fixed", top: m ? 16 : 22, left: m ? 16 : 28, zIndex: 20 }}>
          <Wordmark size="sm" />
        </div>

        <CheckCircleIcon size={52} color="#6B3FA0" />

        <div
          style={{
            fontSize: m ? 36 : 48,
            fontWeight: 600,
            letterSpacing: "-1.4px",
            marginTop: 20,
            marginBottom: 10,
          }}
        >
          You&apos;re verified.
        </div>
        <div style={{ fontSize: 16, color: "#6B6080", marginBottom: 36 }}>
          {store.entity?.name ?? "Your business"} is now on TETA+PI.
        </div>

        {/* Summary card */}
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            padding: "20px 22px",
            border: "1px solid rgba(26,16,53,0.08)",
            borderLeft: "3px solid #B8B2C8",
            borderRadius: "0 13px 13px 0",
            background: "rgba(107,63,160,0.012)",
            textAlign: "left",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span
              style={{ width: 7, height: 7, borderRadius: "50%", background: "#B8B2C8" }}
            />
            <span style={{ fontSize: 18, fontWeight: 600 }}>
              {store.entity?.name ?? "Your business"}
            </span>
            <span
              style={{
                fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                fontSize: 10,
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: "#B8B2C8",
                marginLeft: "auto",
              }}
            >
              Registry Only
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: "#9991AC", display: "flex", flexDirection: "column", gap: 5, marginLeft: 17 }}>
            <span>
              <span className="mono">{store.entity?.registryId ?? "—"}</span>
            </span>
            <span>{store.accountEmail || "—"}</span>
            {store.paired && (
              <span style={{ color: "#6B3FA0" }}>✓ PI Camera linked</span>
            )}
          </div>
        </div>

        {/* Maturity strip */}
        <div
          style={{
            fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
            fontSize: 11,
            color: "#9991AC",
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginBottom: 32,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#B8B2C8" }}>● Registry Only</span>
          <span>→</span>
          <span>○ Partial</span>
          <span>→</span>
          <span>○ Full</span>
        </div>

        <div
          style={{
            fontSize: 14,
            color: "#6B6080",
            maxWidth: 360,
            lineHeight: 1.55,
            marginBottom: 28,
          }}
        >
          Add C2PA-signed media with PI Camera to reach Full verification — the
          highest trust level.
        </div>

        <Link
          href="/profile"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            padding: "13px 24px",
            borderRadius: 11,
            background: "#6B3FA0",
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Build your profile →
        </Link>
      </div>
    );
  }

  return null;
}

// ── Helper: collapsible method card ──
function ProveMethodCard({
  title,
  description,
  icon,
  selected,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: selected
          ? "1px solid rgba(107,63,160,0.3)"
          : "1px solid rgba(26,16,53,0.10)",
        borderLeft: selected ? "3px solid #6B3FA0" : "1px solid rgba(26,16,53,0.10)",
        borderRadius: selected ? "0 11px 11px 0" : 11,
        padding: "16px 18px",
        background: selected ? "rgba(107,63,160,0.025)" : "transparent",
        cursor: "pointer",
        transition: "border 0.16s, background 0.16s",
      }}
      onClick={onToggle}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: selected ? "#6B3FA0" : "#9991AC" }}>{icon}</span>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "#1A1035" }}>
            {title}
          </div>
          <div style={{ fontSize: 12.5, color: "#6B6080", marginTop: 2 }}>
            {description}
          </div>
        </div>
      </div>
      {selected && (
        <div onClick={(e) => e.stopPropagation()}>{children}</div>
      )}
    </div>
  );
}
