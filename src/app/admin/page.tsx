"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminApi,
  authApi,
  AdminUser,
  AdminUserDetail,
  AdminClaim,
  AdminEntity,
  AdminAuditEntry,
} from "@/lib/api";

const INDIGO = "#5B45C9";
const SUN = "#F59A2E";
const TEXT = "#1A1035";
const TEXT_SEC = "#5A4F78";
const MUTED = "#9088B0";
const TOKEN_KEY = "tetapi_admin_token";

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.55)",
  border: "1px solid rgba(255,255,255,0.7)",
  borderRadius: 16,
  boxShadow: "0 8px 30px rgba(45,55,120,0.10)",
};

type Tab = "users" | "claims" | "entities" | "audit";

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY));
    setChecked(true);
  }, []);

  if (!checked) return null;
  if (!token) return <AdminLogin onToken={(t) => { localStorage.setItem(TOKEN_KEY, t); setToken(t); }} />;
  return <AdminDashboard token={token} onLogout={() => { localStorage.removeItem(TOKEN_KEY); setToken(null); }} />;
}

/* ── Login ─────────────────────────────────────────────────────────────────── */

function AdminLogin({ onToken }: { onToken: (t: string) => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 45%,#EDF1FB 100%)", fontFamily: "'Manrope',sans-serif", color: TEXT }}>
      <div style={{ ...glass, padding: "40px 44px", width: 380 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          <span style={{ color: INDIGO }}>Θ</span>+<span style={{ color: SUN }}>π</span> · Back Office
        </div>
        <div style={{ fontSize: 13.5, color: TEXT_SEC, marginBottom: 24 }}>Admin access only. All actions are audited.</div>

        {!sent ? (
          <>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@email"
              type="email"
              style={{ width: "100%", height: 46, padding: "0 14px", fontSize: 14.5, border: "1px solid rgba(26,16,53,0.14)", borderRadius: 10, background: "rgba(255,255,255,0.7)", color: TEXT, fontFamily: "inherit", marginBottom: 12, boxSizing: "border-box" }}
            />
            {error && <div style={{ color: SUN, fontSize: 13, marginBottom: 10 }}>{error}</div>}
            <button
              disabled={!email.includes("@") || busy}
              onClick={async () => {
                setBusy(true); setError("");
                try { await authApi.sendEmailCode(email.trim()); setSent(true); }
                catch { setError("Could not send code."); }
                finally { setBusy(false); }
              }}
              style={{ width: "100%", height: 46, fontSize: 14.5, fontWeight: 600, color: "#fff", background: `linear-gradient(180deg,#6E58D6,${INDIGO})`, border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "Sending…" : "Send code"}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: TEXT_SEC, marginBottom: 10 }}>Code sent to <strong>{email}</strong></div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="······"
              maxLength={6}
              style={{ width: "100%", height: 50, padding: "0 14px", fontSize: 22, letterSpacing: 8, fontFamily: "ui-monospace,'SF Mono',monospace", border: "1px solid rgba(26,16,53,0.14)", borderRadius: 10, background: "rgba(255,255,255,0.7)", color: TEXT, marginBottom: 12, boxSizing: "border-box", textAlign: "center" }}
            />
            {error && <div style={{ color: SUN, fontSize: 13, marginBottom: 10 }}>{error}</div>}
            <button
              disabled={code.length < 6 || busy}
              onClick={async () => {
                setBusy(true); setError("");
                try {
                  const res = await authApi.verifyCode(email.trim(), code);
                  // Confirm role before storing: stats is admin-gated
                  await adminApi.stats(res.access_token);
                  onToken(res.access_token);
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "";
                  setError(msg.includes("Admin") ? "This account has no admin access." : "Wrong or expired code.");
                } finally { setBusy(false); }
              }}
              style={{ width: "100%", height: 46, fontSize: 14.5, fontWeight: 600, color: "#fff", background: `linear-gradient(180deg,#6E58D6,${INDIGO})`, border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "Checking…" : "Enter →"}
            </button>
            <div onClick={() => { setSent(false); setCode(""); }} style={{ fontSize: 12.5, color: MUTED, cursor: "pointer", marginTop: 10, textAlign: "center" }}>
              Change email / resend
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────────────────── */

function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("users");
  const [stats, setStats] = useState<Awaited<ReturnType<typeof adminApi.stats>> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi.stats(token).then(setStats).catch((err) => {
      if (err instanceof Error && (err.message.includes("Admin") || err.message.includes("Invalid"))) onLogout();
      else setError("Failed to load stats");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 45%,#EDF1FB 100%)", fontFamily: "'Manrope',sans-serif", color: TEXT, padding: "28px 24px 60px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ fontSize: 19, fontWeight: 700 }}>
            <span style={{ color: INDIGO }}>Θ</span>+<span style={{ color: SUN }}>π</span> · Back Office
          </div>
          <button onClick={onLogout} style={{ fontSize: 13, color: TEXT_SEC, background: "none", border: "1px solid rgba(26,16,53,0.14)", borderRadius: 10, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit" }}>
            Log out
          </button>
        </div>

        {/* Stats cards */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 24 }}>
            <StatCard label="Users" value={stats.users.total} sub={`+${stats.users.today} today · +${stats.users.week} this week`} />
            <StatCard label="Waitlist claims" value={stats.claims.total} sub={`${stats.claims.pay_ready} ready to pay (${stats.claims.pay_ready_pct}%)`} accent />
            <StatCard label="Entities" value={stats.entities.total} sub={Object.entries(stats.entities.by_level).map(([l, c]) => `${l}: ${c}`).join(" · ") || "—"} />
            <StatCard label="Verification events" value={stats.verification_events} sub="append-only · BTC-anchored" />
          </div>
        )}
        {error && <div style={{ color: SUN, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["users", "claims", "entities", "audit"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                fontSize: 13.5, fontWeight: 600, padding: "8px 18px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                color: tab === t ? "#fff" : TEXT_SEC,
                background: tab === t ? `linear-gradient(180deg,#6E58D6,${INDIGO})` : "rgba(255,255,255,0.55)",
                border: tab === t ? "none" : "1px solid rgba(255,255,255,0.7)",
              }}
            >
              {t === "users" ? "Users" : t === "claims" ? "Claims" : t === "entities" ? "Entities" : "Audit log"}
            </button>
          ))}
        </div>

        {tab === "users" && <UsersTab token={token} />}
        {tab === "claims" && <ClaimsTab token={token} />}
        {tab === "entities" && <EntitiesTab token={token} />}
        {tab === "audit" && <AuditTab token={token} />}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: number; sub: string; accent?: boolean }) {
  return (
    <div style={{ ...glass, padding: "18px 20px", borderTop: accent ? `3px solid ${SUN}` : undefined }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: accent ? SUN : INDIGO, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: TEXT_SEC, marginTop: 8 }}>{sub}</div>
    </div>
  );
}

/* ── Shared table bits ─────────────────────────────────────────────────────── */

const th: React.CSSProperties = { textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: MUTED, padding: "10px 14px", borderBottom: "1px solid rgba(26,16,53,0.08)" };
const td: React.CSSProperties = { fontSize: 13.5, color: TEXT, padding: "11px 14px", borderBottom: "1px solid rgba(26,16,53,0.05)", verticalAlign: "top" };

function Pager({ total, offset, onOffset, pageSize = 50 }: { total: number; offset: number; onOffset: (o: number) => void; pageSize?: number }) {
  if (total <= pageSize) return null;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 14px" }}>
      <button disabled={offset === 0} onClick={() => onOffset(Math.max(0, offset - pageSize))} style={{ fontSize: 13, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(26,16,53,0.14)", background: "none", cursor: "pointer", fontFamily: "inherit", opacity: offset === 0 ? 0.4 : 1 }}>←</button>
      <span style={{ fontSize: 12.5, color: MUTED }}>{offset + 1}–{Math.min(offset + pageSize, total)} of {total}</span>
      <button disabled={offset + pageSize >= total} onClick={() => onOffset(offset + pageSize)} style={{ fontSize: 13, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(26,16,53,0.14)", background: "none", cursor: "pointer", fontFamily: "inherit", opacity: offset + pageSize >= total ? 0.4 : 1 }}>→</button>
    </div>
  );
}

function SearchBox({ onSearch }: { onSearch: (q: string) => void }) {
  const [q, setQ] = useState("");
  return (
    <input
      value={q}
      onChange={(e) => { setQ(e.target.value); }}
      onKeyDown={(e) => { if (e.key === "Enter") onSearch(q.trim()); }}
      placeholder="Search… (Enter)"
      style={{ height: 38, padding: "0 14px", fontSize: 13.5, border: "1px solid rgba(26,16,53,0.12)", borderRadius: 10, background: "rgba(255,255,255,0.7)", color: TEXT, fontFamily: "inherit", width: 260 }}
    />
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}18`, padding: "3px 8px", borderRadius: 7 }}>{text}</span>;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ── Users tab ─────────────────────────────────────────────────────────────── */

function UsersTab({ token }: { token: string }) {
  const [data, setData] = useState<{ total: number; results: AdminUser[] } | null>(null);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);

  const load = useCallback(() => {
    adminApi.users(token, { q: q || undefined, offset }).then(setData).catch(() => {});
  }, [token, q, offset]);
  useEffect(load, [load]);

  return (
    <div style={{ ...glass, overflow: "hidden" }}>
      <div style={{ padding: "14px 14px 0" }}>
        <SearchBox onSearch={(v) => { setQ(v); setOffset(0); }} />
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
        <thead><tr>
          <th style={th}>Email</th><th style={th}>Name</th><th style={th}>Role</th><th style={th}>Provider</th><th style={th}>Entities</th><th style={th}>Registered</th>
        </tr></thead>
        <tbody>
          {data?.results.map((u) => (
            <tr key={u.id} onClick={() => adminApi.userDetail(token, u.id).then(setDetail).catch(() => {})} style={{ cursor: "pointer" }}>
              <td style={td}>{u.email}{u.is_agent && <span style={{ marginLeft: 6 }}><Badge text="AGENT" color={INDIGO} /></span>}{!u.is_active && <span style={{ marginLeft: 6 }}><Badge text="INACTIVE" color="#B04545" /></span>}</td>
              <td style={td}>{u.full_name ?? <span style={{ color: MUTED }}>—</span>}</td>
              <td style={td}>{u.role === "admin" ? <Badge text="ADMIN" color={SUN} /> : u.role}</td>
              <td style={td}>{u.auth_provider}</td>
              <td style={td}>{u.entities_count}</td>
              <td style={td}>{fmtDate(u.created_at)}</td>
            </tr>
          ))}
          {data && data.results.length === 0 && (
            <tr><td style={{ ...td, color: MUTED }} colSpan={6}>No users found.</td></tr>
          )}
        </tbody>
      </table>
      {data && <Pager total={data.total} offset={offset} onOffset={setOffset} />}

      {detail && <UserDetailPanel token={token} detail={detail} onClose={() => setDetail(null)} onChanged={() => { setDetail(null); load(); }} />}
    </div>
  );
}

function UserDetailPanel({ token, detail, onClose, onChanged }: { token: string; detail: AdminUserDetail; onClose: () => void; onChanged: () => void }) {
  const u = detail.user;
  const [flags, setFlags] = useState<string[] | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    adminApi.userFlags(token, u.id).then((r) => setFlags(r.flags)).catch(() => setFlags([]));
  }, [token, u.id]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(26,16,53,0.35)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px,100%)", height: "100%", overflowY: "auto", background: "#F6F5FC", padding: "28px 28px 60px", boxShadow: "-16px 0 50px rgba(26,16,53,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{u.email}</div>
          <button onClick={onClose} style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", color: TEXT }}>×</button>
        </div>

        {/* Suspicion flags */}
        {flags && flags.length > 0 && (
          <div style={{ background: "rgba(245,154,46,0.12)", border: "1px solid rgba(245,154,46,0.4)", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#B06A10", marginBottom: 4 }}>⚠ Flags</div>
            {flags.map((f) => <div key={f} style={{ fontSize: 12.5, color: "#7A4A0C", fontFamily: "ui-monospace,monospace" }}>{f}</div>)}
          </div>
        )}

        {/* GDPR actions */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            disabled={busy !== ""}
            onClick={async () => {
              setBusy("export");
              try {
                const data = await adminApi.exportUser(token, u.id);
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `tetapi-user-${u.id.slice(0, 8)}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
              } finally { setBusy(""); }
            }}
            style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: 10, border: `1px solid ${INDIGO}40`, background: "rgba(91,69,201,0.08)", color: INDIGO, cursor: "pointer", fontFamily: "inherit" }}
          >
            {busy === "export" ? "Exporting…" : "⬇ GDPR export"}
          </button>
          {u.role !== "admin" && (
            <button
              disabled={busy !== ""}
              onClick={async () => {
                if (!confirm(`Anonymize ${u.email}? PII is wiped, entities unpublished. This cannot be undone.`)) return;
                setBusy("anon");
                try { await adminApi.anonymizeUser(token, u.id); onChanged(); }
                catch { alert("Anonymize failed"); }
                finally { setBusy(""); }
              }}
              style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(176,69,69,0.35)", background: "rgba(176,69,69,0.07)", color: "#B04545", cursor: "pointer", fontFamily: "inherit" }}
            >
              {busy === "anon" ? "Anonymizing…" : "✕ Anonymize (GDPR)"}
            </button>
          )}
        </div>

        <div style={{ ...glass, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: MUTED, marginBottom: 10 }}>Profile</div>
          {[
            ["ID", u.id], ["Name", u.full_name ?? "—"], ["Role", u.role], ["Provider", u.auth_provider],
            ["Active", String(u.is_active)], ["Agent", String(u.is_agent)],
            ["Created", fmtDate(u.created_at)], ["Updated", fmtDate(u.updated_at)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 12, fontSize: 13, padding: "4px 0" }}>
              <span style={{ color: MUTED, width: 90, flexShrink: 0 }}>{k}</span>
              <span style={{ color: TEXT, fontFamily: k === "ID" ? "ui-monospace,monospace" : "inherit", fontSize: k === "ID" ? 12 : 13, wordBreak: "break-all" }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ ...glass, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: MUTED, marginBottom: 10 }}>Entities ({detail.entities.length})</div>
          {detail.entities.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>None</div>}
          {detail.entities.map((e) => (
            <div key={e.id} style={{ padding: "10px 0", borderBottom: "1px solid rgba(26,16,53,0.06)" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{e.name} <span style={{ fontSize: 12, color: MUTED }}>({e.entity_type})</span></div>
              <div style={{ fontSize: 12, color: TEXT_SEC, marginTop: 3 }}>
                level: {e.verification_level} · registry: {e.registry_status} {e.registry_id ? `· ${e.registry_id}` : ""} {e.country ? `· ${e.country}` : ""}
              </div>
            </div>
          ))}
        </div>

        <div style={{ ...glass, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: MUTED, marginBottom: 10 }}>Verification events ({detail.verification_events.length})</div>
          {detail.verification_events.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>None</div>}
          {detail.verification_events.map((ev) => (
            <div key={ev.id} style={{ fontSize: 12.5, color: TEXT_SEC, padding: "6px 0", borderBottom: "1px solid rgba(26,16,53,0.05)" }}>
              <strong style={{ color: TEXT }}>{ev.event_type}</strong> · L{ev.level} · {ev.source} · {ev.ots_status}{ev.btc_block ? ` · block #${ev.btc_block}` : ""} · {fmtDate(ev.created_at)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Claims tab ────────────────────────────────────────────────────────────── */

function ClaimsTab({ token }: { token: string }) {
  const [data, setData] = useState<{ total: number; results: AdminClaim[] } | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    adminApi.claims(token, { offset }).then(setData).catch(() => {});
  }, [token, offset]);

  return (
    <div style={{ ...glass, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={th}>#</th><th style={th}>Email</th><th style={th}>Type</th><th style={th}>Ready to pay</th><th style={th}>Source</th><th style={th}>Date</th>
        </tr></thead>
        <tbody>
          {data?.results.map((c) => (
            <tr key={c.id}>
              <td style={{ ...td, fontFamily: "ui-monospace,monospace" }}>{c.position}</td>
              <td style={td}>{c.email}</td>
              <td style={td}>{c.entity_type}</td>
              <td style={td}>{c.ready_to_pay ? <Badge text="$21 LOCKED" color={SUN} /> : <span style={{ color: MUTED }}>—</span>}</td>
              <td style={{ ...td, fontSize: 12, color: TEXT_SEC }}>{c.source?.utm_source ?? c.source?.referrer ?? "—"}</td>
              <td style={td}>{fmtDate(c.created_at)}</td>
            </tr>
          ))}
          {data && data.results.length === 0 && (
            <tr><td style={{ ...td, color: MUTED }} colSpan={6}>No claims yet.</td></tr>
          )}
        </tbody>
      </table>
      {data && <Pager total={data.total} offset={offset} onOffset={setOffset} />}
    </div>
  );
}

/* ── Entities tab ──────────────────────────────────────────────────────────── */

function EntitiesTab({ token }: { token: string }) {
  const [data, setData] = useState<{ total: number; results: AdminEntity[] } | null>(null);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const [validating, setValidating] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi.entities(token, { q: q || undefined, offset }).then(setData).catch(() => {});
  }, [token, q, offset]);
  useEffect(load, [load]);

  return (
    <div style={{ ...glass, overflow: "hidden" }}>
      <div style={{ padding: "14px 14px 0" }}>
        <SearchBox onSearch={(v) => { setQ(v); setOffset(0); }} />
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
        <thead><tr>
          <th style={th}>Name</th><th style={th}>Type</th><th style={th}>Level</th><th style={th}>Registry</th><th style={th}>Owner</th><th style={th}>T / P</th><th style={th}>Created</th><th style={th}></th>
        </tr></thead>
        <tbody>
          {data?.results.map((e) => (
            <tr key={e.id}>
              <td style={td}>{e.name}<div style={{ fontSize: 11.5, color: MUTED }}>{e.slug}</div></td>
              <td style={td}>{e.entity_type}</td>
              <td style={td}><Badge text={e.verification_level.toUpperCase()} color={e.verification_level === "none" ? "#9088B0" : INDIGO} /></td>
              <td style={{ ...td, fontSize: 12.5 }}>{e.registry_status}{e.registry_id ? <div style={{ color: MUTED, fontSize: 11.5 }}>{e.registry_id}</div> : null}</td>
              <td style={{ ...td, fontSize: 12.5 }}>{e.owner_email ?? "—"}</td>
              <td style={{ ...td, fontFamily: "ui-monospace,monospace", fontSize: 12 }}>{(e.t_score ?? 0).toFixed(2)} / {(e.p_score ?? 0).toFixed(2)}</td>
              <td style={td}>{fmtDate(e.created_at)}</td>
              <td style={td}>
                <button
                  disabled={validating === e.id}
                  onClick={async () => {
                    setValidating(e.id);
                    try {
                      const r = await adminApi.validateEntity(token, e.id);
                      alert(r.status === "confirmed" ? `✓ Confirmed in registry (${r.matches} match)` : "⚠ Not found in any registry");
                      load();
                    } catch { alert("Validation failed"); }
                    finally { setValidating(null); }
                  }}
                  style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 9, border: `1px solid ${INDIGO}40`, background: "rgba(91,69,201,0.08)", color: INDIGO, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                >
                  {validating === e.id ? "…" : "Validate"}
                </button>
              </td>
            </tr>
          ))}
          {data && data.results.length === 0 && (
            <tr><td style={{ ...td, color: MUTED }} colSpan={8}>No entities found.</td></tr>
          )}
        </tbody>
      </table>
      {data && <Pager total={data.total} offset={offset} onOffset={setOffset} />}
    </div>
  );
}

/* ── Audit tab ─────────────────────────────────────────────────────────────── */

function AuditTab({ token }: { token: string }) {
  const [data, setData] = useState<{ total: number; results: AdminAuditEntry[] } | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    adminApi.auditLog(token, { offset }).then(setData).catch(() => {});
  }, [token, offset]);

  return (
    <div style={{ ...glass, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={th}>When</th><th style={th}>Actor</th><th style={th}>Action</th><th style={th}>Target</th>
        </tr></thead>
        <tbody>
          {data?.results.map((r) => (
            <tr key={r.id}>
              <td style={td}>{fmtDate(r.created_at)}</td>
              <td style={td}>{r.actor_email}</td>
              <td style={{ ...td, fontFamily: "ui-monospace,monospace", fontSize: 12.5 }}>{r.action}</td>
              <td style={{ ...td, fontSize: 12.5, color: TEXT_SEC }}>{r.target_type ? `${r.target_type} ${r.target_id ?? ""}` : "—"}</td>
            </tr>
          ))}
          {data && data.results.length === 0 && (
            <tr><td style={{ ...td, color: MUTED }} colSpan={4}>Empty.</td></tr>
          )}
        </tbody>
      </table>
      {data && <Pager total={data.total} offset={offset} onOffset={setOffset} pageSize={100} />}
    </div>
  );
}
