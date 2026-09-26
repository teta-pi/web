"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import AppHeader, { APP_HEADER_H } from "@/components/AppHeader";
import { SpinnerIcon } from "@/components/ui/VerificationIcon";
import { ApiError, claimFlowApi, publicProfileApi } from "@/lib/api";
import {
  GR_INK, GR_BODY, GR_MUTED, GR_BORDER, GR_RAISED, GR_MONO_FONT, GR_TINT,
} from "@/components/GridOfRecord";

// One-click opt-out for a pre-verified-unclaimed profile (1.11/1.23, GTM
// Phase 2 guardrail: "instant opt-out/removal — no form, no login, no
// waiting"). This is the page behind the `opt_out_url` every outreach
// message carries: `/e/{slug}/opt-out?token=…`. The backend route takes the
// entity id, the link carries the slug, so the slug is resolved through the
// public payload first. One button, then a plain statement of what happened
// — never a default "success", every backend outcome gets its own honest
// text. Deliberately muted: no seal colors, nothing that reads as a sale.
//
// Auto-firing on page load was rejected on purpose: mail scanners and link
// previewers GET every URL in a message, and would opt profiles out on the
// recipient's behalf. The click is the consent.

type Stage =
  | { kind: "no_token" }
  | { kind: "resolving" }
  | { kind: "ready"; id: string; name: string }
  | { kind: "removing"; id: string; name: string }
  | { kind: "done"; name: string }
  | { kind: "gone" }            // by-slug/public 404: already opted out, claimed-then-hidden, or never existed
  | { kind: "invalid_token" }   // 403
  | { kind: "not_eligible" }    // 400: already opted out or since claimed
  | { kind: "not_found" }       // 404 on the POST itself
  | { kind: "error"; message: string };

export default function OptOutPage() {
  return (
    <Suspense fallback={null}>
      <OptOut />
    </Suspense>
  );
}

function OptOut() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const slug = params?.slug ?? "";
  const [stage, setStage] = useState<Stage>(token ? { kind: "resolving" } : { kind: "no_token" });

  useEffect(() => {
    if (!token || !slug) return;
    let cancelled = false;
    publicProfileApi.bySlug(slug)
      .then((p) => {
        if (cancelled) return;
        const id = typeof p.id === "string" ? p.id : null;
        if (!id) {
          // `id` on the public payload ships with api PR #32 (3.24); an API
          // older than that leaves this page unable to address the opt-out
          // route at all — say so instead of pretending.
          setStage({ kind: "error", message: "Couldn't resolve this profile's id. The link is right, the lookup isn't — write to hello@tetapi.dev and we'll remove it by hand." });
          return;
        }
        setStage({ kind: "ready", id, name: String(p.name ?? slug) });
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setStage({ kind: "gone" });
        else setStage({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong." });
      });
    return () => { cancelled = true; };
  }, [token, slug]);

  const remove = async () => {
    if (stage.kind !== "ready" || !token) return;
    const { id, name } = stage;
    setStage({ kind: "removing", id, name });
    try {
      await claimFlowApi.optOut(id, token);
      setStage({ kind: "done", name });
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setStage({ kind: "invalid_token" });
      else if (e instanceof ApiError && e.status === 400) setStage({ kind: "not_eligible" });
      else if (e instanceof ApiError && e.status === 404) setStage({ kind: "not_found" });
      else setStage({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong." });
    }
  };

  const label = (t: string) => (
    <div style={{ fontFamily: GR_MONO_FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: GR_MUTED, marginBottom: 16 }}>{t}</div>
  );
  const title = (t: string) => (
    <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.5px", lineHeight: 1.15, color: GR_INK, marginBottom: 10 }}>{t}</div>
  );
  const body = (children: React.ReactNode) => (
    <div style={{ fontSize: 15, fontWeight: 300, lineHeight: 1.6, color: GR_BODY, maxWidth: 520 }}>{children}</div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#EEF2FC 0%,#FBFAF4 50%,#EDF1FB 100%)", color: GR_INK, fontFamily: "'Manrope','Trebuchet MS','Segoe UI',sans-serif", position: "relative" }}>
      <AppHeader />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: `${APP_HEADER_H + 40}px 20px 80px` }}>
        <div style={{ background: "#fff", border: `1px solid ${GR_BORDER}`, padding: "32px 30px 30px" }}>

          {stage.kind === "no_token" && (<>
            {label("Opt-out link")}
            {title("This link is missing its opt-out token.")}
            {body(<>Use the exact link from the message you received — it ends in <code style={{ fontFamily: GR_MONO_FONT, fontSize: 13 }}>?token=…</code>. Nothing has been changed.</>)}
          </>)}

          {stage.kind === "resolving" && (<>
            {label("Opt-out")}
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: GR_MUTED, fontSize: 14 }}><SpinnerIcon size={14} /> Looking up the profile…</div>
          </>)}

          {(stage.kind === "ready" || stage.kind === "removing") && (<>
            {label("Pre-verified · Unclaimed")}
            {title(`Remove ${stage.name} from TETA+PI?`)}
            {body(<>
              This profile is a public-data snapshot TETA+PI compiled — not something you registered.
              Removing it unpublishes the page and its badge immediately. No account, no form, and
              nothing else happens: one click, done.
            </>)}
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 26, flexWrap: "wrap" }}>
              <button
                onClick={remove}
                disabled={stage.kind === "removing"}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 4,
                  border: `1px solid ${GR_INK}`, background: stage.kind === "removing" ? GR_TINT : GR_INK,
                  color: stage.kind === "removing" ? GR_MUTED : "#fff",
                  fontSize: 14.5, fontWeight: 600, fontFamily: "inherit", cursor: stage.kind === "removing" ? "default" : "pointer",
                }}
              >
                {stage.kind === "removing" ? <><SpinnerIcon size={14} /> Removing…</> : "Remove this profile"}
              </button>
              <Link href={`/e/${slug}`} style={{ fontSize: 13.5, color: GR_MUTED, textDecoration: "none" }}>View the profile first</Link>
            </div>
          </>)}

          {stage.kind === "done" && (<>
            {label("Opted out")}
            {title(`${stage.name} is no longer published.`)}
            {body(<>
              The page and badge are off, and the profile is marked <span style={{ fontFamily: GR_MONO_FONT, fontSize: 13 }}>opted_out</span> —
              it won&apos;t show in search or to agents. We keep the record itself (unpublished) as an audit trail of the removal.
              You won&apos;t hear from us about it again.
            </>)}
          </>)}

          {stage.kind === "gone" && (<>
            {label("Opt-out")}
            {title("Nothing to remove.")}
            {body(<>
              No public profile exists at <span style={{ fontFamily: GR_MONO_FONT, fontSize: 13 }}>/e/{slug}</span> — it&apos;s
              already opted out, or it was never there. If you clicked this link before, that&apos;s the earlier removal holding.
            </>)}
          </>)}

          {stage.kind === "invalid_token" && (<>
            {label("Opt-out")}
            {title("That token doesn't match this profile.")}
            {body(<>Nothing was changed. Use the exact link from the message you received; if it still fails, write to hello@tetapi.dev and we&apos;ll remove the profile by hand.</>)}
          </>)}

          {stage.kind === "not_eligible" && (<>
            {label("Opt-out")}
            {title("This profile can't be opted out any more.")}
            {body(<>It&apos;s either already removed, or it has since been claimed by an owner with a domain proof — in which case it&apos;s no longer a pre-verified snapshot. Nothing was changed.</>)}
          </>)}

          {stage.kind === "not_found" && (<>
            {label("Opt-out")}
            {title("Profile not found.")}
            {body(<>It was there a moment ago and isn&apos;t now — most likely removed in the meantime. Nothing further to do.</>)}
          </>)}

          {stage.kind === "error" && (<>
            {label("Opt-out")}
            {title("Couldn't complete the opt-out.")}
            {body(<>{stage.message}</>)}
          </>)}

          <div style={{ marginTop: 28, paddingTop: 16, borderTop: `1px solid ${GR_BORDER}`, background: GR_RAISED, margin: "28px -30px -30px", padding: "14px 30px 18px" }}>
            <div style={{ fontFamily: GR_MONO_FONT, fontSize: 10.5, color: GR_MUTED, lineHeight: 1.6 }}>
              Public data only · instant claim and instant opt-out · one message, no follow-ups.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
