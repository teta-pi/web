import { create } from "zustand";
import type { EntityKind } from "@/lib/types";

// 0 Type · 1 Identify · 2 Verify · 3 Camera · 4 Done · 5 Claim. There is no
// registry step: creation is registry-free (docs/verification-rework.md §1),
// and a registry match is an optional method the owner runs later from
// /profile. Step 5 is a branch, not a rail step: POST /businesses 409'd onto a
// pre-verified-unclaimed row (1.11), so the wizard turns into a
// domain-ownership claim of that row instead of creating a duplicate.
export type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5;
export type NameCheck = "idle" | "checking" | "taken" | "available";

export type { EntityKind };

export interface OnboardingEntity {
  name: string;
  iso: string;
}

// The 409 body from POST /businesses (see api.ts PreVerifiedConflict) plus
// the display name, so step 5 can say whose profile is being claimed.
export interface ClaimConflict {
  businessId: string;
  slug: string;
  name: string;
}

interface OnboardingState {
  step: OnboardingStep;
  entityKind: EntityKind | null;
  query: string;
  entity: OnboardingEntity | null;
  authed: boolean;
  accountEmail: string;
  paired: boolean;
  token: string | null;
  createdEntityId: string | null;
  claimConflict: ClaimConflict | null;
  // Slug the wizard was opened for from /e/[slug]'s "Is this you?" CTA
  // (`/claim?claim=<slug>`): name + kind are prefilled from the public
  // payload and the user lands on the email step straight away.
  claimingSlug: string | null;

  setStep: (step: OnboardingStep) => void;
  setEntityKind: (kind: EntityKind | null) => void;
  setQuery: (q: string) => void;
  setEntity: (entity: OnboardingEntity | null) => void;
  setAuthed: (authed: boolean) => void;
  setAccountEmail: (email: string) => void;
  setPaired: (paired: boolean) => void;
  setToken: (token: string | null) => void;
  setCreatedEntityId: (id: string | null) => void;
  setClaimConflict: (c: ClaimConflict | null) => void;
  setClaimingSlug: (slug: string | null) => void;
  reset: () => void;
}

const initial = {
  step: 0 as OnboardingStep,
  entityKind: null as EntityKind | null,
  query: "",
  entity: null as OnboardingEntity | null,
  authed: false,
  accountEmail: "",
  paired: false,
  token: null as string | null,
  createdEntityId: null as string | null,
  claimConflict: null as ClaimConflict | null,
  claimingSlug: null as string | null,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initial,
  setStep: (step) => set({ step }),
  setEntityKind: (entityKind) => set({ entityKind }),
  setQuery: (query) => set({ query }),
  setEntity: (entity) => set({ entity }),
  setAuthed: (authed) => set({ authed }),
  setAccountEmail: (accountEmail) => set({ accountEmail }),
  setPaired: (paired) => set({ paired }),
  setToken: (token) => set({ token }),
  setCreatedEntityId: (createdEntityId) => set({ createdEntityId }),
  setClaimConflict: (claimConflict) => set({ claimConflict }),
  setClaimingSlug: (claimingSlug) => set({ claimingSlug }),
  reset: () => set(initial),
}));
