import { create } from "zustand";

export type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5;
export type AuthMode = "signup" | "signin";
export type SearchPhase = "idle" | "searching" | "none" | "results";
export type ProvePhase = "idle" | "proving" | "proven";
export type ProveMethod = "domain" | "contact" | "document";

export interface RegistryEntity {
  name: string;
  registryId: string;
  iso: string;
  authority: string;
  city: string;
  status: string;
  since: string;
}

interface OnboardingState {
  step: OnboardingStep;
  authMode: AuthMode;
  query: string;
  searchPhase: SearchPhase;
  entity: RegistryEntity | null;
  method: ProveMethod | null;
  provePhase: ProvePhase;
  code: string;
  officer: string | null;
  proven: boolean;
  authed: boolean;
  email: string;
  accountEmail: string;
  paired: boolean;

  setStep: (step: OnboardingStep) => void;
  setAuthMode: (mode: AuthMode) => void;
  setQuery: (q: string) => void;
  setSearchPhase: (phase: SearchPhase) => void;
  setEntity: (entity: RegistryEntity | null) => void;
  setMethod: (method: ProveMethod | null) => void;
  setProvePhase: (phase: ProvePhase) => void;
  setCode: (code: string) => void;
  setOfficer: (officer: string | null) => void;
  setProven: (proven: boolean) => void;
  setAuthed: (authed: boolean) => void;
  setEmail: (email: string) => void;
  setAccountEmail: (email: string) => void;
  setPaired: (paired: boolean) => void;
  reset: () => void;
}

const initial = {
  step: 0 as OnboardingStep,
  authMode: "signup" as AuthMode,
  query: "",
  searchPhase: "idle" as SearchPhase,
  entity: null,
  method: null,
  provePhase: "idle" as ProvePhase,
  code: "",
  officer: null,
  proven: false,
  authed: false,
  email: "",
  accountEmail: "",
  paired: false,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initial,
  setStep: (step) => set({ step }),
  setAuthMode: (authMode) => set({ authMode }),
  setQuery: (query) => set({ query }),
  setSearchPhase: (searchPhase) => set({ searchPhase }),
  setEntity: (entity) => set({ entity }),
  setMethod: (method) => set({ method }),
  setProvePhase: (provePhase) => set({ provePhase }),
  setCode: (code) => set({ code }),
  setOfficer: (officer) => set({ officer }),
  setProven: (proven) => set({ proven }),
  setAuthed: (authed) => set({ authed }),
  setEmail: (email) => set({ email }),
  setAccountEmail: (accountEmail) => set({ accountEmail }),
  setPaired: (paired) => set({ paired }),
  reset: () => set(initial),
}));
