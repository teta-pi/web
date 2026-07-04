"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";

const INDIGO = "#5B45C9";
const SUN = "#F59A2E";
const TEXT = "#1A1035";
const TEXT_SEC = "#5A4F78";
const MUTED = "#9088B0";

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.55)",
  border: "1px solid rgba(255,255,255,0.7)",
  borderRadius: 20,
  boxShadow: "0 12px 40px rgba(45,55,120,0.12), inset 0 1px 0 rgba(255,255,255,0.85)",
  backdropFilter: "blur(20px) saturate(140%)",
  WebkitBackdropFilter: "blur(20px) saturate(140%)",
};

const inputStyle: React.CSSProperties = {
  width: "100%", height: 46, padding: "0 14px", fontSize: 14.5,
  border: "1px solid rgba(26,16,53,0.12)", borderRadius: 10,
  background: "rgba(255,255,255,0.7)", color: TEXT, fontFamily: "inherit",
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 50%,#EDF1FB 100%)", fontFamily: "'Manrope','Trebuchet MS','Segoe UI',sans-serif", color: TEXT, position: "relative" }}>
      <Link href="/" style={{ position: "fixed", top: 26, left: 30, textDecoration: "none", display: "flex", alignItems: "baseline", gap: 7 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: INDIGO }}>Θ</span>
        <span style={{ fontSize: 15, fontWeight: 300, color: TEXT }}>+</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: SUN }}>π</span>
      </Link>

      <div style={{ ...glass, padding: "40px 44px", width: 400, maxWidth: "calc(100vw - 32px)" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.6px", margin: "0 0 6px" }}>Welcome back.</h1>
        <p style={{ fontSize: 14, color: TEXT_SEC, margin: "0 0 24px" }}>Sign in to manage your verified page.</p>

        {/* Mode switch */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "rgba(26,16,53,0.05)", borderRadius: 12, padding: 4 }}>
          {(["password", "code"] as Mode[]).map((mo) => (
            <button
              key={mo}
              onClick={() => { setMode(mo); setError(""); }}
              style={{
                flex: 1, height: 36, fontSize: 13, fontWeight: 600, borderRadius: 9,
                border: "none", cursor: "pointer", fontFamily: "inherit",
                color: mode === mo ? TEXT : MUTED,
                background: mode === mo ? "rgba(255,255,255,0.9)" : "transparent",
                boxShadow: mode === mo ? "0 2px 8px rgba(45,55,120,0.10)" : "none",
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
              {error && <div style={{ color: SUN, fontSize: 13 }}>{error}</div>}
              <button
                id="login-submit"
                disabled={!email.includes("@") || !password || busy}
                onClick={async () => {
                  setBusy(true); setError("");
                  try {
                    const res = await authApi.login(email.trim(), password);
                    finish(res.access_token);
                  } catch {
                    setError("Wrong email or password. No password set? Use email code.");
                  } finally { setBusy(false); }
                }}
                style={{ height: 46, fontSize: 14.5, fontWeight: 600, color: "#fff", background: `linear-gradient(180deg,#6E58D6,${INDIGO})`, border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "Signing in…" : "Sign in →"}
              </button>
            </>
          ) : !codeSent ? (
            <>
              {error && <div style={{ color: SUN, fontSize: 13 }}>{error}</div>}
              <button
                disabled={!email.includes("@") || busy}
                onClick={async () => {
                  setBusy(true); setError("");
                  try { await authApi.sendEmailCode(email.trim()); setCodeSent(true); }
                  catch { setError("Could not send code — try again in a minute."); }
                  finally { setBusy(false); }
                }}
                style={{ height: 46, fontSize: 14.5, fontWeight: 600, color: "#fff", background: `linear-gradient(180deg,#6E58D6,${INDIGO})`, border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "Sending…" : "Send code"}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: TEXT_SEC }}>Code sent to <strong>{email}</strong></div>
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                placeholder="· · · · · ·"
                maxLength={6}
                style={{ ...inputStyle, height: 50, fontSize: 22, letterSpacing: 8, fontFamily: "ui-monospace,'SF Mono',monospace", textAlign: "center" }}
              />
              {error && <div style={{ color: SUN, fontSize: 13 }}>{error}</div>}
              <button
                disabled={code.length < 6 || busy}
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
                style={{ height: 46, fontSize: 14.5, fontWeight: 600, color: "#fff", background: `linear-gradient(180deg,#6E58D6,${INDIGO})`, border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "Checking…" : "Sign in →"}
              </button>
              <div onClick={() => { setCodeSent(false); setCode(""); }} style={{ fontSize: 12.5, color: MUTED, cursor: "pointer", textAlign: "center" }}>
                Change email / resend
              </div>
            </>
          )}
        </div>

        <div style={{ fontSize: 13, color: TEXT_SEC, textAlign: "center", marginTop: 22 }}>
          No account yet? <Link href="/claim" style={{ color: INDIGO, textDecoration: "none", fontWeight: 600 }}>Get verified →</Link>
        </div>
      </div>
    </div>
  );
}
