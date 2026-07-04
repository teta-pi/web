"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi, mediaUrl } from "@/lib/api";
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

  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState("");

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionMsg, setSessionMsg] = useState("");
  const [delBusy, setDelBusy] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !token) router.replace("/claim");
  }, [mounted, token, router]);
  useEffect(() => {
    if (!token) return;
    authApi.me(token).then((me) => setAvatarUrl(mediaUrl(me.avatar_url))).catch(() => {});
  }, [token]);

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
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: avatarUrl ? "#fff" : `linear-gradient(180deg,#6E58D6,${INDIGO})`, color: "#fff", fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                (user?.email ?? "?")[0].toUpperCase()
              )}
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 15.5, fontWeight: 600 }}>{user?.email ?? "Signed in"}</div>
              <div style={{ fontSize: 12.5, color: MUTED }}>Signed in with email code</div>
            </div>
            <label style={{ fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: 10, border: `1px solid ${INDIGO}40`, background: "rgba(91,69,201,0.08)", color: INDIGO, cursor: "pointer" }}>
              {avatarBusy ? "Uploading…" : avatarUrl ? "Change avatar" : "Upload avatar"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                disabled={avatarBusy}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setAvatarBusy(true); setAvatarMsg("");
                  try {
                    const r = await authApi.uploadAvatar(f, token);
                    setAvatarUrl(mediaUrl(r.avatar_url));
                    setAvatarMsg("✓ Avatar updated.");
                  } catch (err) {
                    setAvatarMsg(err instanceof Error ? err.message : "Upload failed.");
                  } finally { setAvatarBusy(false); e.target.value = ""; }
                }}
              />
            </label>
          </div>
          {avatarMsg && <div style={{ fontSize: 13, color: avatarMsg.startsWith("✓") ? "#3FA97C" : SUN, marginTop: 10 }}>{avatarMsg}</div>}
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

        {/* Change email */}
        <div style={{ ...glass, padding: "26px 28px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: MUTED, marginBottom: 6 }}>Change email</div>
          <p style={{ fontSize: 13.5, color: TEXT_SEC, margin: "0 0 18px", lineHeight: 1.55 }}>
            We&apos;ll send a verification code to the new address.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 380 }}>
            {!emailCodeSent ? (
              <>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => { setNewEmail(e.target.value); setEmailMsg(null); }}
                  placeholder="new@email.com"
                  style={{ height: 46, padding: "0 14px", fontSize: 14.5, border: "1px solid rgba(26,16,53,0.12)", borderRadius: 10, background: "rgba(255,255,255,0.7)", color: TEXT, fontFamily: "inherit" }}
                />
                {emailMsg && <div style={{ fontSize: 13, color: emailMsg.ok ? "#3FA97C" : SUN }}>{emailMsg.text}</div>}
                <button
                  disabled={!newEmail.includes("@") || emailBusy}
                  onClick={async () => {
                    setEmailBusy(true); setEmailMsg(null);
                    try {
                      await authApi.changeEmail(newEmail.trim(), token);
                      setEmailCodeSent(true);
                    } catch (err) {
                      setEmailMsg({ ok: false, text: err instanceof Error ? err.message : "Failed to send code." });
                    } finally { setEmailBusy(false); }
                  }}
                  style={{ height: 46, fontSize: 14.5, fontWeight: 600, color: "#fff", background: !newEmail.includes("@") ? "rgba(26,16,53,0.15)" : `linear-gradient(180deg,#6E58D6,${INDIGO})`, border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", opacity: emailBusy ? 0.6 : 1 }}
                >
                  {emailBusy ? "Sending…" : "Send code to new email"}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: TEXT_SEC }}>Code sent to <strong>{newEmail}</strong></div>
                <input
                  value={emailCode}
                  onChange={(e) => { setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setEmailMsg(null); }}
                  placeholder="· · · · · ·"
                  maxLength={6}
                  style={{ height: 50, padding: "0 14px", fontSize: 22, letterSpacing: 8, fontFamily: "ui-monospace,'SF Mono',monospace", border: "1px solid rgba(26,16,53,0.12)", borderRadius: 10, background: "rgba(255,255,255,0.7)", color: TEXT, textAlign: "center" }}
                />
                {emailMsg && <div style={{ fontSize: 13, color: emailMsg.ok ? "#3FA97C" : SUN }}>{emailMsg.text}</div>}
                <button
                  disabled={emailCode.length < 6 || emailBusy}
                  onClick={async () => {
                    setEmailBusy(true); setEmailMsg(null);
                    try {
                      const res = await authApi.confirmEmailChange(newEmail.trim(), emailCode, token);
                      useAuthStore.getState().setAuth(token, { email: res.email } as never);
                      setEmailMsg({ ok: true, text: "✓ Email updated." });
                      setEmailCodeSent(false); setNewEmail(""); setEmailCode("");
                    } catch (err) {
                      setEmailMsg({ ok: false, text: err instanceof Error ? err.message : "Wrong or expired code." });
                    } finally { setEmailBusy(false); }
                  }}
                  style={{ height: 46, fontSize: 14.5, fontWeight: 600, color: "#fff", background: emailCode.length < 6 ? "rgba(26,16,53,0.15)" : `linear-gradient(180deg,#6E58D6,${INDIGO})`, border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", opacity: emailBusy ? 0.6 : 1 }}
                >
                  {emailBusy ? "Checking…" : "Confirm change"}
                </button>
                <span onClick={() => { setEmailCodeSent(false); setEmailCode(""); }} style={{ fontSize: 12.5, color: MUTED, cursor: "pointer" }}>Change address / resend</span>
              </>
            )}
          </div>
        </div>

        {/* API key */}
        <div style={{ ...glass, padding: "26px 28px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: MUTED, marginBottom: 6 }}>API key</div>
          <p style={{ fontSize: 13.5, color: TEXT_SEC, margin: "0 0 18px", lineHeight: 1.55 }}>
            Personal key for the TETA+PI API and MCP tools. Shown once — rotating invalidates the previous key.
          </p>
          {apiKey ? (
            <div style={{ fontFamily: "ui-monospace,'SF Mono',monospace", fontSize: 13, color: INDIGO, background: "rgba(91,69,201,0.07)", border: "1px solid rgba(91,69,201,0.2)", borderRadius: 10, padding: "12px 14px", wordBreak: "break-all", marginBottom: 10 }}>
              {apiKey}
            </div>
          ) : null}
          <button
            disabled={keyBusy}
            onClick={async () => {
              if (apiKey && !confirm("Rotate the key? The previous key stops working immediately.")) return;
              setKeyBusy(true);
              try { const r = await authApi.personalApiKey(token); setApiKey(r.api_key); }
              catch { alert("Failed to generate key"); }
              finally { setKeyBusy(false); }
            }}
            style={{ fontSize: 14, fontWeight: 600, padding: "10px 20px", borderRadius: 11, border: `1px solid ${INDIGO}40`, background: "rgba(91,69,201,0.08)", color: INDIGO, cursor: "pointer", fontFamily: "inherit" }}
          >
            {keyBusy ? "Generating…" : apiKey ? "Rotate key" : "Generate API key"}
          </button>
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

        {/* Sessions */}
        <div style={{ ...glass, padding: "26px 28px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: MUTED, marginBottom: 14 }}>Sessions</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => { clearAuth(); router.push("/"); }}
              style={{ fontSize: 14, fontWeight: 600, padding: "10px 20px", borderRadius: 11, border: "1px solid rgba(26,16,53,0.14)", background: "none", color: TEXT_SEC, cursor: "pointer", fontFamily: "inherit" }}
            >
              Log out
            </button>
            <button
              disabled={sessionBusy}
              onClick={async () => {
                setSessionBusy(true); setSessionMsg("");
                try {
                  const res = await authApi.logoutAll(token);
                  useAuthStore.getState().setAuth(res.access_token, user ?? undefined);
                  setSessionMsg("✓ All other sessions signed out. This one stays active.");
                } catch { setSessionMsg("Failed — try again."); }
                finally { setSessionBusy(false); }
              }}
              style={{ fontSize: 14, fontWeight: 600, padding: "10px 20px", borderRadius: 11, border: "1px solid rgba(176,69,69,0.35)", background: "rgba(176,69,69,0.07)", color: "#B04545", cursor: "pointer", fontFamily: "inherit", opacity: sessionBusy ? 0.6 : 1 }}
            >
              {sessionBusy ? "Working…" : "Log out everywhere"}
            </button>
          </div>
          {sessionMsg && <div style={{ fontSize: 13, color: sessionMsg.startsWith("✓") ? "#3FA97C" : SUN, marginTop: 10 }}>{sessionMsg}</div>}
        </div>

        {/* Danger zone */}
        <div style={{ ...glass, padding: "26px 28px", border: "1px solid rgba(176,69,69,0.25)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#B04545", marginBottom: 14 }}>Danger zone</div>
          <button
            disabled={delBusy}
            onClick={async () => {
              if (!confirm("Delete your account? PII is erased, your pages are unpublished. This cannot be undone.")) return;
              if (!confirm("Really sure? Bitcoin timestamps remain on the public blockchain (they contain no personal data).")) return;
              setDelBusy(true);
              try {
                await authApi.deleteAccount(token);
                clearAuth();
                router.push("/");
              } catch { alert("Deletion failed — contact hello@tetapi.dev"); setDelBusy(false); }
            }}
            style={{ fontSize: 14, fontWeight: 600, padding: "10px 20px", borderRadius: 11, border: "none", background: "#B04545", color: "#fff", cursor: "pointer", fontFamily: "inherit", opacity: delBusy ? 0.6 : 1 }}
          >
            {delBusy ? "Deleting…" : "Delete account"}
          </button>
          <p style={{ fontSize: 12.5, color: MUTED, margin: "14px 0 0", lineHeight: 1.55 }}>
            GDPR Art. 17: personal data is erased immediately. Bitcoin timestamps are immutable
            and remain on the public blockchain — they contain hashes, not personal data.
          </p>
        </div>
      </div>
    </div>
  );
}
