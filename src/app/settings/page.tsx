"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import AccountMenu from "@/components/AccountMenu";

const INDIGO = "#5B45C9";
const SUN = "#F59A2E";
const TEXT = "#1A1035";
const TEXT_SEC = "#5A4F78";
const MUTED = "#9088B0";

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.55)",
  border: "1px solid rgba(255,255,255,0.7)",
  borderRadius: 18,
  boxShadow: "0 12px 40px rgba(45,55,120,0.10), inset 0 1px 0 rgba(255,255,255,0.85)",
  backdropFilter: "blur(20px) saturate(140%)",
  WebkitBackdropFilter: "blur(20px) saturate(140%)",
};

export default function SettingsPage() {
  const { token, user, clearAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !token) router.replace("/claim");
  }, [mounted, token, router]);

  if (!mounted || !token) return null;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 50%,#EDF1FB 100%)", color: TEXT, fontFamily: "'Manrope','Trebuchet MS','Segoe UI',sans-serif", position: "relative" }}>
      {/* Corner logo + account */}
      <Link href="/" style={{ position: "fixed", top: 26, left: 30, zIndex: 10, textDecoration: "none", display: "flex", alignItems: "baseline", gap: 7 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: INDIGO }}>Θ</span>
        <span style={{ fontSize: 15, fontWeight: 300, color: TEXT }}>+</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: SUN }}>π</span>
      </Link>
      <AccountMenu />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "110px 24px 80px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.8px", margin: "0 0 6px" }}>Settings</h1>
        <p style={{ fontSize: 14.5, color: TEXT_SEC, margin: "0 0 32px" }}>Manage your account and sign-in methods.</p>

        {/* Account */}
        <div style={{ ...glass, padding: "26px 28px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: MUTED, marginBottom: 14 }}>Account</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(180deg,#6E58D6,${INDIGO})`, color: "#fff", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {(user?.email ?? "?")[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 600 }}>{user?.email ?? "Signed in"}</div>
              <div style={{ fontSize: 12.5, color: MUTED }}>Signed in with email code</div>
            </div>
          </div>
        </div>

        {/* Password */}
        <div style={{ ...glass, padding: "26px 28px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: MUTED, marginBottom: 6 }}>Password (key sign-in)</div>
          <p style={{ fontSize: 13.5, color: TEXT_SEC, margin: "0 0 18px", lineHeight: 1.55 }}>
            Add a password to sign in without waiting for an email code. Minimum 8 characters.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 380 }}>
            <input
              type="password"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setPwMsg(null); }}
              placeholder="New password"
              style={{ height: 46, padding: "0 14px", fontSize: 14.5, border: "1px solid rgba(26,16,53,0.12)", borderRadius: 10, background: "rgba(255,255,255,0.7)", color: TEXT, fontFamily: "inherit" }}
            />
            <input
              type="password"
              value={pw2}
              onChange={(e) => { setPw2(e.target.value); setPwMsg(null); }}
              placeholder="Repeat password"
              style={{ height: 46, padding: "0 14px", fontSize: 14.5, border: "1px solid rgba(26,16,53,0.12)", borderRadius: 10, background: "rgba(255,255,255,0.7)", color: TEXT, fontFamily: "inherit" }}
            />
            {pwMsg && (
              <div style={{ fontSize: 13, color: pwMsg.ok ? "#3FA97C" : SUN }}>{pwMsg.text}</div>
            )}
            <button
              disabled={pw.length < 8 || pwBusy}
              onClick={async () => {
                if (pw !== pw2) { setPwMsg({ ok: false, text: "Passwords don't match." }); return; }
                setPwBusy(true); setPwMsg(null);
                try {
                  await authApi.setPassword(pw, token);
                  setPwMsg({ ok: true, text: "✓ Password set — you can now sign in with email + password." });
                  setPw(""); setPw2("");
                } catch (err) {
                  setPwMsg({ ok: false, text: err instanceof Error ? err.message : "Failed to set password." });
                } finally { setPwBusy(false); }
              }}
              style={{
                height: 46, fontSize: 14.5, fontWeight: 600, color: "#fff",
                background: pw.length < 8 ? "rgba(26,16,53,0.15)" : `linear-gradient(180deg,#6E58D6,${INDIGO})`,
                border: "none", borderRadius: 12, cursor: pw.length < 8 ? "default" : "pointer", fontFamily: "inherit",
                opacity: pwBusy ? 0.6 : 1,
              }}
            >
              {pwBusy ? "Saving…" : "Set password"}
            </button>
          </div>
        </div>

        {/* Legal / links */}
        <div style={{ ...glass, padding: "26px 28px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: MUTED, marginBottom: 14 }}>Resources</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <a href="https://tetapi.dev/privacy.html" style={{ fontSize: 14, color: INDIGO, textDecoration: "none" }}>Privacy Policy →</a>
            <a href="https://tetapi.dev/terms.html" style={{ fontSize: 14, color: INDIGO, textDecoration: "none" }}>Terms of Service →</a>
            <a href="mailto:hello@tetapi.dev" style={{ fontSize: 14, color: INDIGO, textDecoration: "none" }}>Contact support →</a>
          </div>
        </div>

        {/* Danger zone */}
        <div style={{ ...glass, padding: "26px 28px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: MUTED, marginBottom: 14 }}>Session</div>
          <button
            onClick={() => { clearAuth(); router.push("/"); }}
            style={{ fontSize: 14, fontWeight: 600, padding: "10px 20px", borderRadius: 11, border: "1px solid rgba(176,69,69,0.35)", background: "rgba(176,69,69,0.07)", color: "#B04545", cursor: "pointer", fontFamily: "inherit" }}
          >
            Log out
          </button>
          <p style={{ fontSize: 12.5, color: MUTED, margin: "14px 0 0", lineHeight: 1.55 }}>
            To delete your account and data (GDPR), email <a href="mailto:hello@tetapi.dev" style={{ color: INDIGO }}>hello@tetapi.dev</a>.
            Bitcoin timestamps are immutable and remain on the public blockchain.
          </p>
        </div>
      </div>
    </div>
  );
}
