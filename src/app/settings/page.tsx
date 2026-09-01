"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, mediaUrl } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import AppHeader from "@/components/AppHeader";
import {
  GR_INK, GR_BODY, GR_MUTED, GR_PRIMARY, GR_PRIMARY_HOVER,
  GR_TINT, GR_LILAC, GR_ORANGE, GR_BORDER, GR_MONO_FONT,
} from "@/components/GridOfRecord";

// Flat square card — same board pattern as /profile, /search, /e/[slug],
// /claim, /login (no glass blur/gradient/shadow).
const card: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${GR_BORDER}`,
};

const inputStyle: React.CSSProperties = {
  height: 46, padding: "0 14px", fontSize: 14.5,
  border: `1px solid ${GR_BORDER}`, background: "#fff", color: GR_INK, fontFamily: "inherit",
};

// Secondary (outline) action button — same recipe as BlockDetailModal's
// secondary CTA and /claim's disabled-OAuth buttons.
const secondaryBtn: React.CSSProperties = {
  fontSize: 14, fontWeight: 600, padding: "10px 20px",
  border: `1px solid ${GR_LILAC}`, background: "transparent", color: GR_PRIMARY,
  cursor: "pointer", fontFamily: "inherit",
};

function primaryBtnStyle(enabled: boolean, busy: boolean): React.CSSProperties {
  return {
    height: 46, fontSize: 14.5, fontWeight: 600,
    color: enabled ? "#fff" : GR_MUTED,
    background: enabled ? GR_PRIMARY : GR_TINT,
    border: "none", cursor: enabled ? "pointer" : "default", fontFamily: "inherit",
    opacity: busy ? 0.6 : 1,
  };
}

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
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 50%,#EDF1FB 100%)", color: GR_INK, fontFamily: "'Manrope','Trebuchet MS','Segoe UI',sans-serif", position: "relative" }}>
      <AppHeader />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "110px 24px 80px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.8px", margin: "0 0 6px" }}>Settings</h1>
        <p style={{ fontSize: 14.5, color: GR_BODY, margin: "0 0 32px" }}>Manage your account and sign-in methods.</p>

        {/* Account */}
        <div style={{ ...card, padding: "26px 28px", marginBottom: 16 }}>
          <div style={{ fontFamily: GR_MONO_FONT, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: GR_MUTED, marginBottom: 14 }}>Account</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ width: 56, height: 56, border: `1px solid ${GR_BORDER}`, background: avatarUrl ? "#fff" : GR_TINT, color: GR_PRIMARY, fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                (user?.email ?? "?")[0].toUpperCase()
              )}
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 15.5, fontWeight: 600 }}>{user?.email ?? "Signed in"}</div>
              <div style={{ fontSize: 12.5, color: GR_MUTED }}>Signed in with email code</div>
            </div>
            <label style={{ ...secondaryBtn, fontSize: 13, padding: "9px 16px", display: "inline-block" }}>
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
          {avatarMsg && <div style={{ fontSize: 13, color: avatarMsg.startsWith("✓") ? "#3FA97C" : GR_ORANGE, marginTop: 10 }}>{avatarMsg}</div>}
        </div>

        {/* Password */}
        <div style={{ ...card, padding: "26px 28px", marginBottom: 16 }}>
          <div style={{ fontFamily: GR_MONO_FONT, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: GR_MUTED, marginBottom: 6 }}>Password (key sign-in)</div>
          <p style={{ fontSize: 13.5, color: GR_BODY, margin: "0 0 18px", lineHeight: 1.55 }}>
            Add a password to sign in without waiting for an email code. Minimum 8 characters.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 380 }}>
            <input
              type="password"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setPwMsg(null); }}
              placeholder="New password"
              style={inputStyle}
            />
            <input
              type="password"
              value={pw2}
              onChange={(e) => { setPw2(e.target.value); setPwMsg(null); }}
              placeholder="Repeat password"
              style={inputStyle}
            />
            {pwMsg && (
              <div style={{ fontSize: 13, color: pwMsg.ok ? "#3FA97C" : GR_ORANGE }}>{pwMsg.text}</div>
            )}
            <button
              disabled={pw.length < 8 || pwBusy}
              onMouseEnter={(e) => { if (pw.length >= 8 && !pwBusy) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY_HOVER; }}
              onMouseLeave={(e) => { if (pw.length >= 8 && !pwBusy) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY; }}
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
              style={primaryBtnStyle(pw.length >= 8, pwBusy)}
            >
              {pwBusy ? "Saving…" : "Set password"}
            </button>
          </div>
        </div>

        {/* Change email */}
        <div style={{ ...card, padding: "26px 28px", marginBottom: 16 }}>
          <div style={{ fontFamily: GR_MONO_FONT, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: GR_MUTED, marginBottom: 6 }}>Change email</div>
          <p style={{ fontSize: 13.5, color: GR_BODY, margin: "0 0 18px", lineHeight: 1.55 }}>
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
                  style={inputStyle}
                />
                {emailMsg && <div style={{ fontSize: 13, color: emailMsg.ok ? "#3FA97C" : GR_ORANGE }}>{emailMsg.text}</div>}
                <button
                  disabled={!newEmail.includes("@") || emailBusy}
                  onMouseEnter={(e) => { if (newEmail.includes("@") && !emailBusy) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY_HOVER; }}
                  onMouseLeave={(e) => { if (newEmail.includes("@") && !emailBusy) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY; }}
                  onClick={async () => {
                    setEmailBusy(true); setEmailMsg(null);
                    try {
                      await authApi.changeEmail(newEmail.trim(), token);
                      setEmailCodeSent(true);
                    } catch (err) {
                      setEmailMsg({ ok: false, text: err instanceof Error ? err.message : "Failed to send code." });
                    } finally { setEmailBusy(false); }
                  }}
                  style={primaryBtnStyle(newEmail.includes("@"), emailBusy)}
                >
                  {emailBusy ? "Sending…" : "Send code to new email"}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: GR_BODY }}>Code sent to <strong>{newEmail}</strong></div>
                <input
                  value={emailCode}
                  onChange={(e) => { setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setEmailMsg(null); }}
                  placeholder="· · · · · ·"
                  maxLength={6}
                  style={{ ...inputStyle, height: 50, fontSize: 22, letterSpacing: 8, fontFamily: GR_MONO_FONT, textAlign: "center" }}
                />
                {emailMsg && <div style={{ fontSize: 13, color: emailMsg.ok ? "#3FA97C" : GR_ORANGE }}>{emailMsg.text}</div>}
                <button
                  disabled={emailCode.length < 6 || emailBusy}
                  onMouseEnter={(e) => { if (emailCode.length >= 6 && !emailBusy) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY_HOVER; }}
                  onMouseLeave={(e) => { if (emailCode.length >= 6 && !emailBusy) (e.currentTarget as HTMLElement).style.background = GR_PRIMARY; }}
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
                  style={primaryBtnStyle(emailCode.length >= 6, emailBusy)}
                >
                  {emailBusy ? "Checking…" : "Confirm change"}
                </button>
                <span onClick={() => { setEmailCodeSent(false); setEmailCode(""); }} style={{ fontSize: 12.5, color: GR_MUTED, cursor: "pointer" }}>Change address / resend</span>
              </>
            )}
          </div>
        </div>

        {/* API key */}
        <div style={{ ...card, padding: "26px 28px", marginBottom: 16 }}>
          <div style={{ fontFamily: GR_MONO_FONT, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: GR_MUTED, marginBottom: 6 }}>API key</div>
          <p style={{ fontSize: 13.5, color: GR_BODY, margin: "0 0 18px", lineHeight: 1.55 }}>
            Personal key for the TETA+PI API and MCP tools. Shown once — rotating invalidates the previous key.
          </p>
          {apiKey ? (
            <div style={{ fontFamily: GR_MONO_FONT, fontSize: 13, color: GR_PRIMARY, background: GR_TINT, border: `1px solid ${GR_LILAC}`, padding: "12px 14px", wordBreak: "break-all", marginBottom: 10 }}>
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
            style={{ ...secondaryBtn, opacity: keyBusy ? 0.6 : 1 }}
          >
            {keyBusy ? "Generating…" : apiKey ? "Rotate key" : "Generate API key"}
          </button>
        </div>

        {/* Legal / links */}
        <div style={{ ...card, padding: "26px 28px", marginBottom: 16 }}>
          <div style={{ fontFamily: GR_MONO_FONT, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: GR_MUTED, marginBottom: 14 }}>Resources</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <a href="https://tetapi.dev/privacy.html" style={{ fontSize: 14, color: GR_PRIMARY, textDecoration: "none" }}>Privacy Policy →</a>
            <a href="https://tetapi.dev/terms.html" style={{ fontSize: 14, color: GR_PRIMARY, textDecoration: "none" }}>Terms of Service →</a>
            <a href="mailto:hello@tetapi.dev" style={{ fontSize: 14, color: GR_PRIMARY, textDecoration: "none" }}>Contact support →</a>
          </div>
        </div>

        {/* Sessions */}
        <div style={{ ...card, padding: "26px 28px", marginBottom: 16 }}>
          <div style={{ fontFamily: GR_MONO_FONT, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: GR_MUTED, marginBottom: 14 }}>Sessions</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => { clearAuth(); router.push("/"); }}
              style={{ fontSize: 14, fontWeight: 600, padding: "10px 20px", border: `1px solid ${GR_BORDER}`, background: "#fff", color: GR_BODY, cursor: "pointer", fontFamily: "inherit" }}
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
              style={{ fontSize: 14, fontWeight: 600, padding: "10px 20px", border: "1px solid rgba(176,69,69,0.35)", background: "rgba(176,69,69,0.07)", color: "#B04545", cursor: "pointer", fontFamily: "inherit", opacity: sessionBusy ? 0.6 : 1 }}
            >
              {sessionBusy ? "Working…" : "Log out everywhere"}
            </button>
          </div>
          {sessionMsg && <div style={{ fontSize: 13, color: sessionMsg.startsWith("✓") ? "#3FA97C" : GR_ORANGE, marginTop: 10 }}>{sessionMsg}</div>}
        </div>

        {/* Danger zone */}
        <div style={{ ...card, padding: "26px 28px", border: "1px solid rgba(176,69,69,0.25)" }}>
          <div style={{ fontFamily: GR_MONO_FONT, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#B04545", marginBottom: 14 }}>Danger zone</div>
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
            style={{ fontSize: 14, fontWeight: 600, padding: "10px 20px", border: "none", background: "#B04545", color: "#fff", cursor: "pointer", fontFamily: "inherit", opacity: delBusy ? 0.6 : 1 }}
          >
            {delBusy ? "Deleting…" : "Delete account"}
          </button>
          <p style={{ fontSize: 12.5, color: GR_MUTED, margin: "14px 0 0", lineHeight: 1.55 }}>
            GDPR Art. 17: personal data is erased immediately. Bitcoin timestamps are immutable
            and remain on the public blockchain — they contain hashes, not personal data.
          </p>
        </div>
      </div>
    </div>
  );
}
