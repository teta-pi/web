"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  GR_INK, GR_BODY, GR_MUTED, GR_PRIMARY, GR_PRIMARY_HOVER,
  GR_TINT, GR_ORANGE, GR_BORDER, GR_RAISED, GR_MONO_FONT,
} from "@/components/GridOfRecord";

// Flat square card — same board pattern as /profile, /search, /e/[slug],
// /claim (no glass blur/gradient/shadow).
const card: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${GR_BORDER}`,
};

const inputStyle: React.CSSProperties = {
  width: "100%", height: 46, padding: "0 14px", fontSize: 14.5,
  border: `1px solid ${GR_BORDER}`,
  background: "#fff", color: GR_INK, fontFamily: "inherit",
  boxSizing: "border-box",
};

type Mode = "password" | "code";

export default function LoginPage() {
  const router = useRouter();
  const { token, setAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && token) router.replace("/profile");
  }, [mounted, token, router]);

  if (!mounted || token) return null;

  const finish = (accessToken: string) => {
    setAuth(accessToken, { email: email.trim() } as never);
    router.push("/profile");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 50%,#EDF1FB 100%)", fontFamily: "'Manrope','Trebuchet MS','Segoe UI',sans-serif", color: GR_INK, position: "relative" }}>
      <Link href="/" style={{ position: "fixed", top: "calc(var(--banner-h) + 26px)", left: 30, textDecoration: "none", display: "flex", alignItems: "baseline", gap: 7 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: GR_PRIMARY }}>Θ</span>
        <span style={{ fontSize: 15, fontWeight: 300, color: GR_INK }}>+</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: GR_ORANGE }}>π</span>
      </Link>

      <div style={{ ...card, padding: "40px 44px", width: 400, maxWidth: "calc(100vw - 32px)" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.6px", margin: "0 0 6px" }}>Welcome back.</h1>
        <p style={{ fontSize: 14, color: GR_BODY, margin: "0 0 24px" }}>Sign in to manage your verified page.</p>

        {/* Mode switch — same segmented-tab pattern as /search's filter bar */}
        <div style={{ display: "flex", marginBottom: 20, border: `1px solid ${GR_BORDER}`, background: GR_RAISED }}>
          {(["password", "code"] as Mode[]).map((mo, i) => (
            <button
              key={mo}
              onClick={() => { setMode(mo); setError(""); }}
              style={{
                flex: 1, height: 36, fontSize: 13, fontWeight: 600,
                border: "none", borderRight: i === 0 ? `1px solid ${GR_BORDER}` : "none",
                cursor: "pointer", fontFamily: "inherit",
                color: mode === mo ? GR_INK : GR_MUTED,
                background: mode === mo ? GR_TINT : "transparent",
                boxShadow: mode === mo ? `inset 0 -2px 0 0 ${GR_PRIMARY}` : "none",
              }}
            >
              {mo === "password" ? "Password" : "Email code"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="you@company.com" type="email" style={inputStyle} />

          {mode === "password" ? (
            <>
              <input
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="Password"
                type="password"
                onKeyDown={(e) => e.key === "Enter" && email.includes("@") && password && !busy && document.getElementById("login-submit")?.click()}
                style={inputStyle}
              />
              {error && <div style={{ color: GR_ORANGE, fontSize: 13 }}>{error}</div>}
              <button
                id="login-submit"
                disabled={!email.includes("@") || !password || busy}
                onMouseEnter={(e) => { if (!busy) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY_HOVER; }}
                onMouseLeave={(e) => { if (!busy) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY; }}
                onClick={async () => {
                  setBusy(true); setError("");
                  try {
                    const res = await authApi.login(email.trim(), password);
                    finish(res.access_token);
                  } catch {
                    setError("Wrong email or password. No password set? Use email code.");
                  } finally { setBusy(false); }
                }}
                style={{ height: 46, fontSize: 14.5, fontWeight: 600, color: "#fff", background: GR_PRIMARY, border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "Signing in…" : "Sign in →"}
              </button>
            </>
          ) : !codeSent ? (
            <>
              {error && <div style={{ color: GR_ORANGE, fontSize: 13 }}>{error}</div>}
              <button
                disabled={!email.includes("@") || busy}
                onMouseEnter={(e) => { if (!busy) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY_HOVER; }}
                onMouseLeave={(e) => { if (!busy) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY; }}
                onClick={async () => {
                  setBusy(true); setError("");
                  try { await authApi.sendEmailCode(email.trim()); setCodeSent(true); }
                  catch { setError("Could not send code — try again in a minute."); }
                  finally { setBusy(false); }
                }}
                style={{ height: 46, fontSize: 14.5, fontWeight: 600, color: "#fff", background: GR_PRIMARY, border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "Sending…" : "Send code"}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: GR_BODY }}>Code sent to <strong>{email}</strong></div>
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                placeholder="· · · · · ·"
                maxLength={6}
                style={{ ...inputStyle, height: 50, fontSize: 22, letterSpacing: 8, fontFamily: GR_MONO_FONT, textAlign: "center" }}
              />
              {error && <div style={{ color: GR_ORANGE, fontSize: 13 }}>{error}</div>}
              <button
                disabled={code.length < 6 || busy}
                onMouseEnter={(e) => { if (!busy) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY_HOVER; }}
                onMouseLeave={(e) => { if (!busy) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY; }}
                onClick={async () => {
                  setBusy(true); setError("");
                  try {
                    const res = await authApi.verifyCode(email.trim(), code);
                    finish(res.access_token);
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : "";
                    setError(msg.includes("Too many") ? "Too many attempts — request a new code." : "Wrong or expired code.");
                  } finally { setBusy(false); }
                }}
                style={{ height: 46, fontSize: 14.5, fontWeight: 600, color: "#fff", background: GR_PRIMARY, border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "Checking…" : "Sign in →"}
              </button>
              <div onClick={() => { setCodeSent(false); setCode(""); }} style={{ fontSize: 12.5, color: GR_MUTED, cursor: "pointer", textAlign: "center" }}>
                Change email / resend
              </div>
            </>
          )}
        </div>

        <div style={{ fontSize: 13, color: GR_BODY, textAlign: "center", marginTop: 22 }}>
          No account yet? <Link href="/claim" style={{ color: GR_PRIMARY, textDecoration: "none", fontWeight: 600 }}>Get verified →</Link>
        </div>
      </div>
    </div>
  );
}
