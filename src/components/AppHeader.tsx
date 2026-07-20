"use client";

import { Wordmark } from "@/components/ui/Wordmark";
import AccountMenu from "@/components/AccountMenu";

// The banner's height is CSS var --banner-h (globals.css) — it changes on
// narrow viewports where the sentence wraps to two lines, so the header
// stacks below it via var(), never a hardcoded number (QA #8/#10/#24).
export const APP_HEADER_H = 64;

/** Fixed, translucent iOS-style app chrome: wordmark + account menu in one
 *  bar, replacing the old per-page floating logo + separately-fixed
 *  AccountMenu (which had no shared backdrop and could collide with the
 *  under-construction banner). Used on every "app" page — home, search,
 *  profile, settings, the public entity page. */
export default function AppHeader() {
  return (
    <div
      style={{
        position: "fixed",
        top: "var(--banner-h)",
        left: 0,
        right: 0,
        height: APP_HEADER_H,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        background: "rgba(255,255,255,0.55)",
        borderBottom: "1px solid rgba(255,255,255,0.7)",
        backdropFilter: "blur(16px) saturate(140%)",
        WebkitBackdropFilter: "blur(16px) saturate(140%)",
        boxShadow: "0 4px 20px rgba(45,55,120,0.06)",
      }}
    >
      <Wordmark size="sm" />
      <AccountMenu fixed={false} />
    </div>
  );
}
